// The sidebar popups' writes, the save path and a project's new worktree,
// with no `herdr` import so the repository's unit tests run them under Node.

import {
  addProject,
  CHANGED,
  moveProject,
  parseConfig,
  removeProject,
  serialize,
} from "./model.js";

// Marks a popup row's click handler as a write: it runs with the click and
// closes the popup itself once written. Other actions close it first.
export const writeAction = (handler) =>
  Object.assign(handler, { writes: true });

// A popup row's click.
export function clickItem(action, e, cx, { enabled, busy, close }) {
  if (!enabled || busy) return;
  if (action.writes) return action(e, cx);
  close();
  action();
}

// The project menu's row ids, in order, for the project at `at` of `count`:
// only the moves that apply.
export function projectMenuRows(at, count) {
  return [
    "space",
    ...(at > 0 ? ["up"] : []),
    ...(at < count - 1 ? ["down"] : []),
    "new",
    "remove",
  ];
}

// A sidebar popup's writes by row id. write(change) makes the row's click
// handler for an edit of projects.json; home expands "~".
export function menuWrites(p, home, write) {
  const w = (change) => writeAction(write(change));
  switch (p.menu) {
    case "project":
      return {
        up: w((doc) => moveProject(doc, p.project, -1, p.path)),
        down: w((doc) => moveProject(doc, p.project, 1, p.path)),
        remove: w((doc) => removeProject(doc, p.project, p.path)),
      };
    case "other":
      return p.path
        ? { "new-project": w((doc) => addProject(doc, p.path, home)) }
        : {};
    default:
      return {};
  }
}

// Reads projects.json, applies change(doc) and writes it only over the text
// it read. io: { read(), write(text, expected) }.
// Resolves { status: "written" }, { status: "conflict" } when projects.json
// changed meanwhile (nothing is overwritten), or { status: "error", message }.
export async function saveConfig(io, change) {
  const failed = (e) => ({ status: "error", message: String(e?.message ?? e) });
  let text, next;
  try {
    text = (await io.read()) ?? null;
    next = serialize(change(parseConfig(text)));
  } catch (e) {
    return e?.code === CHANGED ? { status: "conflict" } : failed(e);
  }
  try {
    await io.write(next, text);
    return { status: "written" };
  } catch (e) {
    // writeTextFile rejects a stale snapshot without a code: look again.
    let now;
    try {
      now = (await io.read()) ?? null;
    } catch {
      return failed(e);
    }
    return now !== text ? { status: "conflict" } : failed(e);
  }
}

const ADJECTIVES =
  "amber bold brave brisk calm clever crisp daring eager fond gentle glad golden happy hardy jolly keen kind lively lucky merry mighty nimble noble plucky proud quick quiet rapid shy sly steady sunny swift tidy witty".split(
    " ",
  );
const ANIMALS =
  "badger beaver bison crane cricket dingo dolphin eagle falcon ferret finch fox gecko heron ibis koala lemur lynx magpie marmot moose newt otter owl panda puffin quail raven robin seal sparrow stoat swan tapir toad walrus wombat yak".split(
    " ",
  );
const pick = (words, random) => words[Math.floor(random() * words.length)];
// Fetch and worktree add may take Herdr's longest exec: 10 minutes.
const LONG = 600_000;

// A random adjective-animal branch name, such as brave-otter.
export const branchName = (random = Math.random) =>
  `${pick(ADJECTIVES, random)}-${pick(ANIMALS, random)}`;

// Where worktrees go: settings.json's worktrees.directory (text, or null when
// there is none), default ~/.herdr/worktrees, checked as Herdr's shipped
// `worktree` mod checks it.
export function worktreeRoot(settingsText, home) {
  let settings;
  try {
    settings = settingsText === null ? {} : JSON.parse(settingsText);
  } catch (e) {
    throw new Error(`settings.json is not valid JSON: ${e.message}`);
  }
  const directory = settings?.worktrees?.directory ?? "~/.herdr/worktrees";
  if (typeof directory !== "string" || !directory.trim())
    throw new Error("worktrees.directory must be a non-empty path.");
  let path = directory.replace(/\\/g, "/");
  if (path === "~" || path.startsWith("~/"))
    path = home.replace(/\\/g, "/").replace(/\/$/, "") + path.slice(1);
  if (!path.startsWith("/") && !/^[A-Za-z]:\//.test(path))
    throw new Error(
      "worktrees.directory must be an absolute path or start with ~/.",
    );
  return path.replace(/\/+$/, "");
}

// A new worktree of the repo whose main checkout is dir (named name), on a
// free random branch cut from the freshly fetched origin default branch.
// io: { exec, settings() (settings.json text or null), home, random?, step?(text) }.
// Resolves { branch, path }; throws with git's error, having created nothing
// past the step that failed.
export async function newWorktree(io, dir, name) {
  const git = async (args, timeout) => {
    const r = await io.exec("git", args, {
      cwd: dir,
      ...(timeout ? { timeout } : {}),
    });
    return {
      ok: r.code === 0,
      out: (r.stdout ?? "").trim(),
      err: (r.stderr || r.stdout || "").trim(),
    };
  };
  const has = async (ref) =>
    (await git(["rev-parse", "--verify", "--quiet", ref])).ok;
  const root = worktreeRoot(await io.settings(), io.home);
  io.step?.("Fetching origin…");
  const fetched = await git(["fetch", "origin"], LONG);
  if (!fetched.ok) throw new Error(fetched.err || "git fetch origin failed.");
  const head = await git([
    "symbolic-ref",
    "--quiet",
    "--short",
    "refs/remotes/origin/HEAD",
  ]);
  let base = null;
  for (const b of [
    ...(head.ok ? [head.out.replace(/^origin\//, "")] : []),
    "main",
    "master",
  ])
    if (await has(`refs/remotes/origin/${b}`)) {
      base = b;
      break;
    }
  if (!base)
    throw new Error("origin has no default branch (HEAD, main or master).");
  let branch = null;
  let path;
  for (let tries = 0; tries < 20 && !branch; tries++) {
    const b = branchName(io.random);
    path = `${root}/${name}/${b}`;
    if (
      (await has(`refs/heads/${b}`)) ||
      (await has(`refs/remotes/origin/${b}`)) ||
      (await io.exec("test", ["-e", path])).code === 0
    )
      continue;
    branch = b;
  }
  if (!branch) throw new Error("No free branch name found. Try again.");
  io.step?.(`Adding ${branch} from origin/${base}…`);
  const added = await git(
    ["worktree", "add", "--no-track", "-b", branch, path, `origin/${base}`],
    LONG,
  );
  if (!added.ok) throw new Error(added.err || "git worktree add failed.");
  return { branch, path };
}
