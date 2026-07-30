#!/usr/bin/env tsx
import { pathToFileURL } from "node:url";
import { validateGitLabEvidence } from "./gitlab-evidence.ts";
import { normalizeFeedback, printTemplate } from "./nitro-feedback-render.ts";
import {
  expectedNitroRequest,
  nitroArtifactClassifications,
  nitroArtifactLifecycles,
} from "./nitro-request-policy.ts";
import {
  extractSection,
  extractYaml,
  fail,
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

type Command =
  | "template"
  | "validate"
  | "normalize-feedback"
  | "validate-gitlab-evidence"
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
      "Usage: nitro-feedback-gate.ts <template|validate|normalize-feedback|validate-gitlab-evidence|validate-route> [--file path]",
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
    normalizeFeedback(input, nitroFeedbackGateErrors);
    return;
  }
  if (command === "validate-gitlab-evidence") {
    validateGitLabEvidence(input);
    return;
  }

  validateRoute(input);
}

export function nitroFeedbackGateErrors(input: string): string[] {
  const errors: string[] = [];
  const gate = parseGate(input);

  requireValue(gate.artifact, "nitro_feedback_gate.artifact", errors);
  requireValue(gate.headSha, "head.sha", errors);
  requireValue(
    gate.artifactLifecycle,
    "nitro_feedback_gate.artifact_lifecycle",
    errors,
  );
  requireValue(
    gate.artifactClassification,
    "nitro_feedback_gate.artifact_classification",
    errors,
  );
  requireValue(gate.effectiveDiffHeadSha, "effective_diff.head_sha", errors);
  requireValue(gate.effectiveDiffFiles, "effective_diff.files", errors);
  requireValue(gate.requestRequired, "request.required", errors);
  requireValue(gate.requestNoteId, "request.note_id", errors);
  requireValue(gate.requestNoteUrl, "request.note_url", errors);
  requireValue(gate.requestAuthor, "request.author", errors);
  requireValue(gate.requestBody, "request.body", errors);
  requireValue(
    gate.requestObservedHeadSha,
    "request.observed_head_sha",
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
  if (
    gate.artifactLifecycle &&
    !includes(nitroArtifactLifecycles, gate.artifactLifecycle)
  ) {
    errors.push(
      `artifact_lifecycle must be one of: ${nitroArtifactLifecycles.join(", ")}`,
    );
  }
  if (
    gate.artifactClassification &&
    !includes(nitroArtifactClassifications, gate.artifactClassification)
  ) {
    errors.push(
      `artifact_classification must be one of: ${nitroArtifactClassifications.join(", ")}`,
    );
  }
  const effectiveDiffFiles = Number(gate.effectiveDiffFiles);
  if (
    gate.effectiveDiffFiles &&
    (!Number.isSafeInteger(effectiveDiffFiles) || effectiveDiffFiles < 0)
  ) {
    errors.push("effective_diff_files must be a non-negative integer");
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
  if (gate.classificationEvidence.length === 0) {
    errors.push("classification_evidence is required");
  }
  if (gate.headEvidence.length === 0) {
    errors.push("head.evidence is required");
  }
  if (gate.effectiveDiffEvidence.length === 0) {
    errors.push("effective_diff.evidence is required");
  }
  if (
    gate.headSha &&
    gate.effectiveDiffHeadSha &&
    gate.effectiveDiffHeadSha !== gate.headSha
  ) {
    errors.push("effective_diff.head_sha must match head.sha");
  }
  if (
    gate.headSha &&
    gate.requestObservedHeadSha &&
    gate.requestObservedHeadSha !== gate.headSha
  ) {
    errors.push(
      "request.observed_head_sha must match head.sha; request Nitro again after the latest source-head push",
    );
  }
  let expectedRequest: string | undefined;
  if (
    gate.artifactLifecycle &&
    includes(nitroArtifactLifecycles, gate.artifactLifecycle) &&
    gate.artifactClassification &&
    includes(nitroArtifactClassifications, gate.artifactClassification) &&
    Number.isSafeInteger(effectiveDiffFiles) &&
    effectiveDiffFiles >= 0
  ) {
    try {
      expectedRequest = expectedNitroRequest({
        artifactLifecycle: gate.artifactLifecycle,
        artifactClassification: gate.artifactClassification,
        effectiveDiffFiles,
      });
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "nitro_request_policy_invalid",
      );
    }
  }
  if (expectedRequest && gate.requestBody !== expectedRequest) {
    errors.push(`request.body must equal ${expectedRequest}`);
  }
  if (gate.requestEvidence.length === 0) {
    errors.push("request.evidence is required");
  } else if (
    gate.requestNoteId &&
    gate.requestNoteUrl &&
    !gate.requestEvidence.some(
      (evidence) =>
        evidence.includes(gate.requestNoteId ?? "") ||
        evidence.includes(gate.requestNoteUrl ?? ""),
    )
  ) {
    errors.push("request.evidence must identify the provider note");
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
  } else if (
    gate.completionStatus !== "pending" &&
    !gate.completionEvidence.some(
      (evidence) =>
        /nitro/i.test(evidence) &&
        !/local[- ]reviewer|local review/i.test(evidence),
    )
  ) {
    errors.push("completion.evidence must cite Nitro hosted review evidence");
  }
  if (
    gate.completionStatus &&
    ["clean", "findings", "stale"].includes(gate.completionStatus)
  ) {
    requireValue(gate.completionHeadSha, "completion.head_sha", errors);
    requireValue(gate.completionAuthor, "completion.author", errors);
    requireValue(gate.completionNoteId, "completion.note_id", errors);
    requireValue(gate.completionNoteUrl, "completion.note_url", errors);
    if (gate.completionAuthor && !/nitro/i.test(gate.completionAuthor)) {
      errors.push("completion.author must identify Nitro");
    }
    if (
      gate.completionStatus !== "stale" &&
      gate.completionHeadSha &&
      gate.headSha &&
      gate.completionHeadSha !== gate.headSha
    ) {
      errors.push("completion.head_sha must match head.sha");
    }
    if (
      gate.completionStatus === "stale" &&
      gate.completionHeadSha &&
      gate.headSha &&
      gate.completionHeadSha === gate.headSha
    ) {
      errors.push("stale completion must identify an older head");
    }
  }

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
  const section = extractSection(body, "nitro_feedback_gate");
  const head = extractSection(section, "head");
  const effectiveDiff = extractSection(section, "effective_diff");
  const request = extractSection(section, "request");
  const start = extractSection(section, "start");
  const completion = extractSection(section, "completion");

  return {
    artifact: scalar(section, "artifact"),
    headSha: scalar(head, "sha"),
    headEvidence: list(head, "evidence"),
    artifactLifecycle: scalar(section, "artifact_lifecycle"),
    artifactClassification: scalar(section, "artifact_classification"),
    classificationEvidence: list(section, "classification_evidence"),
    effectiveDiffHeadSha: scalar(effectiveDiff, "head_sha"),
    effectiveDiffFiles: scalar(effectiveDiff, "files"),
    effectiveDiffEvidence: list(effectiveDiff, "evidence"),
    requestRequired: scalar(request, "required"),
    requestNoteId: scalar(request, "note_id"),
    requestNoteUrl: scalar(request, "note_url"),
    requestAuthor: scalar(request, "author"),
    requestBody: scalar(request, "body"),
    requestObservedHeadSha: scalar(request, "observed_head_sha"),
    requestEvidence: list(request, "evidence"),
    startStatus: scalar(start, "status"),
    timeoutMinutes: scalar(start, "timeout_minutes"),
    pollIntervalMinutes: scalar(start, "poll_interval_minutes"),
    startEvidence: list(start, "evidence"),
    completionStatus: scalar(completion, "status"),
    completionHeadSha: scalar(completion, "head_sha"),
    completionAuthor: scalar(completion, "author"),
    completionNoteId: scalar(completion, "note_id"),
    completionNoteUrl: scalar(completion, "note_url"),
    completionEvidence: list(completion, "evidence"),
    unresolvedActionableFeedback: list(
      section,
      "unresolved_actionable_feedback",
    ),
    gateOutcome: scalar(section, "gate_outcome"),
  };
}

function isCommand(command: string | undefined): command is Command {
  return [
    "template",
    "validate",
    "normalize-feedback",
    "validate-gitlab-evidence",
    "validate-route",
  ].includes(command ?? "");
}
