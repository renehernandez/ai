// charter-contracts: pi-paseo-config
import assert from "node:assert/strict";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
  applyPreparedManagedConfigs,
  inspectManagedConfigs,
  prepareManagedConfigs,
  syncManagedConfigs,
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
    config: {
      version: 1 as const,
      runtime: {
        canonicalSkillsDir: "~/.agents/skills",
        skillSymlinkTargets: [],
        configs: {
          pi: {
            target: "~/.pi/agent/settings.json",
            managedPaths: [
              { path: ["defaultProvider"], value: "openai-codex" },
              {
                path: ["extensions"],
                value: ["~/.agents/hooks/pi/index.ts"],
                expandHome: true,
              },
            ],
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
            ],
          },
          paseo: {
            target: "~/.paseo/config.json",
            managedPaths: [
              {
                path: ["agents", "providers", "pi-ax"],
                value: {
                  extends: "pi",
                  command: ["pi", "--extension", "~/.agents/hooks/pi/index.ts"],
                  env: { DESCRIPTION: "literal ~/ text" },
                },
                expandHome: true,
              },
              {
                path: ["daemon", "agentProfiles"],
                value: [
                  { id: "implementer", model: "openai-codex/gpt-5.6-sol" },
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

test("GREEN pi-paseo-config: JSON sync preserves unowned configuration and credentials", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ax-json-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = options(root);
  const paseo = join(input.home, ".paseo/config.json");
  const auth = join(input.home, ".pi/agent/auth.json");
  write(paseo, {
    agents: {
      providers: {
        "pi-ax": { obsolete: true },
        custom: { command: ["custom"] },
      },
    },
    daemon: { port: 1234 },
    theme: "dark",
  });
  write(auth, { sentinel: "untouched" });
  const result = syncManagedConfigs(input);
  assert.equal(result.status, "synchronized");
  const observed = JSON.parse(readFileSync(paseo, "utf-8"));
  assert.equal(observed.agents.providers["pi-ax"].obsolete, undefined);
  assert.deepEqual(observed.agents.providers.custom, { command: ["custom"] });
  assert.equal(observed.daemon.port, 1234);
  assert.equal(observed.theme, "dark");
  assert.equal(
    observed.agents.providers["pi-ax"].command[2],
    join(input.home, ".agents/hooks/pi/index.ts"),
  );
  assert.equal(
    observed.agents.providers["pi-ax"].env.DESCRIPTION,
    "literal ~/ text",
  );
  assert.equal(readFileSync(auth, "utf-8"), '{"sentinel":"untouched"}');
  assert.equal(
    JSON.parse(readFileSync(join(input.home, ".pi/agent/models.json"), "utf-8"))
      .providers["cloudflare-ai-gateway"].modelOverrides[
      "workers-ai/@cf/zai-org/glm-5.3"
    ].maxTokens,
    16384,
  );
  assert.equal(
    lstatSync(join(input.home, ".pi/agent/settings.json")).mode & 0o777,
    0o600,
  );
  assert.equal(inspectManagedConfigs(input).ok, true);
  assert.deepEqual(syncManagedConfigs(input).changedPaths, []);
});

test("RED pi-paseo-config: invalid JSON leaves every target unchanged", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ax-json-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = options(root);
  const pi = join(input.home, ".pi/agent/settings.json");
  const paseo = join(input.home, ".paseo/config.json");
  write(pi, { defaultProvider: "old" });
  write(paseo, {});
  writeFileSync(paseo, "invalid json");
  assert.throws(() => syncManagedConfigs(input), /json_invalid/);
  assert.equal(readFileSync(pi, "utf-8"), '{"defaultProvider":"old"}');
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
