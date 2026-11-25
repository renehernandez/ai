// Headless load test for the `projects` and `projects-edit` Herdr mods.
//
// Imports each mod's main.js with stubbed `herdr`, `gpui-kit` and `gpui-base`
// modules, constructs its view, runs `init` and `render`, and asserts that
// every import and member the mods touch is on Herdr 0.1.16's documented
// surface (herdr.d.ts, gpui-kit.d.ts). The allow-lists below are reviewed
// copies of that surface; when Herdr's type files are installed, the last
// test checks every listed name against them.
//
// It does not prove real rendering, layout, scrolling or Herdr's own mod
// loader: the stubs record calls and never draw.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// ---- the documented surface the stubs allow ----

// Every runtime export of herdr.d.ts (Herdr 0.1.16).
const HERDR_EXPORTS = [
  "exec",
  "hc",
  "home",
  "appHome",
  "checking",
  "readTextFile",
  "writeTextFile",
  "knownAgents",
  "pickFolder",
  "playSound",
  "run",
  "machines",
  "spaces",
  "agents",
  "panes",
  "setAgentOrder",
  "terminals",
  "focused",
  "layout",
  "layouts",
  "commands",
  "window",
  "setWindowTitle",
  "setBadge",
  "placement",
  "theme",
  "themes",
  "fonts",
  "updates",
  "presentUpdateNotes",
  "telemetry",
  "feedbackPreview",
  "feedbackPasteImage",
  "feedbackPickImages",
  "feedbackAttachImages",
  "feedbackClearImages",
  "sendFeedback",
  "settings",
  "keys",
  "openOverlay",
  "closeOverlay",
  "notify",
  "props",
  "shared",
  "setShared",
  "nextCommand",
  "watchFolder",
];
// The gpui-kit.d.ts exports the stubs provide; a mod importing another fails to link.
const GPUI_KIT_EXPORTS = ["View", "div", "svg", "image"];
const GPUI_BASE_EXPORTS = [
  "h_flex",
  "v_flex",
  "Input",
  "InputState",
  "ScrollHandle",
];
// NativeElement methods (gpui-kit.d.ts) the mods may call.
const ELEMENT_METHODS = [
  "absolute",
  "bg",
  "border_1",
  "border_color",
  "bottom",
  "child",
  "children",
  "cursor_pointer",
  "flex",
  "flex_1",
  "flex_auto",
  "flex_initial",
  "flex_none",
  "font_bold",
  "font_semibold",
  "gap",
  "h",
  "hover",
  "id",
  "items_center",
  "justify_between",
  "justify_center",
  "justify_end",
  "left",
  "max_w",
  "mb",
  "min_h",
  "min_w",
  "ml",
  "mode",
  "mt",
  "mx",
  "my",
  "on_click",
  "on_key_down",
  "on_mouse_down",
  "on_mouse_move",
  "on_mouse_up",
  "on_size_change",
  "opacity",
  "overflow_y_scrollbar",
  "p",
  "pb",
  "pl",
  "pr",
  "pt",
  "px",
  "py",
  "relative",
  "right",
  "rounded",
  "size",
  "size_full",
  "spin",
  "text_color",
  "text_size",
  "tooltip",
  "top",
  "track_focus",
  "track_scroll",
  "truncate",
  "w",
  "w_full",
  "when",
];
// Members of the other documented interfaces, by interface.
const MEMBERS: Record<string, string[]> = {
  Context: [
    "notify",
    "stop_propagation",
    "focus_handle",
    "spawn",
    "timer",
    "write_to_clipboard",
  ],
  Timer: ["after", "every"],
  Task: ["cancel", "is_done"],
  FocusHandle: ["focus", "is_focused", "release"],
  ScrollHandle: ["scroll_to_item", "release"],
  InputState: ["on", "focus", "value", "set_selected_range", "release"],
  Storage: ["getItem", "setItem", "removeItem"],
};
// theme() names in Herdr's AGENTS.md.
const THEME = [
  "background",
  "canvas",
  "chrome",
  "surface",
  "popover",
  "raised",
  "hover",
  "selected",
  "border",
  "input",
  "foreground",
  "muted",
  "dim",
  "accent",
  "accent_foreground",
  "solid",
  "solid_foreground",
  "selection",
  "working",
  "blocked",
  "done",
  "idle",
  "unknown",
  ...Array.from({ length: 16 }, (_, i) => `ansi${i}`),
];

