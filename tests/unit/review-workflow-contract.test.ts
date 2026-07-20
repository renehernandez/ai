import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assertPocExpansionAllowed,
  firstObjectiveProofReviewers,
  type PocArchitectureCheckpoint,
} from "../../skills/execute/scripts/execution-contract.ts";
import {
  type DeliveryShapeEvidence,
  firstObjectiveProofBaseline,
  type PlanningReviewCheckpoint,
  requiredReviewTypesFor,
  reviewerCatalog,
  reviewWavesFor,
  type TechnicalReadinessCheckpoint,
  validatePlanningReviewCheckpoint,
  validateReviewTaskPacket,
  validateTechnicalReadinessCheckpoint,
} from "../../skills/review/scripts/review-contract.ts";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

const implementationReviewerCatalog = [
  "code-simplifier",
  "code-quality-review",
  "deslop",
  "diff-review",
  "scrutinize",
] as const;

function passingCheckpoint(): TechnicalReadinessCheckpoint {
  return {
    artifact: "MR !199",
    targetBase: "main",
    targetBaseSha: "base-a",
    head: "head-a",
    diffInspected: true,
    hooksPassed: true,
    requiredSpecialists: [],
    reviewResults: implementationReviewerCatalog.map((reviewType) => ({
      reviewType,
      execution: "inline" as const,
      executionId: "main-agent-review",
      targetBaseSha: "base-a",
      head: "head-a",
      status: "passed" as const,
      findings: [],
    })),
    closureResult: undefined,
    rebaseEvidence: undefined,
    provider: "gitlab",
    blockers: [],
  };
}

function passingPlanningCheckpoint(): PlanningReviewCheckpoint {
  return {
    artifact: ".agents/plans/example.md",
    artifactFingerprint: "sha256:plan-a",
    requiredSpecialists: [],
    reviewResults: requiredReviewTypesFor("planning").map((reviewType) => ({
      reviewType,
      execution: "inline" as const,
      executionId: "main-agent-planning-review",
      artifactFingerprint: "sha256:plan-a",
      status: "passed" as const,
      findings: [],
    })),
    blockers: [],
  };
}

function passingDeliveryShapeEvidence(): DeliveryShapeEvidence {
  const assessment = (unitId: string) => ({
    unitId,
    status: "passed" as const,
    observedDomains: [`${unitId}-owner`],
    localOutcome: `${unitId} produces one reviewable outcome`,
    safeStopState: `${unitId} remains safe before successors`,
    localProof: `${unitId} owns visible local proof`,
    securitySeam: "No separate security boundary remains inside the unit",
    activationSeam: "The unit has one activation boundary",
    rollbackSeam: "The unit has one rollback boundary",
    deploymentSeam: "The unit has one deployment boundary",
    splitAlternative: `Split ${unitId} by nested work item`,
    splitRationale: "The split would create unproved unused plumbing",
    mergeAlternative: `Merge ${unitId} with its successor`,
    mergeRationale: "The merge would cross independent reviewer domains",
    predecessorOutput: unitId === "unit-1" ? "Normal target base" : "unit-1",
    integrationHotspots: [],
  });

  return {
    pocHead: "poc-head-a",
    footprintFingerprint: "sha256:poc-footprint-a",
    provisionalUnitIds: ["unit-1", "unit-2"],
    finalUnitIds: ["unit-1", "unit-2"],
    unitAssessments: [assessment("unit-1"), assessment("unit-2")],
    footprint: [
      {
        id: "cli-contract",
        evidence: "The POC diff exercises the CLI contract owner",
        domains: ["cli", "contracts"],
        ownerUnitId: "unit-1",
      },
      {
        id: "review-proof",
        evidence: "The POC proof crosses the CLI and review harness boundary",
        domains: ["cli", "review"],
        integrationUnitIds: ["unit-1", "unit-2"],
      },
    ],
  };
}

