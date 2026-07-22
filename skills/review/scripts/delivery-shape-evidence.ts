export type DeliveryShapeAssessmentStatus =
  | "passed"
  | "split_required"
  | "merge_required";

export const deliveryReviewBudget = {
  plannedFiles: 10,
  plannedChangedLines: 500,
  maximumFiles: 15,
  maximumChangedLines: 1_000,
} as const;

export type DeliveryBudgetForecast = {
  unitId: string;
  fileCount: number;
  additions: number;
  deletions: number;
  overBudgetRationale?: string;
};

export type DeliveryBudgetException = {
  artifact: string;
  sourceHead: string;
  targetBaseSha: string;
  fileCount: number;
  additions: number;
  deletions: number;
  rationale: string;
  reviewConsequences: string;
  approvalEvidence: string;
  explicitUserApproval: true;
};

export type EffectiveDiffBudget = {
  artifact: string;
  sourceHead: string;
  targetBaseSha: string;
  fileCount: number;
  additions: number;
  deletions: number;
  overBudgetRationale?: string;
  exception?: DeliveryBudgetException;
};

export type DeliveryShapeUnitAssessment = {
  unitId: string;
  status: DeliveryShapeAssessmentStatus;
  observedDomains: readonly string[];
  localOutcome: string;
  safeStopState: string;
  localProof: string;
  securitySeam: string;
  activationSeam: string;
  rollbackSeam: string;
  deploymentSeam: string;
  splitAlternative: string;
  splitRationale: string;
  mergeAlternative: string;
  mergeRationale: string;
  predecessorOutput: string;
  integrationHotspots: readonly string[];
  budget: DeliveryBudgetForecast;
};

export type DeliveryShapeFootprintEntry = {
  id: string;
  evidence: string;
  domains: readonly string[];
  ownerUnitId?: string;
  integrationUnitIds?: readonly string[];
};

export type DeliveryShapeEvidence = {
  pocHead: string;
  footprintFingerprint: string;
  provisionalUnitIds: readonly string[];
  finalUnitIds: readonly string[];
  unitAssessments: readonly DeliveryShapeUnitAssessment[];
  footprint: readonly DeliveryShapeFootprintEntry[];
};

export type AcceptedPocContext = {
  head: string;
  footprintFingerprint: string;
  materialFootprintIds: readonly string[];
};

export type PostPocPlanningContext = {
  acceptedPoc: AcceptedPocContext;
  provisionalUnitIds: readonly string[];
  finalUnitIds: readonly string[];
  materialTopologyChanged: boolean;
  topologyChangeAccepted: boolean;
};

