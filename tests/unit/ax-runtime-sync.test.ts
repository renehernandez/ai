import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createVerifiedBackup } from "../../scripts/ax/backup-store.ts";
import {
  manifestHash,
  readManagedRuntimeManifest,
  validateManagedRuntimeManifest,
} from "../../scripts/ax/runtime-state.ts";
import {
  type AxRuntimeConfig,
  inspectRuntime,
  syncRuntime,
} from "../../scripts/ax/runtime-sync.ts";
import {
  copyPath,
  HASH_VERSION,
  hashPath,
  SourceSnapshotManager,
  sha256Bytes,
} from "../../scripts/ax/source-snapshot.ts";
import {
  applyTransaction,
  inspectTransactions,
  recoverTransactions,
  TransactionInterruption,
} from "../../scripts/ax/transaction-engine.ts";

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ax-runtime-sync-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function runtimeFixture(root: string): {
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
    writeFileSync(
      join(skill, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name}\n---\n# ${name}\n`,
      "utf-8",
    );
  }
  mkdirSync(join(sourceRoot, "instructions"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "instructions", "AGENTS.md"),
    "# Agents\n",
    "utf-8",
  );
  mkdirSync(join(sourceRoot, "rules"), { recursive: true });
  writeFileSync(join(sourceRoot, "rules", "base.md"), "# Rule\n", "utf-8");
  mkdirSync(join(sourceRoot, "hooks"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "hooks", "startup.ts"),
    "export {};\n",
    "utf-8",
  );
  const config: AxRuntimeConfig = {
    version: 1,
    runtime: {
      canonicalSkillsDir: join(installRoot, "agents", "skills"),
      skillSymlinkTargets: [
        join(installRoot, "codex", "skills"),
        join(installRoot, "claude", "skills"),
      ],
      instructionSymlinkTargets: {
        agents: join(installRoot, "agents"),
        codex: join(installRoot, "codex"),
        claude: join(installRoot, "claude"),
      },
      hooks: {
        sourceDir: "hooks",
        canonicalDir: join(installRoot, "agents", "hooks"),
        targets: {
          codex: join(installRoot, "codex", "hooks"),
          claude: join(installRoot, "claude", "hooks"),
        },
      },
    },
    profiles: {
      personal: {
        include: ["modes"],
        paths: [
          { sourcePath: "instructions/AGENTS.md", targetPath: "AGENTS.md" },
          "rules/base.md",
        ],
      },
      work: {
        include: ["modes"],
        paths: [
          { sourcePath: "instructions/AGENTS.md", targetPath: "AGENTS.md" },
          "rules/base.md",
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

test("sha256-tree-v1 includes empty directories, symlink targets, and executable bits only", () => {
  withTempDir((root) => {
    mkdirSync(join(root, "tree", "empty"), { recursive: true });
    const file = join(root, "tree", "tool");
    writeFileSync(file, "content\n", "utf-8");
    symlinkSync("tool", join(root, "tree", "link"));
    const initial = hashPath(join(root, "tree"));

    utimesSync(file, new Date(10_000), new Date(10_000));
    chmodSync(file, 0o640);
    assert.equal(hashPath(join(root, "tree")), initial);

    chmodSync(file, 0o750);
    assert.notEqual(hashPath(join(root, "tree")), initial);
    assert.match(String(initial), /^sha256:[a-f0-9]{64}$/);
  });
});

test("snapshot copies preserve relative symlink payloads and tree hashes", () => {
  withTempDir((root) => {
    const source = join(root, "source");
    const target = join(root, "target");
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "value.txt"), "value\n", "utf-8");
    symlinkSync("value.txt", join(source, "relative-link"));

    copyPath(source, target);

    assert.equal(hashPath(target), hashPath(source));
  });
});

test("remote refs resolve once per invocation and advance on the next invocation", () => {
  withTempDir((root) => {
    const repository = join(root, "repository");
    mkdirSync(repository);
    git(repository, ["init"]);
    git(repository, ["config", "user.email", "ax@example.com"]);
    git(repository, ["config", "user.name", "AX Test"]);
    writeFileSync(join(repository, "value.txt"), "one\n", "utf-8");
    git(repository, ["add", "value.txt"]);
    git(repository, ["commit", "-m", "one"]);
    const branch = git(repository, ["branch", "--show-current"]);

    const firstManager = new SourceSnapshotManager({
      cacheRoot: join(root, "cache"),
      temporaryRoot: join(root, "temporary-one"),
    });
    const first = firstManager.snapshotRemote(repository, branch);
    writeFileSync(join(repository, "value.txt"), "two\n", "utf-8");
    git(repository, ["add", "value.txt"]);
    git(repository, ["commit", "-m", "two"]);
    const reused = firstManager.snapshotRemote(repository, branch);
    assert.equal(reused.resolvedCommit, first.resolvedCommit);
    firstManager.dispose();

    const secondManager = new SourceSnapshotManager({
      cacheRoot: join(root, "cache"),
      temporaryRoot: join(root, "temporary-two"),
    });
    const advanced = secondManager.snapshotRemote(repository, branch);
    assert.notEqual(advanced.resolvedCommit, first.resolvedCommit);
    assert.equal(
      readFileSync(join(advanced.path, "value.txt"), "utf-8"),
      "two\n",
    );
    secondManager.dispose();
  });
});

test("managed runtime manifest rejects duplicated desired or source state", () => {
  const valid = validateManagedRuntimeManifest({
    schemaVersion: 1,
    hashVersion: HASH_VERSION,
    installedProfiles: ["personal"],
    policyProfile: "personal",
    ownedPaths: {
      "/tmp/example": sha256Bytes("example"),
    },
  });
  assert.deepEqual(Object.keys(valid).sort(), [
    "hashVersion",
    "installedProfiles",
    "ownedPaths",
    "policyProfile",
    "schemaVersion",
  ]);
  assert.throws(
    () =>
      validateManagedRuntimeManifest({
        ...valid,
        resolvedCommit: "deadbeef",
      }),
    /unexpected=\[resolvedCommit\]/,
  );
  assert.throws(
    () =>
      validateManagedRuntimeManifest({
        ...valid,
        policyProfile: "work",
      }),
    /policy_profile_ambiguous/,
  );
});

test("top-level sync initializes local ownership and scoped sync consumes it", () => {
  withTempDir((root) => {
    const fixture = runtimeFixture(root);
    const first = syncRuntime({
      ...fixture,
      profiles: ["personal"],
      policyProfile: "personal",
      interactive: false,
    });
    assert.equal(first.status, "synchronized");
    const manifest = readManagedRuntimeManifest(first.manifestPath);
    assert.deepEqual(manifest?.installedProfiles, ["personal"]);
    assert.equal(manifest?.policyProfile, "personal");
    assert.ok(Object.keys(manifest?.ownedPaths ?? {}).length >= 10);
    assert.equal(existsSyncCompat(join(root, "source", "ax.lock.json")), false);
    assert.equal(existsSyncCompat(join(root, "source", ".ax", "cache")), false);

    const second = syncRuntime({
      ...fixture,
      surface: "skills",
      interactive: false,
    });
    assert.equal(second.status, "current");
    const status = inspectRuntime(fixture);
    assert.equal(status.ok, true, status.findings.join("\n"));
  });
});

test("scoped sync rejects a missing manifest", () => {
  withTempDir((root) => {
    const fixture = runtimeFixture(root);
    assert.throws(
      () =>
        syncRuntime({
          ...fixture,
          surface: "hooks",
          interactive: false,
        }),
      /runtime_not_initialized/,
    );
  });
});

test("manifest-less occupied paths require exact-hash adoption", () => {
  withTempDir((root) => {
    const fixture = runtimeFixture(root);
    const occupied = join(fixture.installRoot, "agents", "skills", "explore");
    mkdirSync(join(occupied, ".."), { recursive: true });
    copyDirectory(join(fixture.sourceRoot, "skills", "explore"), occupied);
    assert.throws(
      () =>
        syncRuntime({
          ...fixture,
          profiles: ["personal"],
          policyProfile: "personal",
          interactive: false,
        }),
      /adoption_required: manage/,
    );
    const adoptionFile = join(root, "adoption.json");
    writeFileSync(
      adoptionFile,
      `${JSON.stringify({
        schemaVersion: 1,
        hashVersion: HASH_VERSION,
        actions: [
          {
            path: occupied,
            observedHash: hashPath(occupied),
            action: "manage",
          },
        ],
      })}\n`,
      "utf-8",
    );
    const result = syncRuntime({
      ...fixture,
      profiles: ["personal"],
      policyProfile: "personal",
      adoptionFile,
      interactive: false,
    });
    assert.equal(result.status, "synchronized");
  });
});

test("later headless profile changes require an exact manifest-bound file", () => {
  withTempDir((root) => {
    const fixture = runtimeFixture(root);
    const first = syncRuntime({
      ...fixture,
      profiles: ["personal"],
      policyProfile: "personal",
      interactive: false,
    });
    assert.throws(
      () =>
        syncRuntime({
          ...fixture,
          profiles: ["work"],
          policyProfile: "work",
          interactive: false,
        }),
      /profile_selection_file_required/,
    );
    const current = readManagedRuntimeManifest(first.manifestPath);
    assert.ok(current);
    const selectionFile = join(root, "profile-selection.json");
    writeFileSync(
      selectionFile,
      `${JSON.stringify({
        schemaVersion: 1,
        hashVersion: HASH_VERSION,
        currentManifestHash: manifestHash(current),
        installedProfiles: ["work"],
        policyProfile: "work",
      })}\n`,
      "utf-8",
    );
    const changed = syncRuntime({
      ...fixture,
      profileSelectionFile: selectionFile,
      interactive: false,
    });
    assert.deepEqual(changed.installedProfiles, ["work"]);
    assert.equal(changed.policyProfile, "work");
  });
});

test("transaction recovery restores preimages or finalizes a committed candidate by hashes", () => {
  withTempDir((root) => {
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const lockPath = join(root, "lock");
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const manifest = join(root, "manifest.json");
    const candidateManifest = join(root, "candidate-manifest.json");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    writeFileSync(manifest, "old-manifest\n", "utf-8");
    writeFileSync(candidateManifest, "new-manifest\n", "utf-8");

    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: target, asset: "target", candidatePath: candidate },
          ],
          manifestPath: manifest,
          candidateManifestPath: candidateManifest,
          fault: (point) => {
            if (point.startsWith("after-target:")) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    assert.equal(readFileSync(target, "utf-8"), "new\n");
    recoverTransactions({ transactionsRoot, backupsRoot });
    assert.equal(readFileSync(target, "utf-8"), "old\n");
    assert.equal(readFileSync(manifest, "utf-8"), "old-manifest\n");

    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: target, asset: "target", candidatePath: candidate },
          ],
          manifestPath: manifest,
          candidateManifestPath: candidateManifest,
          fault: (point) => {
            if (point === "after-manifest") {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    recoverTransactions({ transactionsRoot, backupsRoot });
    assert.equal(readFileSync(target, "utf-8"), "new\n");
    assert.equal(readFileSync(manifest, "utf-8"), "new-manifest\n");
    assert.deepEqual(inspectTransactions(transactionsRoot), []);
  });
});

test("transaction recovery preserves an external edit as a conflict", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: target, asset: "target", candidatePath: candidate },
          ],
          fault: (point) => {
            if (point.startsWith("after-target:")) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    writeFileSync(target, "external\n", "utf-8");
    assert.throws(
      () => recoverTransactions({ transactionsRoot, backupsRoot }),
      /recovery_conflict/,
    );
    assert.equal(readFileSync(target, "utf-8"), "external\n");
    assert.equal(
      inspectTransactions(transactionsRoot)[0]?.phase,
      "recovery_conflict",
    );
  });
});

test("backup store retains the latest seven verified preimages", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const backupsRoot = join(root, "backups");
    for (let index = 0; index < 9; index += 1) {
      writeFileSync(target, `${index}\n`, "utf-8");
      createVerifiedBackup({ backupsRoot, asset: "test", targetPath: target });
    }
    const targetSets = readdirSync(join(backupsRoot, "test"));
    assert.equal(targetSets.length, 1);
    assert.equal(
      readdirSync(join(backupsRoot, "test", targetSets[0])).length,
      7,
    );
  });
});

function existsSyncCompat(path: string): boolean {
  try {
    lstatSyncCompat(path);
    return true;
  } catch {
    return false;
  }
}

function lstatSyncCompat(path: string): void {
  readFileSync(path);
}

function copyDirectory(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      writeFileSync(targetPath, readFileSync(sourcePath));
    }
  }
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}
