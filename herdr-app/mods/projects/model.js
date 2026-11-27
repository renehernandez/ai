// Projects: config parsing, grouping and edits, shared by the `projects`
// sidebar and the `projects-edit` dialog. A mod imports only its own files, so
// each mod keeps an identical copy (a repository test compares them).
// No `herdr` import: the repository's unit tests run this under Node.
//
// projects.json: { "projects": [{ "path": "~/x" }] }
// A project is one local git repo, named after its folder. Edits keep unknown keys.

export const CONFIG_FILE = "projects.json";
// The `code` of the error an edit throws when its project moved meanwhile.
export const CHANGED = "projects-changed";
const SHAPE =
  'It must look like { "projects": [{ "path": "~/x" }] }. Delete it to start over.';

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value));
const base = (dir) => dir.split("/").pop() || dir;

// A path with "~" expanded with home (when known), forward slashes, no
// trailing slash.
export function expandPath(path, home) {
  let out = path.trim().replace(/\\/g, "/");
  if (home && (out === "~" || out.startsWith("~/")))
    out = home.replace(/\\/g, "/").replace(/\/+$/, "") + out.slice(1);
  return out.length > 1 ? out.replace(/\/+$/, "") : out;
}

// The other way: a folder under home written as "~/…".
export function tildePath(path, home) {
  if (!home) return path;
  const root = home.replace(/\\/g, "/").replace(/\/+$/, "");
  if (path === root) return "~";
  return path.startsWith(`${root}/`) ? `~${path.slice(root.length)}` : path;
}

// The main checkout of a checkout, from `git rev-parse --path-format=absolute
// --git-common-dir`: the folder holding .git (a bare repo is its own folder).
export function mainCheckout(commonDir) {
  const dir = commonDir.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return dir.endsWith("/.git") ? dir.slice(0, -5) : dir;
}

// Where a space's new tabs start: the top of the checkout its first terminal is
// in (git --show-toplevel), or undefined outside a repo.
export function tabFolder(git) {
  return git?.top || undefined;
}

// projects.json text to its document; throws a readable error for bad JSON or
// a bad shape. Missing or empty text is no projects yet.
export function parseConfig(text) {
  if (text === null || text === undefined || !text.trim())
    return { projects: [] };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new Error(`projects.json is not valid JSON: ${error.message}`);
  }
  if (!isObject(doc)) throw new Error(`projects.json: ${SHAPE}`);
  if (doc.projects === undefined) return { ...doc, projects: [] };
  if (!Array.isArray(doc.projects)) throw new Error(`projects.json: ${SHAPE}`);
  doc.projects.forEach((project, i) => {
    if (
      !isObject(project) ||
      typeof project.path !== "string" ||
      !project.path.trim()
    )
      throw new Error(`projects.json: projects[${i}] has no path. ${SHAPE}`);
  });
  return doc;
}

// The new document, or the last good one with the error when the text is bad.
export function loadConfig(text, previous) {
  try {
    return { doc: parseConfig(text), error: null };
  } catch (error) {
    return { doc: previous ?? { projects: [] }, error: error.message };
  }
}

// Projects each with its folder (dir, "~" expanded), its name (the folder's)
// and, when another project shares that name, its parent folder (`parent`).
// The first listing of a folder wins; each later one is an error.
export function resolveProjects(doc, home) {
  const seen = new Set();
  const errors = [];
  const projects = [];
  (doc.projects ?? []).forEach((project, index) => {
    const dir = expandPath(project.path, home);
    if (seen.has(dir)) {
      errors.push(
        `${project.path} is listed more than once; only its first listing is used.`,
      );
      return;
    }
    seen.add(dir);
    projects.push({ index, path: project.path, dir, name: base(dir) });
  });
  for (const p of projects)
    if (projects.some((o) => o !== p && o.name === p.name))
      p.parent = tildePath(p.dir.slice(0, -p.name.length - 1) || "/", home);
  return { projects, errors };
}

// Items (spaces or rows) under the project that owns them, the rest in `other`.
// dirOf(item): the main checkout of the item's local repo, or null.
// mains: a project's dir to its main checkout, once git says so.
export function groupSpaces(projects, items, dirOf, mains = {}) {
  const owner = new Map();
  for (const project of projects) {
    const main = mains[project.dir] ?? project.dir;
    if (!owner.has(main)) owner.set(main, project);
  }
  const under = new Map();
  const other = [];
  for (const item of items) {
    const project = owner.get(dirOf(item) ?? "");
    if (!project) other.push(item);
    else under.set(project, [...(under.get(project) ?? []), item]);
  }
  return {
    projects: projects.map((project) => ({
      ...project,
      spaces: under.get(project) ?? [],
    })),
    other,
  };
}

// What tells apart unnamed spaces of one group that share a name: space id to
// its active tab's name, when someone named that tab and no other such space
// shows it, else "#" and its index. Named spaces and unique names get none.
// spaces: [{ id, name, named, index, tab }], tab: the active tab's given name or null.
export function duplicateLabels(spaces) {
  const byName = new Map();
  for (const s of spaces)
    if (!s.named) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
  const out = {};
  for (const same of byName.values()) {
    if (same.length < 2) continue;
    for (const s of same)
      out[s.id] =
        s.tab && same.filter((o) => o.tab === s.tab).length === 1
          ? s.tab
          : `#${s.index}`;
  }
  return out;
}

// Edits: each returns a new document and keeps every key it doesn't change.
function edit(doc, change) {
  const next = copy(doc);
  next.projects ??= [];
  change(next.projects);
  return next;
}

// The project at index, still at the path the caller saw.
export function projectAt(doc, index, path) {
  const project = doc.projects?.[index];
  if (!project || (path !== undefined && project.path !== path))
    throw Object.assign(
      new Error("projects.json changed meanwhile. Try again."),
      { code: CHANGED },
    );
  return project;
}

// Adds the main checkout at path ("~/…" or absolute) as a project.
export function addProject(doc, path, home) {
  const clean = typeof path === "string" ? path.trim() : "";
  if (!clean) throw new Error("A project needs a folder.");
  const dir = expandPath(clean, home);
  if ((doc.projects ?? []).some((p) => expandPath(p.path, home) === dir))
    throw new Error(`${base(dir)} is already a project.`);
  return edit(doc, (projects) => {
    projects.push({ path: clean });
  });
}

export function moveProject(doc, index, by, expected) {
  projectAt(doc, index, expected);
  return edit(doc, (projects) => {
    const to = Math.max(0, Math.min(projects.length - 1, index + by));
    projects.splice(to, 0, projects.splice(index, 1)[0]);
  });
}

// Its spaces go back to Other; nothing closes.
export function removeProject(doc, index, expected) {
  projectAt(doc, index, expected);
  return edit(doc, (projects) => {
    projects.splice(index, 1);
  });
}

export function serialize(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
