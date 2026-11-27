import assert from "node:assert/strict";
import test from "node:test";
import {
  branchName,
  clickItem,
  menuWrites,
  newWorktree,
  projectMenuRows,
  saveConfig,
  worktreeRoot,
} from "../../herdr-app/mods/projects-edit/edit.js";
import {
  CHANGED,
  parseConfig,
  removeProject,
  serialize,
} from "../../herdr-app/mods/projects-edit/model.js";

const HOME = "/Users/me";
type Change = (doc: unknown) => unknown;
type Popup = Record<string, unknown> & { menu: string };

// projects.json in memory; write behaves like writeTextFile's stale check.
function config(doc: unknown, { failWrite = null as Error | null } = {}) {
  const file = { text: serialize(doc) as string | null, writes: 0 };
  const io = {
    read: async () => file.text,
    write: async (text: string, expected: string | null) => {
      if (failWrite) throw failWrite;
      if (expected !== file.text) throw new Error("snapshot is stale");
      file.text = text;
      file.writes += 1;
    },
  };
  return { file, io, doc: () => parseConfig(file.text) };
}

const TWO = { projects: [{ path: "~/a" }, { path: "~/b" }] };
const paths = (c: ReturnType<typeof config>) =>
  (c.doc().projects as { path: string }[]).map((p) => p.path);

// Clicks a popup row the way the mod's item() does, with write handlers
// shaped like the mod's: (_e, cx) => cx.spawn(...).
async function click(
  p: Popup,
  id: string,
  io: ReturnType<typeof config>["io"],
) {
  const spawned: Promise<unknown>[] = [];
  const cx = { spawn: (task: () => Promise<unknown>) => spawned.push(task()) };
  let closed = false;
  const writes = menuWrites(
    p,
    HOME,
    (change: Change) => (_e: unknown, cx: typeof cx) =>
      cx.spawn(() => saveConfig(io, change)),
  );
  const action = writes[id];
  assert.ok(action, `${p.menu} has a ${id} write`);
  assert.equal(action.writes, true);
  clickItem(action, {}, cx, {
    enabled: true,
    busy: false,
    close: () => {
      closed = true;
    },
  });
  assert.equal(spawned.length, 1, `${id} starts its write`);
  const result = await spawned[0];
  assert.equal(closed, false, "a write closes the popup once written");
  return result;
}

test("each sidebar menu write reaches projects.json", async () => {
  const project = (at: number, path: string) => ({
    menu: "project",
    project: at,
    path,
  });

  let c = config(TWO);
  assert.deepEqual(await click(project(1, "~/b"), "up", c.io), {
    status: "written",
  });
  assert.deepEqual(paths(c), ["~/b", "~/a"]);

  c = config(TWO);
  await click(project(0, "~/a"), "down", c.io);
  assert.deepEqual(paths(c), ["~/b", "~/a"]);

  c = config(TWO);
  await click(project(0, "~/a"), "remove", c.io);
  assert.deepEqual(paths(c), ["~/b"]);

  c = config(TWO);
  await click({ menu: "other", space: "s1", path: "~/z" }, "new-project", c.io);
  assert.deepEqual(paths(c), ["~/a", "~/b", "~/z"]);

  c = config(TWO);
  const again = await click(
    { menu: "other", space: "s1", path: "/Users/me/a" },
    "new-project",
    c.io,
  );
  assert.deepEqual(again, {
    status: "error",
    message: "a is already a project.",
  });
  assert.equal(c.file.writes, 0);

  assert.deepEqual(
    menuWrites({ menu: "other", space: "s1" }, HOME, () => () => {}),
    {},
    "a space outside a repo has no project to make",
  );
});

test("the project menu starts with New space and offers only the moves that apply", () => {
  const rest = ["new", "remove"];
  assert.deepEqual(projectMenuRows(0, 1), ["space", ...rest]);
  assert.deepEqual(projectMenuRows(0, 3), ["space", "down", ...rest]);
  assert.deepEqual(projectMenuRows(1, 3), ["space", "up", "down", ...rest]);
  assert.deepEqual(projectMenuRows(2, 3), ["space", "up", ...rest]);
});

// ---- a project's new worktree ----

const ROOT = "/Users/me/.herdr/worktrees";
type Call = { cmd: string; args: string[]; cwd?: string; timeout?: number };

