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
  architectureFitAndReuse: "passed" | "finding" | "blocked";
  codeQualityReview: "passed" | "finding" | "blocked";
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

  const incomplete = [
    ["reuse-contract", checkpoint.reuseContractReviewed ? "passed" : "missing"],
    [
      "precedent-evidence",
      checkpoint.precedentEvidence.some((evidence) => evidence.trim())
        ? "passed"
        : "missing",
    ],
    ["architecture-fit-and-reuse", checkpoint.architectureFitAndReuse],
    ["code-quality-review", checkpoint.codeQualityReview],
  ]
    .filter(([, status]) => status !== "passed")
    .map(([reviewer]) => reviewer);

  if (incomplete.length > 0) {
    throw new Error(
      `poc_architecture_checkpoint_incomplete:${incomplete.join(",")}`,
    );
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
