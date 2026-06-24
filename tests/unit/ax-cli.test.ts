import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import type { Command } from "commander";

import {
  claudeStartupHookStatus,
  codexStartupHookStatus,
  collectOpenSpecProjectSignals,
  createOpenSpecInstallSetup,
  createProgram,
  createRuntimeBackup,
  createRuntimeInvocationContext,
  inspectOpenSpecState,
  registerClaudeStartupHook,
  registerCodexStartupHook,
  renderOpenSpecConfigYaml,
} from "../../scripts/ax.ts";
import {
  derivePlanArtifactIdentity,
  listPlanArtifacts,
  recordPlanArtifact,
} from "../../scripts/plan-artifacts.ts";

const repoRoot = process.cwd();

type ParsedCommand = {
  scope?: string;
  command: string;
  shimCommand?: string;
  profileNames?: string[];
  allProfiles?: boolean;
  configPath: string;
};

function parseCommand(args: string[]): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const program = createProgram((input) => {
    commands.push(input);
  });
  configureProgramForTest(program);
  program.parse(["node", "ax", ...args], { from: "node" });
  return commands;
}

function parseInvalidCommand(args: string[]): Error {
  const program = createProgram(() => undefined);
  configureProgramForTest(program);

  try {
    program.parse(["node", "ax", ...args], { from: "node" });
  } catch (error) {
    assert.ok(error instanceof Error);
    return error;
  }
  assert.fail("Expected command parsing to fail");
}

function configureProgramForTest(command: Command): void {
  command.exitOverride();
  command.configureOutput({
    writeOut: () => undefined,
    writeErr: () => undefined,
  });
  for (const subcommand of command.commands) {
    configureProgramForTest(subcommand);
  }
}

function withTempDir(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "ax-unit-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempCwd(callback: (directory: string) => void): void {
  withTempDir((directory) => {
    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      callback(process.cwd());
    } finally {
      process.chdir(originalCwd);
    }
  });
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function createPlanArtifactTarget(directory: string): string {
  const targetRepo = join(directory, "target-repo");
  mkdirSync(join(targetRepo, ".agents", "plans"), { recursive: true });
  git(targetRepo, ["init"]);
  git(targetRepo, [
    "remote",
    "add",
    "origin",
    "git@git.fullscript.io:team/target-repo.git",
  ]);
  writeFileSync(
    join(targetRepo, ".agents", "plans", "example.md"),
    "# Example plan\n",
    "utf-8",
  );
  writeFileSync(
    join(targetRepo, "reviewer-selection.yaml"),
    "reviewers:\n  - nitro\n",
    "utf-8",
  );
  return targetRepo;
}

function testOpenSpecConfig() {
  return {
    tools: ["codex", "claude"],
    schema: "spec-driven",
    profile: "custom",
    delivery: "both",
    workflows: ["propose", "explore", "apply", "archive"],
    context: "",
    rules: {
      proposal: ["State goals clearly."],
      tasks: ["Keep tasks small."],
    },
    canonicalSkillsDir: ".agents/skills",
    canonicalCommandsDir: ".agents/commands",
    backupsRoot: "backups",
    reusableScripts: [],
    skillTargets: {
      codex: ".codex/skills",
      claude: ".claude/skills",
    },
    commandTargets: {
      claude: ".claude/commands",
    },
  };
}

test("Commander routes scoped skills commands", () => {
  const [parsed] = parseCommand([
    "skills",
    "validate",
    "--profile",
    "work",
    "--config",
    "custom.json",
  ]);

  assert.equal(parsed.scope, "skills");
  assert.equal(parsed.command, "validate");
  assert.deepEqual(parsed.profileNames, ["work"]);
  assert.equal(parsed.configPath, resolve("custom.json"));
});

test("Commander routes top-level wrapper commands", () => {
  const [parsed] = parseCommand(["status", "--profile", "personal"]);

  assert.equal(parsed.scope, undefined);
  assert.equal(parsed.command, "status");
  assert.deepEqual(parsed.profileNames, ["personal"]);
  assert.equal(parsed.configPath, join(repoRoot, "ax.config.json"));
});

test("Commander routes scoped OpenSpec commands", () => {
  const [parsed] = parseCommand([
    "openspec",
    "install",
    "--config",
    "custom.json",
  ]);

  assert.equal(parsed.scope, "openspec");
  assert.equal(parsed.command, "install");
  assert.equal(parsed.configPath, resolve("custom.json"));
});

test("Commander routes scoped hooks commands", () => {
  const [parsed] = parseCommand([
    "hooks",
    "install",
    "--config",
    "custom.json",
  ]);

  assert.equal(parsed.scope, "hooks");
  assert.equal(parsed.command, "install");
  assert.equal(parsed.configPath, resolve("custom.json"));
});

test("Commander routes shim commands", () => {
  const [parsed] = parseCommand(["shim", "status"]);

  assert.equal(parsed.scope, undefined);
  assert.equal(parsed.command, "status");
  assert.equal(parsed.shimCommand, "status");
  assert.equal(parsed.configPath, join(repoRoot, "ax.config.json"));
});

test("Runtime invocation context separates source and target roots", () => {
  withTempDir((directory) => {
    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      const targetRoot = process.cwd();
      const context = createRuntimeInvocationContext();

      assert.equal(context.sourceRoot, repoRoot);
      assert.equal(context.targetRoot, targetRoot);
      assert.equal(context.configPath, join(repoRoot, "ax.config.json"));
    } finally {
      process.chdir(originalCwd);
    }
  });
});

test("Runtime invocation context uses AX executable path env var", () => {
  const originalAxExecutablePath = process.env.AX_EXECUTABLE_PATH;
  const originalAgentRuntimeExecutablePath =
    process.env.AGENT_RUNTIME_EXECUTABLE_PATH;
  try {
    process.env.AX_EXECUTABLE_PATH = "/tmp/ax-bin";
    process.env.AGENT_RUNTIME_EXECUTABLE_PATH = "/tmp/agent-runtime-bin";

    const context = createRuntimeInvocationContext();

    assert.equal(context.executablePath, resolve("/tmp/ax-bin"));
  } finally {
    if (originalAxExecutablePath === undefined) {
      delete process.env.AX_EXECUTABLE_PATH;
    } else {
      process.env.AX_EXECUTABLE_PATH = originalAxExecutablePath;
    }
    if (originalAgentRuntimeExecutablePath === undefined) {
      delete process.env.AGENT_RUNTIME_EXECUTABLE_PATH;
    } else {
      process.env.AGENT_RUNTIME_EXECUTABLE_PATH =
        originalAgentRuntimeExecutablePath;
    }
  }
});