export function validatePostPocDeliveryShapeEvidence(
  evidence: DeliveryShapeEvidence,
  expected: PostPocPlanningContext,
): void {
  if (
    !evidence.pocHead.trim() ||
    evidence.pocHead !== expected.acceptedPoc.head
  ) {
    throw new Error("post_poc_delivery_shape_stale_poc");
  }
  if (
    !evidence.footprintFingerprint.trim() ||
    evidence.footprintFingerprint !== expected.acceptedPoc.footprintFingerprint
  ) {
    throw new Error("post_poc_delivery_shape_stale_footprint");
  }

  validateOrderedUnitIds(
    evidence.provisionalUnitIds,
    expected.provisionalUnitIds,
    "provisional",
  );
  validateOrderedUnitIds(evidence.finalUnitIds, expected.finalUnitIds, "final");

  const unitIdsChanged = !sameOrderedValues(
    expected.provisionalUnitIds,
    expected.finalUnitIds,
  );
  if (
    (expected.materialTopologyChanged || unitIdsChanged) &&
    !expected.topologyChangeAccepted
  ) {
    throw new Error("post_poc_delivery_shape_change_unaccepted");
  }

  const finalUnitIds = new Set(expected.finalUnitIds);
  const assessedUnitIds = new Set<string>();
  for (const assessment of evidence.unitAssessments) {
    if (!assessment.unitId.trim() || assessedUnitIds.has(assessment.unitId)) {
      throw new Error(
        `post_poc_delivery_shape_assessment_duplicate:${assessment.unitId}`,
      );
    }
    assessedUnitIds.add(assessment.unitId);
    if (!finalUnitIds.has(assessment.unitId)) {
      throw new Error(
        `post_poc_delivery_shape_assessment_unknown_unit:${assessment.unitId}`,
      );
    }
    validateDeliveryShapeAssessment(assessment);
  }

  if (
    assessedUnitIds.size !== finalUnitIds.size ||
    expected.finalUnitIds.some((unitId) => !assessedUnitIds.has(unitId))
  ) {
    throw new Error("post_poc_delivery_shape_assessments_incomplete");
  }

  const expectedFootprintIds = new Set(
    expected.acceptedPoc.materialFootprintIds,
  );
  if (
    expectedFootprintIds.size !==
      expected.acceptedPoc.materialFootprintIds.length ||
    expected.acceptedPoc.materialFootprintIds.some(
      (footprintId) => !footprintId.trim(),
    )
  ) {
    throw new Error("post_poc_delivery_shape_expected_footprint_invalid");
  }

  const footprintIds = new Set<string>();
  for (const entry of evidence.footprint) {
    if (!entry.id.trim() || footprintIds.has(entry.id)) {
      throw new Error(
        `post_poc_delivery_shape_footprint_duplicate:${entry.id}`,
      );
    }
    footprintIds.add(entry.id);
    requireNonEmpty(
      entry.evidence,
      `post_poc_delivery_shape_footprint_incomplete:${entry.id}:evidence`,
    );
    requireNonEmptyList(
      entry.domains,
      `post_poc_delivery_shape_footprint_incomplete:${entry.id}:domains`,
    );

    const hasOwner = Boolean(entry.ownerUnitId?.trim());
    const integrationUnitIds = entry.integrationUnitIds ?? [];
    const hasIntegration = integrationUnitIds.length > 0;
    if (hasOwner === hasIntegration) {
      throw new Error(
        `post_poc_delivery_shape_footprint_assignment_invalid:${entry.id}`,
      );
    }
    if (hasOwner && !finalUnitIds.has(entry.ownerUnitId as string)) {
      throw new Error(
        `post_poc_delivery_shape_footprint_unknown_unit:${entry.id}:${entry.ownerUnitId}`,
      );
    }
    if (hasIntegration) {
      const uniqueIntegrationUnits = new Set(integrationUnitIds);
      if (
        uniqueIntegrationUnits.size < 2 ||
        uniqueIntegrationUnits.size !== integrationUnitIds.length ||
        integrationUnitIds.some(
          (unitId) => !unitId.trim() || !finalUnitIds.has(unitId),
        )
      ) {
        throw new Error(
          `post_poc_delivery_shape_integration_hotspot_invalid:${entry.id}`,
        );
      }
    }
  }

  if (
    footprintIds.size !== expectedFootprintIds.size ||
    expected.acceptedPoc.materialFootprintIds.some(
      (footprintId) => !footprintIds.has(footprintId),
    )
  ) {
    throw new Error("post_poc_delivery_shape_footprint_incomplete");
  }
}

function validateOrderedUnitIds(
  actual: readonly string[],
  expected: readonly string[],
  kind: "provisional" | "final",
): void {
  if (
    new Set(actual).size !== actual.length ||
    actual.some((unitId) => !unitId.trim())
  ) {
    throw new Error(`post_poc_delivery_shape_${kind}_units_invalid`);
  }
  if (!sameOrderedValues(actual, expected)) {
    throw new Error(`post_poc_delivery_shape_${kind}_units_stale`);
  }
}

