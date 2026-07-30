import {
  type NitroArtifactClassification,
  type NitroArtifactLifecycle,
  nitroArtifactClassifications,
  nitroArtifactLifecycles,
} from "./nitro-request-policy.ts";
import {
  extractYaml,
  fail,
  includes,
  list,
  scalar,
} from "./planning-contracts.ts";

const NITRO_STATUSES = [
  "pending",
  "no issues",
  "findings",
  "unavailable",
  "stale",
] as const;

export function printTemplate(): void {
  console.log(`## Readable Summary

- Status: Nitro feedback gate evidence is ready to validate.
- Request: latest-head Nitro review was requested after the last material push.
- Start wait: 10 minutes, polled every 1 minute.
- Completion: latest-head Nitro review is clean, pending, or blocked with evidence.

\`\`\`yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab MR URL>
  head_sha: <latest MR head sha>
  artifact_lifecycle: poc | final_implementation
  artifact_classification: standard | poc | removal-only
  classification_evidence:
    - <OpenSpec POC or final delivery checkpoint>
  head:
    sha: <latest MR head sha>
    evidence:
      - <MR API readback URL or command evidence>
  effective_diff:
    head_sha: <same latest MR head sha>
    files: <non-negative integer>
    evidence:
      - <provider diff-stat readback>
  request:
    required: true
    note_id: <GitLab note id>
    note_url: <GitLab note URL>
    author: <requesting user>
    body: <exact command-only note body>
    observed_head_sha: <MR head observed immediately after the note>
    evidence:
      - <provider note and post-note MR-head readback>
  start:
    status: started | blocked | pending
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro pending review, acknowledgement, or start evidence>
  completion:
    status: clean | findings | stale | unavailable | pending
    head_sha: <reviewed MR head sha, when Nitro responded>
    author: <Nitro provider identity, when Nitro responded>
    note_id: <Nitro note or discussion id, when Nitro responded>
    note_url: <Nitro note or discussion URL, when Nitro responded>
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed | blocked | pending
\`\`\`
`);
}

