import assert from "node:assert/strict";
import test from "node:test";
import {
  clickItem,
  menuWrites,
  projectMenuRows,
  saveConfig,
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

test("the project menu offers only the moves that apply", () => {
  const rest = ["new", "remove"];
  assert.deepEqual(projectMenuRows(0, 1), rest);
  assert.deepEqual(projectMenuRows(0, 3), ["down", ...rest]);
  assert.deepEqual(projectMenuRows(1, 3), ["up", "down", ...rest]);
  assert.deepEqual(projectMenuRows(2, 3), ["up", ...rest]);
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
