#!/usr/bin/env tsx
import { readFileSync } from "node:fs";

const STATUSES = ["active", "complete", "blocked", "needs_replan"] as const;
const MODES = ["ship_then_continue", "stack_then_continue"] as const;
const SLICE_HANDOFF_STATUSES = ["ready", "blocked"] as const;
const DELIVERY_STATUSES = [
  "shipped",
  "stacked_pending_merge",
  "blocked",
  "needs_replan",
] as const;
const REVIEW_FEEDBACK_STATUSES = ["passed", "blocked"] as const;
const MERGE_STATES = [
  "draft",
  "open",
  "mergeable",
  "merged",
  "direct_published",
] as const;

type Command =
  | "ledger-template"
  | "slice-handoff-template"
  | "delivery-template"
  | "validate-ledger"
  | "validate-slice-handoff"
  | "validate-delivery";

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-followthrough.ts <ledger-template|slice-handoff-template|delivery-template|validate-ledger|validate-slice-handoff|validate-delivery> [--file path]",
    );
  }

  if (command === "ledger-template") {
    printLedgerTemplate();
    return;
  }

  if (command === "slice-handoff-template") {
    printSliceHandoffTemplate();
    return;
  }

  if (command === "delivery-template") {
    printDeliveryTemplate();
    return;
  }

  const input = readInput(args);
  if (command === "validate-ledger") {
    validateLedger(input);
    return;
  }

  if (command === "validate-slice-handoff") {
    validateSliceHandoff(input);
    return;
  }

  validateDelivery(input);
}

function printLedgerTemplate(): void {
  console.log(`plan_followthrough_ledger:
  status: active
  ledger_ref: <plan>.followthrough.md
  plan:
    artifact_ref: <plan artifact>
  slice_advancement:
    mode: ship_then_continue | stack_then_continue
    source: user_statement | existing_ledger
  current_slice:
    id: slice-01
    title: <slice title>
  slices:
    - id: slice-01
      title: <slice title>
      status: pending
  carry_forward:
    refactoring_reuse: []
    significant_refactor_suggestions: []
    review_findings: []
    verification_gaps: []
    changed_assumptions: []
  next_action: run_plan_to_pr
  blockers: []
  warnings: []
`);
}

function printSliceHandoffTemplate(): void {
  console.log(`plan_followthrough_slice_handoff:
  status: ready
  plan_ready_handoff:
    status: ready
    artifact_type: plan
    artifact_ref: <plan artifact>
    reviewed_slices:
      - slice-01
    approved_slice: <one slice only>
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers_selected: []
    unresolved_blockers: []
    scrutiny_verdict: ship
  followthrough_context:
    ledger_ref: <plan>.followthrough.md
    slice_advancement_mode: ship_then_continue | stack_then_continue
    slice_id: slice-01
    slice_name: <slice title>
    prior_slices: []
    carry_forward:
      refactoring_reuse: []
      significant_refactor_suggestions: []
      review_findings: []
      verification_gaps: []
      changed_assumptions: []
    stop_conditions: []
`);
}

function printDeliveryTemplate(): void {
  console.log(`plan_followthrough_delivery:
  slice_id: slice-01
  slice_name: <slice title>
  slice_advancement_mode: ship_then_continue | stack_then_continue
  status: shipped
  artifact:
    pr_or_mr:
      url: <url or none>
      draft: false
      latest_head: <sha>
      merge_state: merged | direct_published
    commit:
    branch:
  delivery_ledger_ref:
  verification:
    passed: []
    gaps: []
  review_feedback:
    status: passed
    reviewed_head: <sha>
    resolved: []
    carried_forward: []
  refactoring_reuse:
    implemented: []
    deferred: []
    must_consume_later: []
  significant_refactor_suggestions: []
  changed_assumptions: []
  recommended_next_action:
`);
}

function validateLedger(input: string): void {
  const errors: string[] = [];
  requireRoot(input, "plan_followthrough_ledger", errors);
  validateScalar(input, "status", STATUSES, errors);
  requireValue(input, "ledger_ref", errors);
  requireValue(input, "artifact_ref", errors);
  validateScalar(input, "mode", MODES, errors);
  requireValue(input, "next_action", errors);

  if (errors.length > 0) {
    fail(`Invalid plan_followthrough_ledger:\n${formatErrors(errors)}`);
  }

  console.log("plan_followthrough_ledger valid");
}