// ---- stub elements ----

type El = { [name: string]: (...args: unknown[]) => El };
type Node = {
  kind: string;
  id?: string;
  calls: Map<string, unknown[][]>;
  children: (Node | string)[];
  consumed: boolean;
};
const NODE = Symbol("node");
const nodeOf = (el: unknown): Node | undefined =>
  el && typeof el === "object"
    ? (el as Record<symbol, Node | undefined>)[NODE]
    : undefined;

function element(kind: string): El {
  const node: Node = { kind, calls: new Map(), children: [], consumed: false };
  const self: El = new Proxy({} as El, {
    get(_target, name) {
      if (name === NODE) return node;
      if (typeof name === "symbol" || name === "then") return undefined;
      return (...args: unknown[]) => call(node, self, name, args);
    },
  });
  return self;
}

function adopt(parent: Node, child: unknown) {
  if (["string", "number", "boolean"].includes(typeof child)) {
    parent.children.push(String(child));
    return;
  }
  const node = nodeOf(child);
  if (!node) assert.fail(`a child of ${parent.kind} is not an element`);
  assert.ok(!node.consumed, `element ${node.id ?? node.kind} used twice`);
  node.consumed = true;
  parent.children.push(node);
}

function call(node: Node, self: El, name: string, args: unknown[]): El {
  assert.ok(
    ELEMENT_METHODS.includes(name),
    `${name}() is not an allowed NativeElement method`,
  );
  assert.ok(
    !node.consumed,
    `element ${node.id ?? node.kind} used after it was consumed`,
  );
  node.calls.set(name, [...(node.calls.get(name) ?? []), args]);
  switch (name) {
    case "id":
      node.id = String(args[0]);
      return self;
    case "child":
      adopt(node, args[0]);
      return self;
    case "children":
      for (const child of args[0] as Iterable<unknown>) adopt(node, child);
      return self;
    case "when":
      if (args[0])
        assert.equal(
          (args[1] as (el: El) => El)(self),
          self,
          "when() branch returns its element",
        );
      return self;
    case "hover":
      (args[0] as (el: El) => unknown)(element("style"));
      return self;
    default:
      return self;
  }
}

function find(node: Node, id: string): Node | null {
  if (node.id === id) return node;
  for (const child of node.children)
    if (typeof child !== "string") {
      const found = find(child, id);
      if (found) return found;
    }
  return null;
}

const ids = (node: Node): string[] =>
  node.children.flatMap((c) =>
    typeof c === "string" ? [] : [...(c.id ? [c.id] : []), ...ids(c)],
  );
const texts = (node: Node): string[] =>
  node.children.flatMap((c) => (typeof c === "string" ? [c] : texts(c)));
const args = (node: Node, name: string) => node.calls.get(name) ?? [];

// An object that refuses any member not listed for its interface; `extra`:
// the test's own handles on it.
function strict<T extends object>(
  name: string,
  members: T,
  extra: string[] = [],
): T {
  for (const key of Object.keys(members))
    assert.ok(
      MEMBERS[name].includes(key) || extra.includes(key),
      `${name}.${key} is not allowed`,
    );
  return new Proxy(members, {
    get(target, key) {
      if (typeof key === "symbol" || key === "then") return undefined;
      assert.ok(key in target, `${name}.${key} is not allowed`);
      return target[key as keyof T];
    },
  });
}

// ---- the Herdr host ----

type Space = {
  id: string;
  name: string;
  active: boolean;
  machine: string | null;
  folder: string;
  status: string;
  tabs: { id: string }[];
};

const HOME = "/Users/me";
const APP_HOME = `${HOME}/.config/herdr-app`;
const CONFIG = `${APP_HOME}/projects.json`;
// cwd ("machine:path") -> its git answers
const REPOS: Record<string, { top: string; common: string; branch: string }> = {
  ":/Users/me/src/ai": {
    top: "/Users/me/src/ai",
    common: "/Users/me/src/ai/.git",
    branch: "main",
  },
  ":/Users/me/src/ai-wt/feature": {
    top: "/Users/me/src/ai-wt/feature",
    common: "/Users/me/src/ai/.git",
    branch: "feature",
  },
  ":/Users/me/src/loose": {
    top: "/Users/me/src/loose",
    common: "/Users/me/src/loose/.git",
    branch: "main",
  },
  "vps:/home/me/src/api": {
    top: "/home/me/src/api",
    common: "/home/me/src/api/.git",
    branch: "main",
  },
};

