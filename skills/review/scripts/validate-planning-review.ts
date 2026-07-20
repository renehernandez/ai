#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import type {
  PlanningReviewCheckpoint,
  PlanningReviewExpected,
} from "./review-contract.ts";
import { validatePlanningReviewCheckpoint } from "./review-contract.ts";

type PlanningReviewValidationInput = {
  checkpoint: PlanningReviewCheckpoint;
  expected: PlanningReviewExpected;
};

const inputPath = process.argv[2];
if (!inputPath) {
  process.stderr.write(
    "usage: validate-planning-review.ts <task-local-checkpoint.json>\n",
  );
  process.exit(2);
}

try {
  const input = JSON.parse(
    readFileSync(inputPath, "utf8"),
  ) as PlanningReviewValidationInput;
  validatePlanningReviewCheckpoint(input.checkpoint, input.expected);
  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      artifact: input.checkpoint.artifact,
      artifactFingerprint: input.checkpoint.artifactFingerprint,
    })}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
