import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assertPocExpansionAllowed,
  type PocArchitectureCheckpoint,
} from "../../skills/execute/scripts/execution-contract.ts";
import {
  baselineFor,
  firstObjectiveProofBaseline,
  type PublicationCheckpoint,
  reviewWavesFor,
  validatePublicationCheckpoint,
  validateReviewTaskPacket,
} from "../../skills/review/scripts/review-contract.ts";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const implementationReviewers = [
  "code-simplifier",
  "code-quality-review",
  "deslop",
  "diff-review",
  "scrutinize",
] as const;

function passingCheckpoint(): PublicationCheckpoint {
  return {
    targetBase: "main",
    targetBaseSha: "base-a",
    head: "head-a",
    diffInspected: true,
    hooksPassed: true,
    requiredSpecialists: [],
    excludedReviewerRunIds: ["writer", "coordinator", "hosted-bot"],
    reviewResults: implementationReviewers.map((reviewer, index) => ({
      reviewer,
      reviewerRunId: `reviewer-${index + 1}`,
      targetBaseSha: "base-a",
      head: "head-a",
      status: "passed" as const,
      findings: [],
    })),
    provider: "gitlab",
    blockers: [],
  };
}

test("completed code requires the five accepted reviewer skills", () => {
  assert.deepEqual(baselineFor("poc"), implementationReviewers);
  assert.deepEqual(
    baselineFor("final_implementation"),
    implementationReviewers,
  );
  assert.deepEqual(firstObjectiveProofBaseline, [
    "code-quality-review",
    "scrutinize",
  ]);
});

test("publication requires distinct reviewer-run identities on the exact target", () => {
  const checkpoint = passingCheckpoint();
  assert.doesNotThrow(() =>
    validatePublicationCheckpoint(checkpoint, {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-a",
    }),
  );

  const duplicateIdentity = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result, index) =>
      index === 1
        ? {
            ...result,
            reviewerRunId: checkpoint.reviewResults[0].reviewerRunId,
          }
        : result,
    ),
  };
  assert.throws(
    () =>
      validatePublicationCheckpoint(duplicateIdentity, {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "head-a",
      }),
    /publication_checkpoint_reviewer_identity_reused/,
  );

  const excludedIdentity = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result, index) =>
      index === 0 ? { ...result, reviewerRunId: "writer" } : result,
    ),
  };
  assert.throws(
    () =>
      validatePublicationCheckpoint(excludedIdentity, {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "head-a",
      }),
    /publication_checkpoint_reviewer_identity_excluded/,
  );
});

test("selected specialists require separate current passing results", () => {
  const checkpoint = passingCheckpoint();
  const missingSpecialist = {
    ...checkpoint,
    requiredSpecialists: ["security-review"],
  };
  assert.throws(
    () =>
      validatePublicationCheckpoint(missingSpecialist, {
        target: "poc",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "head-a",
      }),
    /publication_checkpoint_reviewers_missing:security-review/,
  );

  const passingSpecialist = {
    ...missingSpecialist,
    reviewResults: [
      ...checkpoint.reviewResults,
      {
        reviewer: "security-review",
        reviewerRunId: "security-specialist",
        targetBaseSha: "base-a",
        head: "head-a",
        status: "passed" as const,
        findings: [],
      },
    ],
  };
  assert.doesNotThrow(() =>
    validatePublicationCheckpoint(passingSpecialist, {
      target: "poc",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-a",
    }),
  );
});

test("publication rejects incomplete or blocking normalized findings", () => {
  const checkpoint = passingCheckpoint();
  const withFinding = (
    finding: PublicationCheckpoint["reviewResults"][number]["findings"][number],
  ): PublicationCheckpoint => ({
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result, index) =>
      index === 0 ? { ...result, findings: [finding] } : result,
    ),
  });

  assert.throws(
    () =>
      validatePublicationCheckpoint(
        withFinding({
          severity: "nonblocking",
          affectedLocation: "skills/review/SKILL.md",
          issue: "Reviewer result needs structured evidence.",
          evidence: "",
          remediationOutcome: "Unresolved suggestion.",
          invalidatedSurfaces: [],
        }),
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-a",
        },
      ),
    /publication_checkpoint_finding_incomplete:code-simplifier:evidence/,
  );

  assert.throws(
    () =>
      validatePublicationCheckpoint(
        withFinding({
          severity: "blocking",
          affectedLocation: "skills/review/scripts/review-contract.ts",
          issue: "A blocking finding cannot pass publication.",
          evidence: "The reviewer marked the finding blocking.",
          remediationOutcome: "Unresolved.",
          invalidatedSurfaces: ["publication-checkpoint"],
        }),
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-a",
        },
      ),
    /publication_checkpoint_reviewer_blocking_finding:code-simplifier/,
  );
});

test("review waves preserve coverage at available worker capacity", () => {
  assert.deepEqual(reviewWavesFor("final_implementation", 9, []), [
    [...implementationReviewers],
  ]);
  assert.deepEqual(reviewWavesFor("final_implementation", 3, []), [
    implementationReviewers.slice(0, 3),
    implementationReviewers.slice(3),
  ]);
  assert.deepEqual(
    reviewWavesFor("final_implementation", 6, [
      "security-review",
      "docs-alignment-review",
    ]),
    [
      [...implementationReviewers, "security-review"],
      ["docs-alignment-review"],
    ],
  );
  assert.throws(
    () => reviewWavesFor("final_implementation", 0, []),
    /review_worker_capacity_invalid/,
  );
});