function repairFinding() {
  return {
    id: "finding-1",
    severity: "blocking" as const,
    disposition: "repair" as const,
    affectedLocation: "skills/review/SKILL.md",
    issue: "The closure boundary is missing.",
    evidence: "The current instructions restart full discovery after repair.",
    remediationOutcome: "Bound closure to this finding and affected proof.",
    invalidatedSurfaces: ["review-guidance"],
  };
}

function passingClosure(
  overrides: Partial<
    NonNullable<TechnicalReadinessCheckpoint["closureResult"]>
  > = {},
): NonNullable<TechnicalReadinessCheckpoint["closureResult"]> {
  return {
    reviewTypes: ["diff-review"],
    execution: "inline",
    executionId: "main-agent-closure",
    targetBaseSha: "base-a",
    head: "head-b",
    resolutions: [
      {
        findingId: "finding-1",
        resolutionEvidence:
          "The repaired head uses one bounded closure path for the finding.",
        recheckedSurfaces: ["review-guidance"],
        affectedVerificationPassed: true,
      },
    ],
    status: "passed",
    findings: [],
    ...overrides,
  };
}

test("completed code exposes every required phase review type", () => {
  assert.deepEqual(
    requiredReviewTypesFor("poc"),
    implementationReviewerCatalog,
  );
  assert.deepEqual(
    requiredReviewTypesFor("final_implementation"),
    implementationReviewerCatalog,
  );
  assert.deepEqual(firstObjectiveProofBaseline, [
    "code-simplifier",
    "code-quality-review",
    "scrutinize",
  ]);
  assert.deepEqual(firstObjectiveProofReviewers, firstObjectiveProofBaseline);
});

test("planning completion requires a current explicit simplifier result", () => {
  const checkpoint = passingPlanningCheckpoint();
  const expected = {
    artifact: ".agents/plans/example.md",
    artifactFingerprint: "sha256:plan-a",
    lifecycle: "atomic_or_pre_poc" as const,
  };

  assert.doesNotThrow(() =>
    validatePlanningReviewCheckpoint(checkpoint, expected),
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(
        {
          ...checkpoint,
          reviewResults: checkpoint.reviewResults.filter(
            (result) => result.reviewType !== "code-simplifier",
          ),
        },
        expected,
      ),
    /planning_review_types_missing:code-simplifier/,
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(
        {
          ...checkpoint,
          reviewResults: checkpoint.reviewResults.map((result) =>
            result.reviewType === "code-simplifier"
              ? { ...result, artifactFingerprint: "sha256:stale" }
              : result,
          ),
        },
        expected,
      ),
    /planning_review_result_stale:code-simplifier/,
  );
});

test("planning completion carries only nonblocking deferred considerations", () => {
  const checkpoint = passingPlanningCheckpoint();
  const deferredFinding = {
    id: "planning-consideration-1",
    severity: "nonblocking" as const,
    disposition: "defer" as const,
    affectedLocation: "skills/execute/SKILL.md",
    issue: "The implementer can use the existing helper directly.",
    evidence: "The helper already owns the task-local operation.",
    remediationOutcome: "Carry the consideration into Execute.",
    invalidatedSurfaces: ["implementation-mechanics"],
  };
  const withFinding = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result) =>
      result.reviewType === "code-simplifier"
        ? {
            ...result,
            status: "finding" as const,
            findings: [deferredFinding],
          }
        : result,
    ),
  };
  const expected = {
    artifact: checkpoint.artifact,
    artifactFingerprint: checkpoint.artifactFingerprint,
    lifecycle: "atomic_or_pre_poc" as const,
  };

  assert.doesNotThrow(() =>
    validatePlanningReviewCheckpoint(withFinding, expected),
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(
        {
          ...withFinding,
          reviewResults: withFinding.reviewResults.map((result) =>
            result.reviewType === "code-simplifier"
              ? {
                  ...result,
                  findings: [
                    { ...deferredFinding, disposition: "repair" as const },
                  ],
                }
              : result,
          ),
        },
        expected,
      ),
    /planning_review_finding_blocks_handoff:planning-consideration-1/,
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(
        {
          ...withFinding,
          reviewResults: withFinding.reviewResults.map((result) =>
            result.reviewType === "code-simplifier"
              ? {
                  ...result,
                  findings: [
                    { ...deferredFinding, severity: "blocking" as const },
                  ],
                }
              : result,
          ),
        },
        expected,
      ),
    /planning_review_finding_blocks_handoff:planning-consideration-1/,
  );
});

