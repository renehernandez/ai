#!/usr/bin/env tsx
import { pathToFileURL } from "node:url";
import {
  extractSection,
  extractYaml,
  fail,
  findSection,
  includes,
  list,
  readInput,
  requireValue,
  scalar,
} from "./planning-contracts.ts";

const START_STATUSES = ["started", "blocked", "pending"] as const;
const COMPLETION_STATUSES = [
  "clean",
  "findings",
  "stale",
  "unavailable",
  "pending",
] as const;
const GATE_OUTCOMES = ["passed", "blocked", "pending"] as const;
const NITRO_STATUSES = [
  "pending",
  "no issues",
  "findings",
  "unavailable",
  "stale",
] as const;
const LOCAL_REVIEW_EVIDENCE_PATTERN =
  /\b(local[_ -]review(?:er)?(?:[_ -]?gate)?|reviewer[_-]passes|reviewer[_ -]?report|review[_ -]?gate|implementation[_-]review|implementation[_-]scrutiny|code[_-]quality[_-]review|code[_-]simplifier|deslop|docs[_-]alignment(?:[_-]review)?|ai[_-]readiness[_-]upkeep|security[_-]review)\b/i;

type Command =
  | "template"
  | "validate"
  | "normalize-feedback"
  | "validate-route";

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: nitro-feedback-gate.ts <template|validate|normalize-feedback|validate-route> [--file path]",
    );
  }

  if (command === "template") {
    printTemplate();
    return;
  }

  const input = readInput(args);
  if (command === "validate") {
    validateGate(input);
    return;
  }
  if (command === "normalize-feedback") {
    normalizeFeedback(input);
    return;
  }

  validateRoute(input);
}

function printTemplate(): void {
  console.log(`## Readable Summary

- Status: Nitro feedback gate evidence is ready to validate.
- Request: latest-head Nitro review was requested after the last material push.
- Start wait: 10 minutes, polled every 1 minute.
- Completion: latest-head Nitro review is clean, pending, or blocked with evidence.

\`\`\`yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab MR URL>
  head_sha: <latest MR head sha>
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - <request command, note URL, or discussion evidence>
  start:
    status: started | blocked | pending
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro pending review, acknowledgement, or start evidence>
  completion:
    status: clean | findings | stale | unavailable | pending
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed | blocked | pending
\`\`\`
`);
}

export function nitroFeedbackGateErrors(input: string): string[] {
  const errors: string[] = [];
  const gate = parseGate(input);

  requireValue(gate.artifact, "nitro_feedback_gate.artifact", errors);
  requireValue(gate.headSha, "nitro_feedback_gate.head_sha", errors);
  requireValue(gate.requestRequired, "request.required", errors);
  requireValue(
    gate.requestedAfterLatestPush,
    "request.requested_after_latest_push",
    errors,
  );
  requireValue(gate.startStatus, "start.status", errors);
  requireValue(gate.timeoutMinutes, "start.timeout_minutes", errors);
  requireValue(gate.pollIntervalMinutes, "start.poll_interval_minutes", errors);
  requireValue(gate.completionStatus, "completion.status", errors);
  requireValue(gate.gateOutcome, "gate_outcome", errors);

  if (gate.requestRequired !== "true") {
    errors.push("request.required must be true");
  }
  if (gate.requestedAfterLatestPush !== "true") {
    errors.push("request.requested_after_latest_push must be true");
  }
  if (gate.timeoutMinutes !== "10") {
    errors.push("start.timeout_minutes must be 10");
  }
  if (gate.pollIntervalMinutes !== "1") {
    errors.push("start.poll_interval_minutes must be 1");
  }
  if (gate.startStatus && !includes(START_STATUSES, gate.startStatus)) {
    errors.push(`start.status must be one of: ${START_STATUSES.join(", ")}`);
  }
  if (
    gate.completionStatus &&
    !includes(COMPLETION_STATUSES, gate.completionStatus)
  ) {
    errors.push(
      `completion.status must be one of: ${COMPLETION_STATUSES.join(", ")}`,
    );
  }
  if (gate.gateOutcome && !includes(GATE_OUTCOMES, gate.gateOutcome)) {
    errors.push(`gate_outcome must be one of: ${GATE_OUTCOMES.join(", ")}`);
  }
  if (gate.requestEvidence.length === 0) {
    errors.push("request.evidence is required");
  }
  if (
    gate.requestEvidence.length > 0 &&
    !gate.requestEvidence.some((item) =>
      /\/request_review\s+@nitro\b/i.test(item),
    )
  ) {
    errors.push("request.evidence must include /request_review @nitro");
  }
  if (gate.startStatus !== "blocked" && gate.startEvidence.length === 0) {
    errors.push("start.evidence is required unless start.status is blocked");
  }
  if (
    gate.completionStatus !== "pending" &&
    gate.completionEvidence.length === 0
  ) {
    errors.push(
      "completion.evidence is required unless completion.status is pending",
    );
  }
  rejectLocalReviewEvidence(gate.requestEvidence, "request.evidence", errors);
  rejectLocalReviewEvidence(gate.startEvidence, "start.evidence", errors);
  rejectLocalReviewEvidence(
    gate.completionEvidence,
    "completion.evidence",
    errors,
  );

  validateGateOutcome(gate, errors);

  return errors;
}

