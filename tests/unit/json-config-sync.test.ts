// charter-contracts: pi-config
import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import {
  applyPreparedManagedConfigs,
  herdrAppPathAllowed,
  inspectManagedConfigs,
  prepareManagedConfigs,
  readHerdrAppFiles,
  syncManagedConfigs,
  validateManagedConfigs,
} from "../../scripts/ax/config-sync.ts";

function fixture(t: TestContext): ReturnType<typeof options> {
  const root = mkdtempSync(join(tmpdir(), "ax-json-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return options(root);
}

function options(root: string) {
  return {
    sourceRoot: join(root, "source"),
    runtimeRoot: join(root, "runtime"),
    home: join(root, "home"),
    liveHome: join(root, "live"),
    sourceVerified: false,
    miseValidator: () => ({ status: 0 }),
    config: {
      version: 1 as const,
      runtime: {
        canonicalSkillsDir: "~/.agents/skills",
        skillSymlinkTargets: [],
        configs: {
          mise: {
            target: "~/.config/mise/config.toml",
            managed: {
              tools: { "npm:@earendil-works/pi-coding-agent": "1.5.0" },
            },
          },
          pi: {
            target: "~/.pi/agent/settings.json",
            managedPaths: [
              { path: ["defaultProvider"], value: "openai-codex" },
              {
                path: ["packages"],
                value: "npm:pi-claude-bridge@0.8.0",
                merge: "append-unique" as const,
              },
              {
                path: ["extensions"],
                value: ["~/.agents/hooks/pi/index.ts"],
                expandHome: true,
              },
            ],
          },
          piClaudeBridge: {
            target: "~/.pi/agent/claude-bridge.json",
            managedPaths: [{ path: ["askClaude", "enabled"], value: false }],
          },
          piModels: {
            target: "~/.pi/agent/models.json",
            managedPaths: [
              {
                path: [
                  "providers",
                  "cloudflare-ai-gateway",
                  "modelOverrides",
                  "workers-ai/@cf/zai-org/glm-5.3",
                  "maxTokens",
                ],
                value: 16384,
              },
              {
                path: ["providers", "pi-ax"],
                value: {
                  extends: "pi",
                  command: ["pi", "--extension", "~/.agents/hooks/pi/index.ts"],
                  env: { DESCRIPTION: "literal ~/ text" },
                },
                expandHome: true,
              },
              {
                path: ["profiles"],
                value: [
                  { id: "implementer", model: "openai-codex/gpt-6.1-sol" },
                ],
              },
            ],
          },
        },
      },
      profiles: { personal: { include: [], paths: [] } },
      blocks: {},
    },
  };
}

function write(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

test("GREEN pi-config: JSON sync preserves unowned configuration and credentials", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ax-json-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = options(root);
  const models = join(input.home, ".pi/agent/models.json");
  const auth = join(input.home, ".pi/agent/auth.json");
  const piSettings = join(input.home, ".pi/agent/settings.json");
  write(piSettings, {
    packages: ["npm:unowned-extension@1.0.0", "npm:pi-claude-bridge@0.7.0"],
  });
  chmodSync(piSettings, 0o600);
  write(models, {
    providers: {
      "pi-ax": { obsolete: true },
      custom: { command: ["custom"] },
    },
    daemon: { port: 1234 },
    theme: "dark",
  });
  write(auth, { sentinel: "untouched" });
  const result = syncManagedConfigs(input);
  assert.equal(result.status, "synchronized");
  const observed = JSON.parse(readFileSync(models, "utf-8"));
  assert.equal(observed.providers["pi-ax"].obsolete, undefined);
  assert.deepEqual(observed.providers.custom, { command: ["custom"] });
  assert.equal(observed.daemon.port, 1234);
  assert.equal(observed.theme, "dark");
  assert.equal(
    observed.providers["pi-ax"].command[2],
    join(input.home, ".agents/hooks/pi/index.ts"),
  );
  assert.equal(observed.providers["pi-ax"].env.DESCRIPTION, "literal ~/ text");
  assert.equal(readFileSync(auth, "utf-8"), '{"sentinel":"untouched"}');
  assert.equal(
    observed.providers["cloudflare-ai-gateway"].modelOverrides[
      "workers-ai/@cf/zai-org/glm-5.3"
    ].maxTokens,
    16384,
  );
  const pi = JSON.parse(
    readFileSync(join(input.home, ".pi/agent/settings.json"), "utf-8"),
  );
  assert.deepEqual(pi.packages, [
    "npm:unowned-extension@1.0.0",
    "npm:pi-claude-bridge@0.8.0",
  ]);
  assert.equal(
    JSON.parse(
      readFileSync(join(input.home, ".pi/agent/claude-bridge.json"), "utf-8"),
    ).askClaude.enabled,
    false,
  );
  assert.equal(
    lstatSync(join(input.home, ".pi/agent/settings.json")).mode & 0o777,
    0o600,
  );
  assert.equal(
    readFileSync(join(input.home, ".config/mise/config.toml"), "utf-8"),
    '[tools]\n"npm:@earendil-works/pi-coding-agent" = "1.5.0"\n',
  );
  assert.equal(inspectManagedConfigs(input).ok, true);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
});

test("RED pi-config: invalid JSON leaves every target unchanged", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ax-json-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = options(root);
  const pi = join(input.home, ".pi/agent/settings.json");
  const models = join(input.home, ".pi/agent/models.json");
  const mise = join(input.home, ".config/mise/config.toml");
  write(pi, { defaultProvider: "old" });
  write(models, {});
  writeFileSync(models, "invalid json");
  mkdirSync(join(mise, ".."), { recursive: true });
  writeFileSync(mise, '[tools]\nruby = "3.4.1"\n');
  assert.throws(() => syncManagedConfigs(input), /json_invalid/);
  assert.equal(readFileSync(pi, "utf-8"), '{"defaultProvider":"old"}');
  assert.equal(readFileSync(mise, "utf-8"), '[tools]\nruby = "3.4.1"\n');
});

function templateOptions(t: TestContext) {
  const input = fixture(t);
  mkdirSync(join(input.sourceRoot, "hooks/pi"), { recursive: true });
  copyFileSync(
    join(import.meta.dirname, "../../hooks/pi/routes.json"),
    join(input.sourceRoot, "hooks/pi/routes.json"),
  );
  return {
    ...input,
    config: {
      ...input.config,
      runtime: {
        ...input.config.runtime,
        configs: {
          herdrTemplates: { target: "~/.config/herdr-core/templates" },
        },
      },
    },
  };
}

test("GREEN pi-config: config sync owns only the generated herdr-core ax templates and repairs their drift", (t) => {
  const input = templateOptions(t);
  const directory = join(input.home, ".config/herdr-core/templates");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "reviewer.md"), "person-owned\n");
  assert.equal(syncManagedConfigs(input).changedPaths.length, 4);
  assert.equal(inspectManagedConfigs(input).ok, true);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
  assert.deepEqual(readdirSync(directory).sort(), [
    "ax-orchestrator-gpt-6-astra.md",
    "ax-orchestrator.md",
    "ax-planner-astra.md",
    "ax-planner-fable.md",
    "reviewer.md",
  ]);
  const orchestrator = join(directory, "ax-orchestrator.md");
  const generated = readFileSync(orchestrator, "utf8");
  writeFileSync(orchestrator, "edited\n");
  assert.deepEqual(inspectManagedConfigs(input).findings, [
    "managed_config_drift: herdrTemplates/ax-orchestrator.md.content is different",
  ]);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, [orchestrator]);
  assert.equal(readFileSync(orchestrator, "utf8"), generated);
  assert.equal(
    readFileSync(join(directory, "reviewer.md"), "utf8"),
    "person-owned\n",
  );
});