test("post-POC planning requires complete cohesive delivery-shape evidence", () => {
  const checkpoint = passingPlanningCheckpoint();
  const evidence = passingDeliveryShapeEvidence();
  const postPoc = {
    acceptedPoc: {
      head: evidence.pocHead,
      footprintFingerprint: evidence.footprintFingerprint,
      materialFootprintIds: evidence.footprint.map((entry) => entry.id),
    },
    provisionalUnitIds: evidence.provisionalUnitIds,
    finalUnitIds: evidence.finalUnitIds,
    materialTopologyChanged: false,
    topologyChangeAccepted: false,
  };
  const withEvidence = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result) =>
      result.reviewType === "delivery-shape"
        ? { ...result, deliveryShapeEvidence: evidence }
        : result,
    ),
  };
  const expected = {
    artifact: checkpoint.artifact,
    artifactFingerprint: checkpoint.artifactFingerprint,
    lifecycle: "post_poc" as const,
    postPoc,
  };

  assert.doesNotThrow(() =>
    validatePlanningReviewCheckpoint(withEvidence, expected),
  );
  assert.doesNotThrow(() =>
    validatePlanningReviewCheckpoint(checkpoint, {
      artifact: checkpoint.artifact,
      artifactFingerprint: checkpoint.artifactFingerprint,
      lifecycle: "atomic_or_pre_poc",
    }),
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(checkpoint, {
        artifact: checkpoint.artifact,
        artifactFingerprint: checkpoint.artifactFingerprint,
      } as never),
    /planning_review_lifecycle_unresolved/,
  );
  assert.throws(
    () => validatePlanningReviewCheckpoint(checkpoint, expected),
    /post_poc_delivery_shape_evidence_missing/,
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(
        {
          ...withEvidence,
          reviewResults: withEvidence.reviewResults.map((result) =>
            result.reviewType === "delivery-shape"
              ? {
                  ...result,
                  deliveryShapeEvidence: {
                    ...evidence,
                    pocHead: "stale-poc-head",
                  },
                }
              : result,
          ),
        },
        expected,
      ),
    /post_poc_delivery_shape_stale_poc/,
  );
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(
        {
          ...withEvidence,
          reviewResults: withEvidence.reviewResults.map((result) =>
            result.reviewType === "delivery-shape"
              ? {
                  ...result,
                  deliveryShapeEvidence: {
                    ...evidence,
                    footprintFingerprint: "sha256:stale-footprint",
                  },
                }
              : result,
          ),
        },
        expected,
      ),
    /post_poc_delivery_shape_stale_footprint/,
  );
});