function validateDeliveryShapeAssessment(
  assessment: DeliveryShapeUnitAssessment,
): void {
  if (assessment.status !== "passed") {
    throw new Error(
      `post_poc_delivery_shape_unit_not_cohesive:${assessment.unitId}:${assessment.status}`,
    );
  }
  requireNonEmptyList(
    assessment.observedDomains,
    `post_poc_delivery_shape_assessment_incomplete:${assessment.unitId}:observedDomains`,
  );
  for (const field of [
    "localOutcome",
    "safeStopState",
    "localProof",
    "securitySeam",
    "activationSeam",
    "rollbackSeam",
    "deploymentSeam",
    "splitAlternative",
    "splitRationale",
    "mergeAlternative",
    "mergeRationale",
    "predecessorOutput",
  ] as const) {
    requireNonEmpty(
      assessment[field],
      `post_poc_delivery_shape_assessment_incomplete:${assessment.unitId}:${field}`,
    );
  }
  if (assessment.integrationHotspots.some((hotspot) => !hotspot.trim())) {
    throw new Error(
      `post_poc_delivery_shape_assessment_incomplete:${assessment.unitId}:integrationHotspots`,
    );
  }
  if (assessment.budget.unitId !== assessment.unitId) {
    throw new Error(
      `post_poc_delivery_shape_budget_unit_stale:${assessment.unitId}`,
    );
  }
  validateDeliveryBudgetForecast(assessment.budget);
}

export function validateDeliveryBudgetForecast(
  forecast: DeliveryBudgetForecast,
): void {
  requireCount(forecast.fileCount, "delivery_budget_file_count_invalid");
  requireCount(forecast.additions, "delivery_budget_additions_invalid");
  requireCount(forecast.deletions, "delivery_budget_deletions_invalid");
  const changedLines = forecast.additions + forecast.deletions;
  if (
    forecast.fileCount > deliveryReviewBudget.maximumFiles ||
    changedLines > deliveryReviewBudget.maximumChangedLines
  ) {
    throw new Error(`delivery_budget_hard_cap_exceeded:${forecast.unitId}`);
  }
  if (
    (forecast.fileCount > deliveryReviewBudget.plannedFiles ||
      changedLines > deliveryReviewBudget.plannedChangedLines) &&
    !forecast.overBudgetRationale?.trim()
  ) {
    throw new Error(`delivery_budget_rationale_missing:${forecast.unitId}`);
  }
}

export function validateEffectiveDiffDeliveryBudget(
  budget: EffectiveDiffBudget,
): void {
  requireNonEmpty(budget.artifact, "delivery_budget_artifact_missing");
  requireNonEmpty(budget.sourceHead, "delivery_budget_source_head_missing");
  requireNonEmpty(
    budget.targetBaseSha,
    "delivery_budget_target_base_sha_missing",
  );
  requireCount(budget.fileCount, "delivery_budget_file_count_invalid");
  requireCount(budget.additions, "delivery_budget_additions_invalid");
  requireCount(budget.deletions, "delivery_budget_deletions_invalid");
  const changedLines = budget.additions + budget.deletions;
  const exceedsMaximum =
    budget.fileCount > deliveryReviewBudget.maximumFiles ||
    changedLines > deliveryReviewBudget.maximumChangedLines;
  if (!exceedsMaximum) {
    validateDeliveryBudgetForecast({ unitId: "effective-diff", ...budget });
    return;
  }

  const exception = budget.exception;
  if (
    !exception?.explicitUserApproval ||
    exception.artifact !== budget.artifact ||
    exception.sourceHead !== budget.sourceHead ||
    exception.targetBaseSha !== budget.targetBaseSha ||
    exception.fileCount !== budget.fileCount ||
    exception.additions !== budget.additions ||
    exception.deletions !== budget.deletions ||
    !exception.rationale.trim() ||
    !exception.reviewConsequences.trim() ||
    !exception.approvalEvidence.trim()
  ) {
    throw new Error("delivery_budget_exception_missing_or_stale");
  }
}

function requireNonEmpty(value: string, error: string): void {
  if (!value.trim()) {
    throw new Error(error);
  }
}

function requireNonEmptyList(values: readonly string[], error: string): void {
  if (values.length === 0 || values.some((value) => !value.trim())) {
    throw new Error(error);
  }
}

function requireCount(value: number, error: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(error);
  }
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
