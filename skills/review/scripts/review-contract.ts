import {
  type DeliveryShapeEvidence,
  type PostPocPlanningContext,
  validatePostPocDeliveryShapeEvidence,
} from "./delivery-shape-evidence.ts";

export type {
  AcceptedPocContext,
  DeliveryShapeAssessmentStatus,
  DeliveryShapeEvidence,
  DeliveryShapeFootprintEntry,
  DeliveryShapeUnitAssessment,
  PostPocPlanningContext,
} from "./delivery-shape-evidence.ts";

export type ReviewTarget = "planning" | "poc" | "final_implementation";

export const planningReviewerCatalog = [
  "implementation-readiness",
  "edge-cases-and-risk",
  "code-simplifier",
  "refactoring-opportunities",
  "delivery-shape",
] as const;

export const finalImplementationReviewerCatalog = [
  "code-simplifier",
  "code-quality-review",
  "deslop",
  "diff-review",
  "scrutinize",
] as const;

export const pocReviewerCatalog = [
  ...finalImplementationReviewerCatalog,
] as const;

export const firstObjectiveProofBaseline = [
  "code-simplifier",
  "code-quality-review",
  "scrutinize",
] as const;

export type ReviewerId =
  | (typeof planningReviewerCatalog)[number]
  | (typeof finalImplementationReviewerCatalog)[number];

export type ReviewerContract = {
  objective: string;
  targets: readonly ReviewTarget[];
  evidenceQuestions: readonly string[];
  passedWhen: string;
  findingWhen: string;
  blockedWhen: string;
  output: "passed | finding | blocked with source evidence";
};

