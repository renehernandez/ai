import assert from "node:assert/strict";
import test from "node:test";
import {
  addProject,
  addRepo,
  expandPath,
  groupSpaces,
  loadConfig,
  mainCheckout,
  moveProject,
  parseConfig,
  removeProject,
  removeRepo,
  renameProject,
  repoKey,
  resolveProjects,
  serialize,
  tabFolder,
  tildePath,
} from "../../herdr-app/mods/projects/model.js";

const HOMES = { "": "/Users/me", vps: "/home/me" };

test("projects config accepts string and object repos and missing files", () => {
  assert.deepEqual(parseConfig(null), { projects: [] });
  assert.deepEqual(parseConfig(""), { projects: [] });
  const { projects, errors } = resolveProjects(
    parseConfig(
      JSON.stringify({
        projects: [
          {
            name: "AI",
            repos: ["~/ai", { path: "~/deploy/", machine: "vps" }],
          },
          { name: "Empty" },
        ],
      }),
    ),
    HOMES,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    projects.map((p) => [p.name, p.repos.map((r) => [r.machine, r.dir])]),
    [
      [
        "AI",
        [
          [null, "/Users/me/ai"],
          ["vps", "/home/me/deploy"],
        ],
      ],
      ["Empty", []],
    ],
  );
});

test("tilde expands with each machine's home and folds back", () => {
  assert.equal(expandPath("~", "/Users/me"), "/Users/me");
  assert.equal(expandPath("~/x/", "/Users/me/"), "/Users/me/x");
  assert.equal(expandPath("~/x", undefined), "~/x");
  assert.equal(expandPath("/", "/Users/me"), "/");
  assert.equal(tildePath("/Users/me/x", "/Users/me"), "~/x");
  assert.equal(tildePath("/Users/meme/x", "/Users/me"), "/Users/meme/x");
  assert.equal(tildePath("/Users/me", "/Users/me"), "~");
});

test("invalid projects config keeps the last good config with a readable error", () => {
  const good = parseConfig('{"projects":[{"name":"AI","repos":["~/ai"]}]}');
  for (const [text, message] of [
    ["{", /not valid JSON/],
    ["[]", /must be an object/],
    ['{"projects":{}}', /projects must be a list/],
    ['{"projects":[{"repos":[]}]}', /projects\[0\]\.name/],
    ['{"projects":[{"name":"A","repos":[3]}]}', /repos\[0\] must be a path/],
    [
      '{"projects":[{"name":"A","repos":[{"path":"~/a","machine":2}]}]}',
      /machine must be a machine name/,
    ],
  ] as const) {
    const result = loadConfig(text, good);
    assert.equal(result.doc, good);
    assert.match(result.error ?? "", message);
  }
  assert.deepEqual(loadConfig("{", undefined).doc, { projects: [] });
});

test("a repo listed twice keeps its first listing and reports the duplicate", () => {
  const doc = parseConfig(
    JSON.stringify({
      projects: [
        { name: "A", repos: ["~/x"] },
        {
          name: "B",
          repos: ["/Users/me/x/", "~/y", { path: "~/x", machine: "vps" }],
        },
      ],
    }),
  );
  const { projects, errors } = resolveProjects(doc, HOMES);
  assert.deepEqual(
    projects.map((p) => p.repos.map((r) => r.path)),
    [["~/x"], ["~/y", "~/x"]],
  );
  assert.deepEqual(errors, [
    "/Users/me/x/ is listed more than once; only its listing in A is used.",
  ]);
});