test("runtime config manages helper scripts imported by installed planning skills", () => {
  const config = JSON.parse(
    readFileSync(join(repoRoot, "ax.config.json"), "utf-8"),
  ) as { runtime?: { reusableScripts?: string[] } };
  const reusableScripts = new Set(config.runtime?.reusableScripts ?? []);

  for (const helper of [
    "scripts/nitro-feedback-gate.ts",
    "scripts/plan-artifacts.ts",
    "scripts/planning-contracts.ts",
    "scripts/stack-state.ts",
  ]) {
    assert.ok(reusableScripts.has(helper), `${helper} must be reusable`);
  }
});

test("plans artifact record stores support artifacts under target repo identity", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });

    assert.equal(result.status, "recorded");
    assert.equal(result.repoKey, "git.fullscript.io/team/target-repo");
    assert.equal(result.normalizedPlanPath, ".agents/plans/example.md");
    assert.match(result.planPathHash, /^[a-f0-9]{64}$/);
    assert.match(result.planSlug, /^example-[a-f0-9]{12}$/);
    assert.match(result.planContentFingerprint, /^[a-f0-9]{64}$/);
    assert.match(
      result.privateWorkspaceRelativePath,
      /^repos\/sha256-[a-f0-9]+\/plans\/example-[a-f0-9]{12}\/revisions\/plan-[a-f0-9]{16}\/artifacts\/reviewer_selection-[a-f0-9]+\.yaml$/,
    );
    assert.match(
      result.metadataRelativePath,
      /^repos\/sha256-[a-f0-9]+\/plans\/example-[a-f0-9]{12}\/revisions\/plan-[a-f0-9]{16}\/metadata\.json$/,
    );
    assert.match(
      result.manifestRelativePath,
      /^repos\/sha256-[a-f0-9]+\/plans\/example-[a-f0-9]{12}\/manifest\.json$/,
    );
    assert.match(
      result.indexRelativePath,
      /^repos\/sha256-[a-f0-9]+\/plans\/example-[a-f0-9]{12}\/index\.jsonl$/,
    );
    assert.ok(
      existsSync(join(axPlansRoot, result.privateWorkspaceRelativePath)),
    );
    const manifest = JSON.parse(
      readFileSync(join(axPlansRoot, result.manifestRelativePath), "utf-8"),
    );
    assert.equal(manifest.version, 1);
    assert.equal(manifest.repoKey, "git.fullscript.io/team/target-repo");
    assert.equal(manifest.normalizedPlanPath, ".agents/plans/example.md");
    assert.equal(manifest.planPathHash, result.planPathHash);
    const workspaceRootRelativePath = result.manifestRelativePath.replace(
      /\/manifest\.json$/,
      "",
    );
    const metadataWorkspaceRelativePath = result.metadataRelativePath.slice(
      workspaceRootRelativePath.length + 1,
    );
    assert.deepEqual(manifest.revisions, [
      {
        revisionId: result.revisionId,
        createdAt: manifest.revisions[0].createdAt,
        metadataRelativePath: result.metadataRelativePath.slice(
          workspaceRootRelativePath.length + 1,
        ),
        planContentFingerprint: result.planContentFingerprint,
        artifacts: [
          {
            recordedAt: manifest.revisions[0].artifacts[0].recordedAt,
            artifactKind: "reviewer_selection",
            artifactContentFingerprint: result.artifactContentFingerprint,
            artifactRelativePath: result.artifactRelativePath,
          },
        ],
      },
    ]);
    const metadata = JSON.parse(
      readFileSync(join(axPlansRoot, result.metadataRelativePath), "utf-8"),
    );
    assert.equal(metadata.revisionId, result.revisionId);
    assert.equal(
      metadata.planContentFingerprint,
      result.planContentFingerprint,
    );
    assert.equal(metadata.metadataRelativePath, metadataWorkspaceRelativePath);
    assert.deepEqual(metadata.artifacts, manifest.revisions[0].artifacts);
    const indexRows = readFileSync(
      join(axPlansRoot, result.indexRelativePath),
      "utf-8",
    )
      .trim()
      .split("\n");
    assert.equal(indexRows.length, 1);
    assert.equal(JSON.parse(indexRows[0]).revisionId, result.revisionId);

    const duplicate = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    assert.equal(duplicate.revisionId, result.revisionId);
    assert.equal(
      readFileSync(join(axPlansRoot, result.indexRelativePath), "utf-8")
        .trim()
        .split("\n").length,
      1,
    );

    rmSync(join(axPlansRoot, result.indexRelativePath));
    const repairedIndex = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    assert.equal(repairedIndex.revisionId, result.revisionId);
    assert.equal(
      readFileSync(join(axPlansRoot, result.indexRelativePath), "utf-8")
        .trim()
        .split("\n").length,
      1,
    );

    writeFileSync(
      join(targetRepo, ".agents", "plans", "example.md"),
      "# Example plan\n\nUpdated\n",
      "utf-8",
    );
    const secondRevision = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    assert.notEqual(secondRevision.revisionId, result.revisionId);
    assert.notEqual(
      secondRevision.planContentFingerprint,
      result.planContentFingerprint,
    );
    const updatedManifest = JSON.parse(
      readFileSync(join(axPlansRoot, result.manifestRelativePath), "utf-8"),
    );
    assert.equal(updatedManifest.revisions.length, 2);
    assert.deepEqual(
      updatedManifest.revisions.map(
        (revision: { revisionId: string }) => revision.revisionId,
      ),
      [result.revisionId, secondRevision.revisionId],
    );
    assert.equal(
      readFileSync(join(axPlansRoot, result.indexRelativePath), "utf-8")
        .trim()
        .split("\n").length,
      2,
    );
  });
});