function host() {
  const spaces: Space[] = [
    ["s1", "ai", null, "/Users/me/src/ai"],
    ["s2", "feature", null, "/Users/me/src/ai-wt/feature"],
    ["s3", "loose", null, "/Users/me/src/loose"],
    ["s4", "scratch", null, "/tmp/scratch"],
    ["s5", "api", "vps", "/home/me/src/api"],
  ].map(([id, name, machine, folder], i) => ({
    id: id as string,
    name: name as string,
    active: i === 0,
    machine: machine as string | null,
    folder: folder as string,
    status: i === 1 ? "blocked" : "idle",
    tabs: [{ id: `t${i}` }],
  }));
  return {
    props: {} as Record<string, unknown>,
    spaces,
    files: {} as Record<string, string | null>,
    sidebarWidth: 260,
    checking: false, // herdr-app check's dry run
    agents: [] as Record<string, unknown>[],
    runs: [] as unknown[],
    overlays: [] as Record<string, unknown>[],
    errors: [] as unknown[],
    timers: [] as ((cx: unknown) => unknown)[],
  };
}
let H = host();

const ok = (stdout: string) => ({ code: 0, stdout, stderr: "" });
const notRepo = {
  code: 128,
  stdout: "",
  stderr: "fatal: not a git repository",
};

async function exec(
  command: string,
  argv: string[] = [],
  options: { cwd?: string; on?: string | null } = {},
) {
  const on = options.on ?? "";
  if (command === "sh") return ok(on ? "/home/me" : HOME);
  assert.equal(command, "git");
  const repo = REPOS[`${on}:${options.cwd}`];
  if (!repo) return notRepo;
  if (argv.includes("--show-toplevel")) return ok(`${repo.top}\n`);
  if (argv.includes("--git-common-dir")) return ok(`${repo.common}\n`);
  if (argv[0] === "symbolic-ref") return ok(`refs/heads/${repo.branch}\n`);
  if (argv[0] === "rev-list") return ok("1\t2\n");
  throw new Error(`unexpected git ${argv.join(" ")}`);
}

const herdr: Record<string, unknown> = {
  exec,
  hc: async (argv: string[]) => {
    assert.deepEqual(argv, ["machine", "ls", "--json"]);
    return ok(
      JSON.stringify({
        machines: [{ name: "vps", state: "connected", target: "vps" }],
      }),
    );
  },
  home: () => HOME,
  appHome: () => APP_HOME,
  checking: () => H.checking,
  readTextFile: async (path: string) => H.files[path] ?? null,
  writeTextFile: async (
    path: string,
    text: string,
    expected: string | null,
  ) => {
    if ((H.files[path] ?? null) !== expected) throw new Error("stale");
    H.files[path] = text;
    return null;
  },
  knownAgents: async () => H.agents,
  pickFolder: async () => null,
  run: (name: string, a?: unknown) => {
    H.runs.push([name, a]);
    return null;
  },
  machines: () => [
    { name: null, layout: "ready" },
    { name: "vps", layout: "ready" },
  ],
  spaces: () => H.spaces,
  panes: () =>
    H.spaces.map((s, i) => ({
      pane: `p${i}`,
      tab: s.tabs[0].id,
      cwd: s.folder,
      terminal: `term${i}`,
      status: "idle",
      program: { shell: true },
    })),
  layout: () => ({
    id: "root",
    children: [{ id: "sidebar", size: { px: H.sidebarWidth } }],
  }),
  window: () => ({ active: true, platform: "macos" }),
  theme: () =>
    new Proxy({} as Record<string, string>, {
      get(_t, key) {
        if (typeof key === "symbol") return undefined;
        assert.ok(THEME.includes(key), `theme().${key} is not a theme color`);
        return "#808080";
      },
    }),
  openOverlay: (spec: Record<string, unknown>) => {
    H.overlays.push(spec);
    return `overlay-${H.overlays.length}`;
  },
  closeOverlay: () => null,
  notify: () => null,
  props: () => H.props,
  shared: () => undefined,
  setShared: () => null,
  watchFolder: () => Object.assign(new Promise(() => {}), { cancel() {} }),
};

const task = () => strict("Task", { cancel() {}, is_done: () => false });
const focusHandle = () =>
  strict("FocusHandle", {
    focus() {},
    is_focused: () => false,
    release: () => true,
  });