test("post-POC planning rejects under-shaped or incomplete unit coverage", () => {
  const checkpoint = passingPlanningCheckpoint();
  const evidence = passingDeliveryShapeEvidence();
  const expected = {
    artifact: checkpoint.artifact,
    artifactFingerprint: checkpoint.artifactFingerprint,
    postPoc: {
      acceptedPoc: {
        head: evidence.pocHead,
        footprintFingerprint: evidence.footprintFingerprint,
        materialFootprintIds: evidence.footprint.map((entry) => entry.id),
      },
      provisionalUnitIds: evidence.provisionalUnitIds,
      finalUnitIds: evidence.finalUnitIds,
      materialTopologyChanged: false,
      topologyChangeAccepted: false,
    },
    lifecycle: "post_poc" as const,
  };
  const validateEvidence = (candidate: DeliveryShapeEvidence) =>
    validatePlanningReviewCheckpoint(
      {
        ...checkpoint,
        reviewResults: checkpoint.reviewResults.map((result) =>
          result.reviewType === "delivery-shape"
            ? { ...result, deliveryShapeEvidence: candidate }
            : result,
        ),
      },
      expected,
    );

  assert.throws(
    () =>
      validateEvidence({
        ...evidence,
        footprint: evidence.footprint.slice(0, 1),
      }),
    /post_poc_delivery_shape_footprint_incomplete/,
  );
  assert.throws(
    () =>
      validateEvidence({
        ...evidence,
        unitAssessments: evidence.unitAssessments.slice(0, 1),
      }),
    /post_poc_delivery_shape_assessments_incomplete/,
  );
  assert.throws(
    () =>
      validateEvidence({
        ...evidence,
        unitAssessments: evidence.unitAssessments.map((assessment, index) =>
          index === 1
            ? { ...assessment, status: "split_required" as const }
            : assessment,
        ),
      }),
    /post_poc_delivery_shape_unit_not_cohesive:unit-2:split_required/,
  );
  assert.throws(
    () =>
      validateEvidence({
        ...evidence,
        footprint: evidence.footprint.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                ownerUnitId: undefined,
                integrationUnitIds: undefined,
              }
            : entry,
        ),
      }),
    /post_poc_delivery_shape_footprint_assignment_invalid:cli-contract/,
  );
  assert.throws(
    () =>
      validateEvidence({
        ...evidence,
        footprint: [
          ...evidence.footprint,
          {
            id: "invalid-hotspot",
            evidence: "One-unit integration is not a cross-unit hotspot",
            domains: ["review"],
            integrationUnitIds: ["unit-1"],
          },
        ],
      }),
    /post_poc_delivery_shape_integration_hotspot_invalid:invalid-hotspot/,
  );
});

test("post-POC planning requires acceptance for material topology changes", () => {
  const checkpoint = passingPlanningCheckpoint();
  const evidence = {
    ...passingDeliveryShapeEvidence(),
    provisionalUnitIds: ["combined-unit"],
  };
  const withEvidence = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result) =>
      result.reviewType === "delivery-shape"
        ? { ...result, deliveryShapeEvidence: evidence }
        : result,
    ),
  };
  const expected = {
    artifact: checkpoint.artifact,
    artifactFingerprint: checkpoint.artifactFingerprint,
    lifecycle: "post_poc" as const,
    postPoc: {
      acceptedPoc: {
        head: evidence.pocHead,
        footprintFingerprint: evidence.footprintFingerprint,
        materialFootprintIds: evidence.footprint.map((entry) => entry.id),
      },
      provisionalUnitIds: evidence.provisionalUnitIds,
      finalUnitIds: evidence.finalUnitIds,
      materialTopologyChanged: true,
      topologyChangeAccepted: false,
    },
  };

  assert.throws(
    () => validatePlanningReviewCheckpoint(withEvidence, expected),
    /post_poc_delivery_shape_change_unaccepted/,
  );
  assert.doesNotThrow(() =>
    validatePlanningReviewCheckpoint(withEvidence, {
      ...expected,
      postPoc: { ...expected.postPoc, topologyChangeAccepted: true },
    }),
  );
  const sameIdsEvidence = passingDeliveryShapeEvidence();
  const sameIdsCheckpoint = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result) =>
      result.reviewType === "delivery-shape"
        ? { ...result, deliveryShapeEvidence: sameIdsEvidence }
        : result,
    ),
  };
  assert.throws(
    () =>
      validatePlanningReviewCheckpoint(sameIdsCheckpoint, {
        ...expected,
        postPoc: {
          ...expected.postPoc,
          acceptedPoc: {
            head: sameIdsEvidence.pocHead,
            footprintFingerprint: sameIdsEvidence.footprintFingerprint,
            materialFootprintIds: sameIdsEvidence.footprint.map(
              (entry) => entry.id,
            ),
          },
          provisionalUnitIds: sameIdsEvidence.finalUnitIds,
          finalUnitIds: sameIdsEvidence.finalUnitIds,
          materialTopologyChanged: true,
        },
      }),
    /post_poc_delivery_shape_change_unaccepted/,
  );
});