// A fake exec over a repo at /src/ai: refs that exist, folders that exist,
// and answers that override one git subcommand ("fetch", "worktree", ...).
function repo({
  refs = ["refs/remotes/origin/main"],
  originHead = "origin/main" as string | null,
  folders = [] as string[],
  fail = {} as Record<string, string>,
} = {}) {
  const calls: Call[] = [];
  const steps: string[] = [];
  const result = (code: number, stdout = "", stderr = "") => ({
    code,
    stdout,
    stderr,
  });
  const exec = async (
    cmd: string,
    args: string[],
    opts: { cwd?: string; timeout?: number } = {},
  ) => {
    calls.push({ cmd, args, ...opts });
    if (cmd === "test") return result(folders.includes(args[1]) ? 0 : 1);
    if (fail[args[0]]) return result(1, "", fail[args[0]]);
    if (args[0] === "symbolic-ref")
      return originHead ? result(0, `${originHead}\n`) : result(1);
    if (args[0] === "rev-parse") return result(refs.includes(args[3]) ? 0 : 1);
    return result(0);
  };
  // Each random() call returns the next number, cycling.
  const randoms = (...ns: number[]) => {
    let i = 0;
    return () => ns[i++ % ns.length];
  };
  const io = (settings: string | null = null, random = randoms(0)) => ({
    exec,
    home: HOME,
    settings: async () => settings,
    random,
    step: (text: string) => steps.push(text),
  });
  return { calls, steps, io, randoms };
}

const first = branchName(() => 0);

test("a new worktree fetches origin, then branches from its default branch", async () => {
  const r = repo();
  const made = await newWorktree(r.io(), "/src/ai", "ai");
  const path = `${ROOT}/ai/${first}`;
  assert.deepEqual(made, { branch: first, path });
  assert.match(first, /^[a-z]+-[a-z]+$/);
  const git = r.calls.filter((c) => c.cmd === "git");
  assert.ok(git.every((c) => c.cwd === "/src/ai"));
  assert.deepEqual(git[0], {
    cmd: "git",
    args: ["fetch", "origin"],
    cwd: "/src/ai",
    timeout: 600_000,
  });
  assert.deepEqual(git.at(-1), {
    cmd: "git",
    args: ["worktree", "add", "--no-track", "-b", first, path, "origin/main"],
    cwd: "/src/ai",
    timeout: 600_000,
  });
  assert.deepEqual(r.steps, [
    "Fetching origin…",
    `Adding ${first} from origin/main…`,
  ]);
});

test("the default branch is origin/HEAD, else main, else master", async () => {
  const base = async (opts: Parameters<typeof repo>[0]) => {
    const r = repo(opts);
    await newWorktree(r.io(), "/src/ai", "ai");
    return r.calls.at(-1)?.args.at(-1);
  };
  assert.equal(
    await base({
      refs: ["refs/remotes/origin/trunk"],
      originHead: "origin/trunk",
    }),
    "origin/trunk",
  );
  assert.equal(
    await base({ refs: ["refs/remotes/origin/main"], originHead: null }),
    "origin/main",
  );
  assert.equal(
    await base({ refs: ["refs/remotes/origin/master"], originHead: null }),
    "origin/master",
  );
  const r = repo({ refs: [], originHead: null });
  await assert.rejects(
    newWorktree(r.io(), "/src/ai", "ai"),
    /no default branch/,
  );
  assert.ok(!r.calls.some((c) => c.args[0] === "worktree"));
});

test("a branch name taken locally, on origin or by a folder is drawn again", async () => {
  // random() pairs: (0, 0) is `first`; (0.5, 0.5) is another name.
  const other = branchName(() => 0.5);
  for (const taken of [
    { refs: ["refs/remotes/origin/main", `refs/heads/${first}`] },
    { refs: ["refs/remotes/origin/main", `refs/remotes/origin/${first}`] },
    { folders: [`${ROOT}/ai/${first}`] },
  ]) {
    const r = repo(taken);
    const made = await newWorktree(
      r.io(null, r.randoms(0, 0, 0.5, 0.5)),
      "/src/ai",
      "ai",
    );
    assert.equal(made.branch, other);
  }
  const r = repo({ refs: ["refs/remotes/origin/main", `refs/heads/${first}`] });
  await assert.rejects(
    newWorktree(r.io(), "/src/ai", "ai"),
    /No free branch name/,
  );
  assert.ok(!r.calls.some((c) => c.args[0] === "worktree"));
});

test("a failed fetch or add reports git's error", async () => {
  let r = repo({ fail: { fetch: "fatal: could not read from remote" } });
  await assert.rejects(
    newWorktree(r.io(), "/src/ai", "ai"),
    /could not read from remote/,
  );
  assert.equal(r.calls.length, 1, "nothing after the fetch");
  r = repo({ fail: { worktree: "fatal: already exists" } });
  await assert.rejects(newWorktree(r.io(), "/src/ai", "ai"), /already exists/);
});

