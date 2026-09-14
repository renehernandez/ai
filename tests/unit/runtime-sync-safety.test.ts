import assert from "node:assert/strict";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareManagedConfigs } from "../../scripts/ax/config-sync.ts";
import {
  type AxRuntimeConfig,
  syncRuntime,
} from "../../scripts/ax/runtime-sync.ts";

type Fixture = {
  sourceRoot: string;
  runtimeRoot: string;
  installRoot: string;
  config: AxRuntimeConfig;
};

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "runtime-sync-safety-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function fixture(root: string): Fixture {
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const installRoot = join(root, "installed");
  for (const name of ["explore", "plan", "execute", "review", "finish"]) {
    const skill = join(sourceRoot, "skills", name);
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), `# ${name}\n`, "utf-8");
  }
  mkdirSync(join(sourceRoot, "instructions"), { recursive: true });
  writeFileSync(join(sourceRoot, "instructions", "AGENTS.md"), "# Agents\n");

  return {
    sourceRoot,
    runtimeRoot,
    installRoot,
    config: {
      version: 1,
      runtime: {
        retiredSkills: [],
        canonicalSkillsDir: join(installRoot, "agents", "skills"),
        skillSymlinkTargets: [join(installRoot, "codex", "skills")],
        instructionSymlinkTargets: {
          agents: join(installRoot, "agents"),
          codex: join(installRoot, "codex"),
        },
      },
      profiles: {
        personal: {
          include: ["modes"],
          paths: [
            {
              sourcePath: "instructions/AGENTS.md",
              targetPath: "AGENTS.md",
            },
          ],
        },
      },
      blocks: {
        modes: {
          skills: [
            {
              localPath: "skills",
              names: ["explore", "plan", "execute", "review", "finish"],
            },
          ],
        },
      },
    },
  };
}

test("candidate validation completes before existing targets are replaced", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const target = join(
      input.installRoot,
      "agents",
      "skills",
      "explore",
      "SKILL.md",
    );
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, "# Existing\n", "utf-8");
    rmSync(join(input.sourceRoot, "skills", "finish", "SKILL.md"));

    assert.throws(
      () => syncRuntime({ ...input, profile: "personal" }),
      /skill_missing/,
    );
    assert.equal(readFileSync(target, "utf-8"), "# Existing\n");
  });
});

test("runtime configuration rejects escapes and overlapping target roots", () => {
  const scenarios: Array<{
    mutate: (input: Fixture, root: string) => void;
    expected: RegExp;
  }> = [
    {
      mutate: (input) => {
        const source = input.config.blocks.modes.skills?.[0];
        if (source) source.names = ["../escape"];
      },
      expected: /skill_name_invalid/,
    },
    {
      mutate: (input) => {
        input.config.profiles.personal.paths = [
          {
            sourcePath: "instructions/AGENTS.md",
            targetPath: "../AGENTS.md",
          },
        ];
      },
      expected: /instruction_target_path_invalid/,
    },
    {
      mutate: (input) => {
        input.config.runtime.skillSymlinkTargets = [
          input.config.runtime.canonicalSkillsDir,
        ];
      },
      expected: /runtime_root_overlap/,
    },
  ];

  for (const scenario of scenarios) {
    withTempDir((root) => {
      const input = fixture(root);
      scenario.mutate(input, root);
      assert.throws(
        () => syncRuntime({ ...input, profile: "personal" }),
        scenario.expected,
      );
    });
  }
});

test("runtime profile selection is explicit and locally persisted", () => {
  withTempDir((root) => {
    const input = fixture(root);
    assert.throws(
      () => syncRuntime({ ...input, profile: "missing" }),
      /selected_profile_unknown.*missing.*personal/,
    );

    const first = syncRuntime({ ...input, profile: "personal" });
    assert.equal(first.selectedProfile, "personal");
    assert.equal(syncRuntime(input).selectedProfile, "personal");
    assert.throws(
      () => syncRuntime({ ...input, surface: "skills", profile: "personal" }),
      /profile_selection_scoped/,
    );
  });
});

test("config, assets and profile switch commit together and roll back with private permissions", () => {
  withTempDir((root) => {
    const input = fixture(root);
    input.config.profiles.work = { ...input.config.profiles.personal };
    syncRuntime({ ...input, profile: "personal" });
    const home = join(root, "config-home");
    const target = join(home, ".pi/agent/settings.json");
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, '{"defaultModel":"old"}');
    chmodSync(target, 0o600);
    input.config.runtime.configs = {
      pi: {
        target: "~/.pi/agent/settings.json",
        managedPaths: [{ path: ["defaultModel"], value: "new" }],
      },
    };
    const configOptions = {
      ...input,
      home,
      liveHome: join(root, "live"),
      sourceVerified: false,
    };
    writeFileSync(
      join(input.sourceRoot, "instructions/AGENTS.md"),
      "# Changed\n",
    );
    assert.throws(
      () =>
        syncRuntime({
          ...input,
          profile: "work",
          preparedConfigs: prepareManagedConfigs(configOptions),
          transactionFault: (point) => {
            if (point === `after-target:${target}`)
              throw new Error("injected config failure");
          },
        }),
      /injected config failure/,
    );
    assert.equal(readFileSync(target, "utf-8"), '{"defaultModel":"old"}');
    assert.equal(lstatSync(target).mode & 0o777, 0o600);
    assert.equal(
      readFileSync(join(input.installRoot, "agents/AGENTS.md"), "utf-8"),
      "# Agents\n",
    );
    assert.equal(
      JSON.parse(
        readFileSync(join(input.runtimeRoot, "selected-profile.json"), "utf-8"),
      ).selectedProfile,
      "personal",
    );
    syncRuntime({
      ...input,
      profile: "work",
      preparedConfigs: prepareManagedConfigs(configOptions),
    });
    assert.equal(JSON.parse(readFileSync(target, "utf-8")).defaultModel, "new");
    assert.equal(lstatSync(target).mode & 0o777, 0o600);
    assert.equal(
      readFileSync(join(input.installRoot, "agents/AGENTS.md"), "utf-8"),
      "# Changed\n",
    );
    assert.equal(
      JSON.parse(
        readFileSync(join(input.runtimeRoot, "selected-profile.json"), "utf-8"),
      ).selectedProfile,
      "work",
    );
  });
});

test("concurrent config modification aborts combined sync before replacing assets", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const home = join(root, "config-home");
    input.config.runtime.configs = {
      pi: {
        target: "~/.pi/agent/settings.json",
        managedPaths: [{ path: ["defaultModel"], value: "new" }],
      },
    };
    const preparedConfigs = prepareManagedConfigs({
      ...input,
      home,
      liveHome: join(root, "live"),
      sourceVerified: false,
    });
    const target = join(home, ".pi/agent/settings.json");
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, '{"concurrent":true}');
    assert.throws(
      () => syncRuntime({ ...input, profile: "personal", preparedConfigs }),
      /target_changed/,
    );
    assert.equal(readFileSync(target, "utf-8"), '{"concurrent":true}');
    assert.throws(
      () => lstatSync(join(input.installRoot, "agents/AGENTS.md")),
      /ENOENT/,
    );
  });
});
