export type WorktreeIdentity = {
  branch: string;
  worktree: string;
  head: string;
  writer: string;
  diffFingerprint: string;
};

export function assertWriterOwnership(
  expected: WorktreeIdentity,
  observed: WorktreeIdentity,
): void {
  for (const field of [
    "branch",
    "worktree",
    "head",
    "writer",
    "diffFingerprint",
  ] as const) {
    if (expected[field] !== observed[field]) {
      throw new Error(`worktree_ownership_stale:${field}`);
    }
  }
}

export function finalDeliveryOrder(unitIds: string[]): string[] {
  const seen = new Set<string>();

  for (const unitId of unitIds) {
    if (!unitId.trim() || seen.has(unitId)) {
      throw new Error(`invalid_delivery_unit:${unitId}`);
    }
    seen.add(unitId);
  }

  return [...unitIds];
}

export type PocArchitectureCheckpoint = {
  targetBaseSha: string;
  diffFingerprint: string;
  reuseContractReviewed: boolean;
  precedentEvidence: readonly string[];
  semanticTripwires: readonly {
    kind: string;
    resolution: "cleared" | "finding" | "plan_required";
  }[];
  reviewResults: readonly {
    reviewer: "code-quality-review" | "scrutinize";
    reviewerRunId: string;
    status: "passed" | "finding" | "blocked";
  }[];
  targetedProof: {
    status: "passed" | "failed" | "blocked";
    entrypoint: string;
    evidence: string;
  };
  architectureAffectingChangeSinceReview: boolean;
};

export function assertPocExpansionAllowed(
  checkpoint: PocArchitectureCheckpoint,
  expected: {
    targetBaseSha: string;
    diffFingerprint: string;
  },
): void {
  if (
    checkpoint.targetBaseSha !== expected.targetBaseSha ||
    checkpoint.diffFingerprint !== expected.diffFingerprint ||
    checkpoint.architectureAffectingChangeSinceReview
  ) {
    throw new Error("poc_architecture_checkpoint_stale");
  }

  const incompleteProof = [
    ["reuse-contract", checkpoint.reuseContractReviewed ? "passed" : "missing"],
    [
      "precedent-evidence",
      checkpoint.precedentEvidence.some((evidence) => evidence.trim())
        ? "passed"
        : "missing",
    ],
    [
      "targeted-proof",
      checkpoint.targetedProof.status === "passed" &&
      checkpoint.targetedProof.entrypoint.trim() &&
      checkpoint.targetedProof.evidence.trim()
        ? "passed"
        : "missing",
    ],
  ]
    .filter(([, status]) => status !== "passed")
    .map(([proof]) => proof);

  if (incompleteProof.length > 0) {
    throw new Error(
      `poc_architecture_checkpoint_incomplete:${incompleteProof.join(",")}`,
    );
  }

  const requiredReviewers = ["code-quality-review", "scrutinize"] as const;
  const requiredResults = requiredReviewers.map((reviewer) => {
    const results = checkpoint.reviewResults.filter(
      (result) => result.reviewer === reviewer,
    );
    if (results.length !== 1) {
      throw new Error(
        `poc_architecture_checkpoint_reviewer_result_invalid:${reviewer}`,
      );
    }
    return results[0];
  });
  for (const result of requiredResults) {
    if (result.status !== "passed") {
      throw new Error(
        `poc_architecture_checkpoint_reviewer_not_passed:${result.reviewer}:${result.status}`,
      );
    }
  }
  const reviewerRunIds = new Set(
    requiredResults.map((result) => result.reviewerRunId.trim()),
  );
  if (
    requiredResults.some((result) => !result.reviewerRunId.trim()) ||
    reviewerRunIds.size !== requiredReviewers.length
  ) {
    throw new Error("poc_architecture_checkpoint_reviewer_identity_reused");
  }

  const unresolvedTripwires = checkpoint.semanticTripwires
    .filter(({ resolution }) => resolution !== "cleared")
    .map(({ kind }) => kind);
  if (unresolvedTripwires.length > 0) {
    throw new Error(
      `poc_architecture_checkpoint_tripwires_unresolved:${unresolvedTripwires.join(",")}`,
    );
  }
}