test("technical readiness requires every phase review type", () => {
  const checkpoint = passingCheckpoint();
  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(checkpoint, {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-a",
    }),
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        { ...checkpoint, reviewResults: checkpoint.reviewResults.slice(0, 1) },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-a",
        },
      ),
    /technical_readiness_review_types_missing:code-quality-review,deslop,diff-review,scrutinize/,
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        { ...checkpoint, artifact: "" },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-a",
        },
      ),
    /technical_readiness_artifact_unresolved/,
  );
});

test("one inline execution may cover every review type on the exact target", () => {
  const checkpoint = passingCheckpoint();
  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(checkpoint, {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-a",
    }),
  );

  const mixedTargets: TechnicalReadinessCheckpoint = {
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result, index) =>
      index === 1
        ? {
            ...result,
            head: "different-discovery-head",
          }
        : result,
    ),
  };
  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(mixedTargets, {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "head-a",
      }),
    /technical_readiness_discovery_target_mismatch:code-quality-review/,
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
      validateTechnicalReadinessCheckpoint(missingSpecialist, {
        target: "poc",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "head-a",
      }),
    /technical_readiness_review_types_missing:security-review/,
  );

  const passingSpecialist = {
    ...missingSpecialist,
    reviewResults: [
      ...checkpoint.reviewResults,
      {
        reviewType: "security-review",
        execution: "subagent" as const,
        executionId: "security-specialist",
        targetBaseSha: "base-a",
        head: "head-a",
        status: "passed" as const,
        findings: [],
      },
    ],
  };
  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(passingSpecialist, {
      target: "poc",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-a",
    }),
  );
});

test("technical readiness rejects incomplete or blocking normalized findings", () => {
  const checkpoint = passingCheckpoint();
  const withFinding = (
    finding: TechnicalReadinessCheckpoint["reviewResults"][number]["findings"][number],
    status: "passed" | "finding" = "finding",
  ): TechnicalReadinessCheckpoint => ({
    ...checkpoint,
    reviewResults: checkpoint.reviewResults.map((result, index) =>
      index === 0 ? { ...result, status, findings: [finding] } : result,
    ),
  });

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        withFinding({
          id: "finding-1",
          severity: "nonblocking",
          disposition: "defer",
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
    /technical_readiness_finding_incomplete:code-simplifier:evidence/,
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        withFinding({
          id: "finding-1",
          severity: "blocking",
          disposition: "repair",
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
    /technical_readiness_closure_missing:finding-1/,
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        withFinding(
          {
            id: "finding-1",
            severity: "nonblocking",
            disposition: "defer",
            affectedLocation: "skills/review/SKILL.md",
            issue: "A passed outcome cannot hide a finding.",
            evidence: "The result includes a normalized finding.",
            remediationOutcome: "Report the review type as finding.",
            invalidatedSurfaces: [],
          },
          "passed",
        ),
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-a",
        },
      ),
    /technical_readiness_passed_review_has_findings:code-simplifier/,
  );

  const secondFinding = {
    ...repairFinding(),
    id: "finding-2",
    issue: "A second repair is required.",
  };
  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          ...checkpoint,
          head: "head-b",
          reviewResults: checkpoint.reviewResults.map((result) =>
            result.reviewType === "diff-review"
              ? {
                  ...result,
                  status: "finding" as const,
                  findings: [repairFinding(), secondFinding],
                }
              : result,
          ),
          closureResult: passingClosure({
            resolutions: [
              {
                findingId: "finding-1",
                resolutionEvidence: "First duplicate resolution.",
                recheckedSurfaces: ["review-guidance"],
                affectedVerificationPassed: true,
              },
              {
                findingId: "finding-1",
                resolutionEvidence: "Second duplicate resolution.",
                recheckedSurfaces: ["review-guidance"],
                affectedVerificationPassed: true,
              },
            ],
          }),
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-b",
        },
      ),
    /technical_readiness_closure_resolution_reused:finding-1/,
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          ...checkpoint,
          head: "head-b",
          reviewResults: checkpoint.reviewResults.map((result) =>
            result.reviewType === "diff-review"
              ? {
                  ...result,
                  status: "finding" as const,
                  findings: [repairFinding(), secondFinding],
                }
              : result,
          ),
          closureResult: passingClosure(),
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-b",
        },
      ),
    /technical_readiness_closure_missing:finding-2/,
  );
});

