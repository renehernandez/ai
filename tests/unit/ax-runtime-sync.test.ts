import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
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
  copyPath,
  hashPath,
  SourceSnapshotManager,
} from "../../scripts/ax/source-snapshot.ts";
import {
  applyTransaction,
  inspectTransactions,
  recoverTransactions,
  TransactionInterruption,
} from "../../scripts/ax/transaction-engine.ts";

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ax-runtime-internals-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("OpenSpec tree hashing includes symlink targets and executable bits", () => {
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
  });
});

test("snapshot copies preserve relative symlinks", () => {
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

test("remote refs resolve once per invocation and advance on the next", () => {
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

test("OpenSpec transaction recovery restores preimages", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const manifest = join(root, "manifest.json");
    const candidateManifest = join(root, "candidate-manifest.json");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    writeFileSync(manifest, "old-manifest\n", "utf-8");
    writeFileSync(candidateManifest, "new-manifest\n", "utf-8");

    assert.throws(
      () =>
        applyTransaction({
          domain: "openspec-test",
          root,
          lockPath: join(root, "lock"),
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
    recoverTransactions({ transactionsRoot, backupsRoot });
    assert.equal(readFileSync(target, "utf-8"), "old\n");
    assert.equal(readFileSync(manifest, "utf-8"), "old-manifest\n");
    assert.deepEqual(inspectTransactions(transactionsRoot), []);
  });
});

test("verified backup store remains available to OpenSpec transactions", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    writeFileSync(target, "value\n", "utf-8");
    const backup = createVerifiedBackup({
      backupsRoot: join(root, "backups"),
      asset: "openspec-test",
      targetPath: target,
    });
    assert.ok(backup);
  });
});

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
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
