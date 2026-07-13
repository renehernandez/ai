export const planningBaseline = [
  "implementation-readiness",
  "edge-cases-and-risk",
  "simplification-and-scope",
  "refactoring-opportunities",
  "delivery-shape",
] as const;

export const finalImplementationBaseline = [
  "correctness",
  "regression-risk",
  "maintainability",
  "verification-quality",
  "architecture-fit-and-reuse",
] as const;

export const pocBaseline = [
  ...finalImplementationBaseline,
  "code-quality-review",
] as const;

export type ReviewerId =
  | (typeof planningBaseline)[number]
  | (typeof finalImplementationBaseline)[number]
  | (typeof pocBaseline)[number];

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
      "Are scope, behavior, acceptance, verification, ownership, and handoff concrete?",
      "Does the primary artifact contain an evidence-backed reuse and deviation contract for the affected repository owners?",
    ],
    passedWhen:
      "The implementer can proceed without inventing contract decisions or rediscovering canonical ownership.",
    findingWhen: "A scoped repair can make the artifact implementation-ready.",
    blockedWhen:
      "A material product, architecture, safety, migration, or ownership decision is unresolved.",
    output: "passed | finding | blocked with source evidence",
  },
  "edge-cases-and-risk": {
    objective:
      "Find missing failure modes, rollback needs, edge cases, and unsafe assumptions.",
    targets: ["planning"],
    evidenceQuestions: [
      "Are success, failure, recovery, compatibility, and operational risks addressed?",
    ],
    passedWhen: "Material risks have an owner, control, and verification path.",
    findingWhen:
      "A concrete risk or edge case is missing but can be repaired within scope.",
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
  correctness: {
    objective:
      "Find behavior that contradicts the accepted contract or mishandles reachable states.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Does the exact diff implement the required success and failure behavior?",
    ],
    passedWhen:
      "No introduced correctness defect is supported by the inspected code and tests.",
    findingWhen:
      "An introduced or materially worsened correctness defect has source evidence.",
    blockedWhen:
      "The exact diff or required runtime evidence cannot be inspected.",
    output: "passed | finding | blocked with source evidence",
  },
  "regression-risk": {
    objective:
      "Trace changed behavior into callers, compatibility boundaries, and likely regressions.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Which unchanged consumers, states, or integrations can the diff break?",
    ],
    passedWhen:
      "Material consumers are preserved or deliberately migrated with proof.",
    findingWhen:
      "A concrete consumer or compatibility path is left unsafe or untested.",
    blockedWhen: "Required consumer or integration state is inaccessible.",
    output: "passed | finding | blocked with source evidence",
  },
  maintainability: {
    objective:
      "Assess ownership, clarity, duplication, type boundaries, and future change cost.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Does the diff fit existing abstractions without avoidable sprawl or hidden coupling?",
    ],
    passedWhen:
      "The implementation is cohesive, readable, and owned by the appropriate modules.",
    findingWhen:
      "Concrete duplication, complexity, or boundary drift materially raises maintenance cost.",
    blockedWhen:
      "The relevant architecture or generated source cannot be determined.",
    output: "passed | finding | blocked with source evidence",
  },
  "verification-quality": {
    objective:
      "Determine whether the proof exercises the real changed decision boundaries.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Do tests and operational evidence prove success, failure, and the user-visible outcome?",
    ],
    passedWhen:
      "Focused proof covers the changed behavior at the appropriate layer.",
    findingWhen:
      "A material changed path lacks direct, risk-proportionate proof.",
    blockedWhen:
      "Required verification cannot run or its result cannot be trusted.",
    output: "passed | finding | blocked with source evidence",
  },
  "architecture-fit-and-reuse": {
    objective:
      "Trace the exact diff to repository precedent and verify that canonical owners absorb the change without avoidable parallel architecture.",
    targets: ["poc", "final_implementation"],
    evidenceQuestions: [
      "Which inspected implementations and canonical owners does the diff reuse, extend, or deliberately deviate from?",
      "Does the diff duplicate a helper, schema, constant, identity, formatting, routing, lifecycle invariant, or durable source of truth?",
    ],
    passedWhen:
      "The exact diff follows the accepted reuse contract and every new mechanism or deviation has repository-backed justification.",
    findingWhen:
      "A concrete canonical owner, reusable path, or parallel implementation requires a scoped correction.",
    blockedWhen:
      "The reuse contract, exact diff, or relevant repository precedent cannot be inspected.",
    output: "passed | finding | blocked with source evidence",
  },
  "code-quality-review": {
    objective:
      "Run the strict code-quality-review specialist against the POC exact diff to challenge abstraction quality, ownership, sprawl, and duplication before expansion or publication.",
    targets: ["poc"],
    evidenceQuestions: [
      "Does the strict structural review find a simpler existing owner or an avoidable near-duplicate?",
      "Would extending this POC deepen a parallel architecture or scattered feature-specific path?",
    ],
    passedWhen:
      "The code-quality-review specialist reports no blocking structural or maintainability finding for the exact diff.",
    findingWhen:
      "The specialist identifies a scoped structural repair required before the POC broadens or publishes.",
    blockedWhen:
      "The specialist cannot inspect the exact diff or the relevant owning code.",
    output: "passed | finding | blocked with source evidence",
  },
};

export type ReviewTarget = "planning" | "poc" | "final_implementation";

export function reviewerContractFor(id: ReviewerId): ReviewerContract {
  return reviewerCatalog[id];
}

export function validateReviewerCatalog(): void {
  const required = [
    ...new Set([
      ...planningBaseline,
      ...finalImplementationBaseline,
      ...pocBaseline,
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

export function baselineFor(target: ReviewTarget): readonly string[] {
  if (target === "planning") {
    return planningBaseline;
  }
  return target === "poc" ? pocBaseline : finalImplementationBaseline;
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
  const passedReviewers = new Set(checkpoint.reviewersPassed);
  const missingReviewers = baselineFor(expected.target).filter(
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