test("one closure check resolves only the repair batch and affected proof", () => {
  const discovery = passingCheckpoint();
  const checkpoint: TechnicalReadinessCheckpoint = {
    ...discovery,
    head: "head-b",
    reviewResults: discovery.reviewResults.map((result) =>
      result.reviewType === "diff-review"
        ? {
            ...result,
            status: "finding" as const,
            findings: [repairFinding()],
          }
        : result,
    ),
    closureResult: passingClosure(),
  };
  const validResolution = passingClosure().resolutions[0];
  const assertClosureRejects = (
    resolutions: NonNullable<
      TechnicalReadinessCheckpoint["closureResult"]
    >["resolutions"],
    expectedError: RegExp,
  ) => {
    assert.throws(
      () =>
        validateTechnicalReadinessCheckpoint(
          {
            ...checkpoint,
            closureResult: passingClosure({ resolutions }),
          },
          {
            target: "final_implementation",
            targetBase: "main",
            targetBaseSha: "base-a",
            head: "head-b",
          },
        ),
      expectedError,
    );
  };

  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(checkpoint, {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-b",
    }),
  );

  for (const [resolutions, expectedError] of [
    [[], /technical_readiness_closure_missing:finding-1/],
    [
      [{ ...validResolution, resolutionEvidence: "" }],
      /technical_readiness_closure_resolution_incomplete:finding-1:resolutionEvidence/,
    ],
    [
      [{ ...validResolution, recheckedSurfaces: [] }],
      /technical_readiness_closure_surfaces_missing:finding-1:review-guidance/,
    ],
    [
      [
        {
          ...validResolution,
          recheckedSurfaces: ["review-guidance", "review-guidance"],
        },
      ],
      /technical_readiness_closure_surfaces_invalid:finding-1/,
    ],
    [
      [{ ...validResolution, affectedVerificationPassed: false }],
      /technical_readiness_closure_verification_failed:finding-1/,
    ],
    [
      [{ ...validResolution, findingId: "unknown-finding" }],
      /technical_readiness_closure_scope_expanded:unknown-finding/,
    ],
  ] as const) {
    assertClosureRejects(resolutions, expectedError);
  }

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          ...checkpoint,
          closureResult: passingClosure({
            findings: [
              {
                ...repairFinding(),
                id: "new-blocker",
                issue: "Repair introduced an affected-behavior defect.",
              },
            ],
          }),
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-b",
        },
      ),
    /technical_readiness_closure_blocking_finding:new-blocker/,
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          ...checkpoint,
          closureResult: passingClosure({
            findings: [
              {
                ...repairFinding(),
                id: "deferred-cleanup",
                severity: "nonblocking",
                disposition: "defer",
                invalidatedSurfaces: [""],
              },
            ],
          }),
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-b",
        },
      ),
    /technical_readiness_closure_finding_incomplete:invalidatedSurfaces/,
  );

  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(
      {
        ...checkpoint,
        closureResult: passingClosure({
          findings: [
            {
              ...repairFinding(),
              id: "deferred-cleanup",
              severity: "nonblocking",
              disposition: "defer",
              issue: "The repair exposed an unrelated optional cleanup.",
              remediationOutcome: "Defer it without blocking readiness.",
              invalidatedSurfaces: [],
            },
          ],
        }),
      },
      {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "head-b",
      },
    ),
  );
});