export const reviewerCatalog: Readonly<Record<ReviewerId, ReviewerContract>> = {
  "implementation-readiness": {
    objective:
      "Determine whether the artifact can be implemented without unresolved material decisions.",
    targets: ["planning"],
    evidenceQuestions: [
      "Are scope, behavior, acceptance, ownership, delivery shape, and end-to-end proof concrete without prescribing repository mechanics?",
      "Does the primary artifact contain an evidence-backed reuse and deviation contract for the affected repository owners?",
    ],
    passedWhen:
      "The implementer can proceed without inventing a material contract decision; implementation mechanics can be rediscovered from the repository.",
    findingWhen:
      "A scoped repair is required for externally observable behavior, architecture or canonical ownership, safety or rollout policy, migration, delivery shape, or end-to-end acceptance.",
    blockedWhen:
      "A material product, architecture, safety, migration, or ownership decision is unresolved.",
    output: "passed | finding | blocked with source evidence",
  },
  "edge-cases-and-risk": {
    objective:
      "Find missing failure modes, rollback needs, edge cases, and unsafe assumptions.",
    targets: ["planning"],
    evidenceQuestions: [
      "Are material success, failure, recovery, compatibility, and operational risks addressed without expanding into an exhaustive implementation matrix?",
    ],
    passedWhen: "Material risks have an owner, control, and verification path.",
    findingWhen:
      "A concrete risk is evidenced and can be addressed within scope; classify it as a durable artifact repair or a task-local implementation consideration using the Planning Artifact Boundary.",
    blockedWhen:
      "Safe behavior depends on an unresolved policy or unavailable evidence.",
    output: "passed | finding | blocked with source evidence",
  },
  "refactoring-opportunities": {
    objective:
      "Identify existing ownership boundaries that should absorb the change.",
    targets: ["planning"],
    evidenceQuestions: [
      "Does the plan duplicate an existing helper, abstraction, rule, or source of truth?",
    ],
    passedWhen:
      "The change extends the correct existing owners without avoidable duplication.",
    findingWhen:
      "A concrete existing owner should replace a proposed parallel path.",
    blockedWhen:
      "Proceeding would create conflicting durable sources of truth.",
    output: "passed | finding | blocked with source evidence",
  },
  "delivery-shape": {
    objective:
      "Verify that delivery units are cohesive, independently reviewable, and safely ordered.",
    targets: ["planning"],
    evidenceQuestions: [
      "Does each final unit own one local outcome and proof, rollback, reviewer, and safe intermediate state, with stack objective proof by unit 3?",
      "Are any preceding groundwork units independently valuable, directly consumed by a named successor, and smaller or safer than a forced root vertical slice?",
      "Do proposal units, top-level task headings, tracker units, and intended PR/MR topology agree?",
      "After an accepted POC, does fingerprint-bound evidence assess every final unit against the actual POC footprint, assign every material footprint entry to one unit or a declared integration hotspot, and challenge plausible split and merge alternatives?",
    ],
    passedWhen:
      "Units are neither under-split nor checkbox-only, groundwork is bounded and non-speculative, delivery topology and dependencies agree, and post-POC evidence accounts for every final unit and material footprint entry.",
    findingWhen: "Concrete seams require a split, merge, or ordering repair.",
    blockedWhen:
      "The accepted delivery shape cannot produce safe reviewable intermediate states.",
    output: "passed | finding | blocked with source evidence",
  },
  "code-simplifier": {
    objective:
      "Find contract- or behavior-preserving simplifications that remove unnecessary scope, machinery, branches, wrappers, nesting, duplication, or concepts.",
    targets: ["planning", "poc", "final_implementation"],
    evidenceQuestions: [
      "For planning artifacts, can existing owners or a smaller coherent delivery shape achieve the same accepted outcome without duplicated contracts or setup-only machinery?",
      "Can the exact diff express the same behavior with fewer concepts or a clearer project-native flow?",
      "Does a proposed simplification preserve every accepted contract boundary and reachable success and failure state?",
    ],
    passedWhen:
      "No concrete contract- or behavior-preserving simplification would materially reduce scope, change cost, or cognitive load.",
    findingWhen:
      "A scoped simplification can remove meaningful complexity without changing the accepted contract or implementation behavior.",
    blockedWhen:
      "The exact planning artifact or diff, surrounding ownership, or accepted contract cannot be inspected.",
    output: "passed | finding | blocked with source evidence",
  },
  "code-quality-review": {
    objective:
      "Run strict structural review against the exact diff to challenge architecture, ownership, abstraction quality, boundaries, maintainability, and reuse.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Does the diff extend canonical owners instead of adding a parallel implementation or scattered special cases?",
      "Do abstractions, type boundaries, state transitions, and module ownership remain coherent?",
    ],
    passedWhen:
      "No blocking structural or maintainability finding is supported by the exact diff and repository precedent.",
    findingWhen:
      "A scoped structural repair is required before the implementation broadens or publishes.",
    blockedWhen:
      "The exact diff, accepted reuse contract, or relevant owning code cannot be inspected.",
    output: "passed | finding | blocked with source evidence",
  },
  deslop: {
    objective:
      "Find AI-shaped clutter and local-convention drift without broadening into architectural refactoring.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Did the diff add unnecessary comments, defensive checks, casts, generic helpers, verbose naming, or unrelated formatting churn?",
      "Does neighboring code establish a simpler local convention for the same concern?",
    ],
    passedWhen:
      "The changed surface matches local conventions and contains no evidenced AI-shaped clutter.",
    findingWhen:
      "A scoped branch-delta cleanup can remove clutter or convention drift while preserving behavior.",
    blockedWhen:
      "The branch delta or neighboring convention cannot be determined.",
    output: "passed | finding | blocked with source evidence",
  },
  "diff-review": {
    objective:
      "Find introduced correctness, regression, verification, security, performance, usability, and documentation-impact defects.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Does the exact diff implement the accepted success and failure behavior for every material caller and integration?",
      "Does risk-proportionate proof exercise the real changed decision boundaries?",
    ],
    passedWhen:
      "No introduced or materially worsened defect is supported by the inspected code, callers, and proof.",
    findingWhen:
      "An introduced defect, unsafe consumer path, or material verification gap has source evidence.",
    blockedWhen:
      "The exact diff, required caller path, or required runtime evidence cannot be inspected.",
    output: "passed | finding | blocked with source evidence",
  },
  scrutinize: {
    objective:
      "Adversarially validate intent, simpler alternatives, repository precedent, and real-system-path claims end to end.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Should this implementation exist in its current shape, or does a smaller existing path solve the accepted goal?",
      "Do the exact diff and unchanged system path prove the claimed behavior and architecture fit?",
    ],
    passedWhen:
      "The goal remains valid, no evidenced smaller path supersedes the change, and the real system trace supports its claims.",
    findingWhen:
      "Concrete evidence requires a scoped correction before technical readiness.",
    blockedWhen:
      "Required live state, repository context, or system-path evidence is unavailable.",
    output: "passed | finding | blocked with source evidence",
  },
};