function context() {
  const cx: Record<string, unknown> = strict("Context", {
    notify() {},
    stop_propagation() {},
    focus_handle: focusHandle,
    spawn(body: (cx: unknown) => unknown) {
      Promise.resolve()
        .then(() => body(cx))
        .catch((e) => H.errors.push(e));
      return task();
    },
    timer: strict("Timer", {
      after(_ms: number, handler: (cx: unknown) => unknown) {
        H.timers.push(handler);
        return task();
      },
      every(_ms: number, handler: (cx: unknown) => unknown) {
        H.timers.push(handler);
        return task();
      },
    }),
    write_to_clipboard() {},
  });
  return cx;
}

function inputState({ value = "" }: { value?: string } = {}) {
  let text = value;
  return strict(
    "InputState",
    {
      on() {
        return true;
      },
      focus() {},
      value: () => text,
      set_selected_range() {},
      release: () => true,
      type(next: string) {
        text = next;
      },
    },
    ["type"],
  );
}

class View {}
const gpuiKit: Record<string, unknown> = {
  View,
  div: () => element("div"),
  svg: (path: string) => element(`svg:${path}`),
  image: (path: string) => element(`image:${path}`),
};
const gpuiBase: Record<string, unknown> = {
  h_flex: () => element("h_flex"),
  v_flex: () => element("v_flex"),
  Input: { new: (_state: unknown) => element("input") },
  InputState: { new: inputState },
  ScrollHandle: {
    new: () =>
      strict("ScrollHandle", { scroll_to_item() {}, release: () => true }),
  },
};

const STUBS: Record<string, [string[], Record<string, unknown>]> = {
  herdr: [HERDR_EXPORTS, herdr],
  "gpui-kit": [GPUI_KIT_EXPORTS, gpuiKit],
  "gpui-base": [GPUI_BASE_EXPORTS, gpuiBase],
};
const global = globalThis as Record<string, unknown>;
global.__herdrLoadStubs = Object.fromEntries(
  Object.entries(STUBS).map(([mod, [names, impl]]) => [
    mod,
    Object.fromEntries(
      names.map((n) => [
        n,
        impl[n] ??
          (() => {
            throw new Error(`${mod}.${n} is not stubbed`);
          }),
      ]),
    ),
  ]),
);
const store = new Map<string, string>();
global.localStorage = strict("Storage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
});

registerHooks({
  resolve(specifier, context, next) {
    const stub = STUBS[specifier];
    if (!stub) return next(specifier, context);
    const source = stub[0]
      .map(
        (n) =>
          `export const ${n} = globalThis.__herdrLoadStubs[${JSON.stringify(specifier)}].${n};`,
      )
      .join("\n");
    return {
      url: `data:text/javascript,${encodeURIComponent(source)}`,
      shortCircuit: true,
    };
  },
});

const MODS = join(import.meta.dirname, "../../herdr-app/mods");
type ViewInstance = {
  init(props: unknown, cx: unknown): void;
  render(cx: unknown): unknown;
  [key: string]: unknown;
};
async function viewOf(mod: string) {
  const loaded = await import(pathToFileURL(join(MODS, mod, "main.js")).href);
  return new loaded.default() as ViewInstance;
}

const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r));
};

function projectsDoc(count = 2) {
  const projects = [
    {
      name: "AI",
      repos: [{ path: "~/src/ai" }, { path: "~/src/api", machine: "vps" }],
    },
    { name: "Empty", repos: [] },
    ...Array.from({ length: Math.max(0, count - 2) }, (_, i) => ({
      name: `Project ${i + 3}`,
      repos: [],
    })),
  ];
  return `${JSON.stringify({ projects }, null, 2)}\n`;
}

// Starts a view the way Herdr does: init, its first tasks, a timer round, render.
function start(props: Record<string, unknown> = {}) {
  H = host();
  H.files[CONFIG] = projectsDoc();
  H.props = { overlay: "overlay-0", ...props };
}
async function mount(mod: string) {
  const view = await viewOf(mod);
  const cx = context();
  view.init(H.props, cx);
  await settle();
  for (const timer of H.timers.splice(0)) timer(cx);
  await settle();
  return { view, cx, render: () => rendered(view, cx) };
}
function rendered(view: ViewInstance, cx: unknown): Node {
  const node = nodeOf(view.render(cx));
  assert.ok(node, "render returns an element");
  assert.deepEqual(H.errors, [], "no task failed");
  return node;
}
function click(root: Node, id: string, cx: unknown) {
  const node = find(root, id);
  assert.ok(node, `${id} is drawn`);
  const [[handler]] = args(node, "on_click");
  (handler as (e: unknown, cx: unknown) => unknown)({}, cx);
}

