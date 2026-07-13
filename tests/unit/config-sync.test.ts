import assert from "node:assert/strict";
import {
  chmodSync,
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
import test from "node:test";
import {
  applyPreparedManagedConfigs,
  inspectManagedConfigs,
  prepareManagedConfigs,
  syncManagedConfigs,
  validateManagedConfigs,
} from "../../scripts/ax/config-sync.ts";
import type { AxRuntimeConfig } from "../../scripts/ax/runtime-sync.ts";

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "managed-config-sync-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function config(): AxRuntimeConfig {
  return {
    version: 1,
    runtime: {
      installedProfiles: ["personal"],
      policyProfile: "personal",
      canonicalSkillsDir: "~/.agents/skills",
      skillSymlinkTargets: ["~/.codex/skills"],
      configs: {
        codex: {
          target: "~/.codex/config.toml",
          managed: {
            features: {
              memories: true,
              multi_agent_v2: {
                enabled: true,
                max_concurrent_threads_per_session: 10,
              },
            },
            agents: { max_depth: 1 },
            memories: {
              generate_memories: true,
              use_memories: true,
            },
          },
        },
      },
    },
    profiles: { personal: { include: [], paths: [] } },
    blocks: {},
  };
}

function matchingToml(): string {
  return `model = "gpt-test"

[features]
js_repl = false
memories = true

[features.multi_agent_v2]
enabled = true
max_concurrent_threads_per_session = 10

[agents]
max_depth = 1

[memories]
generate_memories = true
use_memories = true

[projects."/machine/specific/path"]
trust_level = "trusted"
`;
}

function options(root: string) {
  const home = join(root, "isolated-home");
  return {
    sourceRoot: join(root, "source"),
    config: config(),
    runtimeRoot: join(root, "isolated-runtime"),
    home,
    liveHome: join(root, "live-home"),
    sourceVerified: false,
    validator: (candidateHome: string) => {
      assert.match(
        readFileSync(join(candidateHome, "config.toml"), "utf-8"),
        /max_concurrent_threads_per_session = 10/,
      );
      return { status: 0 };
    },
  };
}

function writeConfig(home: string, content: string): string {
  const path = join(home, ".codex", "config.toml");
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf-8");
  return path;
}

test("status reports exact managed paths and path-specific drift", () => {
  withTempDir((root) => {
    const input = options(root);
    const path = writeConfig(input.home, matchingToml());
    const matching = inspectManagedConfigs(input);

    assert.equal(matching.ok, true);
    assert.deepEqual(matching.tools.codex.managedPaths, [
      "agents.max_depth",
      "features.memories",
      "features.multi_agent_v2.enabled",
      "features.multi_agent_v2.max_concurrent_threads_per_session",
      "memories.generate_memories",
      "memories.use_memories",
    ]);

    writeFileSync(
      path,
      matchingToml().replace("max_depth = 1", "max_depth = 2"),
    );
    const drifted = inspectManagedConfigs(input);
    assert.equal(drifted.ok, false);
    assert.deepEqual(drifted.tools.codex.drift, [
      {
        path: "agents.max_depth",
        expected: 1,
        actual: 2,
        reason: "different",
      },
    ]);
    assert.match(drifted.findings[0], /codex\.agents\.max_depth/);
  });
});