test("review task packets contain exact immutable assignment context", () => {
  assert.doesNotThrow(() =>
    validateReviewTaskPacket({
      reviewer: "diff-review",
      target: "final_implementation",
      artifactPath: ".",
      artifactFingerprint: "sha256:diff",
      targetBaseSha: "base-a",
      head: "head-a",
      changedFiles: ["src/example.ts"],
      rules: ["AGENTS.md", "rules/testing-and-verification.md"],
      acceptedDecisions: ["preserve the existing owner"],
      verificationEvidence: ["unit test passed"],
      outputContract: "passed | finding | blocked with source evidence",
    }),
  );

  assert.throws(
    () =>
      validateReviewTaskPacket({
        reviewer: "diff-review",
        target: "final_implementation",
        artifactPath: ".",
        artifactFingerprint: "",
        targetBaseSha: "base-a",
        head: "head-a",
        changedFiles: [],
        rules: [],
        acceptedDecisions: [],
        verificationEvidence: [],
        outputContract: "passed | finding | blocked with source evidence",
      }),
    /review_task_packet_incomplete:artifactFingerprint/,
  );
});

test("first objective proof requires two independent reviewers and targeted proof", () => {
  const checkpoint: PocArchitectureCheckpoint = {
    targetBaseSha: "base-a",
    diffFingerprint: "sha256:proof",
    reuseContractReviewed: true,
    precedentEvidence: ["skills/review/SKILL.md owns review"],
    semanticTripwires: [],
    reviewResults: [
      {
        reviewer: "code-quality-review",
        reviewerRunId: "quality-agent",
        status: "passed",
      },
      {
        reviewer: "scrutinize",
        reviewerRunId: "scrutiny-agent",
        status: "passed",
      },
    ],
    targetedProof: {
      status: "passed",
      entrypoint: "pnpm exec node --import tsx --test focused.test.ts",
      evidence: "real decision path passed",
    },
    architectureAffectingChangeSinceReview: false,
  };

  assert.doesNotThrow(() =>
    assertPocExpansionAllowed(checkpoint, {
      targetBaseSha: "base-a",
      diffFingerprint: "sha256:proof",
    }),
  );

  assert.throws(
    () =>
      assertPocExpansionAllowed(
        {
          ...checkpoint,
          reviewResults: checkpoint.reviewResults.map((result) => ({
            ...result,
            reviewerRunId: "same-agent",
          })),
        },
        {
          targetBaseSha: "base-a",
          diffFingerprint: "sha256:proof",
        },
      ),
    /poc_architecture_checkpoint_reviewer_identity_reused/,
  );

  assert.throws(
    () =>
      assertPocExpansionAllowed(
        {
          ...checkpoint,
          reviewResults: [
            ...checkpoint.reviewResults,
            checkpoint.reviewResults[0],
          ],
        },
        {
          targetBaseSha: "base-a",
          diffFingerprint: "sha256:proof",
        },
      ),
    /poc_architecture_checkpoint_reviewer_result_invalid:code-quality-review/,
  );

  assert.throws(
    () =>
      assertPocExpansionAllowed(
        {
          ...checkpoint,
          targetedProof: {
            ...checkpoint.targetedProof,
            status: "failed",
          },
        },
        {
          targetBaseSha: "base-a",
          diffFingerprint: "sha256:proof",
        },
      ),
    /poc_architecture_checkpoint_incomplete:targeted-proof/,
  );

  assert.throws(
    () =>
      assertPocExpansionAllowed(
        {
          ...checkpoint,
          reviewResults: checkpoint.reviewResults.map((result) =>
            result.reviewer === "scrutinize"
              ? { ...result, status: "finding" }
              : result,
          ),
        },
        {
          targetBaseSha: "base-a",
          diffFingerprint: "sha256:proof",
        },
      ),
    /poc_architecture_checkpoint_reviewer_not_passed:scrutinize:finding/,
  );
});

test("required reviewer skills are findings-only", () => {
  for (const path of [
    "skills/code-simplifier/SKILL.md",
    "skills/code-quality-review/SKILL.md",
    "skills/deslop/SKILL.md",
    "skills/diff-review/SKILL.md",
    "skills/scrutinize/SKILL.md",
  ]) {
    const skill = read(path);
    assert.match(skill, /findings-only/i, path);
    assert.doesNotMatch(skill, /allowed-tools:[^\n]*(?:Edit|Write)/, path);
    assert.doesNotMatch(skill, /fix automatically/i, path);
  }
});

test("orchestration guidance uses clean context, barriers, and progressive proof", () => {
  const review = read("skills/review/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const docs = read("skills/doc-smith/SKILL.md");

  assert.match(review, /fork_turns="none"/);
  assert.match(review, /phase barrier/i);
  assert.match(review, /backfill/i);
  assert.match(review, /findings batch/i);
  assert.match(execute, /environment preflight/i);
  assert.match(execute, /progressive verification/i);
  assert.match(docs, /planning contracts/i);
  assert.match(docs, /final stable document text/i);
});