function validateSliceHandoff(input: string): void {
  const errors: string[] = [];
  requireRoot(input, "plan_followthrough_slice_handoff", errors);
  validateScalar(input, "status", SLICE_HANDOFF_STATUSES, errors);
  requireSection(input, "plan_ready_handoff", errors);
  requireValue(input, "artifact_type", errors);
  requireValue(input, "artifact_ref", errors);
  requireValue(input, "reviewed_slices", errors);
  requireValue(input, "approved_slice", errors);
  validateScalar(input, "scrutiny_verdict", ["ship"] as const, errors);
  requireSection(input, "followthrough_context", errors);
  requireValue(input, "ledger_ref", errors);
  validateScalar(input, "slice_advancement_mode", MODES, errors);
  requireValue(input, "slice_id", errors);
  requireValue(input, "slice_name", errors);

  for (const reviewer of [
    "implementation-readiness",
    "edge-cases-and-risks",
    "simplification-and-scope-control",
    "refactoring-opportunities",
  ]) {
    if (!input.includes(`- ${reviewer}`)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    fail(`Invalid plan_followthrough_slice_handoff:\n${formatErrors(errors)}`);
  }

  console.log("plan_followthrough_slice_handoff valid");
}

function validateDelivery(input: string): void {
  const errors: string[] = [];
  requireRoot(input, "plan_followthrough_delivery", errors);
  requireValue(input, "slice_id", errors);
  requireValue(input, "slice_name", errors);
  validateScalar(input, "slice_advancement_mode", MODES, errors);
  validateScalar(input, "status", DELIVERY_STATUSES, errors);
  requireSection(input, "artifact", errors);
  requireSection(input, "pr_or_mr", errors);
  requireValue(input, "url", errors, "artifact.pr_or_mr.url");
  requireValue(input, "draft", errors, "artifact.pr_or_mr.draft");
  requireValue(input, "latest_head", errors, "artifact.pr_or_mr.latest_head");
  requireValue(input, "merge_state", errors, "artifact.pr_or_mr.merge_state");
  requireSection(input, "verification", errors);
  requireSection(input, "review_feedback", errors);
  requireValue(input, "reviewed_head", errors, "review_feedback.reviewed_head");
  validateScalar(input, "status", REVIEW_FEEDBACK_STATUSES, errors, {
    errorLabel: "review_feedback.status",
    sectionName: "review_feedback",
  });
  requireSection(input, "refactoring_reuse", errors);
  requireKey(input, "significant_refactor_suggestions", errors);

  const status = scalar(input, "status");
  const mode = scalar(input, "slice_advancement_mode");
  const draft = scalar(input, "draft");
  const latestHead = scalar(input, "latest_head");
  const mergeState = scalar(input, "merge_state");
  const reviewedHead = scalar(input, "reviewed_head");
  const reviewFeedbackStatus = scalar(input, "status", "review_feedback");

  if (draft && !["true", "false"].includes(draft)) {
    errors.push("artifact.pr_or_mr.draft must be true or false");
  }

  if (mergeState && !includes(MERGE_STATES, mergeState)) {
    errors.push(
      `artifact.pr_or_mr.merge_state must be one of: ${MERGE_STATES.join(", ")}`,
    );
  }

  if (latestHead && reviewedHead && latestHead !== reviewedHead) {
    errors.push(
      "review_feedback.reviewed_head must match artifact.pr_or_mr.latest_head",
    );
  }

  if (reviewFeedbackStatus === "blocked" && status !== "blocked") {
    errors.push(
      "review_feedback.status blocked requires delivery status blocked",
    );
  }

  if (
    (status === "shipped" || status === "stacked_pending_merge") &&
    reviewFeedbackStatus !== "passed"
  ) {
    errors.push(`${status} requires review_feedback.status passed`);
  }

  if (status === "shipped" && draft === "true") {
    errors.push("shipped delivery cannot reference a draft PR/MR");
  }

  if (
    status === "shipped" &&
    mergeState &&
    !["merged", "direct_published"].includes(mergeState)
  ) {
    errors.push(
      "shipped delivery requires merge_state merged or direct_published",
    );
  }

  if (status === "stacked_pending_merge" && mode === "ship_then_continue") {
    errors.push("stacked_pending_merge is not valid for ship_then_continue");
  }

  if (errors.length > 0) {
    fail(`Invalid plan_followthrough_delivery:\n${formatErrors(errors)}`);
  }

  console.log("plan_followthrough_delivery valid");
}

function requireRoot(input: string, root: string, errors: string[]): void {
  if (!new RegExp(`^${escapeRegExp(root)}:\\s*$`, "m").test(input)) {
    errors.push(`${root} root is required`);
  }
}

function requireSection(input: string, key: string, errors: string[]): void {
  if (!new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`, "m").test(input)) {
    errors.push(`${key} section is required`);
  }
}

function requireKey(input: string, key: string, errors: string[]): void {
  if (!new RegExp(`^\\s*${escapeRegExp(key)}:\\s*`, "m").test(input)) {
    errors.push(`${key} is required`);
  }
}

function requireValue(
  input: string,
  key: string,
  errors: string[],
  errorLabel = key,
): void {
  const value = scalar(input, key);
  if (!value || value.startsWith("<")) {
    errors.push(`${errorLabel} is required`);
  }
}

function validateScalar<const T extends readonly string[]>(
  input: string,
  key: string,
  allowed: T,
  errors: string[],
  options: { errorLabel?: string; sectionName?: string } = {},
): void {
  const errorLabel = options.errorLabel ?? key;
  const value = scalar(input, key, options.sectionName);
  if (!value || value.startsWith("<")) {
    errors.push(`${errorLabel} is required`);
    return;
  }

  if (!allowed.includes(value as T[number])) {
    errors.push(`${errorLabel} must be one of: ${allowed.join(", ")}`);
  }
}

function scalar(
  input: string,
  key: string,
  sectionName?: string,
): string | undefined {
  const source = sectionName ? extractSection(input, sectionName) : input;
  const match = source.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"),
  );
  return match?.[1]?.trim();
}

function extractSection(input: string, sectionName: string): string {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return input;
  }

  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value as T[number]);
}

function readInput(args: string[]): string {
  const fileIndex = args.indexOf("--file");
  if (fileIndex !== -1) {
    const file = args[fileIndex + 1];
    if (!file) {
      fail("--file requires a path");
    }
    return readFileSync(file, "utf8");
  }

  return readFileSync(0, "utf8");
}

function isCommand(command: string | undefined): command is Command {
  return [
    "ledger-template",
    "slice-handoff-template",
    "delivery-template",
    "validate-ledger",
    "validate-slice-handoff",
    "validate-delivery",
  ].includes(command ?? "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatErrors(errors: string[]): string {
  return errors.map((error) => `- ${error}`).join("\n");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
