import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import test from "node:test";
import {
  reviewGateStatePath,
  stagedDiffHash,
  validateReviewGateForCommit,
} from "../../scripts/review-gate.ts";

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_PREFIX;
  delete env.GIT_QUARANTINE_PATH;
  delete env.GIT_WORK_TREE;
  return env;
}

function runGit(args: string[], cwd: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createGitFixture(prefix = "review-gate-"): string {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  runGit(["init"], cwd);
  runGit(["config", "user.email", "agent@example.com"], cwd);
  runGit(["config", "user.name", "Agent Runtime"], cwd);
  return cwd;
}

function writeGateState(cwd: string, json: string): void {
  const statePath = reviewGateStatePath(cwd);
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, json, "utf-8");
}

test("review gate state path resolves under the repository Git directory", () => {
  const cwd = createGitFixture("review-gate-path-");
  try {
    const statePath = reviewGateStatePath(cwd);

    assert.equal(dirname(statePath), join(cwd, ".git", "ax"));
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review gate state path resolves under linked worktree metadata", () => {
  const repo = createGitFixture("review-gate-worktree-repo-");
  const worktree = mkdtempSync(join(tmpdir(), "review-gate-worktree-"));
  try {
    writeFileSync(join(repo, "base.txt"), "base\n", "utf-8");
    runGit(["add", "base.txt"], repo);
    runGit(["commit", "-m", "base"], repo);
    rmSync(worktree, { force: true, recursive: true });
    runGit(["worktree", "add", worktree], repo);

    const gitDir = runGit(["rev-parse", "--git-dir"], worktree);
    const statePath = reviewGateStatePath(worktree);

    const expectedGitDir = isAbsolute(gitDir) ? gitDir : join(worktree, gitDir);
    assert.equal(dirname(statePath), join(expectedGitDir, "ax"));
  } finally {
    rmSync(worktree, { force: true, recursive: true });
    rmSync(repo, { force: true, recursive: true });
  }
});

test("staged diff fingerprint is stable until the staged diff changes", () => {
  const cwd = createGitFixture("review-gate-hash-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const firstHash = stagedDiffHash(cwd);

    writeFileSync(join(cwd, "file.txt"), "one\nunstaged\n", "utf-8");
    assert.equal(stagedDiffHash(cwd), firstHash);

    runGit(["add", "file.txt"], cwd);
    assert.notEqual(stagedDiffHash(cwd), firstHash);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("active gate reports missing review passes and blocking findings", () => {
  const cwd = createGitFixture("review-gate-validation-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeGateState(
      cwd,
      JSON.stringify({
        version: 1,
        active: true,
        stagedDiffHash: stagedDiffHash(cwd),
        requiredReviewPasses: ["implementation-review"],
        results: {},
        blockingFindings: [{ message: "fix me" }],
      }),
    );

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.deepEqual(validation.missingReviewPasses, ["implementation-review"]);
    assert.equal(validation.blockingFindings.length, 1);
    assert.match(validation.errors.join("\n"), /unresolved blocking findings/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("malformed review gate state blocks validation", () => {
  const cwd = createGitFixture("review-gate-malformed-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeGateState(cwd, "{ nope\n");

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /not valid JSON/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("incomplete active review gate state blocks validation", () => {
  const cwd = createGitFixture("review-gate-incomplete-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeGateState(cwd, JSON.stringify({ version: 1, active: true }));

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /requires stagedDiffHash/);
    assert.match(validation.errors.join("\n"), /requires requiredReviewPasses/);
    assert.match(validation.errors.join("\n"), /requires results/);
    assert.match(validation.errors.join("\n"), /requires blockingFindings/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("active review gate state requires at least one review pass", () => {
  const cwd = createGitFixture("review-gate-empty-passes-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeGateState(
      cwd,
      JSON.stringify({
        version: 1,
        active: true,
        stagedDiffHash: stagedDiffHash(cwd),
        requiredReviewPasses: [],
        results: {},
        blockingFindings: [],
      }),
    );

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /at least one review pass/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});