function validateGate(input: string): void {
  const errors = nitroFeedbackGateErrors(input);

  if (errors.length > 0) {
    console.error(
      `Invalid nitro_feedback_gate:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("nitro_feedback_gate valid");
}

function rejectLocalReviewEvidence(
  evidence: string[],
  label: string,
  errors: string[],
): void {
  for (const item of evidence) {
    if (LOCAL_REVIEW_EVIDENCE_PATTERN.test(item)) {
      errors.push(
        `${label} must cite Nitro hosted review evidence; local review gate evidence cannot satisfy nitro_feedback_gate`,
      );
    }
  }
}

function normalizeFeedback(input: string): void {
  const body = extractYaml(input);
  const status = scalar(body, "status");
  const artifact = scalar(body, "artifact") ?? "<MR URL>";
  const headSha = scalar(body, "head_sha") ?? "<latest MR head sha>";

  if (!status || !includes(NITRO_STATUSES, status)) {
    fail(`status must be one of: ${NITRO_STATUSES.join(", ")}`);
  }

  const normalized = normalizedGateForStatus(status, artifact, headSha);
  console.log(normalized);
}

function validateRoute(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "nitro_route");
  const artifactHost = scalar(section, "artifact_host");
  const artifactKind = scalar(section, "artifact_kind");
  const remoteHost = scalar(section, "remote_host");
  const required = scalar(section, "required");
  const errors: string[] = [];

  requireValue(artifactHost, "nitro_route.artifact_host", errors);
  requireValue(artifactKind, "nitro_route.artifact_kind", errors);
  requireValue(remoteHost, "nitro_route.remote_host", errors);
  requireValue(required, "nitro_route.required", errors);

  if (required !== "true") {
    errors.push("nitro_route.required must be true");
  }
  if (
    artifactHost !== "gitlab" ||
    artifactKind !== "merge_request" ||
    remoteHost !== "git.fullscript.io"
  ) {
    errors.push(
      "nitro_route_unsupported: Nitro requires a Fullscript GitLab merge request route",
    );
  }

  if (errors.length > 0) {
    console.error(
      `Invalid nitro_route:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("nitro_route valid");
}

function validateGateOutcome(
  gate: ReturnType<typeof parseGate>,
  errors: string[],
): void {
  if (
    gate.gateOutcome === "passed" &&
    (gate.startStatus !== "started" ||
      gate.completionStatus !== "clean" ||
      gate.unresolvedActionableFeedback.length > 0)
  ) {
    errors.push(
      "gate_outcome passed requires start.status started, completion.status clean, and no unresolved actionable feedback",
    );
  }

  if (gate.gateOutcome === "pending" && gate.completionStatus !== "pending") {
    errors.push("gate_outcome pending requires completion.status pending");
  }

  if (
    gate.gateOutcome === "blocked" &&
    gate.completionStatus === "clean" &&
    gate.startStatus === "started" &&
    gate.unresolvedActionableFeedback.length === 0
  ) {
    errors.push(
      "gate_outcome blocked requires blocked start or non-clean feedback",
    );
  }
}

function parseGate(input: string) {
  const body = extractYaml(input);
  const section = findSection(body, "nitro_feedback_gate") ?? "";
  const request = extractSection(section, "request");
  const start = extractSection(section, "start");
  const completion = extractSection(section, "completion");

  return {
    artifact: scalar(section, "artifact"),
    headSha: scalar(section, "head_sha"),
    requestRequired: scalar(request, "required"),
    requestedAfterLatestPush: scalar(request, "requested_after_latest_push"),
    requestEvidence: list(request, "evidence"),
    startStatus: scalar(start, "status"),
    timeoutMinutes: scalar(start, "timeout_minutes"),
    pollIntervalMinutes: scalar(start, "poll_interval_minutes"),
    startEvidence: list(start, "evidence"),
    completionStatus: scalar(completion, "status"),
    completionEvidence: list(completion, "evidence"),
    unresolvedActionableFeedback: list(
      section,
      "unresolved_actionable_feedback",
    ),
    gateOutcome: scalar(section, "gate_outcome"),
  };
}

function normalizedGateForStatus(
  status: (typeof NITRO_STATUSES)[number],
  artifact: string,
  headSha: string,
): string {
  const startStatus = status === "unavailable" ? "blocked" : "started";
  const completionStatus = status === "no issues" ? "clean" : status;
  const gateOutcome =
    status === "no issues"
      ? "passed"
      : status === "pending"
        ? "pending"
        : "blocked";
  const unresolved =
    status === "findings" ? "\n    - latest-head Nitro findings" : " []";
  const startEvidence =
    status === "unavailable"
      ? []
      : ["Nitro request acknowledged or review state observed"];
  const completionEvidence =
    status === "pending" ? [] : [`Nitro normalized status: ${status}`];

  return `nitro_feedback_gate:
  artifact: ${artifact}
  head_sha: ${headSha}
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - /request_review @nitro posted for latest head
  start:
    status: ${startStatus}
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:${formatEvidence(startEvidence)}
  completion:
    status: ${completionStatus}
    evidence:${formatEvidence(completionEvidence)}
  unresolved_actionable_feedback:${unresolved}
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: ${gateOutcome}`;
}

function formatEvidence(values: string[]): string {
  if (values.length === 0) {
    return " []";
  }
  return `\n${values.map((value) => `      - ${value}`).join("\n")}`;
}

function isCommand(command: string | undefined): command is Command {
  return [
    "template",
    "validate",
    "normalize-feedback",
    "validate-route",
  ].includes(command ?? "");
}