export function reviewerContractFor(id: ReviewerId): ReviewerContract {
  return reviewerCatalog[id];
}

export function validateReviewerCatalog(): void {
  const required = [
    ...new Set([
      ...planningReviewerCatalog,
      ...finalImplementationReviewerCatalog,
      ...pocReviewerCatalog,
      ...firstObjectiveProofBaseline,
    ]),
  ];
  for (const id of required) {
    const contract = reviewerCatalog[id];
    if (
      !contract?.objective.trim() ||
      contract.targets.length === 0 ||
      contract.evidenceQuestions.length === 0 ||
      !contract.passedWhen.trim() ||
      !contract.findingWhen.trim() ||
      !contract.blockedWhen.trim()
    ) {
      throw new Error(`reviewer_contract_incomplete:${id}`);
    }
  }
}

export function requiredReviewTypesFor(
  target: ReviewTarget,
): readonly ReviewerId[] {
  if (target === "planning") {
    return planningReviewerCatalog;
  }
  return target === "poc"
    ? pocReviewerCatalog
    : finalImplementationReviewerCatalog;
}

export type ReviewTaskPacket = {
  reviewer: string;
  target: ReviewTarget;
  artifactPath: string;
  artifactFingerprint: string;
  targetBaseSha?: string;
  head?: string;
  changedFiles: readonly string[];
  rules: readonly string[];
  acceptedDecisions: readonly string[];
  verificationEvidence: readonly string[];
  outputContract: string;
};

export function validateReviewTaskPacket(packet: ReviewTaskPacket): void {
  for (const field of [
    "reviewer",
    "artifactPath",
    "artifactFingerprint",
    "outputContract",
  ] as const) {
    if (!packet[field].trim()) {
      throw new Error(`review_task_packet_incomplete:${field}`);
    }
  }
  if (
    packet.target !== "planning" &&
    (!packet.targetBaseSha?.trim() || !packet.head?.trim())
  ) {
    throw new Error("review_task_packet_incomplete:targetIdentity");
  }
}

export function reviewWavesFor(
  target: ReviewTarget,
  workerCapacity: number,
  delegatedReviewTypes: readonly ReviewerId[],
  requiredSpecialists: readonly string[],
): string[][] {
  if (!Number.isInteger(workerCapacity) || workerCapacity < 1) {
    throw new Error("review_worker_capacity_invalid");
  }

  for (const reviewType of delegatedReviewTypes) {
    if (!reviewerCatalog[reviewType]?.targets.includes(target)) {
      throw new Error(`review_type_target_invalid:${reviewType}`);
    }
  }

  const required = [
    ...delegatedReviewTypes,
    ...requiredSpecialists.map((reviewType) => reviewType.trim()),
  ];
  const seen = new Set<string>();
  for (const reviewType of required) {
    if (!reviewType || seen.has(reviewType)) {
      throw new Error(`review_type_routing_invalid:${reviewType}`);
    }
    seen.add(reviewType);
  }

  const waves: string[][] = [];
  for (let index = 0; index < required.length; index += workerCapacity) {
    waves.push(required.slice(index, index + workerCapacity));
  }
  return waves;
}

