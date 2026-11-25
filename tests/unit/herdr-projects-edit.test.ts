import assert from "node:assert/strict";
import test from "node:test";
import {
  clickItem,
  menuWrites,
  saveConfig,
} from "../../herdr-app/mods/projects-edit/edit.js";
import {
  CHANGED,
  parseConfig,
  removeProject,
  serialize,
} from "../../herdr-app/mods/projects-edit/model.js";

const HOMES: Record<string, string> = { "": "/Users/me", vps: "/home/me" };
type Change = (doc: unknown, homes: Record<string, string>) => unknown;
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
    homesFor: async (machines: string[]) => ({
      "": HOMES[""],
      ...Object.fromEntries(machines.map((m) => [m, HOMES[m]])),
    }),
  };
  return { file, io, doc: () => parseConfig(file.text) };
}

const TWO = {
  projects: [
    { name: "A", repos: [{ path: "~/x" }, { path: "~/y", machine: "vps" }] },
    { name: "B", repos: [] },
  ],
};

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
    ["A", "B"],
    (change: Change, machines?: string[]) => (_e: unknown, cx: typeof cx) =>
      cx.spawn(() => saveConfig(io, change, machines)),
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
  assert.deepEqual(await spawned[0], { status: "written" });
  assert.equal(closed, false, "a write closes the popup once written");
}

test("each sidebar menu write reaches projects.json", async () => {
  const names = (c: ReturnType<typeof config>) =>
    (c.doc().projects as { name: string }[]).map((p) => p.name);
  const project = (at: number, name: string) => ({
    menu: "project",
    project: at,
    name,
  });

  let c = config(TWO);
  await click(project(1, "B"), "up", c.io);
  assert.deepEqual(names(c), ["B", "A"]);

  c = config(TWO);
  await click(project(0, "A"), "down", c.io);
  assert.deepEqual(names(c), ["B", "A"]);

  c = config(TWO);
  await click(project(0, "A"), "remove", c.io);
  assert.deepEqual(names(c), ["B"]);

  c = config(TWO);
  await click(
    { menu: "repo", project: 0, name: "A", path: "~/y", machine: "vps" },
    "remove",
    c.io,
  );
  assert.deepEqual(c.doc().projects[0].repos, [{ path: "~/x" }]);

  c = config(TWO);
  await click(
    { menu: "other", space: "s1", machine: "vps", path: "~/z" },
    "add-1",
    c.io,
  );
  assert.deepEqual(c.doc().projects[1].repos, [
    { path: "~/z", machine: "vps" },
  ]);
  c = config(TWO);
  await click(
    { menu: "other", space: "s1", machine: null, path: "~/x" },
    "add-1",
    c.io,
  );
  assert.deepEqual(
    c.doc().projects.map((p: { repos: unknown[] }) => p.repos),
    [[{ path: "~/y", machine: "vps" }], [{ path: "~/x" }]],
    "a repo listed in another project moves",
  );
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
    menuWrites({ menu: "tab" }, ["A"], () => () => {}),
    {},
  );
});

test("an edit of a project that moved meanwhile is a conflict and writes nothing", async () => {
  const c = config(TWO);
  const before = c.file.text;
  assert.throws(
    () => removeProject(parseConfig(before), 0, "Renamed"),
    (error: { code?: string }) => error.code === CHANGED,
  );
  const result = await saveConfig(c.io, (doc: unknown) =>
    removeProject(doc, 0, "Renamed"),
  );
  assert.deepEqual(result, { status: "conflict" });
  assert.equal(c.file.text, before);
  assert.equal(c.file.writes, 0);
});

test("a rejected write is a conflict only when projects.json changed", async () => {
  // Changed meanwhile: the other edit stays.
  const c = config(TWO);
  const other = serialize({ projects: [{ name: "Theirs", repos: [] }] });
  const raced = {
    ...c.io,
    homesFor: async (machines: string[]) => {
      c.file.text = other;
      return c.io.homesFor(machines);
    },
  };
  assert.deepEqual(await saveConfig(raced, (doc: unknown) => doc), {
    status: "conflict",
  });
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

  const missing = config(TWO);
  missing.file.text = null;
  assert.deepEqual(await saveConfig(missing.io, () => ({ projects: [] })), {
    status: "written",
  });
  assert.equal(missing.file.text, '{\n  "projects": []\n}\n');
});