// ---- the sidebar ----

test("projects sidebar loads and renders projects, repos and Other", async () => {
  start();
  const { render } = await mount("projects");
  const root = render();
  const shown = texts(root);
  for (const text of ["Projects", "AI", "Empty", "Other", "ai", "loose"])
    assert.ok(shown.includes(text), `${text} is shown`);
  const drawn = ids(root);
  for (const id of [
    "project-0",
    "project-1",
    "repo-0-0",
    "repo-0-1",
    "projects-other",
    "space-s1",
    "space-s2",
    "space-s3",
    "space-s4",
    "space-s5",
  ])
    assert.ok(drawn.includes(id), `${id} is drawn`);
});

test("projects sidebar renders its narrow rail and a broken projects.json", async () => {
  start();
  H.sidebarWidth = 100;
  H.files[CONFIG] = "{ not json";
  const { render } = await mount("projects");
  const root = render();
  assert.ok(ids(root).includes("space-s1"));
});

test("sidebar popups pass their most height to projects-edit", async () => {
  start();
  const { render } = await mount("projects");
  const root = render();
  const tab = find(root, "space-new-tab-s1");
  assert.ok(tab);
  const [[handler]] = args(tab, "on_click");
  (handler as (e: unknown, cx: unknown) => unknown)({}, context());
  const spec = H.overlays.at(-1) as {
    mod: string;
    height: number;
    props: Record<string, unknown>;
  };
  assert.equal(spec.mod, "projects-edit");
  assert.equal(spec.props.height, spec.height);
  assert.equal(spec.props.menu, "tab");
});

test("both mods render in herdr-app check's dry run", async () => {
  for (const [mod, props] of [
    ["projects", {}],
    ["projects-edit", {}],
    ["projects-edit", { menu: "tab", space: "s1", folder: null, height: 320 }],
  ] as const) {
    start(props);
    H.checking = true;
    const { render } = await mount(mod);
    render();
  }
});

// ---- projects-edit ----

test("projects-edit dialog renders, opens Add repo and the machine form", async () => {
  start();
  const { view, cx, render } = await mount("projects-edit");
  let root = render();
  for (const id of ["new-project", "p-0", "p-1", "r-0-0", "r-0-1"])
    assert.ok(ids(root).includes(id), `${id} is drawn`);
  click(root, "p-add-0", cx);
  await settle();
  root = render();
  assert.ok(texts(root).includes("~/src/loose"), "an open repo is offered");
  click(root, "remote-0", cx);
  root = render();
  assert.ok(texts(root).includes("Add a repo on a machine to AI"));
  assert.equal(view.form && (view.form as { kind: string }).kind, "remote");
});

for (const form of [
  { kind: "new", addRepo: { path: "~/src/loose", machine: null } },
  { kind: "rename", project: 0, name: "AI" },
])
  test(`projects-edit ${form.kind} form renders and saves`, async () => {
    start({ form });
    const { view, cx, render } = await mount("projects-edit");
    const root = render();
    assert.ok(ids(root).includes("form-save"));
    (view.nameInput as { type(v: string): void }).type("Renamed");
    click(root, "form-save", cx);
    await settle();
    assert.match(H.files[CONFIG] ?? "", /"Renamed"/);
  });

const MENUS: Record<string, Record<string, unknown>> = {
  project: { menu: "project", project: 0, name: "AI", height: 260 },
  repo: {
    menu: "repo",
    project: 0,
    name: "AI",
    path: "~/src/ai",
    machine: null,
    height: 120,
  },
  other: {
    menu: "other",
    space: "s3",
    machine: null,
    path: "~/src/loose",
    height: 300,
  },
  tab: {
    menu: "tab",
    space: "s1",
    machine: null,
    folder: "/Users/me/src/ai",
    height: 320,
  },
};