test("plans artifact list prints manifest and revision artifact records", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const missing = listPlanArtifacts({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      axPlansRoot,
    });
    assert.equal(missing.status, "missing");
    assert.equal(missing.repoKey, "git.fullscript.io/team/target-repo");
    assert.deepEqual(missing.revisions, []);
    assert.deepEqual(missing.artifacts, []);

    const recorded = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    const listed = listPlanArtifacts({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      axPlansRoot,
    });

    assert.equal(listed.status, "found");
    assert.equal(listed.repoKey, recorded.repoKey);
    assert.equal(listed.normalizedPlanPath, recorded.normalizedPlanPath);
    assert.equal(listed.planPathHash, recorded.planPathHash);
    assert.equal(listed.planSlug, recorded.planSlug);
    assert.equal(
      listed.planContentFingerprint,
      recorded.planContentFingerprint,
    );
    assert.equal(listed.manifestRelativePath, recorded.manifestRelativePath);
    assert.equal(listed.indexRelativePath, recorded.indexRelativePath);
    assert.equal(listed.revisions.length, 1);
    const manifest = JSON.parse(
      readFileSync(join(axPlansRoot, listed.manifestRelativePath), "utf-8"),
    );
    assert.equal(typeof listed.artifacts[0].recordedAt, "string");
    assert.deepEqual(listed.artifacts, [
      {
        revisionId: recorded.revisionId,
        planContentFingerprint: recorded.planContentFingerprint,
        recordedAt: manifest.revisions[0].artifacts[0].recordedAt,
        artifactKind: "reviewer_selection",
        artifactContentFingerprint: recorded.artifactContentFingerprint,
        artifactRelativePath: recorded.artifactRelativePath,
      },
    ]);
  });
});

test("plans artifact record rejects symlinked index files", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    const outside = join(directory, "outside-index.jsonl");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    rmSync(join(axPlansRoot, result.indexRelativePath));
    symlinkSync(outside, join(axPlansRoot, result.indexRelativePath));

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "reviewer_selection",
          filePath: "reviewer-selection.yaml",
          axPlansRoot,
        }),
      /index must be a regular file/,
    );
  });
});

test("plans artifact record command uses invocation target repo", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const home = join(directory, "home");
    mkdirSync(home, { recursive: true });
    const originalCwd = process.cwd();
    const originalHome = process.env.HOME;
    const originalLog = console.log;
    let output = "";
    let recordOutput = "";
    let listOutput = "";
    try {
      process.chdir(targetRepo);
      process.env.HOME = home;
      console.log = (value?: unknown) => {
        output += `${String(value)}\n`;
      };

      const program = createProgram();
      configureProgramForTest(program);
      program.parse(
        [
          "node",
          "ax",
          "plans",
          "artifact",
          "record",
          "--plan",
          ".agents/plans/example.md",
          "--kind",
          "reviewer_selection",
          "--file",
          "reviewer-selection.yaml",
          "--config",
          join(repoRoot, "ax.config.json"),
        ],
        { from: "node" },
      );
      recordOutput = output;

      output = "";
      const listProgram = createProgram();
      configureProgramForTest(listProgram);
      listProgram.parse(
        [
          "node",
          "ax",
          "plans",
          "artifact",
          "list",
          "--plan",
          ".agents/plans/example.md",
          "--config",
          join(repoRoot, "ax.config.json"),
        ],
        { from: "node" },
      );
      listOutput = output;
    } finally {
      console.log = originalLog;
      process.chdir(originalCwd);
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }
    }

    const recordResult = JSON.parse(recordOutput);
    assert.equal(recordResult.status, "recorded");
    assert.equal(recordResult.repoKey, "git.fullscript.io/team/target-repo");
    assert.ok(
      existsSync(
        join(home, ".ax", "plans", recordResult.privateWorkspaceRelativePath),
      ),
    );

    const result = JSON.parse(listOutput);
    assert.equal(result.status, "found");
    assert.equal(result.repoKey, "git.fullscript.io/team/target-repo");
    assert.equal(result.artifacts.length, 1);
    const workspaceRootRelativePath = result.manifestRelativePath.replace(
      /\/manifest\.json$/,
      "",
    );
    assert.ok(
      existsSync(
        join(
          home,
          ".ax",
          "plans",
          workspaceRootRelativePath,
          result.artifacts[0].artifactRelativePath,
        ),
      ),
    );
  });
});

test("plans artifact record command reports validation errors without stack traces", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const originalCwd = process.cwd();
    const originalError = console.error;
    const originalExitCode = process.exitCode;
    let errorOutput = "";
    try {
      process.chdir(targetRepo);
      process.exitCode = undefined;
      console.error = (value?: unknown) => {
        errorOutput += `${String(value)}\n`;
      };

      const program = createProgram();
      configureProgramForTest(program);
      program.parse(
        [
          "node",
          "ax",
          "plans",
          "artifact",
          "record",
          "--plan",
          "../escape.md",
          "--kind",
          "reviewer_selection",
          "--file",
          "reviewer-selection.yaml",
          "--config",
          join(repoRoot, "ax.config.json"),
        ],
        { from: "node" },
      );
    } finally {
      console.error = originalError;
      process.chdir(originalCwd);
    }

    const actualExitCode = process.exitCode;
    process.exitCode = originalExitCode;

    assert.equal(actualExitCode, 1);
    assert.match(
      errorOutput,
      /--plan must be a primary markdown file under \.agents\/plans/,
    );
    assert.doesNotMatch(errorOutput, /Error:|at\s+/);
  });
});

test("plans artifact list command reports validation errors without stack traces", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const originalCwd = process.cwd();
    const originalError = console.error;
    const originalExitCode = process.exitCode;
    let errorOutput = "";
    try {
      process.chdir(targetRepo);
      process.exitCode = undefined;
      console.error = (value?: unknown) => {
        errorOutput += `${String(value)}\n`;
      };

      const program = createProgram();
      configureProgramForTest(program);
      program.parse(
        [
          "node",
          "ax",
          "plans",
          "artifact",
          "list",
          "--plan",
          "../escape.md",
          "--config",
          join(repoRoot, "ax.config.json"),
        ],
        { from: "node" },
      );
    } finally {
      console.error = originalError;
      process.chdir(originalCwd);
    }

    const actualExitCode = process.exitCode;
    process.exitCode = originalExitCode;

    assert.equal(actualExitCode, 1);
    assert.match(
      errorOutput,
      /--plan must be a primary markdown file under \.agents\/plans/,
    );
    assert.doesNotMatch(errorOutput, /Error:|at\s+/);
  });
});