export type ReviewResult = {
  reviewType: string;
  execution: "inline" | "subagent";
  executionId: string;
  targetBaseSha: string;
  head: string;
  status: "passed" | "finding" | "blocked";
  findings: readonly ReviewFinding[];
};

export type ReviewFinding = {
  id: string;
  severity: "blocking" | "nonblocking";
  disposition: "repair" | "defer" | "plan_required";
  affectedLocation: string;
  issue: string;
  evidence: string;
  remediationOutcome: string;
  invalidatedSurfaces: readonly string[];
};

export type PlanningReviewResult = {
  reviewType: string;
  execution: "inline" | "subagent";
  executionId: string;
  artifactFingerprint: string;
  status: "passed" | "finding" | "blocked";
  findings: readonly ReviewFinding[];
  deliveryShapeEvidence?: DeliveryShapeEvidence;
};

export type PlanningReviewExpected = {
  artifact: string;
  artifactFingerprint: string;
} & (
  | { lifecycle: "atomic_or_pre_poc" }
  | { lifecycle: "post_poc"; postPoc: PostPocPlanningContext }
);

export type PlanningReviewCheckpoint = {
  artifact: string;
  artifactFingerprint: string;
  requiredSpecialists: readonly string[];
  reviewResults: readonly PlanningReviewResult[];
  blockers: readonly string[];
};

export type ClosureResolution = {
  findingId: string;
  resolutionEvidence: string;
  recheckedSurfaces: readonly string[];
  affectedVerificationPassed: boolean;
};

export type ClosureResult = {
  reviewTypes: readonly string[];
  execution: "inline" | "subagent";
  executionId: string;
  targetBaseSha: string;
  head: string;
  resolutions: readonly ClosureResolution[];
  status: "passed" | "blocked";
  findings: readonly ReviewFinding[];
};

export type RebaseEvidence = {
  reviewedTargetBaseSha: string;
  reviewedHead: string;
  effectivePatchUnchanged: boolean;
  baseSensitiveContextUnchanged: boolean;
  requiredCoverageUnchanged: boolean;
  affectedVerificationPassed: boolean;
};

export type TechnicalReadinessCheckpoint = {
  artifact: string;
  targetBase: string;
  targetBaseSha: string;
  head: string;
  diffInspected: boolean;
  hooksPassed: boolean;
  requiredSpecialists: readonly string[];
  reviewResults: readonly ReviewResult[];
  closureResult?: ClosureResult;
  rebaseEvidence?: RebaseEvidence;
  provider: string;
  blockers: readonly string[];
};

function validateFinding(
  finding: ReviewFinding,
  incompleteErrorPrefix: string,
): void {
  for (const field of [
    "id",
    "affectedLocation",
    "issue",
    "evidence",
    "remediationOutcome",
  ] as const) {
    if (!finding[field].trim()) {
      throw new Error(`${incompleteErrorPrefix}:${field}`);
    }
  }
  if (
    !Array.isArray(finding.invalidatedSurfaces) ||
    finding.invalidatedSurfaces.some((surface) => !surface.trim())
  ) {
    throw new Error(`${incompleteErrorPrefix}:invalidatedSurfaces`);
  }
}