test("RED pi-config: a symlinked herdr-core templates directory is refused", (t) => {
  const input = templateOptions(t);
  const elsewhere = join(input.home, "elsewhere");
  mkdirSync(elsewhere, { recursive: true });
  mkdirSync(join(input.home, ".config/herdr-core"), { recursive: true });
  symlinkSync(elsewhere, join(input.home, ".config/herdr-core/templates"));
  assert.throws(
    () => syncManagedConfigs(input),
    /managed_config_parent_invalid/,
  );
  assert.deepEqual(readdirSync(elsewhere), []);
});

test("Pi parent symlink escapes are rejected", (t) => {
  const input = fixture(t);
  mkdirSync(input.home, { recursive: true });
  mkdirSync(input.liveHome, { recursive: true });
  symlinkSync(input.liveHome, join(input.home, ".pi"));
  assert.throws(
    () => syncManagedConfigs(input),
    /parent_invalid|parent_escape/,
  );
});

test("JSON candidate refuses concurrent changes", (t) => {
  const input = fixture(t);
  const prepared = prepareManagedConfigs(input);
  assert.throws(
    () =>
      applyPreparedManagedConfigs(prepared, {
        beforeApply: (target) => write(target, { concurrent: true }),
      }),
    /target_changed/,
  );
});

