export type ReviewTarget = "planning" | "poc" | "final_implementation";

export const planningBaseline = [
  "implementation-readiness",
  "edge-cases-and-risk",
  "simplification-and-scope",
  "refactoring-opportunities",
  "delivery-shape",
] as const;

export const finalImplementationBaseline = [
  "code-simplifier",
  "code-quality-review",
  "deslop",
  "diff-review",
  "scrutinize",
] as const;

export const pocBaseline = [...finalImplementationBaseline] as const;

export const firstObjectiveProofBaseline = [
  "code-quality-review",
  "scrutinize",
] as const;

export type ReviewerId =
  | (typeof planningBaseline)[number]
  | (typeof finalImplementationBaseline)[number];

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
  "simplification-and-scope": {
    objective:
      "Challenge unnecessary machinery, duplicated contracts, and accidental scope growth.",
    targets: ["planning"],
    evidenceQuestions: [
      "Can existing systems or a smaller coherent change achieve the same outcome?",
    ],
    passedWhen:
      "The artifact uses the smallest coherent surface that preserves the outcome.",
    findingWhen: "Unnecessary scope or an existing simpler path is evidenced.",
    blockedWhen:
      "The proposed shape is incoherent or substantially broader than the accepted goal.",
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
      "Does each unit own one outcome, proof, rollback, reviewer, and safe intermediate state?",
    ],
    passedWhen:
      "Units are neither under-split nor checkbox-only and have explicit dependencies.",
    findingWhen: "Concrete seams require a split, merge, or ordering repair.",
    blockedWhen:
      "The accepted delivery shape cannot produce safe reviewable intermediate states.",
    output: "passed | finding | blocked with source evidence",
  },
  "code-simplifier": {
    objective:
      "Find behavior-preserving simplifications that remove avoidable branches, wrappers, nesting, duplication, or concepts.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Can the exact diff express the same behavior with fewer concepts or a clearer project-native flow?",
      "Does a proposed simplification preserve every reachable success and failure state?",
    ],
    passedWhen:
      "No concrete behavior-preserving simplification would materially reduce change cost or cognitive load.",
    findingWhen:
      "A scoped simplification can remove meaningful complexity without changing behavior.",
    blockedWhen:
      "The exact diff, surrounding ownership, or behavior contract cannot be inspected.",
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
      "Concrete evidence requires a scoped correction before publication.",
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
      ...planningBaseline,
      ...finalImplementationBaseline,
      ...pocBaseline,
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

export function baselineFor(target: ReviewTarget): readonly ReviewerId[] {
  if (target === "planning") {
    return planningBaseline;
  }
  return target === "poc" ? pocBaseline : finalImplementationBaseline;
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
  requiredSpecialists: readonly string[],
): string[][] {
  if (!Number.isInteger(workerCapacity) || workerCapacity < 1) {
    throw new Error("review_worker_capacity_invalid");
  }

  const required = [
    ...baselineFor(target),
    ...requiredSpecialists.map((reviewer) => reviewer.trim()),
  ];
  const seen = new Set<string>();
  for (const reviewer of required) {
    if (!reviewer || seen.has(reviewer)) {
      throw new Error(`reviewer_selection_invalid:${reviewer}`);
    }
    seen.add(reviewer);
  }

  const waves: string[][] = [];
  for (let index = 0; index < required.length; index += workerCapacity) {
    waves.push(required.slice(index, index + workerCapacity));
  }
  return waves;
}

export type ReviewResult = {
  reviewer: string;
  reviewerRunId: string;
  targetBaseSha: string;
  head: string;
  status: "passed" | "finding" | "blocked";
  findings: readonly ReviewFinding[];
};

export type ReviewFinding = {
  severity: "blocking" | "nonblocking";
  affectedLocation: string;
  issue: string;
  evidence: string;
  remediationOutcome: string;
  invalidatedSurfaces: readonly string[];
};

export type PublicationCheckpoint = {
  targetBase: string;
  targetBaseSha: string;
  head: string;
  diffInspected: boolean;
  hooksPassed: boolean;
  requiredSpecialists: readonly string[];
  excludedReviewerRunIds: readonly string[];
  reviewResults: readonly ReviewResult[];
  provider: string;
  blockers: readonly string[];
};

export function validatePublicationCheckpoint(
  checkpoint: PublicationCheckpoint,
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
    throw new Error("publication_checkpoint_stale");
  }
  if (!checkpoint.diffInspected || !checkpoint.hooksPassed) {
    throw new Error("publication_checkpoint_incomplete");
  }
  if (!checkpoint.provider.trim()) {
    throw new Error("provider_route_unresolved");
  }

  const required = [
    ...baselineFor(expected.target),
    ...checkpoint.requiredSpecialists.map((reviewer) => reviewer.trim()),
  ];
  const selected = new Set<string>();
  for (const reviewer of required) {
    if (!reviewer || selected.has(reviewer)) {
      throw new Error(
        `publication_checkpoint_reviewer_selection_invalid:${reviewer}`,
      );
    }
    selected.add(reviewer);
  }

  const missing = required.filter(
    (reviewer) =>
      !checkpoint.reviewResults.some((result) => result.reviewer === reviewer),
  );
  if (missing.length > 0) {
    throw new Error(
      `publication_checkpoint_reviewers_missing:${missing.join(",")}`,
    );
  }

  const requiredResults = required.map((reviewer) => {
    const results = checkpoint.reviewResults.filter(
      (result) => result.reviewer === reviewer,
    );
    if (results.length !== 1) {
      throw new Error(
        `publication_checkpoint_reviewer_result_invalid:${reviewer}`,
      );
    }
    return results[0];
  });

  const reviewerRunIds = new Set<string>();
  const excluded = new Set(checkpoint.excludedReviewerRunIds);
  for (const result of requiredResults) {
    if (
      result.targetBaseSha !== expected.targetBaseSha ||
      result.head !== expected.head
    ) {
      throw new Error(
        `publication_checkpoint_reviewer_stale:${result.reviewer}`,
      );
    }
    for (const finding of result.findings) {
      for (const field of [
        "affectedLocation",
        "issue",
        "evidence",
        "remediationOutcome",
      ] as const) {
        if (!finding[field].trim()) {
          throw new Error(
            `publication_checkpoint_finding_incomplete:${result.reviewer}:${field}`,
          );
        }
      }
      if (
        !Array.isArray(finding.invalidatedSurfaces) ||
        finding.invalidatedSurfaces.some((surface) => !surface.trim())
      ) {
        throw new Error(
          `publication_checkpoint_finding_incomplete:${result.reviewer}:invalidatedSurfaces`,
        );
      }
    }
    if (result.status !== "passed") {
      throw new Error(
        `publication_checkpoint_reviewer_not_passed:${result.reviewer}`,
      );
    }
    if (result.findings.some((finding) => finding.severity === "blocking")) {
      throw new Error(
        `publication_checkpoint_reviewer_blocking_finding:${result.reviewer}`,
      );
    }
    if (!result.reviewerRunId.trim() || excluded.has(result.reviewerRunId)) {
      throw new Error(
        `publication_checkpoint_reviewer_identity_excluded:${result.reviewer}`,
      );
    }
    if (reviewerRunIds.has(result.reviewerRunId)) {
      throw new Error(
        `publication_checkpoint_reviewer_identity_reused:${result.reviewerRunId}`,
      );
    }
    reviewerRunIds.add(result.reviewerRunId);
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