test("plans artifact record rejects private workspace symlink escapes", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    const outside = join(directory, "outside");
    mkdirSync(outside, { mode: 0o700 });
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    symlinkSync(outside, join(axPlansRoot, "repos"));

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "reviewer_selection",
          filePath: "reviewer-selection.yaml",
          axPlansRoot,
        }),
      /must not be a symlink/,
    );
  });
});

test("plans artifact record rejects corrupt existing artifact blobs", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    writeFileSync(
      join(axPlansRoot, result.privateWorkspaceRelativePath),
      "truncated\n",
      "utf-8",
    );

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "reviewer_selection",
          filePath: "reviewer-selection.yaml",
          axPlansRoot,
        }),
      /incomplete or corrupt/,
    );
  });
});

test("plans artifact identity separates nested duplicate plan basenames", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(join(targetRepo, ".agents", "plans", "team"), {
      recursive: true,
    });
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(
      join(targetRepo, ".agents", "plans", "team", "example.md"),
      "# Nested example plan\n",
      "utf-8",
    );

    const rootPlan = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    const nestedPlan = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/team/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });

    assert.notEqual(rootPlan.planPathHash, nestedPlan.planPathHash);
    assert.notEqual(rootPlan.planSlug, nestedPlan.planSlug);
    assert.notEqual(
      rootPlan.manifestRelativePath,
      nestedPlan.manifestRelativePath,
    );
  });
});

test("plans artifact commands reject path traversal inputs", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    const outsideArtifact = join(directory, "outside.yaml");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(outsideArtifact, "outside: true\n", "utf-8");

    assert.throws(
      () =>
        listPlanArtifacts({
          targetRoot: targetRepo,
          planPath: "../example.md",
          axPlansRoot,
        }),
      /--plan must be a primary markdown file under \.agents\/plans/,
    );
    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "reviewer_selection",
          filePath: "../outside.yaml",
          axPlansRoot,
        }),
      /--file must resolve inside target repo/,
    );
  });
});

test("plans artifact record rejects invalid kinds and normalizes unsafe extensions", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(
      join(targetRepo, "reviewer-selection.bad-ext"),
      "reviewers:\n  - nitro\n",
      "utf-8",
    );

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "unknown",
          filePath: "reviewer-selection.yaml",
          axPlansRoot,
        }),
      /--kind must be one of/,
    );

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.bad-ext",
      axPlansRoot,
    });
    assert.match(result.privateWorkspaceRelativePath, /\.artifact$/);
    assert.match(result.artifactRelativePath, /\.artifact$/);
  });
});

test("plans artifact commands reject corrupt manifests and truncated index rows", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    const manifestPath = join(axPlansRoot, result.manifestRelativePath);
    const indexPath = join(axPlansRoot, result.indexRelativePath);

    writeFileSync(indexPath, `${readFileSync(indexPath, "utf-8")}{"broken"\n`);
    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "reviewer_selection",
          filePath: "reviewer-selection.yaml",
          axPlansRoot,
        }),
      /index is corrupt/,
    );

    writeFileSync(manifestPath, "{", "utf-8");
    assert.throws(
      () =>
        listPlanArtifacts({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          axPlansRoot,
        }),
      /manifest is corrupt.*before reading plan artifacts/,
    );
  });
});

test("plans artifact commands reject orphan blobs", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    const workspaceRootRelativePath = result.manifestRelativePath.replace(
      /\/manifest\.json$/,
      "",
    );
    writeFileSync(
      join(
        axPlansRoot,
        workspaceRootRelativePath,
        "revisions",
        result.revisionId,
        "artifacts",
        "orphan.yaml",
      ),
      "orphan: true\n",
      "utf-8",
    );

    assert.throws(
      () =>
        listPlanArtifacts({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          axPlansRoot,
        }),
      /orphan blob/,
    );
    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "reviewer_selection",
          filePath: "reviewer-selection.yaml",
          axPlansRoot,
        }),
      /orphan blob/,
    );
  });
});

test("plans artifact record recovers an already copied blob without a manifest", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    rmSync(join(axPlansRoot, result.manifestRelativePath));
    rmSync(join(axPlansRoot, result.indexRelativePath));
    rmSync(join(axPlansRoot, result.metadataRelativePath));

    const recovered = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });

    assert.equal(recovered.artifactRelativePath, result.artifactRelativePath);
    assert.equal(
      readFileSync(join(axPlansRoot, recovered.indexRelativePath), "utf-8")
        .trim()
        .split("\n").length,
      1,
    );
    const listed = listPlanArtifacts({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      axPlansRoot,
    });
    assert.equal(listed.status, "found");
    assert.equal(listed.artifacts.length, 1);
  });
});

test("plans artifact record recovers prior copied blobs when recording another artifact", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(
      join(targetRepo, "review-request.yaml"),
      "review:\n  request: nitro\n",
      "utf-8",
    );

    const interrupted = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    rmSync(join(axPlansRoot, interrupted.manifestRelativePath));
    rmSync(join(axPlansRoot, interrupted.indexRelativePath));
    rmSync(join(axPlansRoot, interrupted.metadataRelativePath));

    const recovered = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "review_request",
      filePath: "review-request.yaml",
      axPlansRoot,
    });

    assert.equal(
      readFileSync(join(axPlansRoot, recovered.indexRelativePath), "utf-8")
        .trim()
        .split("\n").length,
      2,
    );
    const listed = listPlanArtifacts({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      axPlansRoot,
    });
    assert.equal(listed.status, "found");
    assert.deepEqual(
      listed.artifacts.map((artifact) => artifact.artifactKind).sort(),
      ["review_request", "reviewer_selection"],
    );
  });
});