test("material-risk rediscovery supersedes the earlier closure checkpoint", () => {
  const discovery = passingCheckpoint();
  const rediscovered: TechnicalReadinessCheckpoint = {
    ...discovery,
    head: "head-b",
    reviewResults: discovery.reviewResults.map((result) => ({
      ...result,
      head: "head-b",
    })),
  };

  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(rediscovered, {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "head-b",
    }),
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        { ...rediscovered, closureResult: passingClosure() },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "head-b",
        },
      ),
    /technical_readiness_closure_scope_expanded:finding-1/,
  );
});

test("patch-equivalent rebase refreshes the checkpoint without rediscovery", () => {
  const discovery = passingCheckpoint();
  const rebaseEvidence = {
    reviewedTargetBaseSha: "base-a",
    reviewedHead: "head-a",
    effectivePatchUnchanged: true,
    baseSensitiveContextUnchanged: true,
    requiredCoverageUnchanged: true,
    affectedVerificationPassed: true,
  };
  const checkpoint: TechnicalReadinessCheckpoint = {
    ...discovery,
    targetBaseSha: "base-b",
    rebaseEvidence,
  };

  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(checkpoint, {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-b",
      head: "head-a",
    }),
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          ...checkpoint,
          rebaseEvidence: {
            ...rebaseEvidence,
            requiredCoverageUnchanged: false,
          },
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-b",
          head: "head-a",
        },
      ),
    /technical_readiness_discovery_stale:code-simplifier/,
  );

  const repairedAfterRebase: TechnicalReadinessCheckpoint = {
    ...checkpoint,
    head: "head-b",
    reviewResults: discovery.reviewResults.map((result) =>
      result.reviewType === "diff-review"
        ? {
            ...result,
            status: "finding" as const,
            findings: [repairFinding()],
          }
        : result,
    ),
    closureResult: passingClosure({
      targetBaseSha: "base-b",
      head: "head-b",
    }),
    rebaseEvidence: undefined,
  };
  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(repairedAfterRebase, {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-b",
        head: "head-b",
      }),
    /technical_readiness_discovery_stale:code-simplifier/,
  );
  assert.doesNotThrow(() =>
    validateTechnicalReadinessCheckpoint(
      { ...repairedAfterRebase, rebaseEvidence },
      {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-b",
        head: "head-b",
      },
    ),
  );
});

