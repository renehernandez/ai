import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  type AxRuntimeConfig,
  inspectRuntime,
  syncRuntime,
  validateRuntime,
} from "../../scripts/ax/runtime-sync.ts";

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "runtime-authoritative-sync-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function fixture(root: string): {
  sourceRoot: string;
  runtimeRoot: string;
  installRoot: string;
  config: AxRuntimeConfig;
} {
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const installRoot = join(root, "installed");
  for (const name of ["explore", "plan", "execute", "review", "finish"]) {
    const skill = join(sourceRoot, "skills", name);
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), `# ${name}\n`, "utf-8");
  }
  mkdirSync(join(sourceRoot, "instructions"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "instructions", "AGENTS.md"),
    "# Agents\n",
    "utf-8",
  );
  mkdirSync(join(sourceRoot, "hooks"), { recursive: true });
  writeFileSync(join(sourceRoot, "hooks", "startup.ts"), "export {};\n");

  const config: AxRuntimeConfig = {
    version: 1,
    runtime: {
      installedProfiles: ["personal"],
      policyProfile: "personal",
      retiredSkills: ["retired-skill"],
      canonicalSkillsDir: join(installRoot, "agents", "skills"),
      skillSymlinkTargets: [join(installRoot, "codex", "skills")],
      instructionSymlinkTargets: {
        agents: join(installRoot, "agents"),
        codex: join(installRoot, "codex"),
      },
      hooks: {
        sourceDir: "hooks",
        canonicalDir: join(installRoot, "agents", "hooks"),
        targets: { codex: join(installRoot, "codex", "hooks") },
      },
    },
    profiles: {
      personal: {
        include: ["modes"],
        paths: [
          { sourcePath: "instructions/AGENTS.md", targetPath: "AGENTS.md" },
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
  };
  return { sourceRoot, runtimeRoot, installRoot, config };
}

test("sync authoritatively replaces declared targets without adoption or a manifest", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const explore = join(
      input.installRoot,
      "agents",
      "skills",
      "explore",
      "SKILL.md",
    );
    const retired = join(
      input.installRoot,
      "agents",
      "skills",
      "retired-skill",
      "SKILL.md",
    );
    const unrelated = join(
      input.installRoot,
      "agents",
      "skills",
      "unrelated",
      "SKILL.md",
    );
    for (const path of [explore, retired, unrelated]) {
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "# Existing\n", "utf-8");
    }
    mkdirSync(join(input.runtimeRoot, "transactions", "old"), {
      recursive: true,
    });
    mkdirSync(join(input.runtimeRoot, "backups", "old"), { recursive: true });
    writeFileSync(
      join(input.runtimeRoot, "managed-runtime.json"),
      "{}\n",
      "utf-8",
    );
    writeFileSync(join(input.runtimeRoot, "mutation.lock"), "{}\n", "utf-8");

    const first = syncRuntime(input);
    assert.equal(first.status, "synchronized");
    assert.equal(readFileSync(explore, "utf-8"), "# explore\n");
    assert.equal(existsSync(join(retired, "..")), false);
    assert.equal(readFileSync(unrelated, "utf-8"), "# Existing\n");
    assert.equal(
      existsSync(join(input.runtimeRoot, "managed-runtime.json")),
      false,
    );
    assert.equal(existsSync(join(input.runtimeRoot, "transactions")), false);
    assert.equal(existsSync(join(input.runtimeRoot, "backups")), false);
    assert.equal(existsSync(join(input.runtimeRoot, "mutation.lock")), false);

    writeFileSync(explore, "# Local drift\n", "utf-8");
    const second = syncRuntime(input);
    assert.equal(second.status, "synchronized");
    assert.equal(readFileSync(explore, "utf-8"), "# explore\n");
    assert.equal(validateRuntime(input).ok, true);

    rmSync(explore);
    assert.throws(() => validateRuntime(input), /runtime_skill_invalid/);
  });
});

test("scoped sync initializes its declared surface without runtime state", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const result = syncRuntime({ ...input, surface: "hooks" });

    assert.equal(result.status, "synchronized");
    assert.equal(
      existsSync(join(input.installRoot, "agents", "hooks", "startup.ts")),
      true,
    );
    assert.equal(
      existsSync(join(input.runtimeRoot, "managed-runtime.json")),
      false,
    );
  });
});

test("status reports invalid config without a secondary exception", () => {
  withTempDir((root) => {
    const input = fixture(root);
    input.config.runtime.installedProfiles = [];

    const report = inspectRuntime(input);

    assert.equal(report.ok, false);
    assert.match(report.findings.join("\n"), /installedProfiles is required/);
  });
});

test("duplicate skill names from different sources fail deterministically", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const duplicate = join(input.sourceRoot, "other-skills", "explore");
    mkdirSync(duplicate, { recursive: true });
    writeFileSync(join(duplicate, "SKILL.md"), "# Other explore\n", "utf-8");
    input.config.blocks.other = {
      skills: [{ localPath: "other-skills", names: ["explore"] }],
    };
    input.config.profiles.personal.include.push("other");

    assert.throws(() => syncRuntime(input), /candidate_collision/);
  });
});
