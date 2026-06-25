import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import test from "node:test";
import {
  clearReviewGate,
  committedDiffHash,
  consumeReviewGate,
  consumeReviewGateForDiff,
  reviewGateInvalidationPath,
  reviewGateStatePath,
  stagedDiffHash,
  validateReviewGateForCommit,
  writeActiveReviewGate,
  writeReviewGateInvalidation,
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

function activeReviewGateFingerprint(cwd: string): string {
  const validation = validateReviewGateForCommit(cwd);
  assert.equal(validation.ok, true);
  assert.equal(validation.active, true);
  assert.match(validation.activeReviewGateFingerprint ?? "", /^sha256:/);
  return validation.activeReviewGateFingerprint ?? "";
}

function validReviewGateInput(cwd: string) {
  const diffHash = stagedDiffHash(cwd);
  return {
    workflow: "test-workflow",
    unit: {
      id: "unit-1",
      title: "Fixture unit",
    },
    sourceProvenance: {
      kind: "test",
      ref: "fixture",
      evidence: ["fixture-evidence"],
    },
    requiredReviewPasses: ["implementation-readiness", "edge-cases-and-risks"],
    results: {
      "implementation-readiness": {
        status: "passed" as const,
        diffHash,
        summary: "Ready for implementation.",
      },
      "edge-cases-and-risks": {
        status: "passed" as const,
        diffHash,
        summary: "No blocking edge cases.",
      },
    },
    blockingFindings: [],
  };
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

test("active review gate writes persisted state for the staged diff", () => {
  const cwd = createGitFixture("review-gate-active-write-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);

    const { state, statePath } = writeActiveReviewGate(
      validReviewGateInput(cwd),
      cwd,
    );
    const persisted = JSON.parse(readFileSync(statePath, "utf-8"));
    const validation = validateReviewGateForCommit(cwd);

    assert.equal(state.active, true);
    assert.equal(state.status, "active");
    assert.equal(state.workflow, "test-workflow");
    assert.equal(state.sourceProvenance?.kind, "test");
    assert.equal(state.identity?.workflow, "test-workflow");
    assert.equal(state.identity?.unitId, "unit-1");
    assert.equal(state.identity?.stagedDiffHash, stagedDiffHash(cwd));
    assert.equal(typeof state.identity?.gitDir, "string");
    assert.equal(state.stagedDiffHash, stagedDiffHash(cwd));
    assert.deepEqual(state.requiredReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
    ]);
    assert.equal(persisted.active, true);
    assert.equal(persisted.status, "active");
    assert.equal(persisted.identity.workflow, "test-workflow");
    assert.equal(persisted.stagedDiffHash, state.stagedDiffHash);
    assert.equal(validation.ok, true);
    assert.equal(validation.active, true);
    assert.deepEqual(validation.completedReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
    ]);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("active review gate rejects missing and stale result diff hashes", () => {
  const cwd = createGitFixture("review-gate-active-rejects-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);

    const missingDiffHashInput = validReviewGateInput(cwd);
    missingDiffHashInput.results["implementation-readiness"] = {
      status: "passed",
    } as {
      status: "passed";
      diffHash: string;
    };

    assert.throws(
      () => writeActiveReviewGate(missingDiffHashInput, cwd),
      /requires a diff hash/,
    );

    const staleDiffHashInput = validReviewGateInput(cwd);
    staleDiffHashInput.results["implementation-readiness"].diffHash =
      `sha256:${"0".repeat(64)}`;

    assert.throws(
      () => writeActiveReviewGate(staleDiffHashInput, cwd),
      /has stale diff hash/,
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
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

test("created commit diff fingerprint matches its reviewed staged diff", () => {
  const cwd = createGitFixture("review-gate-commit-hash-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const reviewedHash = stagedDiffHash(cwd);

    runGit(["commit", "-m", "add fixture file"], cwd);
    const commitSha = runGit(["rev-parse", "HEAD"], cwd);

    assert.equal(committedDiffHash(commitSha, cwd), reviewedHash);
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

test("review gate invalidation blocks a stale passing active gate", () => {
  const cwd = createGitFixture("review-gate-invalidated-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const diffHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    writeReviewGateInvalidation(cwd, diffHash, ["blocked after review"]);

    const invalidated = validateReviewGateForCommit(cwd);

    assert.equal(invalidated.ok, false);
    assert.equal(invalidated.active, true);
    assert.match(invalidated.note ?? "", /invalidation marker/);
    assert.match(invalidated.errors.join("\n"), /failed blocked activation/);
    assert.match(
      invalidated.errors.join("\n"),
      /Blocked activation finding: blocked after review/,
    );

    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const refreshed = validateReviewGateForCommit(cwd);

    assert.equal(refreshed.ok, true);
    assert.equal(existsSync(reviewGateInvalidationPath(cwd)), false);
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

test("non-object review gate state blocks validation without throwing", () => {
  const cwd = createGitFixture("review-gate-non-object-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeGateState(cwd, "null\n");

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /must be an object/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("malformed review gate state cannot be consumed", () => {
  const cwd = createGitFixture("review-gate-consume-malformed-");
  try {
    writeGateState(cwd, "{ nope\n");

    assert.throws(
      () => consumeReviewGate(cwd),
      /Review gate state is not valid JSON/,
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("consumed review gate state is inactive for commit validation", () => {
  const cwd = createGitFixture("review-gate-consumed-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);

    const consumed = consumeReviewGate(cwd);
    const consumedValidation = validateReviewGateForCommit(cwd);

    assert.equal(consumed.consumed, true);
    assert.equal(consumed.state?.active, false);
    assert.equal(consumed.state?.status, "consumed");
    assert.equal(typeof consumed.state?.consumedAt, "string");
    assert.equal(consumedValidation.ok, true);
    assert.equal(consumedValidation.stateStatus, "consumed");
    assert.equal(consumedValidation.active, false);
    assert.equal(
      consumedValidation.note,
      "Review gate is consumed; allowing commit.",
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("active review gate rejects identity drift", () => {
  const cwd = createGitFixture("review-gate-identity-drift-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const original = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );
    writeGateState(
      cwd,
      JSON.stringify({
        ...original,
        identity: {
          ...original.identity,
          branchRef: "refs/heads/other",
          workflow: "other-workflow",
          unitId: "unit-2",
        },
      }),
    );

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.deepEqual(validation.identityMismatches.sort(), [
      "branchRef",
      "unitId",
      "workflow",
    ]);
    assert.match(
      validation.errors.join("\n"),
      /Review gate identity mismatch: branchRef/,
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("active review gate requires persisted identity", () => {
  const cwd = createGitFixture("review-gate-missing-identity-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const original = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );
    delete original.identity;
    writeGateState(cwd, JSON.stringify(original));

    const validation = validateReviewGateForCommit(cwd);

    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /requires identity/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("compare-and-consume consumes only a matching active review gate", () => {
  const cwd = createGitFixture("review-gate-compare-consume-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const expectedHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const expectedFingerprint = activeReviewGateFingerprint(cwd);

    const consumed = consumeReviewGateForDiff(
      {
        expectedStagedDiffHash: expectedHash,
        expectedRequiredReviewPasses: [
          "implementation-readiness",
          "edge-cases-and-risks",
        ],
        expectedActiveReviewGateFingerprint: expectedFingerprint,
      },
      cwd,
    );

    assert.equal(consumed.consumed, true);
    assert.equal(consumed.state?.active, false);
    assert.equal(consumed.state?.status, "consumed");
    assert.equal(typeof consumed.state?.consumedAt, "string");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("compare-and-consume preserves a changed active review gate", () => {
  const cwd = createGitFixture("review-gate-compare-mismatch-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const expectedHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const expectedFingerprint = activeReviewGateFingerprint(cwd);
    const original = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );
    const changedHash = `sha256:${"0".repeat(64)}`;
    writeGateState(
      cwd,
      JSON.stringify({
        version: 1,
        active: true,
        status: "active",
        workflow: "test-workflow",
        sourceProvenance: {
          kind: "test",
          ref: "changed",
        },
        identity: {
          ...original.identity,
          stagedDiffHash: changedHash,
        },
        stagedDiffHash: changedHash,
        requiredReviewPasses: ["implementation-readiness"],
        results: {
          "implementation-readiness": {
            status: "passed",
            diffHash: changedHash,
          },
        },
        blockingFindings: [],
      }),
    );

    const consumed = consumeReviewGateForDiff(
      {
        expectedStagedDiffHash: expectedHash,
        expectedRequiredReviewPasses: ["implementation-readiness"],
        expectedActiveReviewGateFingerprint: expectedFingerprint,
      },
      cwd,
    );
    const persisted = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );

    assert.equal(consumed.consumed, false);
    assert.match(consumed.note ?? "", /staged diff hash changed/);
    assert.equal(persisted.active, true);
    assert.equal(persisted.status, "active");
    assert.equal(persisted.stagedDiffHash, changedHash);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("compare-and-consume preserves a changed required review pass set", () => {
  const cwd = createGitFixture("review-gate-compare-passes-mismatch-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const expectedHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const expectedFingerprint = activeReviewGateFingerprint(cwd);
    const original = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );
    writeGateState(
      cwd,
      JSON.stringify({
        version: 1,
        active: true,
        status: "active",
        workflow: "test-workflow",
        sourceProvenance: {
          kind: "test",
          ref: "changed-passes",
        },
        identity: original.identity,
        stagedDiffHash: expectedHash,
        requiredReviewPasses: ["implementation-readiness"],
        results: {
          "implementation-readiness": {
            status: "passed",
            diffHash: expectedHash,
          },
        },
        blockingFindings: [],
      }),
    );

    const consumed = consumeReviewGateForDiff(
      {
        expectedStagedDiffHash: expectedHash,
        expectedRequiredReviewPasses: [
          "implementation-readiness",
          "edge-cases-and-risks",
        ],
        expectedActiveReviewGateFingerprint: expectedFingerprint,
      },
      cwd,
    );
    const persisted = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );

    assert.equal(consumed.consumed, false);
    assert.match(consumed.note ?? "", /required review passes changed/);
    assert.equal(persisted.active, true);
    assert.equal(persisted.status, "active");
    assert.deepEqual(persisted.requiredReviewPasses, [
      "implementation-readiness",
    ]);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("compare-and-consume preserves a changed active review gate identity", () => {
  const cwd = createGitFixture("review-gate-compare-identity-mismatch-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const expectedHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const expectedFingerprint = activeReviewGateFingerprint(cwd);
    const original = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );
    writeGateState(
      cwd,
      JSON.stringify({
        version: 1,
        active: true,
        status: "active",
        workflow: "test-workflow",
        unit: {
          id: "unit-2",
          title: "Other fixture unit",
        },
        sourceProvenance: {
          kind: "test",
          ref: "changed-identity",
          evidence: ["other-evidence"],
        },
        identity: original.identity,
        stagedDiffHash: expectedHash,
        requiredReviewPasses: [
          "implementation-readiness",
          "edge-cases-and-risks",
        ],
        results: {
          "implementation-readiness": {
            status: "passed",
            diffHash: expectedHash,
            summary: "Ready for implementation.",
          },
          "edge-cases-and-risks": {
            status: "passed",
            diffHash: expectedHash,
            summary: "No blocking edge cases.",
          },
        },
        blockingFindings: [],
      }),
    );

    const consumed = consumeReviewGateForDiff(
      {
        expectedStagedDiffHash: expectedHash,
        expectedRequiredReviewPasses: [
          "implementation-readiness",
          "edge-cases-and-risks",
        ],
        expectedActiveReviewGateFingerprint: expectedFingerprint,
      },
      cwd,
    );
    const persisted = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );

    assert.equal(consumed.consumed, false);
    assert.match(consumed.note ?? "", /identity or evidence changed/);
    assert.equal(persisted.active, true);
    assert.equal(persisted.status, "active");
    assert.equal(persisted.sourceProvenance.ref, "changed-identity");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("compare-and-consume preserves an identity-only changed active review gate", () => {
  const cwd = createGitFixture("review-gate-compare-identity-only-mismatch-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const expectedHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const expectedFingerprint = activeReviewGateFingerprint(cwd);
    const original = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );
    writeGateState(
      cwd,
      JSON.stringify({
        ...original,
        identity: {
          ...original.identity,
          gitDir: `${original.identity.gitDir}-changed`,
        },
      }),
    );

    const consumed = consumeReviewGateForDiff(
      {
        expectedStagedDiffHash: expectedHash,
        expectedRequiredReviewPasses: [
          "implementation-readiness",
          "edge-cases-and-risks",
        ],
        expectedActiveReviewGateFingerprint: expectedFingerprint,
      },
      cwd,
    );
    const persisted = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );

    assert.equal(consumed.consumed, false);
    assert.match(consumed.note ?? "", /identity or evidence changed/);
    assert.equal(persisted.active, true);
    assert.equal(persisted.status, "active");
    assert.equal(
      persisted.identity.gitDir,
      `${original.identity.gitDir}-changed`,
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("compare-and-consume is guarded by a review gate lock", () => {
  const cwd = createGitFixture("review-gate-compare-lock-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    const expectedHash = stagedDiffHash(cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const expectedFingerprint = activeReviewGateFingerprint(cwd);
    writeFileSync(
      join(dirname(reviewGateStatePath(cwd)), "review-gate.lock"),
      "locked\n",
      "utf-8",
    );

    const consumed = consumeReviewGateForDiff(
      {
        expectedStagedDiffHash: expectedHash,
        expectedRequiredReviewPasses: [
          "implementation-readiness",
          "edge-cases-and-risks",
        ],
        expectedActiveReviewGateFingerprint: expectedFingerprint,
      },
      cwd,
    );
    const persisted = JSON.parse(
      readFileSync(reviewGateStatePath(cwd), "utf-8"),
    );

    assert.equal(consumed.consumed, false);
    assert.match(consumed.note ?? "", /locked by another operation/);
    assert.equal(persisted.active, true);
    assert.equal(persisted.status, "active");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("active review gate writes are guarded by the review gate lock", () => {
  const cwd = createGitFixture("review-gate-write-lock-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    mkdirSync(dirname(reviewGateStatePath(cwd)), { recursive: true });
    writeFileSync(
      join(dirname(reviewGateStatePath(cwd)), "review-gate.lock"),
      "locked\n",
      "utf-8",
    );

    assert.throws(
      () => writeActiveReviewGate(validReviewGateInput(cwd), cwd),
      /locked by another operation/,
    );
    assert.equal(existsSync(reviewGateStatePath(cwd)), false);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("clear review gate writes are guarded by the review gate lock", () => {
  const cwd = createGitFixture("review-gate-clear-lock-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], cwd);
    writeActiveReviewGate(validReviewGateInput(cwd), cwd);
    const original = readFileSync(reviewGateStatePath(cwd), "utf-8");
    writeFileSync(
      join(dirname(reviewGateStatePath(cwd)), "review-gate.lock"),
      "locked\n",
      "utf-8",
    );

    assert.throws(() => clearReviewGate(cwd), /locked by another operation/);
    assert.equal(readFileSync(reviewGateStatePath(cwd), "utf-8"), original);
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

test("active and consumed review gate state stays under linked worktree metadata", () => {
  const repo = createGitFixture("review-gate-write-worktree-repo-");
  const worktree = mkdtempSync(join(tmpdir(), "review-gate-write-worktree-"));
  try {
    writeFileSync(join(repo, "base.txt"), "base\n", "utf-8");
    runGit(["add", "base.txt"], repo);
    runGit(["commit", "-m", "base"], repo);
    rmSync(worktree, { force: true, recursive: true });
    runGit(["worktree", "add", worktree], repo);
    writeFileSync(join(worktree, "feature.txt"), "feature\n", "utf-8");
    runGit(["add", "feature.txt"], worktree);

    const parentStatePath = join(repo, ".git", "ax", "review-gate.json");
    const { statePath } = writeActiveReviewGate(
      validReviewGateInput(worktree),
      worktree,
    );
    const gitDir = runGit(["rev-parse", "--git-dir"], worktree);
    const expectedGitDir = isAbsolute(gitDir) ? gitDir : join(worktree, gitDir);

    assert.equal(dirname(statePath), join(expectedGitDir, "ax"));
    assert.equal(existsSync(statePath), true);
    assert.equal(existsSync(parentStatePath), false);

    const consumed = consumeReviewGate(worktree);
    const persisted = JSON.parse(readFileSync(statePath, "utf-8"));

    assert.equal(consumed.consumed, true);
    assert.equal(consumed.statePath, statePath);
    assert.equal(consumed.state?.status, "consumed");
    assert.equal(persisted.status, "consumed");
    assert.equal(existsSync(parentStatePath), false);
  } finally {
    rmSync(worktree, { force: true, recursive: true });
    rmSync(repo, { force: true, recursive: true });
  }
});