test("worktrees go where settings.json's worktrees.directory says", async () => {
  assert.equal(worktreeRoot(null, HOME), ROOT);
  assert.equal(
    worktreeRoot('{"worktrees":{"directory":"~/wt/"}}', HOME),
    "/Users/me/wt",
  );
  assert.equal(
    worktreeRoot('{"worktrees":{"directory":"/srv/wt"}}', HOME),
    "/srv/wt",
  );
  for (const [text, message] of [
    ['{"worktrees":{"directory":"wt"}}', /absolute path/],
    ['{"worktrees":{"directory":" "}}', /non-empty/],
    ["{ nope", /settings.json is not valid JSON/],
  ] as const) {
    assert.throws(() => worktreeRoot(text, HOME), message);
    const r = repo();
    await assert.rejects(newWorktree(r.io(text), "/src/ai", "ai"), message);
    assert.equal(r.calls.length, 0, "a bad setting runs no git");
  }
});

test("a popup row does nothing while disabled or busy, and other actions close first", () => {
  const calls: string[] = [];
  const close = () => calls.push("close");
  const write = Object.assign(() => calls.push("write"), { writes: true });
  clickItem(write, {}, {}, { enabled: false, busy: false, close });
  clickItem(write, {}, {}, { enabled: true, busy: true, close });
  assert.deepEqual(calls, []);
  clickItem(
    () => calls.push("open"),
    {},
    {},
    {
      enabled: true,
      busy: false,
      close,
    },
  );
  assert.deepEqual(calls, ["close", "open"]);
  assert.deepEqual(
    menuWrites({ menu: "tab" }, HOME, () => () => {}),
    {},
  );
});

test("an edit of a project that moved meanwhile is a conflict and writes nothing", async () => {
  const c = config(TWO);
  const before = c.file.text;
  assert.throws(
    () => removeProject(parseConfig(before), 0, "~/b"),
    (error: { code?: string }) => error.code === CHANGED,
  );
  const result = await saveConfig(c.io, (doc: unknown) =>
    removeProject(doc, 0, "~/b"),
  );
  assert.deepEqual(result, { status: "conflict" });
  assert.equal(c.file.text, before);
  assert.equal(c.file.writes, 0);
});

test("a rejected write is a conflict only when projects.json changed", async () => {
  // Changed meanwhile: the other edit stays.
  const c = config(TWO);
  const other = serialize({ projects: [{ path: "~/theirs" }] });
  assert.deepEqual(
    await saveConfig(c.io, (doc: unknown) => {
      c.file.text = other;
      return doc;
    }),
    { status: "conflict" },
  );
  assert.equal(c.file.text, other);

  // Unchanged: the real error, whatever its wording.
  const denied = config(TWO, {
    failWrite: new Error("does not match: permission denied"),
  });
  assert.deepEqual(await saveConfig(denied.io, (doc: unknown) => doc), {
    status: "error",
    message: "does not match: permission denied",
  });

  // Unreadable after the rejection: the write's error.
  const gone = config(TWO, { failWrite: new Error("disk full") });
  let reads = 0;
  const flaky = {
    ...gone.io,
    read: async () => {
      reads += 1;
      if (reads > 1) throw new Error("unreadable");
      return gone.file.text;
    },
  };
  assert.deepEqual(await saveConfig(flaky, (doc: unknown) => doc), {
    status: "error",
    message: "disk full",
  });
});

test("other save failures show their own error", async () => {
  const bad = config(TWO);
  bad.file.text = "{";
  const result = await saveConfig(bad.io, (doc: unknown) => doc);
  assert.equal(result.status, "error");
  assert.match(result.message, /not valid JSON/);
  assert.equal(bad.file.text, "{");

  const old = config(TWO);
  old.file.text = serialize({ projects: [{ name: "ai", repos: [] }] });
  const blocked = await saveConfig(old.io, (doc: unknown) => doc);
  assert.equal(blocked.status, "error");
  assert.match(blocked.message, /Delete it to start over/);
  assert.equal(old.file.writes, 0, "an old-shape file blocks every save");

  const missing = config(TWO);
  missing.file.text = null;
  assert.deepEqual(await saveConfig(missing.io, () => ({ projects: [] })), {
    status: "written",
  });
  assert.equal(missing.file.text, '{\n  "projects": []\n}\n');
});