export function normalizeFeedback(
  input: string,
  validate: (normalized: string) => string[],
): void {
  const body = extractYaml(input);
  const status = scalar(body, "status");
  const artifactLifecycle = scalar(body, "artifact_lifecycle");
  const artifactClassification = scalar(body, "artifact_classification");
  const effectiveDiffFiles = scalar(body, "effective_diff_files");
  if (!status || !includes(NITRO_STATUSES, status)) {
    fail(`status must be one of: ${NITRO_STATUSES.join(", ")}`);
  }
  if (
    !artifactLifecycle ||
    !includes(nitroArtifactLifecycles, artifactLifecycle)
  ) {
    fail(
      `artifact_lifecycle must be one of: ${nitroArtifactLifecycles.join(", ")}`,
    );
  }
  if (
    !artifactClassification ||
    !includes(nitroArtifactClassifications, artifactClassification)
  ) {
    fail(
      `artifact_classification must be one of: ${nitroArtifactClassifications.join(", ")}`,
    );
  }
  const effectiveDiffFileCount = Number(effectiveDiffFiles);
  if (
    !effectiveDiffFiles ||
    !Number.isSafeInteger(effectiveDiffFileCount) ||
    effectiveDiffFileCount < 0
  ) {
    fail("effective_diff_files must be a non-negative integer");
  }
  const normalized = normalizedGateForStatus({
    status,
    artifact: scalar(body, "artifact") ?? "<MR URL>",
    headSha: scalar(body, "head_sha") ?? "<latest MR head sha>",
    artifactLifecycle,
    artifactClassification,
    classificationEvidence: list(body, "classification_evidence"),
    headEvidence: list(body, "head_evidence"),
    effectiveDiffHeadSha: scalar(body, "effective_diff_head_sha"),
    effectiveDiffFiles: effectiveDiffFileCount,
    effectiveDiffEvidence: list(body, "effective_diff_evidence"),
    requestNoteId: scalar(body, "request_note_id"),
    requestNoteUrl: scalar(body, "request_note_url"),
    requestAuthor: scalar(body, "request_author"),
    requestBody: scalar(body, "request_body"),
    requestObservedHeadSha: scalar(body, "request_observed_head_sha"),
    requestEvidence: list(body, "request_evidence"),
    startEvidence: list(body, "start_evidence"),
    completionHeadSha: scalar(body, "completion_head_sha"),
    completionAuthor: scalar(body, "completion_author"),
    completionNoteId: scalar(body, "completion_note_id"),
    completionNoteUrl: scalar(body, "completion_note_url"),
    completionEvidence: list(body, "completion_evidence"),
    unresolvedActionableFeedback: list(body, "unresolved_actionable_feedback"),
    nonActionableFeedback: list(body, "non_actionable_feedback"),
    staleFeedbackIgnored: list(body, "stale_feedback_ignored"),
  });
  const errors = validate(normalized);
  if (errors.length > 0) {
    fail(
      `provider evidence cannot produce a valid Nitro gate:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  console.log(normalized);
}

function normalizedGateForStatus(input: {
  status: (typeof NITRO_STATUSES)[number];
  artifact: string;
  headSha: string;
  artifactLifecycle: NitroArtifactLifecycle;
  artifactClassification: NitroArtifactClassification;
  classificationEvidence: string[];
  headEvidence: string[];
  effectiveDiffHeadSha: string | undefined;
  effectiveDiffFiles: number;
  effectiveDiffEvidence: string[];
  requestNoteId: string | undefined;
  requestNoteUrl: string | undefined;
  requestAuthor: string | undefined;
  requestBody: string | undefined;
  requestObservedHeadSha: string | undefined;
  requestEvidence: string[];
  startEvidence: string[];
  completionHeadSha: string | undefined;
  completionAuthor: string | undefined;
  completionNoteId: string | undefined;
  completionNoteUrl: string | undefined;
  completionEvidence: string[];
  unresolvedActionableFeedback: string[];
  nonActionableFeedback: string[];
  staleFeedbackIgnored: string[];
}): string {
  const startStatus = input.status === "unavailable" ? "blocked" : "started";
  const completionStatus =
    input.status === "no issues" ? "clean" : input.status;
  const gateOutcome =
    input.status === "no issues"
      ? "passed"
      : input.status === "pending"
        ? "pending"
        : "blocked";
  return `nitro_feedback_gate:
  artifact: ${input.artifact}
  artifact_lifecycle: ${input.artifactLifecycle}
  artifact_classification: ${input.artifactClassification}
  classification_evidence:${formatEvidence(input.classificationEvidence, 4)}
  head:
    sha: ${input.headSha}
    evidence:${formatEvidence(input.headEvidence)}
  effective_diff:
    head_sha: ${input.effectiveDiffHeadSha ?? ""}
    files: ${input.effectiveDiffFiles}
    evidence:${formatEvidence(input.effectiveDiffEvidence)}
  request:
    required: true
    note_id: ${input.requestNoteId ?? ""}
    note_url: ${input.requestNoteUrl ?? ""}
    author: ${input.requestAuthor ?? ""}
    body: ${input.requestBody ?? ""}
    observed_head_sha: ${input.requestObservedHeadSha ?? ""}
    evidence:${formatEvidence(input.requestEvidence)}
  start:
    status: ${startStatus}
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:${formatEvidence(input.startEvidence)}
  completion:
    status: ${completionStatus}
    head_sha: ${input.completionHeadSha ?? ""}
    author: ${input.completionAuthor ?? ""}
    note_id: ${input.completionNoteId ?? ""}
    note_url: ${input.completionNoteUrl ?? ""}
    evidence:${formatEvidence(input.completionEvidence)}
  unresolved_actionable_feedback:${formatEvidence(input.unresolvedActionableFeedback, 4)}
  non_actionable_feedback:${formatEvidence(input.nonActionableFeedback, 4)}
  stale_feedback_ignored:${formatEvidence(input.staleFeedbackIgnored, 4)}
  gate_outcome: ${gateOutcome}`;
}

function formatEvidence(values: string[], indentation = 6): string {
  if (values.length === 0) {
    return " []";
  }
  const spaces = " ".repeat(indentation);
  return `\n${values.map((value) => `${spaces}- ${value}`).join("\n")}`;
}