function menuParts(root: Node) {
  assert.equal(root.id, "projects-menu");
  const list = find(root, "projects-menu-list");
  assert.ok(list, "the menu has a list");
  assert.ok(args(list, "overflow_y_scrollbar").length, "the list scrolls");
  assert.ok(args(list, "flex_1").length && args(list, "min_h").length);
  const [[height]] = args(root, "h");
  return { list, height: height as number, inList: new Set(ids(list)) };
}

for (const [kind, props] of Object.entries(MENUS))
  test(`projects-edit ${kind} menu renders inside its height`, async () => {
    start(props);
    H.agents = [
      {
        key: "claude",
        name: "Claude",
        run: ["claude"],
        installed: true,
        icon: "icons/claude.svg",
        tint: true,
      },
    ];
    const { render } = await mount("projects-edit");
    const { height } = menuParts(render());
    assert.ok(height > 0 && height <= (props.height as number));
  });

test("a long Other menu scrolls its projects and keeps New project and Space reachable", async () => {
  start(MENUS.other);
  H.files[CONFIG] = projectsDoc(40);
  const { render } = await mount("projects-edit");
  const root = render();
  const { height, inList } = menuParts(root);
  assert.equal(height, 300, "capped at the sidebar's most height");
  for (let i = 0; i < 40; i++)
    assert.ok(inList.has(`add-${i}`), `add-${i} scrolls`);
  for (const id of ["new", "space"]) {
    assert.ok(ids(root).includes(id), `${id} is drawn`);
    assert.ok(!inList.has(id), `${id} stays outside the scrolling list`);
  }
});

test("a long agent menu scrolls its agents and keeps Terminal reachable", async () => {
  start(MENUS.tab);
  H.agents = Array.from({ length: 30 }, (_, i) => ({
    key: `a${i}`,
    name: `Agent ${i}`,
    run: [`a${i}`],
    installed: true,
    icon: "icons/a.png",
    tint: false,
  }));
  const { render } = await mount("projects-edit");
  const root = render();
  const { height, inList } = menuParts(root);
  assert.equal(height, 320);
  for (let i = 0; i < 30; i++) assert.ok(inList.has(`agent-a${i}`));
  assert.ok(ids(root).includes("terminal") && !inList.has("terminal"));
});

// ---- the allow-lists against Herdr's own type files ----

const TYPES =
  process.env.HERDR_TYPES_DIR ?? join(homedir(), ".config/herdr-app");
const haveTypes =
  existsSync(join(TYPES, "herdr.d.ts")) &&
  existsSync(join(TYPES, "gpui-kit.d.ts"));

// Member names of one `interface Name {` block (2-space indented, members at 4).
function members(source: string, name: string) {
  const start = source.indexOf(`  export interface ${name} {`);
  assert.ok(start >= 0, `interface ${name} is declared`);
  const end = source.indexOf("\n  }\n", start);
  const block = source.slice(start, end);
  return new Set(
    [...block.matchAll(/^ {4}(?:readonly )?([A-Za-z_]\w*)\??[(<:]/gm)].map(
      (m) => m[1],
    ),
  );
}

test("every allowed name is on Herdr's documented surface", {
  skip: haveTypes ? false : `no Herdr type files in ${TYPES}`,
}, () => {
  const herdrTypes = readFileSync(join(TYPES, "herdr.d.ts"), "utf8");
  const kit = readFileSync(join(TYPES, "gpui-kit.d.ts"), "utf8");
  const exported = new Set(
    [...herdrTypes.matchAll(/^export function (\w+)/gm)].map((m) => m[1]),
  );
  assert.deepEqual(
    HERDR_EXPORTS.filter((n) => !exported.has(n)),
    [],
  );
  for (const n of GPUI_KIT_EXPORTS)
    assert.match(
      kit,
      new RegExp(`export (?:abstract class|function|const) ${n}\\b`),
      `gpui-kit ${n}`,
    );
  const base = kit.slice(kit.indexOf('declare module "gpui-base"'));
  for (const n of GPUI_BASE_EXPORTS)
    assert.match(
      base,
      new RegExp(`export (?:function|const) ${n}\\b`),
      `gpui-base ${n}`,
    );
  const element = members(kit, "NativeElement");
  assert.deepEqual(
    ELEMENT_METHODS.filter((n) => !element.has(n)),
    [],
  );
  for (const [name, names] of Object.entries(MEMBERS)) {
    const declared = members(kit, name);
    assert.deepEqual(
      names.filter((n) => !declared.has(n)),
      [],
      name,
    );
  }
});