test("spaces group under their repo's main checkout, the rest under Other", () => {
  const doc = parseConfig(
    JSON.stringify({
      projects: [
        { name: "A", repos: ["~/x", "~/z"] },
        { name: "B", repos: [{ path: "~/y", machine: "vps" }] },
      ],
    }),
  );
  const { projects } = resolveProjects(doc, HOMES);
  const spaces = [
    { id: 1, key: repoKey(null, mainCheckout("/Users/me/x/.git\n")) },
    { id: 2, key: repoKey(null, "/Users/me/x") },
    { id: 3, key: repoKey("vps", "/home/me/y") },
    { id: 4, key: repoKey(null, "/Users/me/y") },
    { id: 5, key: null },
    { id: 6, key: repoKey(null, "/real/x") },
  ];
  // ~/z is a symlink: git names its main checkout /real/z, with no space open.
  const mains = { [repoKey(null, "/Users/me/z")]: repoKey(null, "/real/z") };
  const grouped = groupSpaces(projects, spaces, (s) => s.key, mains);
  assert.deepEqual(
    grouped.projects.map((p) => [
      p.name,
      p.repos.map((r) => [r.path, r.spaces.map((s) => s.id)]),
    ]),
    [
      [
        "A",
        [
          ["~/x", [1, 2]],
          ["~/z", []],
        ],
      ],
      ["B", [["~/y", [3]]]],
    ],
  );
  assert.deepEqual(
    grouped.other.map((s) => s.id),
    [4, 5, 6],
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

test("project edits keep unknown keys and write object repos", () => {
  const doc = parseConfig(
    JSON.stringify({
      version: 2,
      projects: [
        {
          name: "A",
          color: "red",
          repos: ["~/x", { path: "~/y", pinned: true }],
        },
        { name: "B", repos: [] },
      ],
    }),
  );
  const renamed = renameProject(doc, 0, " Alpha ", "A");
  assert.deepEqual(renamed, {
    version: 2,
    projects: [
      {
        name: "Alpha",
        color: "red",
        repos: [{ path: "~/x" }, { path: "~/y", pinned: true }],
      },
      { name: "B", repos: [] },
    ],
  });
  assert.deepEqual(doc.projects[0].repos[0], "~/x", "the input is not changed");
  assert.deepEqual(
    moveProject(renamed, 0, 1, "Alpha").projects.map(
      (p: { name: string }) => p.name,
    ),
    ["B", "Alpha"],
  );
  assert.deepEqual(
    moveProject(renamed, 0, -1, "Alpha").projects.map(
      (p: { name: string }) => p.name,
    ),
    ["Alpha", "B"],
  );
  const added = addProject(renamed, "C");
  assert.deepEqual(added.projects.at(-1), { name: "C", repos: [] });
  assert.equal(added.version, 2);
  assert.deepEqual(
    removeProject(added, 0, "Alpha").projects.map(
      (p: { name: string }) => p.name,
    ),
    ["B", "C"],
  );
  assert.throws(() => addProject(renamed, "B"), /already a project named B/);
  assert.throws(() => addProject(renamed, "  "), /needs a name/);
  assert.throws(
    () => renameProject(renamed, 1, "Alpha", "B"),
    /already a project/,
  );
  assert.throws(() => removeProject(renamed, 0, "A"), /changed meanwhile/);
  assert.equal(serialize({ projects: [] }), '{\n  "projects": []\n}\n');
});

test("adding a repo listed in another project moves it with its keys", () => {
  const doc = parseConfig(
    JSON.stringify({
      projects: [
        { name: "A", repos: [] },
        { name: "B", repos: [{ path: "/Users/me/x", pinned: true }, "~/y"] },
      ],
    }),
  );
  const moved = addRepo(doc, 0, { path: "~/x", machine: null }, HOMES, "A");
  assert.deepEqual(moved.projects, [
    { name: "A", repos: [{ path: "/Users/me/x", pinned: true }] },
    { name: "B", repos: [{ path: "~/y" }] },
  ]);
  assert.deepEqual(addRepo(moved, 0, { path: "~/x" }, HOMES, "A"), moved);
  const remote = addRepo(moved, 1, { path: "~/x", machine: "vps" }, HOMES, "B");
  assert.deepEqual(remote.projects[1].repos, [
    { path: "~/y" },
    { path: "~/x", machine: "vps" },
  ]);
  assert.throws(() => addRepo(doc, 0, { path: " " }, HOMES), /needs a folder/);
});

test("removing a repo matches its listing or its expanded folder", () => {
  const doc = parseConfig(
    JSON.stringify({
      projects: [
        {
          name: "A",
          repos: ["~/x", { path: "~/x", machine: "vps" }, "~/far"],
        },
      ],
    }),
  );
  assert.deepEqual(
    removeRepo(doc, 0, { path: "/Users/me/x", machine: null }, HOMES, "A")
      .projects[0].repos,
    [{ path: "~/x", machine: "vps" }, { path: "~/far" }],
  );
  // The machine's home is unknown: its listing still matches.
  assert.deepEqual(
    removeRepo(
      doc,
      0,
      { path: "~/x", machine: "vps" },
      { "": "/Users/me" },
      "A",
    ).projects[0].repos,
    [{ path: "~/x" }, { path: "~/far" }],
  );
});
