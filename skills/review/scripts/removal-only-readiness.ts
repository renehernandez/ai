import type { EffectiveDiffBudget } from "./delivery-shape-evidence.ts";

type ReviewResultIdentity = {
  reviewType: string;
  executionId: string;
  targetBaseSha: string;
  head: string;
  status: "passed" | "finding" | "blocked";
};

export function validateRemovalOnlySemanticReview(
  deliveryBudget: EffectiveDiffBudget | undefined,
  reviewResults: readonly ReviewResultIdentity[],
): void {
  const removalOnlyEvidence =
    deliveryBudget?.classification === "removal-only"
      ? deliveryBudget.removalOnlyEvidence
      : undefined;
  if (!removalOnlyEvidence) {
    return;
  }

  const diffReview = reviewResults.find(
    (result) => result.reviewType === "diff-review",
  );
  const semanticReview = removalOnlyEvidence.semanticReview;
  if (
    diffReview?.status !== "passed" ||
    !semanticReview ||
    semanticReview.reviewType !== diffReview.reviewType ||
    semanticReview.executionId !== diffReview.executionId ||
    semanticReview.targetBaseSha !== diffReview.targetBaseSha ||
    semanticReview.head !== diffReview.head
  ) {
    throw new Error(
      "technical_readiness_removal_only_semantic_review_mismatch",
    );
  }
}
