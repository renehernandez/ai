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
import { TransactionInterruption } from "../../scripts/ax/transaction-engine.ts";

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
  const workSkill = join(sourceRoot, "work-skills", "work-only");
  mkdirSync(workSkill, { recursive: true });
  writeFileSync(join(workSkill, "SKILL.md"), "# work-only\n", "utf-8");
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
      work: {
        include: ["modes", "work"],
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
      work: {
        skills: [{ localPath: "work-skills", names: ["work-only"] }],
      },
    },
  };
  mkdirSync(runtimeRoot, { recursive: true });
  writeFileSync(
    join(runtimeRoot, "selected-profile.json"),
    '{"schemaVersion":1,"selectedProfile":"personal"}\n',
    "utf-8",
  );
  return { sourceRoot, runtimeRoot, installRoot, config };
}

test("sync authoritatively replaces declared targets using persisted profile state", () => {
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
    writeFileSync(
      join(input.runtimeRoot, "managed-runtime.json"),
      "{}\n",
      "utf-8",
    );

    const first = syncRuntime(input);
    assert.equal(first.status, "synchronized");
    assert.equal(readFileSync(explore, "utf-8"), "# explore\n");
    assert.equal(existsSync(join(retired, "..")), false);
    assert.equal(readFileSync(unrelated, "utf-8"), "# Existing\n");
    assert.equal(
      existsSync(join(input.runtimeRoot, "managed-runtime.json")),
      false,
    );
    assert.equal(
      JSON.parse(
        readFileSync(join(input.runtimeRoot, "selected-profile.json"), "utf-8"),
      ).selectedProfile,
      "personal",
    );

    writeFileSync(explore, "# Local drift\n", "utf-8");
    const second = syncRuntime(input);
    assert.equal(second.status, "synchronized");
    assert.equal(readFileSync(explore, "utf-8"), "# explore\n");
    assert.equal(validateRuntime(input).ok, true);

    rmSync(explore);
    assert.throws(() => validateRuntime(input), /runtime_skill_invalid/);
  });
});

test("scoped sync uses persisted profile state", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const result = syncRuntime({ ...input, surface: "hooks" });

    assert.equal(result.status, "synchronized");
    assert.equal(
      existsSync(join(input.installRoot, "agents", "hooks", "startup.ts")),
      true,
    );
    assert.equal(result.selectedProfile, "personal");
  });
});

test("status reports invalid config without a secondary exception", () => {
  withTempDir((root) => {
    const input = fixture(root);
    input.config.profiles = {};

    const report = inspectRuntime(input);

    assert.equal(report.ok, false);
    assert.match(report.findings.join("\n"), /profiles are required/);
  });
});

test("uninitialized runtime requires an explicit profile before network or mutation", () => {
  withTempDir((root) => {
    const input = fixture(root);
    rmSync(join(input.runtimeRoot, "selected-profile.json"));

    assert.throws(
      () => syncRuntime(input),
      /runtime_profile_uninitialized.*ax sync --profile <name>.*personal/,
    );
    assert.equal(existsSync(input.installRoot), false);

    const result = syncRuntime({ ...input, profile: "personal" });
    assert.equal(result.selectedProfile, "personal");
    assert.equal(inspectRuntime(input).selectedProfile, "personal");
  });
});

test("malformed or unknown persisted profile state fails read-only inspection", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const statePath = join(input.runtimeRoot, "selected-profile.json");
    writeFileSync(statePath, "{not-json}\n", "utf-8");
    assert.match(
      inspectRuntime(input).findings.join("\n"),
      /selected_profile_invalid/,
    );

    writeFileSync(
      statePath,
      '{"schemaVersion":1,"selectedProfile":"missing"}\n',
      "utf-8",
    );
    assert.match(
      inspectRuntime(input).findings.join("\n"),
      /selected_profile_unknown.*missing.*personal.*work/,
    );
  });
});

test("switching profiles removes previous-only paths and commits selection last", () => {
  withTempDir((root) => {
    const input = fixture(root);
    syncRuntime(input);
    const workOnly = join(
      input.installRoot,
      "agents",
      "skills",
      "work-only",
      "SKILL.md",
    );

    syncRuntime({ ...input, profile: "work" });
    assert.equal(readFileSync(workOnly, "utf-8"), "# work-only\n");
    assert.equal(inspectRuntime(input).selectedProfile, "work");

    syncRuntime({ ...input, profile: "personal" });
    assert.equal(existsSync(join(workOnly, "..")), false);
    assert.equal(inspectRuntime(input).selectedProfile, "personal");
  });
});

test("failed profile switch restores runtime and previous selection", () => {
  withTempDir((root) => {
    const input = fixture(root);
    syncRuntime(input);
    let injected = false;

    assert.throws(
      () =>
        syncRuntime({
          ...input,
          profile: "work",
          transactionFault: (point) => {
            if (!injected && point.startsWith("after-target:")) {
              injected = true;
              throw new Error("injected profile switch failure");
            }
          },
        }),
      /injected profile switch failure/,
    );
    assert.equal(inspectRuntime(input).selectedProfile, "personal");
    assert.equal(
      existsSync(
        join(input.installRoot, "agents", "skills", "work-only", "SKILL.md"),
      ),
      false,
    );
    assert.equal(validateRuntime(input).ok, true);
  });
});

test("interrupted profile switch is reported and recovered by the next sync", () => {
  withTempDir((root) => {
    const input = fixture(root);
    syncRuntime(input);
    let interrupted = false;

    assert.throws(
      () =>
        syncRuntime({
          ...input,
          profile: "work",
          transactionFault: (point) => {
            if (!interrupted && point.startsWith("after-target:")) {
              interrupted = true;
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    const interruptedStatus = inspectRuntime(input);
    assert.equal(interruptedStatus.selectedProfile, "personal");
    assert.equal(interruptedStatus.transactions.length, 1);
    assert.match(
      interruptedStatus.findings.join("\n"),
      /incomplete_transaction/,
    );

    syncRuntime({ ...input, profile: "work" });
    const recoveredStatus = inspectRuntime(input);
    assert.equal(recoveredStatus.ok, true);
    assert.equal(recoveredStatus.selectedProfile, "work");
    assert.equal(recoveredStatus.transactions.length, 0);
    assert.equal(
      readFileSync(
        join(input.installRoot, "agents", "skills", "work-only", "SKILL.md"),
        "utf-8",
      ),
      "# work-only\n",
    );
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