test("plans artifact list rejects corrupt revisions paths", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: "reviewer-selection.yaml",
      axPlansRoot,
    });
    const workspaceRootRelativePath = result.manifestRelativePath.replace(
      /\/manifest\.json$/,
      "",
    );
    rmSync(join(axPlansRoot, workspaceRootRelativePath, "revisions"), {
      recursive: true,
    });
    writeFileSync(
      join(axPlansRoot, workspaceRootRelativePath, "revisions"),
      "not a directory\n",
      "utf-8",
    );

    assert.throws(
      () =>
        listPlanArtifacts({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          axPlansRoot,
        }),
      /revisions path is corrupt/,
    );
  });
});

test("plans artifact identity canonicalizes equivalent origin URLs", () => {
  withTempDir((directory) => {
    const sshRepo = createPlanArtifactTarget(join(directory, "ssh"));
    const httpsRepo = createPlanArtifactTarget(join(directory, "https"));
    const trailingRepo = createPlanArtifactTarget(join(directory, "trailing"));
    git(httpsRepo, [
      "remote",
      "set-url",
      "origin",
      "https://GIT.fullscript.io/team/target-repo.git",
    ]);
    git(trailingRepo, [
      "remote",
      "set-url",
      "origin",
      "https://GIT.fullscript.io/team/target-repo.git/",
    ]);

    const first = derivePlanArtifactIdentity({
      targetRoot: sshRepo,
      planPath: ".agents/plans/example.md",
    });
    const second = derivePlanArtifactIdentity({
      targetRoot: httpsRepo,
      planPath: ".agents/plans/example.md",
    });
    const third = derivePlanArtifactIdentity({
      targetRoot: trailingRepo,
      planPath: ".agents/plans/example.md",
    });

    assert.equal(first.repoKey, "git.fullscript.io/team/target-repo");
    assert.equal(second.repoKey, first.repoKey);
    assert.equal(third.repoKey, first.repoKey);
    assert.equal(second.planPathHash, first.planPathHash);
    assert.equal(third.planPathHash, first.planPathHash);
    assert.equal(second.planSlug, first.planSlug);
    assert.equal(third.planSlug, first.planSlug);
    assert.equal(second.planContentFingerprint, first.planContentFingerprint);
    assert.equal(third.planContentFingerprint, first.planContentFingerprint);
  });
});

test("plans artifact identity can use a selected artifact-host remote", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    git(targetRepo, ["remote", "remove", "origin"]);
    git(targetRepo, [
      "remote",
      "add",
      "review",
      "ssh://git@git.fullscript.io/team/review-repo.git",
    ]);

    const identity = derivePlanArtifactIdentity({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      artifactRemoteName: "review",
    });

    assert.equal(identity.repoKey, "git.fullscript.io/team/review-repo");
  });
});

test("plans artifact identity prefers origin over selected artifact-host remote", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    git(targetRepo, [
      "remote",
      "add",
      "review",
      "ssh://git@git.fullscript.io/team/review-repo.git",
    ]);

    const identity = derivePlanArtifactIdentity({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      artifactRemoteName: "review",
    });

    assert.equal(identity.repoKey, "git.fullscript.io/team/target-repo");
  });
});

test("plans artifact identity preserves remote URL ports", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    git(targetRepo, [
      "remote",
      "set-url",
      "origin",
      "https://git.fullscript.io:8443/team/target-repo.git",
    ]);

    const identity = derivePlanArtifactIdentity({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
    });

    assert.equal(identity.repoKey, "git.fullscript.io:8443/team/target-repo");
  });
});

test("plans artifact identity requires origin or selected artifact-host remote", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    git(targetRepo, ["remote", "remove", "origin"]);

    assert.throws(
      () =>
        derivePlanArtifactIdentity({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
        }),
      /no origin fetch URL or selected artifact-host remote/,
    );
  });
});

test("plans artifact record rejects target repos without origin identity", () => {
  withTempDir((directory) => {
    const targetRepo = join(directory, "target-repo");
    const axPlansRoot = join(directory, "ax-plans");
    mkdirSync(join(targetRepo, ".agents", "plans"), { recursive: true });
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    git(targetRepo, ["init"]);
    writeFileSync(
      join(targetRepo, ".agents", "plans", "example.md"),
      "# Example plan\n",
      "utf-8",
    );
    writeFileSync(join(targetRepo, "handoff.yaml"), "status: ready\n", "utf-8");

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "handoff",
          filePath: "handoff.yaml",
          axPlansRoot,
        }),
      /no origin fetch URL/,
    );
  });
});