test("overlapping JSON ownership and unsafe object keys are rejected", (t) => {
  const input = fixture(t);
  input.config.runtime.configs.pi.managedPaths.push({
    path: ["extensions", "nested"],
    value: "unsafe",
  });
  assert.throws(() => syncManagedConfigs(input), /overlap/);
  input.config.runtime.configs.pi.managedPaths.pop();
  input.config.runtime.configs.pi.managedPaths.push({
    path: ["__proto__", "polluted"],
    value: "unsafe",
  });
  assert.throws(() => syncManagedConfigs(input), /key_invalid|path_invalid/);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

const repoRoot = join(import.meta.dirname, "../..");
const HERDR_KEYS = {
  target: "~/.config/herdr-app/keys.json",
  managedPaths: [
    { path: ["global", "cmd-k p"], value: "mod.open:projects-edit" },
  ],
};

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function herdrAppFixture(t: TestContext, configs: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), "ax-herdr-app-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceRoot = join(root, "source");
  writeText(join(sourceRoot, "herdr-app/mods/projects/main.js"), "main\n");
  writeText(join(sourceRoot, "herdr-app/mods/projects/model.js"), "model\n");
  writeText(join(sourceRoot, "herdr-app/layouts/projects.json"), "{}\n");
  return {
    sourceRoot,
    runtimeRoot: join(root, "runtime"),
    home: join(root, "home"),
    liveHome: join(root, "live"),
    sourceVerified: false,
    config: {
      version: 1 as const,
      runtime: {
        canonicalSkillsDir: "~/.agents/skills",
        skillSymlinkTargets: [],
        configs,
      },
    },
  };
}

test("GREEN pi-config: herdrApp owns only the herdr-app source files and repairs their drift", (t) => {
  const input = herdrAppFixture(t, {
    herdrApp: { target: "~/.config/herdr-app" },
  });
  const app = join(input.home, ".config/herdr-app");
  writeText(join(app, "mods/projects/jsconfig.json"), "herdr-written\n");
  writeText(join(app, "mods/projects/gpui-kit.d.ts"), "herdr-written\n");
  writeText(join(app, "mods/spaces/main.js"), "shipped\n");
  writeText(join(app, "settings.json"), "{}\n");
  writeText(join(app, "projects.json"), '{"projects":[]}\n');

  const main = join(app, "mods/projects/main.js");
  assert.deepEqual(syncManagedConfigs(input).changedPaths.sort(), [
    join(app, "layouts/projects.json"),
    main,
    join(app, "mods/projects/model.js"),
  ]);
  assert.equal(validateManagedConfigs(input).ok, true);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
  assert.deepEqual(readdirSync(join(app, "mods/projects")).sort(), [
    "gpui-kit.d.ts",
    "jsconfig.json",
    "main.js",
    "model.js",
  ]);

  writeFileSync(main, "edited\n");
  assert.deepEqual(inspectManagedConfigs(input).findings, [
    "managed_config_drift: herdrApp/mods/projects/main.js.content is different",
  ]);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, [main]);
  assert.equal(readFileSync(main, "utf8"), "main\n");
  for (const [file, text] of [
    ["mods/projects/jsconfig.json", "herdr-written\n"],
    ["mods/projects/gpui-kit.d.ts", "herdr-written\n"],
    ["mods/spaces/main.js", "shipped\n"],
    ["settings.json", "{}\n"],
    ["projects.json", '{"projects":[]}\n'],
  ])
    assert.equal(readFileSync(join(app, file), "utf8"), text);
});

test("GREEN pi-config: a herdr-app source file removed later stays in the Herdr home", (t) => {
  const input = herdrAppFixture(t, {
    herdrApp: { target: "~/.config/herdr-app" },
  });
  syncManagedConfigs(input);
  rmSync(join(input.sourceRoot, "herdr-app/mods/projects/model.js"));
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
  assert.equal(
    existsSync(join(input.home, ".config/herdr-app/mods/projects/model.js")),
    true,
  );
});

test("RED pi-config: herdrApp refuses source that would own Herdr's files", (t) => {
  for (const file of [
    "settings.json",
    "keys.json",
    "projects.json",
    "shared.json",
    "mods/spaces/main.js",
    "mods/projects/jsconfig.json",
    "mods/projects/.hidden.js",
    "layouts/main.json",
    "layouts/.state/projects.json",
  ]) {
    const input = herdrAppFixture(t, {
      herdrApp: { target: "~/.config/herdr-app" },
    });
    writeText(join(input.sourceRoot, "herdr-app", file), "x\n");
    assert.throws(
      () => syncManagedConfigs(input),
      /herdr_app_source_invalid/,
      file,
    );
    assert.equal(existsSync(join(input.home, ".config/herdr-app")), false);
  }
});