test("sync changes managed scalars while preserving unowned source content", () => {
  withTempDir((root) => {
    const input = options(root);
    const original = matchingToml()
      .replace("memories = true", 'memories = "wrong" # managed comment')
      .replace("max_depth = 1", "max_depth = 2");
    const path = writeConfig(input.home, `# machine comment\n${original}`);

    const result = syncManagedConfigs(input);
    const synchronized = readFileSync(path, "utf-8");

    assert.deepEqual(result.changedPaths, [path]);
    assert.match(synchronized, /^# machine comment/m);
    assert.match(synchronized, /memories = true # managed comment/);
    assert.match(synchronized, /max_depth = 1/);
    assert.match(synchronized, /js_repl = false/);
    assert.match(
      synchronized,
      /\[projects\."\/machine\/specific\/path"]\ntrust_level = "trusted"/,
    );
  });
});

test("sync inserts managed keys before an array-of-tables boundary", () => {
  withTempDir((root) => {
    const input = options(root);
    const original = matchingToml()
      .replace("[agents]\nmax_depth = 1", "[agents]")
      .replace(
        "[memories]",
        '[[plugins]]\nname = "machine-plugin"\n\n[memories]',
      );
    const path = writeConfig(input.home, original);

    syncManagedConfigs(input);

    const synchronized = readFileSync(path, "utf-8");
    assert.match(
      synchronized,
      /\[agents]\nmax_depth = 1\n\n\[\[plugins]]\nname = "machine-plugin"/,
    );
  });
});

test("sync creates a minimal private config when the target is absent", () => {
  withTempDir((root) => {
    const input = options(root);
    const path = join(input.home, ".codex", "config.toml");

    const result = syncManagedConfigs(input);

    assert.deepEqual(result.changedPaths, [path]);
    assert.equal(lstatSync(path).mode & 0o777, 0o600);
    assert.equal(inspectManagedConfigs(input).ok, true);
  });
});

test("matching sync validates but does not rewrite the target", () => {
  withTempDir((root) => {
    const input = options(root);
    const path = writeConfig(input.home, matchingToml());
    chmodSync(path, 0o640);
    const prepared = prepareManagedConfigs(input);
    let applyCalled = false;

    const result = applyPreparedManagedConfigs(prepared, {
      beforeApply: () => {
        applyCalled = true;
      },
    });

    assert.deepEqual(result.changedPaths, []);
    assert.equal(applyCalled, false);
    assert.equal(lstatSync(path).mode & 0o777, 0o640);
    assert.equal(readFileSync(path, "utf-8"), matchingToml());
  });
});

test("validator failure leaves the original target unchanged", () => {
  withTempDir((root) => {
    const input = options(root);
    const path = writeConfig(
      input.home,
      matchingToml().replace("max_depth = 1", "max_depth = 2"),
    );
    const original = readFileSync(path, "utf-8");

    assert.throws(
      () =>
        prepareManagedConfigs({
          ...input,
          validator: () => ({ status: 1, stderr: "strict config rejected" }),
        }),
      /managed_config_validator_failed: strict config rejected/,
    );
    assert.equal(readFileSync(path, "utf-8"), original);
  });
});

test("concurrent target changes abort the atomic apply", () => {
  withTempDir((root) => {
    const input = options(root);
    const path = writeConfig(
      input.home,
      matchingToml().replace("max_depth = 1", "max_depth = 2"),
    );
    const prepared = prepareManagedConfigs(input);
    const desktopUpdate = `${matchingToml()}\n# desktop update\n`;

    assert.throws(
      () =>
        applyPreparedManagedConfigs(prepared, {
          beforeApply: () => writeFileSync(path, desktopUpdate, "utf-8"),
        }),
      /managed_config_target_changed/,
    );
    assert.equal(readFileSync(path, "utf-8"), desktopUpdate);
  });
});

test("unverified source requires isolated HOME as well as runtime state", () => {
  withTempDir((root) => {
    const liveHome = join(root, "live-home");
    const input = {
      ...options(root),
      home: liveHome,
      liveHome,
    };
    writeConfig(liveHome, matchingToml());

    assert.throws(
      () => syncManagedConfigs(input),
      /config sync requires isolated HOME and runtime roots/,
    );
  });
});

test("physical HOME identity prevents a symlink alias from reaching live config", () => {
  withTempDir((root) => {
    const liveHome = join(root, "live-home");
    writeConfig(liveHome, matchingToml());
    const homeAlias = join(root, "isolated-looking-home");
    symlinkSync(liveHome, homeAlias);
    const input = {
      ...options(root),
      home: homeAlias,
      liveHome,
    };

    assert.throws(
      () => syncManagedConfigs(input),
      /config sync requires isolated HOME and runtime roots/,
    );
  });
});

test("symlinked targets and noncanonical managed paths fail closed", () => {
  withTempDir((root) => {
    const input = options(root);
    const codexDir = join(input.home, ".codex");
    mkdirSync(codexDir, { recursive: true });
    const external = join(root, "external.toml");
    writeFileSync(external, matchingToml());
    symlinkSync(external, join(codexDir, "config.toml"));

    assert.equal(inspectManagedConfigs(input).ok, false);
    assert.match(
      inspectManagedConfigs(input).findings[0],
      /managed_config_target_unsafe/,
    );

    rmSync(join(codexDir, "config.toml"));
    writeFileSync(
      join(codexDir, "config.toml"),
      `features.memories = false\n\n[features.multi_agent_v2]\nenabled = true\nmax_concurrent_threads_per_session = 10\n\n[agents]\nmax_depth = 1\n\n[memories]\ngenerate_memories = true\nuse_memories = true\n`,
    );
    assert.throws(
      () => prepareManagedConfigs(input),
      /managed_config_path_uneditable: features.memories/,
    );
  });
});

test("validate remains read-only and requires convergence plus Codex config loading", () => {
  withTempDir((root) => {
    const input = options(root);
    const path = writeConfig(input.home, matchingToml());

    const report = validateManagedConfigs(input);
    assert.equal(report.tools.codex.validator, "passed");
    assert.equal(readFileSync(path, "utf-8"), matchingToml());

    writeFileSync(
      path,
      matchingToml().replace("use_memories = true", "use_memories = false"),
    );
    const drifted = validateManagedConfigs({
      ...input,
      validator: () => {
        throw new Error("validator must not run for a drifted config");
      },
    });
    assert.equal(drifted.ok, false);
    assert.equal(drifted.tools.codex.validator, "not_run");
    assert.match(drifted.findings[0], /memories\.use_memories/);
  });
});