test("OpenSpec install setup infers project defaults", () => {
  withTempCwd(() => {
    writeFileSync(
      "package.json",
      JSON.stringify(
        {
          name: "example-cli",
          packageManager: "pnpm@11.5.3",
          dependencies: { commander: "^15.0.0" },
          devDependencies: { typescript: "^5.9.3" },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const setup = createOpenSpecInstallSetup(testOpenSpecConfig());

    assert.deepEqual(setup.tools, ["codex", "claude"]);
    assert.equal(setup.schema, "spec-driven");
    assert.equal(setup.profile, "custom");
    assert.equal(setup.delivery, "both");
    assert.deepEqual(setup.workflows, [
      "propose",
      "explore",
      "apply",
      "archive",
    ]);
    assert.match(setup.context, /OpenSpec tools: codex, claude/);
    assert.match(setup.context, /Project: example-cli/);
    assert.match(setup.context, /Package manager: pnpm@11\.5\.3/);
    assert.match(setup.context, /Tech stack: TypeScript, Commander CLI/);
    assert.deepEqual(setup.rules.tasks, ["Keep tasks small."]);
  });
});

test("OpenSpec config renderer writes schema, context, and artifact rules", () => {
  const rendered = renderOpenSpecConfigYaml({
    tools: ["codex"],
    schema: "spec-driven",
    profile: "custom",
    delivery: "both",
    workflows: ["propose"],
    context: "Project: example\nOpenSpec delivery: both",
    rules: {
      proposal: ["Include goals and non-goals."],
      tasks: ["Keep tasks independently verifiable."],
    },
  });

  assert.match(rendered, /^schema: spec-driven\n/);
  assert.match(rendered, /context: \|-\n {2}Project: example\n/);
  assert.match(rendered, /rules:\n {2}proposal:\n/);
  assert.match(rendered, / {4}- "Include goals and non-goals\."/);
});

test("OpenSpec project signal collection is bounded and ignores unsafe inputs", () => {
  withTempCwd((directory) => {
    writeFileSync(
      "package.json",
      JSON.stringify(
        {
          name: "signal-project",
          packageManager: "pnpm@11.5.3",
          scripts: {
            build: "tsc",
            test: "node --test",
          },
          devDependencies: {
            typescript: "^5.9.3",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    writeFileSync(
      "README.md",
      "# Signal Project\nUseful project context.\n",
      "utf-8",
    );
    writeFileSync("lefthook.yml", "pre-commit:\n  commands: {}\n", "utf-8");
    writeFileSync(".env", "SECRET=value\n", "utf-8");
    writeFileSync("pnpm-lock.yaml", "lockfileVersion: 9\n", "utf-8");
    mkdirSync("node_modules", { recursive: true });
    mkdirSync("logs", { recursive: true });
    mkdirSync("openspec", { recursive: true });

    const report = collectOpenSpecProjectSignals(directory);
    const context = report.contextLines.join("\n");

    assert.match(context, /Project: signal-project/);
    assert.match(context, /Package scripts: build, test/);
    assert.match(context, /README.md: # Signal Project Useful project context/);
    assert.doesNotMatch(context, /SECRET/);
    assert.doesNotMatch(context, /pnpm-lock/);
    assert.ok(report.ignoredNames.includes(".env"));
    assert.ok(report.ignoredNames.includes("node_modules"));
    assert.ok(report.ignoredNames.includes("openspec"));
    assert.match(report.rules.tasks.join("\n"), /package-managed verification/);
    assert.match(report.rules.tasks.join("\n"), /repository hooks/);
  });
});

test("OpenSpec state classification reports missing setup", () => {
  withTempCwd(() => {
    const report = inspectOpenSpecState(testOpenSpecConfig());

    assert.equal(report.state, "missing");
    assert.deepEqual(report.findings, []);
  });
});

test("OpenSpec state classification reports config-only partial setup", () => {
  withTempCwd(() => {
    mkdirSync("openspec", { recursive: true });
    writeFileSync("openspec/config.yaml", "schema: spec-driven\n", "utf-8");

    const report = inspectOpenSpecState(testOpenSpecConfig());

    assert.equal(report.state, "partial");
    assert.match(report.findings.join("\n"), /No managed OpenSpec skills/);
  });
});

test("OpenSpec state classification reports assets-only partial setup", () => {
  withTempCwd(() => {
    mkdirSync(".agents/skills/openspec-propose", { recursive: true });

    const report = inspectOpenSpecState(testOpenSpecConfig());

    assert.equal(report.state, "partial");
    assert.match(report.findings.join("\n"), /Missing OpenSpec config/);
  });
});

test("OpenSpec state classification reports configured setup", () => {
  withTempCwd(() => {
    mkdirSync("openspec", { recursive: true });
    mkdirSync(".agents/skills/openspec-propose", { recursive: true });
    writeFileSync("openspec/config.yaml", "schema: spec-driven\n", "utf-8");

    const report = inspectOpenSpecState(testOpenSpecConfig());

    assert.equal(report.state, "configured");
    assert.deepEqual(report.findings, []);
  });
});

test("Commander routes all selection flags", () => {
  const [parsed] = parseCommand(["install", "--all-profiles"]);

  assert.equal(parsed.command, "install");
  assert.equal(parsed.allProfiles, true);
});

test("Commander rejects agent flags on skills commands", () => {
  const error = parseInvalidCommand([
    "skills",
    "status",
    "--agent",
    "example-agent",
  ]);

  assert.match(error.message, /unknown option '--agent'/);
});

test("Commander rejects profile flags on OpenSpec commands", () => {
  const error = parseInvalidCommand([
    "openspec",
    "status",
    "--profile",
    "work",
  ]);

  assert.match(error.message, /unknown option '--profile'/);
});

test("Commander rejects profile flags on hooks commands", () => {
  const error = parseInvalidCommand(["hooks", "status", "--profile", "work"]);

  assert.match(error.message, /unknown option '--profile'/);
});

test("Commander rejects removed skillset flags", () => {
  const error = parseInvalidCommand(["status", "--skillset", "work"]);

  assert.match(error.message, /unknown option '--skillset'/);
});

test("Commander rejects removed agents commands", () => {
  const error = parseInvalidCommand(["agents", "status"]);

  assert.match(error.message, /unknown command 'agents'/);
});

test("registerCodexStartupHook preserves hooks JSON content and stays idempotent", () => {
  withTempDir((directory) => {
    const hooksJsonPath = join(directory, "hooks.json");
    const configTomlPath = join(directory, "config.toml");
    const command = "$HOME/.codex/hooks/git-sync.sh";
    writeFileSync(
      hooksJsonPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: "command",
                    command: "afplay /System/Library/Sounds/Ping.aiff",
                  },
                ],
              },
            ],
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command: "$HOME/.codex/hooks/existing.sh",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    writeFileSync(
      configTomlPath,
      'model = "gpt-5"\n\n[hooks.state]\n',
      "utf-8",
    );
    const originalToml = readFileSync(configTomlPath, "utf-8");

    const first = registerCodexStartupHook({
      hooksJsonPath,
      configTomlPath,
      command,
    });
    const second = registerCodexStartupHook({
      hooksJsonPath,
      configTomlPath,
      command,
    });
    const document = JSON.parse(readFileSync(hooksJsonPath, "utf-8"));

    assert.equal(first.changed, true);
    assert.deepEqual(first.location, {
      event: "SessionStart",
      eventKey: "session_start",
      matcherIndex: 0,
      hookIndex: 1,
    });
    assert.equal(second.changed, false);
    assert.deepEqual(second.location, first.location);
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.hooks.Stop.length, 1);
    assert.deepEqual(document.hooks.SessionStart[0].hooks, [
      {
        type: "command",
        command: "$HOME/.codex/hooks/existing.sh",
      },
      {
        type: "command",
        command,
      },
    ]);
    assert.equal(readFileSync(configTomlPath, "utf-8"), originalToml);
  });
});

test("codexStartupHookStatus reports missing registration and trust gaps", () => {
  withTempDir((directory) => {
    const actualHooksJsonPath = join(directory, "hooks.json");
    const hooksJsonPath = join(directory, "nested", "..", "hooks.json");
    const configTomlPath = join(directory, "config.toml");
    const command = "$HOME/.codex/hooks/git-sync.sh";

    writeFileSync(
      actualHooksJsonPath,
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [] }] } }, null, 2),
      "utf-8",
    );
    writeFileSync(configTomlPath, "[hooks.state]\n", "utf-8");

    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: false,
        locations: [],
        staleLocations: [],
        trustState: "not_applicable",
        gaps: ["codex startup hook registration missing"],
      },
    );

    registerCodexStartupHook({ hooksJsonPath, configTomlPath, command });
    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: true,
        locations: [
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 0,
          },
        ],
        staleLocations: [],
        trustState: "missing",
        gaps: ["codex startup hook trust missing"],
      },
    );

    writeFileSync(
      configTomlPath,
      `[hooks.state]\n\n[hooks.state."${actualHooksJsonPath}:session_start:0:0"]\ntrusted_hash = "sha256:abc"\n`,
      "utf-8",
    );
    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: true,
        locations: [
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 0,
          },
        ],
        staleLocations: [],
        trustState: "trusted",
        gaps: [],
      },
    );

    writeFileSync(
      actualHooksJsonPath,
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command,
                  },
                  {
                    type: "command",
                    command,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    writeFileSync(
      configTomlPath,
      `[hooks.state]\n\n[hooks.state."${actualHooksJsonPath}:session_start:0:0"]\ntrusted_hash = "sha256:abc"\n\n[hooks.state."${actualHooksJsonPath}:session_start:0:1"]\ntrusted_hash = "sha256:def"\n`,
      "utf-8",
    );
    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: true,
        locations: [
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 0,
          },
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 1,
          },
        ],
        staleLocations: [],
        trustState: "trusted",
        gaps: ["codex startup hook duplicate registrations"],
      },
    );
  });
});