export function validatePlanningReviewCheckpoint(
  checkpoint: PlanningReviewCheckpoint,
  expected: PlanningReviewExpected,
): void {
  if (
    expected.lifecycle !== "atomic_or_pre_poc" &&
    expected.lifecycle !== "post_poc"
  ) {
    throw new Error("planning_review_lifecycle_unresolved");
  }
  if (expected.lifecycle === "post_poc" && !("postPoc" in expected)) {
    throw new Error("post_poc_planning_context_missing");
  }
  if (
    checkpoint.artifact !== expected.artifact ||
    checkpoint.artifactFingerprint !== expected.artifactFingerprint
  ) {
    throw new Error("planning_review_stale");
  }
  if (!checkpoint.artifact.trim() || !checkpoint.artifactFingerprint.trim()) {
    throw new Error("planning_review_artifact_unresolved");
  }

  const required = [
    ...requiredReviewTypesFor("planning"),
    ...checkpoint.requiredSpecialists.map((reviewType) => reviewType.trim()),
  ];
  const selected = new Set<string>();
  for (const reviewType of required) {
    if (!reviewType || selected.has(reviewType)) {
      throw new Error(`planning_review_type_invalid:${reviewType}`);
    }
    selected.add(reviewType);
  }

  const missing = required.filter(
    (reviewType) =>
      !checkpoint.reviewResults.some(
        (result) => result.reviewType === reviewType,
      ),
  );
  if (missing.length > 0) {
    throw new Error(`planning_review_types_missing:${missing.join(",")}`);
  }

  const findingIds = new Set<string>();
  for (const reviewType of required) {
    const results = checkpoint.reviewResults.filter(
      (result) => result.reviewType === reviewType,
    );
    if (results.length !== 1) {
      throw new Error(`planning_review_result_invalid:${reviewType}`);
    }
    const [result] = results;
    if (result.artifactFingerprint !== expected.artifactFingerprint) {
      throw new Error(`planning_review_result_stale:${reviewType}`);
    }
    if (!result.executionId.trim()) {
      throw new Error(`planning_review_execution_incomplete:${reviewType}`);
    }
    if (result.status === "blocked") {
      throw new Error(
        `planning_review_result_not_passed:${reviewType}:${result.status}`,
      );
    }
    if (result.status === "finding" && result.findings.length === 0) {
      throw new Error(`planning_review_finding_missing:${reviewType}`);
    }
    if (result.status === "passed" && result.findings.length > 0) {
      throw new Error(
        `planning_review_passed_result_has_findings:${reviewType}`,
      );
    }
    for (const finding of result.findings) {
      validateFinding(
        finding,
        `planning_review_finding_incomplete:${reviewType}`,
      );
      if (findingIds.has(finding.id)) {
        throw new Error(`planning_review_finding_id_reused:${finding.id}`);
      }
      findingIds.add(finding.id);
      if (finding.disposition !== "defer" || finding.severity === "blocking") {
        throw new Error(`planning_review_finding_blocks_handoff:${finding.id}`);
      }
    }
  }

  if (checkpoint.blockers.some((blocker) => blocker.trim())) {
    throw new Error("planning_review_blocked");
  }

  if (expected.lifecycle === "post_poc") {
    const deliveryShapeResult = checkpoint.reviewResults.find(
      (result) => result.reviewType === "delivery-shape",
    );
    if (!deliveryShapeResult?.deliveryShapeEvidence) {
      throw new Error("post_poc_delivery_shape_evidence_missing");
    }
    validatePostPocDeliveryShapeEvidence(
      deliveryShapeResult.deliveryShapeEvidence,
      expected.postPoc,
    );
  }
}

