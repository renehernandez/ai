export type ObjectiveProofUnit = {
  id: string;
  text: string;
};

export type ObjectiveProofIssueReason =
  | "objective_proof_missing"
  | "objective_proof_too_late"
  | "objective_proof_deferred"
  | "objective_proof_setup_only"
  | "objective_proof_marker_only";

export type ObjectiveProofIssue = {
  unitId?: string;
  reason: ObjectiveProofIssueReason;
  message: string;
};

export type ObjectiveProofAnalysis = {
  status: "pass" | "needs_spec_redesign";
  proofUnitId?: string;
  issues: ObjectiveProofIssue[];
};

const PROOF_MARKER_PATTERN =
  /\b(?:Proof location|First real confirmation)\s*:/i;
const DEFERRED_PROOF_PATTERN =
  /\b(defer(?:red|s|ring)?|later|future|subsequent|follow-?up)\b/i;
const DELIVERY_UNIT_REFERENCE_PATTERN =
  /\b(?:task|delivery unit|unit)\s*(\d+)(?:\.\d+)?\b/gi;
const SETUP_ONLY_PATTERN =
  /\b(setup|scaffold|schema|metadata|registry|register(?:ed)?|resolver?|config(?:uration)?|helper|readiness|prepare|plumbing|probe)\b/i;
const REAL_ENTRYPOINT_PATTERN =
  /\b(entry ?point|command|cli|api|endpoint|route|workflow|job|runner|dispatch|request|hook|ci|matrix|hosted|probe|scenario|browser|runtime|execution)\b|\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[a-z0-9._~!$&'()*+,;=:@%/-]+/i;
const VISIBLE_OUTCOME_PATTERN =
  /\b(success|failure|pass(?:es|ed)?|fail(?:s|ed)?|evidence|artifact|summary|result|output|visible|creates?|produces?|returns?|reports?|observes?|verif(?:y|ies|ication works))\b/i;

export function analyzeObjectiveProof(
  units: ObjectiveProofUnit[],
): ObjectiveProofAnalysis {
  const proofCandidates = units
    .map((unit, index) => ({
      unit,
      index,
      marker: extractProofMarkerText(unit.text),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        unit: ObjectiveProofUnit;
        index: number;
        marker: string;
      } => candidate.marker !== undefined,
    );

  if (proofCandidates.length === 0) {
    return {
      status: "needs_spec_redesign",
      issues: [
        {
          reason: "objective_proof_missing",
          message:
            "needs_spec_redesign: objective proof must be explicit by delivery unit 3 with Proof location: or First real confirmation:",
        },
      ],
    };
  }

  const firstProof = proofCandidates[0];
  const issues: ObjectiveProofIssue[] = [];

  if (firstProof.index > 2) {
    issues.push({
      unitId: firstProof.unit.id,
      reason: "objective_proof_too_late",
      message: `needs_spec_redesign: objective proof first appears in delivery unit ${firstProof.unit.id}; it must appear by delivery unit 3 after at most two groundwork units`,
    });
  }

  const markerIssues = validateProofMarker(
    firstProof.unit.id,
    firstProof.marker,
  );
  issues.push(...markerIssues);

  return {
    status: issues.length > 0 ? "needs_spec_redesign" : "pass",
    proofUnitId: firstProof.unit.id,
    issues,
  };
}

function extractProofMarkerText(text: string): string | undefined {
  const match = PROOF_MARKER_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }

  return text
    .slice(match.index + match[0].length)
    .split(/\r?\n/, 1)[0]
    .trim();
}

function validateProofMarker(
  unitId: string,
  markerText: string,
): ObjectiveProofIssue[] {
  const issues: ObjectiveProofIssue[] = [];
  const hasEntrypoint = REAL_ENTRYPOINT_PATTERN.test(markerText);
  const hasVisibleOutcome = VISIBLE_OUTCOME_PATTERN.test(markerText);

  if (isDeferredProof(unitId, markerText)) {
    issues.push({
      unitId,
      reason: "objective_proof_deferred",
      message: `needs_spec_redesign: delivery unit ${unitId} objective proof marker defers proof instead of proving the capability in this unit`,
    });
  }

  if (SETUP_ONLY_PATTERN.test(markerText)) {
    issues.push({
      unitId,
      reason: "objective_proof_setup_only",
      message: `needs_spec_redesign: delivery unit ${unitId} objective proof marker mentions setup/config concepts that indicate readiness rather than real capability proof`,
    });
  }

  if (!hasEntrypoint || !hasVisibleOutcome) {
    issues.push({
      unitId,
      reason: "objective_proof_marker_only",
      message: `needs_spec_redesign: delivery unit ${unitId} objective proof marker must name the real entrypoint and visible success or failure evidence`,
    });
  }

  return issues;
}

function isDeferredProof(unitId: string, markerText: string): boolean {
  if (DEFERRED_PROOF_PATTERN.test(markerText)) {
    return true;
  }

  const currentUnitNumber = Number.parseInt(unitId.split(".")[0], 10);
  if (Number.isNaN(currentUnitNumber)) {
    return false;
  }

  return Array.from(markerText.matchAll(DELIVERY_UNIT_REFERENCE_PATTERN)).some(
    (match) => Number.parseInt(match[1], 10) > currentUnitNumber,
  );
}
