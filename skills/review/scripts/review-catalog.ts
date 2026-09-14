import {
  finalImplementationReviewerCatalog,
  planningReviewerCatalog,
  reviewerCatalog,
} from "./review-contract.ts";

process.stdout.write(
  `${JSON.stringify({
    planning: planningReviewerCatalog.map((id) => ({
      id,
      ...reviewerCatalog[id],
    })),
    implementation: finalImplementationReviewerCatalog.map((id) => ({
      id,
      ...reviewerCatalog[id],
    })),
  })}\n`,
);