test("GREEN pi-config: herdrKeys sets only global cmd-k p and keeps every other key", (t) => {
  const input = herdrAppFixture(t, { herdrKeys: HERDR_KEYS });
  const keys = join(input.home, ".config/herdr-app/keys.json");
  const before = {
    global: { "cmd-p": "mod.open:picker", "cmd-t": "tab.new" },
    terminal: { "cmd-c": "terminal.copy" },
    "mod:picker": { escape: "overlay.close" },
  };
  writeText(keys, `${JSON.stringify(before, null, 2)}\n`);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, [keys]);
  assert.deepEqual(JSON.parse(readFileSync(keys, "utf8")), {
    ...before,
    global: { ...before.global, "cmd-k p": "mod.open:projects-edit" },
  });
  assert.equal(validateManagedConfigs(input).ok, true);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
});

test("RED pi-config: herdrKeys reports a missing keys.json and does not create it", (t) => {
  const input = herdrAppFixture(t, { herdrKeys: HERDR_KEYS });
  const keys = join(input.home, ".config/herdr-app/keys.json");
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
  assert.equal(existsSync(keys), false);
  const report = validateManagedConfigs(input);
  assert.equal(report.ok, false);
  assert.deepEqual(report.findings, [
    "managed_config_drift: herdrKeys.global.cmd-k p is missing",
  ]);
});

test("GREEN pi-config: ax validate covers herdrApp and herdrKeys together", (t) => {
  const input = herdrAppFixture(t, {
    herdrApp: { target: "~/.config/herdr-app" },
    herdrKeys: HERDR_KEYS,
  });
  writeText(join(input.home, ".config/herdr-app/keys.json"), "{}\n");
  syncManagedConfigs(input);
  const report = validateManagedConfigs(input);
  assert.equal(report.ok, true);
  assert.deepEqual(Object.keys(report.tools).sort(), [
    "herdrApp/layouts/projects.json",
    "herdrApp/mods/projects/main.js",
    "herdrApp/mods/projects/model.js",
    "herdrKeys",
  ]);
});

test("RED pi-config: herdr-app targets must keep their declared paths", (t) => {
  const input = herdrAppFixture(t, {
    herdrApp: { target: "~/.config/herdr" },
  });
  assert.throws(
    () => syncManagedConfigs(input),
    /managed_config_target_invalid: herdrApp must target ~\/.config\/herdr-app/,
  );
});

test("herdr-app paths AX may own", () => {
  for (const file of [
    "mods/projects/main.js",
    "mods/projects-edit/LICENSE",
    "layouts/projects.json",
  ])
    assert.equal(herdrAppPathAllowed(file), true, file);
  for (const file of [
    "keys.json",
    "mods/spaces/main.js",
    "mods/projects",
    "mods/projects/herdr.d.ts",
    "mods/projects/../spaces/main.js",
    "layouts/terminals.json",
    "layouts/projects.txt",
    "layouts/x/projects.json",
    "/abs/mods/projects/main.js",
  ])
    assert.equal(herdrAppPathAllowed(file), false, file);
});

test("GREEN pi-config: the repository ships the projects mods, layout and cmd-k p key", () => {
  assert.deepEqual(
    readHerdrAppFiles(repoRoot).map((f) => f.file),
    [
      "layouts/projects.json",
      "mods/projects/LICENSE",
      "mods/projects/main.js",
      "mods/projects/mod.json",
      "mods/projects/model.js",
      "mods/projects-edit/LICENSE",
      "mods/projects-edit/edit.js",
      "mods/projects-edit/main.js",
      "mods/projects-edit/mod.json",
      "mods/projects-edit/model.js",
    ],
  );
  const mod = (file: string) =>
    readFileSync(join(repoRoot, "herdr-app/mods", file), "utf8");
  assert.equal(mod("projects-edit/model.js"), mod("projects/model.js"));
  assert.match(mod("projects/LICENSE"), /Apache License\s+Version 2\.0/u);

  type Node = { id?: string; content?: { mod?: string }; children?: Node[] };
  const mods: Record<string, string> = {};
  const walk = (node: Node): void => {
    if (node.id && node.content?.mod) mods[node.id] = node.content.mod;
    for (const child of node.children ?? []) walk(child);
  };
  walk(
    JSON.parse(
      readFileSync(join(repoRoot, "herdr-app/layouts/projects.json"), "utf8"),
    ),
  );
  assert.equal(mods.spaces, "projects");
  assert.equal(Object.values(mods).includes("spaces"), false);
  assert.equal(mods.tabs, "tabs");

  const config = JSON.parse(
    readFileSync(join(repoRoot, "ax.config.json"), "utf8"),
  );
  assert.deepEqual(config.runtime.configs.herdrApp, {
    target: "~/.config/herdr-app",
  });
  assert.deepEqual(config.runtime.configs.herdrKeys, HERDR_KEYS);
});
