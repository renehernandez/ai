import assert from "node:assert/strict";
import test from "node:test";
import {
  addProject,
  duplicateLabels,
  expandPath,
  groupSpaces,
  loadConfig,
  mainCheckout,
  moveProject,
  parseConfig,
  removeProject,
  resolveProjects,
  serialize,
  tabFolder,
  tildePath,
} from "../../herdr-app/mods/projects/model.js";

const HOME = "/Users/me";
const doc = (...paths: string[]) =>
  parseConfig(JSON.stringify({ projects: paths.map((path) => ({ path })) }));
const paths = (d: { projects: { path: string }[] }) =>
  d.projects.map((p) => p.path);

test("projects config reads folders and missing files", () => {
  assert.deepEqual(parseConfig(null), { projects: [] });
  assert.deepEqual(parseConfig(""), { projects: [] });
  assert.deepEqual(parseConfig("{}"), { projects: [] });
  const { projects, errors } = resolveProjects(doc("~/ai", "/srv/api/"), HOME);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    projects.map((p) => [p.index, p.name, p.dir, p.parent]),
    [
      [0, "ai", "/Users/me/ai", undefined],
      [1, "api", "/srv/api", undefined],
    ],
  );
});

test("tilde expands with home and folds back", () => {
  assert.equal(expandPath("~", "/Users/me"), "/Users/me");
  assert.equal(expandPath("~/x/", "/Users/me/"), "/Users/me/x");
  assert.equal(expandPath("~/x", undefined), "~/x");
  assert.equal(expandPath("/", "/Users/me"), "/");
  assert.equal(tildePath("/Users/me/x", "/Users/me"), "~/x");
  assert.equal(tildePath("/Users/meme/x", "/Users/me"), "/Users/meme/x");
  assert.equal(tildePath("/Users/me", "/Users/me"), "~");
});

test("an old-shape or bad projects config keeps the last good one and says to delete it", () => {
  const good = doc("~/ai");
  for (const [text, message] of [
    ["{", /not valid JSON/],
    ["[]", /Delete it to start over/],
    ['{"projects":{}}', /Delete it to start over/],
    [
      '{"projects":[{"name":"AI","repos":["~/ai"]}]}',
      /projects\[0\] has no path/,
    ],
    ['{"projects":[{"path":" "}]}', /"path": "~\/x"/],
  ] as const) {
    const result = loadConfig(text, good);
    assert.equal(result.doc, good);
    assert.match(result.error ?? "", message);
  }
  assert.deepEqual(loadConfig("{", undefined).doc, { projects: [] });
});

test("a folder listed twice keeps its first listing and reports the duplicate", () => {
  const { projects, errors } = resolveProjects(
    doc("~/x", "/Users/me/x/", "~/y"),
    HOME,
  );
  assert.deepEqual(
    projects.map((p) => [p.index, p.path]),
    [
      [0, "~/x"],
      [2, "~/y"],
    ],
  );
  assert.deepEqual(errors, [
    "/Users/me/x/ is listed more than once; only its first listing is used.",
  ]);
});

test("projects sharing a folder name show their parent folders", () => {
  const { projects } = resolveProjects(doc("~/a/app", "/srv/app", "~/b"), HOME);
  assert.deepEqual(
    projects.map((p) => [p.name, p.parent]),
    [
      ["app", "~/a"],
      ["app", "/srv"],
      ["b", undefined],
    ],
  );
});

test("spaces group under their repo's main checkout, the rest under Other", () => {
  const { projects } = resolveProjects(doc("~/x", "~/z"), HOME);
  const spaces = [
    { id: 1, main: mainCheckout("/Users/me/x/.git\n") }, // the main checkout
    { id: 2, main: "/Users/me/x" }, // a linked worktree of it
    { id: 3, main: "/Users/me/y" },
    { id: 4, main: null }, // not in a repo, or remote
    { id: 5, main: "/real/z" },
  ];
  // ~/z is a symlink: git names its main checkout /real/z.
  const mains = { "/Users/me/z": "/real/z" };
  const grouped = groupSpaces(projects, spaces, (s) => s.main, mains);
  assert.deepEqual(
    grouped.projects.map((p) => [p.name, p.spaces.map((s) => s.id)]),
    [
      ["x", [1, 2]],
      ["z", [5]],
    ],
  );
  assert.deepEqual(
    grouped.other.map((s) => s.id),
    [3, 4],
  );
});

test("main checkout and worktree root selection", () => {
  assert.equal(mainCheckout("/Users/me/x/.git\n"), "/Users/me/x");
  assert.equal(mainCheckout("/srv/bare.git"), "/srv/bare.git");
  assert.equal(
    tabFolder({ top: "/Users/me/wt/feature" }),
    "/Users/me/wt/feature",
  );
  assert.equal(tabFolder(null), undefined);
  assert.equal(tabFolder({ top: "" }), undefined);
});

test("project edits keep unknown keys and check the project they change", () => {
  const start = parseConfig(
    JSON.stringify({
      version: 2,
      projects: [{ path: "~/a", color: "red" }, { path: "~/b" }],
    }),
  );
  const added = addProject(start, " ~/c ", HOME);
  assert.deepEqual(added, {
    version: 2,
    projects: [{ path: "~/a", color: "red" }, { path: "~/b" }, { path: "~/c" }],
  });
  assert.equal(start.projects.length, 2, "the input is not changed");
  assert.deepEqual(paths(moveProject(added, 0, 1, "~/a")), [
    "~/b",
    "~/a",
    "~/c",
  ]);
  assert.deepEqual(paths(moveProject(added, 0, -1, "~/a")), [
    "~/a",
    "~/b",
    "~/c",
  ]);
  assert.deepEqual(paths(removeProject(added, 0, "~/a")), ["~/b", "~/c"]);
  assert.throws(() => removeProject(added, 0, "~/b"), /changed meanwhile/);
  assert.throws(() => moveProject(added, 5, 1), /changed meanwhile/);
  assert.equal(serialize({ projects: [] }), '{\n  "projects": []\n}\n');
});

test("adding a folder that already is a project compares expanded folders", () => {
  const start = doc("/Users/me/a");
  assert.throws(() => addProject(start, "~/a", HOME), /a is already a project/);
  assert.throws(() => addProject(start, "~/a/", HOME), /already a project/);
  assert.throws(() => addProject(start, "  ", HOME), /needs a folder/);
  assert.deepEqual(paths(addProject(start, "~/b", HOME)), [
    "/Users/me/a",
    "~/b",
  ]);
});

test("unnamed spaces sharing a name get a tab name or their index", () => {
  const space = (
    id: string,
    name: string,
    index: number,
    tab: string | null = null,
    named = false,
  ) => ({ id, name, named, index, tab });
  assert.deepEqual(
    duplicateLabels([
      space("a", "app", 1, "review"),
      space("b", "app", 2),
      space("c", "app", 3, "π - app"),
      space("d", "app", 4, "π - app"),
      space("e", "app", 5, null, true),
      space("f", "api", 6),
    ]),
    { a: "review", b: "#2", c: "#3", d: "#4" },
    "a shared tab name falls back to the index; named and unique spaces get none",
  );
  assert.deepEqual(
    duplicateLabels([space("a", "app", 1), space("b", "app", 2, null, true)]),
    {},
    "one unnamed space beside a named one needs no label",
  );
});
