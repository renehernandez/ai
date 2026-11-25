// Projects: config parsing, repo identity, grouping and edits, shared by the
// `projects` sidebar and the `projects-edit` dialog. A mod imports only its own
// files, so each mod keeps an identical copy (a repository test compares them).
// No `herdr` import: the repository's unit tests run this under Node.
//
// projects.json: { "projects": [{ "name": "AI", "repos": [{ "path": "~/x", "machine": "vps" }] }] }
// A repo may be a bare path string; edits write the object form and keep unknown keys.

export const CONFIG_FILE = "projects.json";
// The `code` of the error an edit throws when its project moved or was renamed.
export const CHANGED = "projects-changed";

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const machineOf = (machine) =>
  typeof machine === "string" && machine ? machine : null;
const copy = (value) => JSON.parse(JSON.stringify(value));

// A path on its machine: "~" expanded with that machine's home (when known),
// forward slashes, no trailing slash.
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

// A repo's identity: its machine (null for this computer) and main checkout folder.
export const repoKey = (machine, dir) =>
  JSON.stringify([machineOf(machine), dir]);

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

export function repoEntry(entry) {
  return typeof entry === "string"
    ? { path: entry, machine: null }
    : { path: entry.path, machine: machineOf(entry.machine) };
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
  if (!isObject(doc))
    throw new Error("projects.json must be an object with a projects list.");
  if (doc.projects === undefined) return { ...doc, projects: [] };
  if (!Array.isArray(doc.projects))
    throw new Error("projects.json: projects must be a list.");
  doc.projects.forEach((project, i) => {
    const at = `projects.json: projects[${i}]`;
    if (!isObject(project)) throw new Error(`${at} must be an object.`);
    if (typeof project.name !== "string" || !project.name.trim())
      throw new Error(`${at}.name must be a non-empty string.`);
    if (project.repos !== undefined && !Array.isArray(project.repos))
      throw new Error(`${at}.repos must be a list.`);
    (project.repos ?? []).forEach((repo, j) => {
      const where = `${at}.repos[${j}]`;
      if (typeof repo === "string") {
        if (!repo.trim()) throw new Error(`${where} must be a non-empty path.`);
        return;
      }
      if (!isObject(repo) || typeof repo.path !== "string" || !repo.path.trim())
        throw new Error(`${where} must be a path or an object with a path.`);
      if (
        repo.machine !== undefined &&
        repo.machine !== null &&
        typeof repo.machine !== "string"
      )
        throw new Error(`${where}.machine must be a machine name.`);
    });
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

// Projects with each repo once: its machine, its folder on that machine
// (homes: machine name, or "" for this computer, to its home) and its key.
// The first listing of a repo wins; each later one is an error.
export function resolveProjects(doc, homes = {}) {
  const seen = new Map();
  const errors = [];
  const projects = (doc.projects ?? []).map((project, index) => ({
    index,
    name: project.name,
    repos: (project.repos ?? []).flatMap((entry) => {
      const { path, machine } = repoEntry(entry);
      const dir = expandPath(path, homes[machine ?? ""]);
      const key = repoKey(machine, dir);
      if (seen.has(key)) {
        errors.push(
          `${path}${machine ? ` on ${machine}` : ""} is listed more than once; only its listing in ${seen.get(key)} is used.`,
        );
        return [];
      }
      seen.set(key, project.name);
      return [{ path, machine, dir, key }];
    }),
  }));
  return { projects, errors };
}

// Items (spaces or rows) under the repo that owns them, the rest in `other`.
// keyOf(item): the repoKey of the item's main checkout, or null outside a repo.
// mains: a configured repo's key to its main checkout's key, once git says so.
export function groupSpaces(projects, items, keyOf, mains = {}) {
  const owner = new Map();
  for (const project of projects)
    for (const repo of project.repos) {
      const main = mains[repo.key] ?? repo.key;
      if (!owner.has(main)) owner.set(main, repo);
    }
  const under = new Map();
  const other = [];
  for (const item of items) {
    const repo = owner.get(keyOf(item) ?? "");
    if (!repo) other.push(item);
    else under.set(repo, [...(under.get(repo) ?? []), item]);
  }
  return {
    projects: projects.map((project) => ({
      ...project,
      repos: project.repos.map((repo) => ({
        ...repo,
        spaces: under.get(repo) ?? [],
      })),
    })),
    other,
  };
}

// Edits: each returns a new document and keeps every key it doesn't change.
// Repos come out in object form.
function edit(doc, change) {
  const next = copy(doc);
  next.projects = (next.projects ?? []).map((project) => ({
    ...project,
    repos: (project.repos ?? []).map((entry) =>
      typeof entry === "string" ? { path: entry } : entry,
    ),
  }));
  change(next.projects);
  return next;
}

function cleanName(name) {
  const out = typeof name === "string" ? name.trim() : "";
  if (!out) throw new Error("A project needs a name.");
  return out;
}

function taken(projects, name, except = -1) {
  if (projects.some((project, i) => i !== except && project.name === name))
    throw new Error(`There is already a project named ${name}.`);
}

// The project at index, still named as the caller saw it.
export function projectAt(doc, index, name) {
  const project = doc.projects?.[index];
  if (!project || (name !== undefined && project.name !== name))
    throw Object.assign(
      new Error("projects.json changed meanwhile. Try again."),
      { code: CHANGED },
    );
  return project;
}

export function addProject(doc, name) {
  const clean = cleanName(name);
  return edit(doc, (projects) => {
    taken(projects, clean);
    projects.push({ name: clean, repos: [] });
  });
}

export function renameProject(doc, index, name, expected) {
  const clean = cleanName(name);
  projectAt(doc, index, expected);
  return edit(doc, (projects) => {
    taken(projects, clean, index);
    projects[index].name = clean;
  });
}

export function moveProject(doc, index, by, expected) {
  projectAt(doc, index, expected);
  return edit(doc, (projects) => {
    const to = Math.max(0, Math.min(projects.length - 1, index + by));
    projects.splice(to, 0, projects.splice(index, 1)[0]);
  });
}

// Its repos go back to Other; nothing closes.
export function removeProject(doc, index, expected) {
  projectAt(doc, index, expected);
  return edit(doc, (projects) => {
    projects.splice(index, 1);
  });
}

// Adds a repo ({ path, machine }) to the project at index. A repo is in one
// project only: listed anywhere else, it moves here (with its other keys).
export function addRepo(doc, index, repo, homes = {}, expected) {
  projectAt(doc, index, expected);
  const path = typeof repo?.path === "string" ? repo.path.trim() : "";
  if (!path) throw new Error("A repo needs a folder.");
  const machine = machineOf(repo.machine);
  const key = repoKey(machine, expandPath(path, homes[machine ?? ""]));
  const same = (entry) => {
    const e = repoEntry(entry);
    return (
      repoKey(e.machine, expandPath(e.path, homes[e.machine ?? ""])) === key
    );
  };
  return edit(doc, (projects) => {
    const here = projects[index].repos.find(same);
    let found = here;
    for (const project of projects)
      project.repos = project.repos.filter((entry) => {
        if (!same(entry) || entry === here) return true;
        found ??= entry;
        return false;
      });
    if (!here)
      projects[index].repos.push(
        found ?? { path, ...(machine ? { machine } : {}) },
      );
  });
}

// Removes a repo ({ path, machine }, as listed) from the project at index:
// every listing there with that path and machine, or the same expanded folder.
export function removeRepo(doc, index, repo, homes = {}, expected) {
  projectAt(doc, index, expected);
  const machine = machineOf(repo?.machine);
  const key = repoKey(
    machine,
    expandPath(repo?.path ?? "", homes[machine ?? ""]),
  );
  return edit(doc, (projects) => {
    projects[index].repos = projects[index].repos.filter((entry) => {
      const e = repoEntry(entry);
      if (e.machine === machine && e.path === repo?.path) return false;
      return (
        repoKey(e.machine, expandPath(e.path, homes[e.machine ?? ""])) !== key
      );
    });
  });
}

// The machines a document's repos are on (for their homes).
export function machinesIn(doc) {
  const out = new Set();
  for (const project of doc.projects ?? [])
    for (const entry of project.repos ?? []) {
      const { machine } = repoEntry(entry);
      if (machine) out.add(machine);
    }
  return [...out].sort();
}

export function serialize(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}
