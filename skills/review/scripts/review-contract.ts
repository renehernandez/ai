export const planningBaseline = [
  "implementation-readiness",
  "edge-cases-and-risk",
  "simplification-and-scope",
  "refactoring-opportunities",
  "delivery-shape",
] as const;

export const implementationBaseline = [
  "correctness",
  "regression-risk",
  "maintainability",
  "verification-quality",
] as const;

export type ReviewTarget = "planning" | "poc" | "final_implementation";

export function baselineFor(target: ReviewTarget): readonly string[] {
  return target === "planning" ? planningBaseline : implementationBaseline;
}

export type PublicationCheckpoint = {
  targetBase: string;
  targetBaseSha: string;
  head: string;
  diffInspected: boolean;
  hooksPassed: boolean;
  reviewersPassed: readonly string[];
  provider: string;
  blockers: readonly string[];
};

export function validatePublicationCheckpoint(
  checkpoint: PublicationCheckpoint,
  expected: {
    targetBase: string;
    targetBaseSha: string;
    head: string;
    requiredReviewers: readonly string[];
  },
): void {
  if (
    checkpoint.targetBase !== expected.targetBase ||
    checkpoint.targetBaseSha !== expected.targetBaseSha ||
    checkpoint.head !== expected.head
  ) {
    throw new Error("publication_checkpoint_stale");
  }
  if (!checkpoint.diffInspected || !checkpoint.hooksPassed) {
    throw new Error("publication_checkpoint_incomplete");
  }
  if (!checkpoint.provider.trim()) {
    throw new Error("provider_route_unresolved");
  }
  const passedReviewers = new Set(checkpoint.reviewersPassed);
  const missingReviewers = expected.requiredReviewers.filter(
    (reviewer) => !passedReviewers.has(reviewer),
  );
  if (missingReviewers.length > 0) {
    throw new Error(
      `publication_checkpoint_reviewers_missing:${missingReviewers.join(",")}`,
    );
  }
  if (checkpoint.blockers.length > 0) {
    throw new Error("publication_checkpoint_blocked");
  }
}

export type HostedFinding = {
  head: string;
  targetBaseSha: string;
  status: "passed" | "finding" | "blocked" | "pending";
  findings: readonly string[];
};

export function normalizeHostedFinding(
  finding: HostedFinding,
  expected: { head: string; targetBaseSha: string },
): HostedFinding {
  if (
    finding.head !== expected.head ||
    finding.targetBaseSha !== expected.targetBaseSha
  ) {
    return {
      head: finding.head,
      targetBaseSha: finding.targetBaseSha,
      status: "blocked",
      findings: ["hosted feedback belongs to a stale effective diff"],
    };
  }
  return finding;
}