test("startup hook helpers reject malformed SessionStart registrations", () => {
  withTempDir((directory) => {
    const settingsJsonPath = join(directory, "settings.json");
    const command = "$HOME/.claude/hooks/git-sync.sh";
    writeFileSync(
      settingsJsonPath,
      JSON.stringify({ hooks: { SessionStart: [null] } }, null, 2),
      "utf-8",
    );

    assert.throws(
      () => registerClaudeStartupHook({ settingsJsonPath, command }),
      /Invalid SessionStart hook matcher at index 0/,
    );
    assert.throws(
      () => claudeStartupHookStatus({ settingsJsonPath, command }),
      /Invalid SessionStart hook matcher at index 0/,
    );

    writeFileSync(
      settingsJsonPath,
      JSON.stringify(
        { hooks: { SessionStart: [{ hooks: "not an array" }] } },
        null,
        2,
      ),
      "utf-8",
    );
    assert.throws(
      () => registerClaudeStartupHook({ settingsJsonPath, command }),
      /Invalid SessionStart hooks array at matcher index 0/,
    );
  });
});

test("registerClaudeStartupHook preserves settings JSON content and stays idempotent", () => {
  withTempDir((directory) => {
    const settingsJsonPath = join(directory, "settings.json");
    const command = "$HOME/.claude/hooks/git-sync.sh";
    writeFileSync(
      settingsJsonPath,
      `${JSON.stringify(
        {
          model: "fable",
          permissions: {
            allow: ["Bash(git status)"],
          },
          hooks: {
            Notification: [
              {
                matcher: "permission_prompt",
                hooks: [
                  {
                    type: "command",
                    command: "afplay /System/Library/Sounds/Glass.aiff",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    const first = registerClaudeStartupHook({ settingsJsonPath, command });
    const second = registerClaudeStartupHook({ settingsJsonPath, command });
    const document = JSON.parse(readFileSync(settingsJsonPath, "utf-8"));

    assert.equal(first.changed, true);
    assert.deepEqual(first.location, {
      event: "SessionStart",
      eventKey: "session_start",
      matcherIndex: 0,
      hookIndex: 0,
    });
    assert.equal(second.changed, false);
    assert.equal(document.model, "fable");
    assert.deepEqual(document.permissions.allow, ["Bash(git status)"]);
    assert.equal(document.hooks.Notification.length, 1);
    assert.deepEqual(document.hooks.SessionStart, [
      {
        hooks: [
          {
            type: "command",
            command,
          },
        ],
      },
    ]);
  });
});

test("claudeStartupHookStatus reports registration gaps without trust state", () => {
  withTempDir((directory) => {
    const settingsJsonPath = join(directory, "settings.json");
    const command = "$HOME/.claude/hooks/git-sync.sh";
    writeFileSync(settingsJsonPath, JSON.stringify({ hooks: {} }), "utf-8");

    assert.deepEqual(claudeStartupHookStatus({ settingsJsonPath, command }), {
      registered: false,
      locations: [],
      staleLocations: [],
      trustState: "not_applicable",
      gaps: ["claude startup hook registration missing"],
    });

    registerClaudeStartupHook({ settingsJsonPath, command });
    assert.deepEqual(claudeStartupHookStatus({ settingsJsonPath, command }), {
      registered: true,
      locations: [
        {
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex: 0,
          hookIndex: 0,
        },
      ],
      staleLocations: [],
      trustState: "not_applicable",
      gaps: [],
    });

    writeFileSync(
      settingsJsonPath,
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command,
                  },
                  {
                    type: "command",
                    command,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    assert.deepEqual(claudeStartupHookStatus({ settingsJsonPath, command }), {
      registered: true,
      locations: [
        {
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex: 0,
          hookIndex: 0,
        },
        {
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex: 0,
          hookIndex: 1,
        },
      ],
      staleLocations: [],
      trustState: "not_applicable",
      gaps: ["claude startup hook duplicate registrations"],
    });
  });
});

test("createRuntimeBackup snapshots executable files", () => {
  withTempDir((directory) => {
    const source = join(directory, "hook.ts");
    writeFileSync(source, "console.log('ok');\n", "utf-8");
    chmodSync(source, 0o755);

    const backup = createRuntimeBackup({
      sourcePath: source,
      backupsRoot: join(directory, "backups"),
      assetKind: "hooks",
      targetName: "codex",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    assert.equal(backup.status, "created");
    assert.equal(backup.kind, "file");
    assert.equal(backup.verified, true);
    assert.equal(
      readFileSync(backup.targetBackupPath ?? "", "utf-8"),
      "console.log('ok');\n",
    );
    assert.ok((lstatSync(backup.targetBackupPath ?? "").mode & 0o111) > 0);
  });
});

test("createRuntimeBackup preserves directory symlinks without dereferencing", () => {
  withTempDir((directory) => {
    const source = join(directory, "source");
    const linked = join(directory, "linked.txt");
    mkdirSync(source);
    writeFileSync(linked, "linked\n", "utf-8");
    symlinkSync("../linked.txt", join(source, "link.txt"));

    const backup = createRuntimeBackup({
      sourcePath: source,
      backupsRoot: join(directory, "backups"),
      assetKind: "skills",
      targetName: "agents",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const backedUpLink = join(backup.targetBackupPath ?? "", "link.txt");

    assert.equal(backup.kind, "directory");
    assert.equal(lstatSync(backedUpLink).isSymbolicLink(), true);
    assert.equal(readlinkSync(backedUpLink), "../linked.txt");
  });
});

test("createRuntimeBackup snapshots dangling symlinks", () => {
  withTempDir((directory) => {
    const source = join(directory, "dangling");
    symlinkSync("missing-target", source);

    const backup = createRuntimeBackup({
      sourcePath: source,
      backupsRoot: join(directory, "backups"),
      assetKind: "hooks",
      targetName: "claude",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    assert.equal(backup.kind, "symlink");
    assert.equal(
      lstatSync(backup.targetBackupPath ?? "").isSymbolicLink(),
      true,
    );
    assert.equal(readlinkSync(backup.targetBackupPath ?? ""), "missing-target");
  });
});

test("createRuntimeBackup records missing targets without target content", () => {
  withTempDir((directory) => {
    const backup = createRuntimeBackup({
      sourcePath: join(directory, "missing"),
      backupsRoot: join(directory, "backups"),
      assetKind: "config",
      targetName: "codex",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const manifest = JSON.parse(readFileSync(backup.manifestPath, "utf-8")) as {
      status: string;
      kind: string;
    };

    assert.equal(backup.status, "missing");
    assert.equal(backup.kind, "missing");
    assert.equal(backup.targetBackupPath, undefined);
    assert.equal(manifest.status, "missing");
    assert.equal(manifest.kind, "missing");
  });
});

test("createRuntimeBackup keeps seven newest backups and disambiguates timestamp collisions", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");
    const firstTimestamp = new Date("2026-01-01T00:00:00.000Z");

    createRuntimeBackup({
      sourcePath: source,
      backupsRoot,
      assetKind: "config",
      targetName: "codex",
      now: firstTimestamp,
    });
    createRuntimeBackup({
      sourcePath: source,
      backupsRoot,
      assetKind: "config",
      targetName: "codex",
      now: firstTimestamp,
    });
    for (let index = 1; index <= 6; index += 1) {
      createRuntimeBackup({
        sourcePath: source,
        backupsRoot,
        assetKind: "config",
        targetName: "codex",
        now: new Date(`2026-01-01T00:00:0${index}.000Z`),
      });
    }

    const backups = readdirSync(targetRoot).sort();
    assert.equal(backups.length, 7);
    assert.ok(!backups.includes("2026-01-01T00-00-00-000Z"));
    assert.ok(backups.includes("2026-01-01T00-00-00-000Z-000002"));
  });
});

test("createRuntimeBackup prunes same-timestamp collisions by numeric order", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");
    const timestamp = new Date("2026-01-01T00:00:00.000Z");

    for (let index = 0; index < 11; index += 1) {
      createRuntimeBackup({
        sourcePath: source,
        backupsRoot,
        assetKind: "config",
        targetName: "codex",
        now: timestamp,
      });
    }

    assert.deepEqual(readdirSync(targetRoot).sort(), [
      "2026-01-01T00-00-00-000Z-000005",
      "2026-01-01T00-00-00-000Z-000006",
      "2026-01-01T00-00-00-000Z-000007",
      "2026-01-01T00-00-00-000Z-000008",
      "2026-01-01T00-00-00-000Z-000009",
      "2026-01-01T00-00-00-000Z-000010",
      "2026-01-01T00-00-00-000Z-000011",
    ]);
  });
});

test("createRuntimeBackup removes failed attempts without pruning old backups", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");
    mkdirSync(targetRoot, { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      mkdirSync(join(targetRoot, `old-${index}`));
    }

    assert.throws(
      () =>
        createRuntimeBackup({
          sourcePath: "/dev/null",
          backupsRoot,
          assetKind: "config",
          targetName: "codex",
          now: new Date("2026-01-01T00:00:00.000Z"),
        }),
      /Unsupported backup target type/,
    );

    for (let index = 0; index < 8; index += 1) {
      assert.equal(existsSync(join(targetRoot, `old-${index}`)), true);
    }
    assert.equal(
      readdirSync(targetRoot).filter((name) => name.startsWith("2026-")).length,
      0,
    );
  });
});

test("createRuntimeBackup preserves seven successful backups after a failed attempt", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");

    assert.throws(
      () =>
        createRuntimeBackup({
          sourcePath: "/dev/null",
          backupsRoot,
          assetKind: "config",
          targetName: "codex",
          now: new Date("2026-01-01T00:00:00.000Z"),
        }),
      /Unsupported backup target type/,
    );

    for (let index = 1; index <= 7; index += 1) {
      createRuntimeBackup({
        sourcePath: source,
        backupsRoot,
        assetKind: "config",
        targetName: "codex",
        now: new Date(`2026-01-01T00:00:0${index}.000Z`),
      });
    }

    const backups = readdirSync(targetRoot).sort();
    assert.equal(backups.length, 7);
    assert.ok(!backups.includes("2026-01-01T00-00-00-000Z"));
  });
});