export function validateTechnicalReadinessCheckpoint(
  checkpoint: TechnicalReadinessCheckpoint,
  expected: {
    target: ReviewTarget;
    targetBase: string;
    targetBaseSha: string;
    head: string;
  },
): void {
  if (
    checkpoint.targetBase !== expected.targetBase ||
    checkpoint.targetBaseSha !== expected.targetBaseSha ||
    checkpoint.head !== expected.head
  ) {
    throw new Error("technical_readiness_stale");
  }
  if (!checkpoint.diffInspected || !checkpoint.hooksPassed) {
    throw new Error("technical_readiness_incomplete");
  }
  if (!checkpoint.artifact.trim()) {
    throw new Error("technical_readiness_artifact_unresolved");
  }
  if (!checkpoint.provider.trim()) {
    throw new Error("provider_route_unresolved");
  }

  const required = [
    ...requiredReviewTypesFor(expected.target),
    ...checkpoint.requiredSpecialists.map((reviewType) => reviewType.trim()),
  ];
  const selected = new Set<string>();
  for (const reviewType of required) {
    if (!reviewType || selected.has(reviewType)) {
      throw new Error(`technical_readiness_review_type_invalid:${reviewType}`);
    }
    selected.add(reviewType);
  }

  const missing = required.filter(
    (reviewType) =>
      !checkpoint.reviewResults.some(
        (result) => result.reviewType === reviewType,
      ),
  );
  if (missing.length > 0) {
    throw new Error(
      `technical_readiness_review_types_missing:${missing.join(",")}`,
    );
  }

  const requiredResults = required.map((reviewType) => {
    const results = checkpoint.reviewResults.filter(
      (result) => result.reviewType === reviewType,
    );
    if (results.length !== 1) {
      throw new Error(
        `technical_readiness_review_result_invalid:${reviewType}`,
      );
    }
    return results[0];
  });

  const discoveryTarget = requiredResults[0];
  for (const result of requiredResults.slice(1)) {
    if (
      result.targetBaseSha !== discoveryTarget.targetBaseSha ||
      result.head !== discoveryTarget.head
    ) {
      throw new Error(
        `technical_readiness_discovery_target_mismatch:${result.reviewType}`,
      );
    }
  }

  const repairFindings: Array<{
    finding: ReviewFinding;
    reviewType: string;
  }> = [];
  const findingIds = new Set<string>();
  for (const result of requiredResults) {
    if (!result.executionId.trim()) {
      throw new Error(
        `technical_readiness_execution_unresolved:${result.reviewType}`,
      );
    }
    for (const finding of result.findings) {
      validateFinding(
        finding,
        `technical_readiness_finding_incomplete:${result.reviewType}`,
      );
      if (findingIds.has(finding.id)) {
        throw new Error(`technical_readiness_finding_id_reused:${finding.id}`);
      }
      findingIds.add(finding.id);
      if (finding.disposition === "plan_required") {
        throw new Error(`technical_readiness_plan_required:${finding.id}`);
      }
      if (finding.disposition === "defer" && finding.severity === "blocking") {
        throw new Error(`technical_readiness_blocking_finding:${finding.id}`);
      }
      if (finding.disposition === "repair") {
        repairFindings.push({ finding, reviewType: result.reviewType });
      }
    }
    if (result.status === "blocked") {
      throw new Error(
        `technical_readiness_review_not_passed:${result.reviewType}`,
      );
    }
    if (result.status === "finding" && result.findings.length === 0) {
      throw new Error(
        `technical_readiness_review_finding_missing:${result.reviewType}`,
      );
    }
    if (result.status === "passed" && result.findings.length > 0) {
      throw new Error(
        `technical_readiness_passed_review_has_findings:${result.reviewType}`,
      );
    }
  }

  const closure = checkpoint.closureResult;
  if (repairFindings.length > 0) {
    if (!closure) {
      throw new Error(
        `technical_readiness_closure_missing:${repairFindings[0].finding.id}`,
      );
    }
  }

  if (closure) {
    if (
      closure.targetBaseSha !== expected.targetBaseSha ||
      closure.head !== expected.head ||
      closure.status !== "passed"
    ) {
      throw new Error("technical_readiness_closure_incomplete");
    }
    if (
      !closure.executionId.trim() ||
      closure.reviewTypes.some((reviewType) => !reviewType.trim())
    ) {
      throw new Error("technical_readiness_closure_execution_invalid");
    }

    const repairsById = new Map(
      repairFindings.map(({ finding }) => [finding.id, finding] as const),
    );
    const resolutionsById = new Map<string, ClosureResolution>();
    for (const resolution of closure.resolutions) {
      if (!resolution.findingId.trim()) {
        throw new Error(
          "technical_readiness_closure_resolution_incomplete:unknown:findingId",
        );
      }
      if (resolutionsById.has(resolution.findingId)) {
        throw new Error(
          `technical_readiness_closure_resolution_reused:${resolution.findingId}`,
        );
      }
      const repair = repairsById.get(resolution.findingId);
      if (!repair) {
        throw new Error(
          `technical_readiness_closure_scope_expanded:${resolution.findingId}`,
        );
      }
      if (!resolution.resolutionEvidence.trim()) {
        throw new Error(
          `technical_readiness_closure_resolution_incomplete:${resolution.findingId}:resolutionEvidence`,
        );
      }
      if (!Array.isArray(resolution.recheckedSurfaces)) {
        throw new Error(
          `technical_readiness_closure_surfaces_invalid:${resolution.findingId}`,
        );
      }
      const recheckedSurfaces = new Set<string>();
      for (const surface of resolution.recheckedSurfaces) {
        const normalizedSurface = surface.trim();
        if (!normalizedSurface || recheckedSurfaces.has(normalizedSurface)) {
          throw new Error(
            `technical_readiness_closure_surfaces_invalid:${resolution.findingId}`,
          );
        }
        recheckedSurfaces.add(normalizedSurface);
      }
      for (const surface of repair.invalidatedSurfaces) {
        const normalizedSurface = surface.trim();
        if (!recheckedSurfaces.has(normalizedSurface)) {
          throw new Error(
            `technical_readiness_closure_surfaces_missing:${resolution.findingId}:${normalizedSurface}`,
          );
        }
      }
      if (!resolution.affectedVerificationPassed) {
        throw new Error(
          `technical_readiness_closure_verification_failed:${resolution.findingId}`,
        );
      }
      resolutionsById.set(resolution.findingId, resolution);
    }

    const missing = repairFindings.find(
      ({ finding }) => !resolutionsById.has(finding.id),
    );
    if (missing) {
      throw new Error(
        `technical_readiness_closure_missing:${missing.finding.id}`,
      );
    }
    const repairReviewTypes = new Set(
      repairFindings.map(({ reviewType }) => reviewType),
    );
    const closureReviewTypes = new Set(closure.reviewTypes);
    if (
      closureReviewTypes.size !== closure.reviewTypes.length ||
      closureReviewTypes.size !== repairReviewTypes.size ||
      [...repairReviewTypes].some(
        (reviewType) => !closureReviewTypes.has(reviewType),
      )
    ) {
      throw new Error("technical_readiness_closure_review_types_mismatch");
    }
    for (const finding of closure.findings) {
      validateFinding(
        finding,
        "technical_readiness_closure_finding_incomplete",
      );
      if (finding.severity === "blocking") {
        throw new Error(
          `technical_readiness_closure_blocking_finding:${finding.id}`,
        );
      }
      if (finding.disposition !== "defer") {
        throw new Error(
          `technical_readiness_closure_scope_expanded:${finding.id}`,
        );
      }
    }
  }

  for (const result of requiredResults) {
    const current =
      result.targetBaseSha === expected.targetBaseSha &&
      result.head === expected.head;
    const repaired =
      repairFindings.length > 0 &&
      result.targetBaseSha === expected.targetBaseSha &&
      closure?.targetBaseSha === expected.targetBaseSha &&
      closure.head === expected.head;
    const rebase = checkpoint.rebaseEvidence;
    const rebased =
      rebase?.reviewedTargetBaseSha === result.targetBaseSha &&
      rebase.reviewedHead === result.head &&
      rebase.effectivePatchUnchanged &&
      rebase.baseSensitiveContextUnchanged &&
      rebase.requiredCoverageUnchanged &&
      rebase.affectedVerificationPassed;
    if (!current && !repaired && !rebased) {
      throw new Error(
        `technical_readiness_discovery_stale:${result.reviewType}`,
      );
    }
  }

  if (checkpoint.blockers.length > 0) {
    throw new Error("technical_readiness_blocked");
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
