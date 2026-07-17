export type ObjectiveProofDeliverable = {
  id: string;
  text: string;
  setupText?: string;
};

export type ObjectiveProofIssueReason =
  | "objective_proof_missing"
  | "objective_proof_too_late"
  | "objective_proof_deferred"
  | "objective_proof_setup_only"
  | "objective_proof_marker_only";

export type ObjectiveProofIssue = {
  taskId?: string;
  reason: ObjectiveProofIssueReason;
  message: string;
};

export type ObjectiveProofAnalysis = {
  status: "pass" | "needs_spec_redesign";
  proofTaskId?: string;
  issues: ObjectiveProofIssue[];
};

const PROOF_MARKER_PATTERN =
  /\b(?:Proof location|First real confirmation)\s*:/i;
const DEFERRED_PROOF_PATTERN =
  /\b(defer(?:red|s|ring)?|later|future|subsequent|follow-?up|task\s*(?:3|4|5|6|7|8|9)(?:\.\d+)?)\b/i;
const SETUP_ONLY_PATTERN =
  /\b(setup|scaffold|schema|metadata|registry|register(?:ed)?|resolver?|config(?:uration)?|helper|readiness|prepare|plumbing|probe)\b/i;
const IMPLEMENTATION_PATTERN =
  /\b(execute|run|dispatch|verify|exercise|route|process|handle|render|send|receive)\b/i;
const REAL_ENTRYPOINT_PATTERN =
  /\b(entry ?point|command|cli|api|endpoint|route|workflow|job|runner|dispatch|request|hook|ci|matrix|hosted|probe|scenario|browser|runtime|execution)\b|\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[a-z0-9._~!$&'()*+,;=:@%/-]+/i;
const VISIBLE_OUTCOME_PATTERN =
  /\b(success|failure|pass(?:es|ed)?|fail(?:s|ed)?|evidence|artifact|summary|result|output|visible|creates?|produces?|returns?|reports?|observes?|verif(?:y|ies|ication works))\b/i;

export function analyzeObjectiveProof(
  deliverables: ObjectiveProofDeliverable[],
): ObjectiveProofAnalysis {
  const proofCandidates = deliverables
    .map((deliverable, index) => ({
      deliverable,
      index,
      marker: extractProofMarkerText(deliverable.text),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        deliverable: ObjectiveProofDeliverable;
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
            "needs_spec_redesign: objective proof must be explicit in deliverable 1 or deliverable 2 with Proof location: or First real confirmation:",
        },
      ],
    };
  }

  const firstProof = proofCandidates[0];
  const issues: ObjectiveProofIssue[] = [];

  if (firstProof.index > 1) {
    issues.push({
      taskId: firstProof.deliverable.id,
      reason: "objective_proof_too_late",
      message: `needs_spec_redesign: objective proof first appears in task ${firstProof.deliverable.id}; it must appear in task 1 or task 2 after at most one setup-only deliverable`,
    });
  }

  if (
    firstProof.index === 1 &&
    !isSetupOnlyDeliverable(deliverables[0].setupText ?? deliverables[0].text)
  ) {
    issues.push({
      taskId: deliverables[0].id,
      reason: "objective_proof_too_late",
      message: `needs_spec_redesign: task ${firstProof.deliverable.id} objective proof is allowed only when task ${deliverables[0].id} is setup-only`,
    });
  }

  const markerIssues = validateProofMarker(
    firstProof.deliverable.id,
    firstProof.marker,
  );
  issues.push(...markerIssues);

  return {
    status: issues.length > 0 ? "needs_spec_redesign" : "pass",
    proofTaskId: firstProof.deliverable.id,
    issues,
  };
}

function isSetupOnlyDeliverable(text: string): boolean {
  const classificationText = setupClassificationText(text);
  return (
    SETUP_ONLY_PATTERN.test(classificationText) &&
    !IMPLEMENTATION_PATTERN.test(classificationText) &&
    !VISIBLE_OUTCOME_PATTERN.test(classificationText)
  );
}

function setupClassificationText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !isVerificationCommandLine(line))
    .join("\n");
}

function isVerificationCommandLine(line: string): boolean {
  return /^\s*(?:[-*]\s*)?(?:run|rerun|execute)\s+(?:pnpm|npm|bun|yarn|node|tsx|vitest|jest|pytest|go|cargo|ruby|bundle|rspec|git|glab)\b/i.test(
    line,
  );
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
  taskId: string,
  markerText: string,
): ObjectiveProofIssue[] {
  const issues: ObjectiveProofIssue[] = [];
  const hasEntrypoint = REAL_ENTRYPOINT_PATTERN.test(markerText);
  const hasVisibleOutcome = VISIBLE_OUTCOME_PATTERN.test(markerText);

  if (DEFERRED_PROOF_PATTERN.test(markerText)) {
    issues.push({
      taskId,
      reason: "objective_proof_deferred",
      message: `needs_spec_redesign: task ${taskId} objective proof marker defers proof instead of proving the capability in this deliverable`,
    });
  }

  if (SETUP_ONLY_PATTERN.test(markerText)) {
    issues.push({
      taskId,
      reason: "objective_proof_setup_only",
      message: `needs_spec_redesign: task ${taskId} objective proof marker mentions setup/config concepts that indicate readiness rather than real capability proof`,
    });
  }

  if (!hasEntrypoint || !hasVisibleOutcome) {
    issues.push({
      taskId,
      reason: "objective_proof_marker_only",
      message: `needs_spec_redesign: task ${taskId} objective proof marker must name the real entrypoint and visible success or failure evidence`,
    });
  }

  return issues;
}