test("review waves preserve coverage at available worker capacity", () => {
  assert.deepEqual(
    reviewWavesFor(
      "final_implementation",
      9,
      ["diff-review", "scrutinize"],
      [],
    ),
    [["diff-review", "scrutinize"]],
  );
  assert.deepEqual(
    reviewWavesFor(
      "final_implementation",
      1,
      ["diff-review", "scrutinize"],
      [],
    ),
    [["diff-review"], ["scrutinize"]],
  );
  assert.deepEqual(
    reviewWavesFor(
      "final_implementation",
      3,
      ["diff-review"],
      ["security-review", "docs-alignment-review"],
    ),
    [["diff-review", "security-review", "docs-alignment-review"]],
  );
  assert.throws(
    () => reviewWavesFor("final_implementation", 0, ["diff-review"], []),
    /review_worker_capacity_invalid/,
  );
  assert.throws(
    () => reviewWavesFor("final_implementation", 1, [], [""]),
    /review_type_routing_invalid/,
  );
  assert.throws(
    () =>
      reviewWavesFor(
        "final_implementation",
        1,
        ["implementation-readiness"],
        [],
      ),
    /review_type_target_invalid:implementation-readiness/,
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

test("first objective proof requires three independent reviewers and targeted proof", () => {
  const checkpoint: PocArchitectureCheckpoint = {
    targetBaseSha: "base-a",
    diffFingerprint: "sha256:proof",
    reuseContractReviewed: true,
    precedentEvidence: ["skills/review/SKILL.md owns review"],
    semanticTripwires: [],
    reviewResults: [
      {
        reviewer: "code-simplifier",
        reviewerRunId: "simplifier-agent",
        status: "passed",
        evidence: "exact first-proof diff simplified",
      },
      {
        reviewer: "code-quality-review",
        reviewerRunId: "quality-agent",
        status: "passed",
        evidence: "exact first-proof structure reviewed",
      },
      {
        reviewer: "scrutinize",
        reviewerRunId: "scrutiny-agent",
        status: "passed",
        evidence: "real system path scrutinized",
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
          reviewResults: checkpoint.reviewResults.filter(
            (result) => result.reviewer !== "code-simplifier",
          ),
        },
        {
          targetBaseSha: "base-a",
          diffFingerprint: "sha256:proof",
        },
      ),
    /poc_architecture_checkpoint_reviewer_result_invalid:code-simplifier/,
  );

  assert.throws(
    () =>
      assertPocExpansionAllowed(
        {
          ...checkpoint,
          reviewResults: checkpoint.reviewResults.map((result) =>
            result.reviewer === "code-simplifier"
              ? { ...result, evidence: "" }
              : result,
          ),
        },
        {
          targetBaseSha: "base-a",
          diffFingerprint: "sha256:proof",
        },
      ),
    /poc_architecture_checkpoint_reviewer_evidence_missing:code-simplifier/,
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
            checkpoint.reviewResults[1],
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

test("delivery-shape review bounds groundwork and checks topology", () => {
  const contract = reviewerCatalog["delivery-shape"];

  assert.match(
    contract.evidenceQuestions.join("\n"),
    /objective proof by unit 3/i,
  );
  assert.match(contract.evidenceQuestions.join("\n"), /groundwork units/i);
  assert.match(
    contract.evidenceQuestions.join("\n"),
    /top-level task headings/i,
  );
  assert.match(
    contract.evidenceQuestions.join("\n"),
    /every final unit.*actual POC footprint/i,
  );
  assert.match(
    contract.evidenceQuestions.join("\n"),
    /one unit or a declared integration hotspot/i,
  );
  assert.match(contract.passedWhen, /non-speculative/i);
  assert.match(contract.passedWhen, /every final unit/i);
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

test("orchestration guidance keeps review coverage explicit and bounded", () => {
  const review = read("skills/review/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const docs = read("skills/doc-smith/SKILL.md");

  assert.match(review, /fork_turns="none"/);
  assert.match(review, /phase barrier/i);
  assert.match(review, /backfill/i);
  assert.match(review, /one discovery pass/i);
  assert.match(review, /one closure check/i);
  assert.match(review, /one resolution record.*repair.*finding/is);
  assert.match(review, /resolutionEvidence/);
  assert.match(review, /recheckedSurfaces/);
  assert.match(review, /surviving canonical owner/i);
  assert.match(review, /producer-to-consumer path/i);
  assert.match(review, /replacement discovery\s+supersedes/i);
  assert.match(review, /do not launch or re-prompt a reviewer/i);
  assert.match(review, /without asking\s+the user/i);
  assert.match(review, /patch-equivalent rebase/i);
  assert.match(review, /findings batch/i);
  assert.match(review, /every phase-specific review type/i);
  assert.match(review, /integrated inline pass/i);
  assert.match(review, /Review: discovery \| MR !123 @ <head> \| inline/);
  assert.match(review, /Findings: 0 repair, 0 defer, 0 plan_required/);
  assert.match(review, /Local: passed \| Nitro: pending \| Readiness: pending/);
  assert.match(review, /pre-commit hook owns the full local suite/i);
  assert.doesNotMatch(review, /distinct reviewer-run identity/i);
  assert.match(execute, /environment preflight/i);
  assert.match(execute, /progressive verification/i);
  assert.match(execute, /do not restart discovery/i);
  assert.match(execute, /hook-clean commit is published.*hosted review/is);
  assert.match(docs, /planning contracts/i);
  assert.match(docs, /final stable document text/i);
});
