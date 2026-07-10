import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";

import {
  inspectOpenSpec,
  type OpenSpecConfig,
  openspecPaths,
  syncOpenSpec,
} from "../../scripts/ax/openspec-sync.ts";
import {
  HASH_VERSION,
  hashPath,
  sha256Bytes,
} from "../../scripts/ax/source-snapshot.ts";
import {
  applyTransaction,
  inspectTransactions,
  RECOVERY_SCHEMA_VERSION,
  type RecoveryFile,
  recoverTransactions,
  TransactionInterruption,
} from "../../scripts/ax/transaction-engine.ts";

const config: OpenSpecConfig = {
  tools: ["codex", "claude"],
  schema: "spec-driven",
  profile: "custom",
  delivery: "both",
  workflows: ["propose", "explore", "apply", "archive"],
  canonicalSkillsDir: ".agents/skills",
  canonicalCommandsDir: ".agents/commands",
  skillTargets: {
    codex: ".codex/skills",
    claude: ".claude/skills",
  },
  commandTargets: { claude: ".claude/commands" },
};

const workflowAssets = [
  ["openspec-propose", "propose.md"],
  ["openspec-explore", "explore.md"],
  ["openspec-apply-change", "apply.md"],
  ["openspec-archive-change", "archive.md"],
] as const;

const explicitOnlyDescription =
  "Explicit-only developer command. Invoke only when the user explicitly names this OpenSpec adapter or its /opsx command.";
const explicitOnlyBoundary =
  "Do not infer this adapter from ordinary language. Route ordinary work through the owning lifecycle mode.";

test("preserve-unmanaged recovery through OpenSpec sync retains external bytes and reports drift", () => {
  const root = mkdtempSync(join(tmpdir(), "openspec-recovery-e2e-"));
  try {
    git(root, ["init"]);
    writeConfiguredInventory(root);
    const initial = inspectOpenSpec({ targetRoot: root, config });
    assert.equal(initial.state, "configured", initial.findings.join("\n"));

    const paths = openspecPaths(root);
    const target = join(root, ".agents", "skills", "openspec-apply-change");
    const candidate = join(root, ".candidate-openspec-apply-change");
    cpSync(target, candidate, { recursive: true });
    writeFileSync(
      join(candidate, "SKILL.md"),
      "---\nname: openspec-apply-change\ndescription: candidate\n---\n",
      "utf-8",
    );

    assert.throws(
      () =>
        applyTransaction({
          domain: `openspec:${root}`,
          root,
          lockPath: paths.lockPath,
          transactionsRoot: paths.transactionsRoot,
          backupsRoot: paths.backupsRoot,
          targetRoots: [root],
          operations: [
            {
              path: target,
              asset: "openspec-apply-change",
              candidatePath: candidate,
            },
          ],
          fault: (point) => {
            if (point === `after-target:${target}`) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );

    const externalBytes = Buffer.from(
      "external owner content must survive recovery exactly\n",
      "utf-8",
    );
    const externalPath = join(target, "SKILL.md");
    writeFileSync(externalPath, externalBytes);
    assert.throws(
      () =>
        recoverTransactions({
          transactionsRoot: paths.transactionsRoot,
          backupsRoot: paths.backupsRoot,
          targetRoots: [root],
        }),
      /recovery_conflict/,
    );

    const [conflict] = inspectTransactions(paths.transactionsRoot);
    assert.ok(conflict);
    assert.equal(conflict.phase, "recovery_conflict");
    assert.equal(conflict.targetHashes[target], hashPath(target));
    const recoveryFile = join(root, "openspec-recovery.json");
    const recovery: RecoveryFile = {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      hashVersion: HASH_VERSION,
      transactionId: conflict.transactionId,
      domain: conflict.domain,
      currentManifestHash: conflict.manifestHash,
      currentTargetHashes: conflict.targetHashes,
      actions: { [target]: "preserve-unmanaged" },
    };
    writeFileSync(recoveryFile, JSON.stringify(recovery), "utf-8");

    const result = syncOpenSpec({
      targetRoot: root,
      config,
      recoveryFile,
      interactive: false,
    });

    assert.equal(result.status, "recovered");
    assert.equal(result.state, "partial_repairable");
    assert.deepEqual(readFileSync(externalPath), externalBytes);
    assert.deepEqual(inspectTransactions(paths.transactionsRoot), []);
    assert.equal(
      existsSync(join(paths.transactionsRoot, conflict.transactionId)),
      false,
    );

    const status = inspectOpenSpec({ targetRoot: root, config });
    assert.equal(status.state, "partial_repairable");
    assert.match(
      status.findings.join("\n"),
      /openspec_adapter_not_explicit_only:.*openspec-apply-change/,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

function writeConfiguredInventory(root: string): void {
  mkdirSync(join(root, "openspec"), { recursive: true });
  writeFileSync(
    join(root, "openspec", "config.yaml"),
    "schema: spec-driven\n",
    "utf-8",
  );

  const canonicalSkills = join(root, ".agents", "skills");
  const canonicalCommands = join(root, ".agents", "commands", "opsx");
  mkdirSync(canonicalCommands, { recursive: true });
  for (const [skillName, commandName] of workflowAssets) {
    const skillRoot = join(canonicalSkills, skillName);
    mkdirSync(skillRoot, { recursive: true });
    writeFileSync(
      join(skillRoot, "SKILL.md"),
      managedContent(
        `---\nname: ${skillName}\ndescription: ${explicitOnlyDescription}\n---\n# ${skillName}\n\n## Explicit Invocation Boundary\n\n${explicitOnlyBoundary}\n\n<!-- ax-openspec-skill: ${skillName}; explicit-only -->\n`,
      ),
      "utf-8",
    );
    for (const targetRoot of [".codex/skills", ".claude/skills"]) {
      const linkPath = join(root, targetRoot, skillName);
      mkdirSync(dirname(linkPath), { recursive: true });
      symlinkSync(relative(dirname(linkPath), skillRoot), linkPath);
    }
    writeFileSync(
      join(canonicalCommands, commandName),
      managedContent(
        `# ${commandName}\n\n<!-- ax-openspec-command: ${commandName}; explicit-only -->\n<!-- Invoke only as /opsx:${commandName.replace(/\.md$/, "")}; do not infer from ordinary language. -->\n`,
      ),
      "utf-8",
    );
  }

  const commandLink = join(root, ".claude", "commands", "opsx");
  mkdirSync(dirname(commandLink), { recursive: true });
  symlinkSync(relative(dirname(commandLink), canonicalCommands), commandLink);
}

function managedContent(content: string): string {
  const base = `${content.trimEnd()}\n`;
  return `${base}\n<!-- ax-openspec-content-sha256: ${sha256Bytes(base)} -->\n`;
}

function git(root: string, args: string[]): void {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf-8",
    env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
