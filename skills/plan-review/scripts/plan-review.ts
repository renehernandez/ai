#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nitroFeedbackGateErrors } from "../../../scripts/nitro-feedback-gate.ts";
import {
  cleanScalar,
  escapeRegExp,
  extractSection,
  extractYaml,
  fail,
  findSection,
  hasKey,
  includes,
  legacyPlanContractErrors,
  list,
  readInput,
  requireValue,
  scalar,
  validatePlanningReviewContract,
} from "../../../scripts/planning-contracts.ts";

const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const REQUEST_STATUSES = ["ready_for_review"] as const;
const REQUESTED_REVIEWERS = [
  "nitro",
  "developers",
  "human",
  "security",
  "docs",
] as const;
const LEDGER_GATES = [
  "request_validation",
  "session_start",
  "planning_only_diff",
  "openspec_source_plan_boundary",
  "artifact_validation",
  "review_feedback_routing",
  "artifact_creation_update",
  "artifact_host_inspection",
  "planning_feedback_disposition",
  "automated_feedback",
  "developer_review",
  "no_implementation",
] as const;
const LEDGER_NOT_APPLICABLE_GATES = [
  "openspec_source_plan_boundary",
  "automated_feedback",
  "developer_review",
] as const;
const LEDGER_STATUSES = ["passed", "blocked", "not_applicable"] as const;
const READINESS_GATE_OUTCOMES = ["passed"] as const;
const READINESS_REVIEWER_STATUSES = [
  "passed",
  "failed",
  "blocked",
  "skipped",
] as const;

type Command =
  | "detect"
  | "request-template"
  | "validate-request"
  | "validate-planning-diff"
  | "planning-review-template"
  | "validate-planning-review"
  | "gate-template"
  | "validate-ledger";

type ParsedRequest = {
  source:
    | "plan_review_request"
    | "plan_delivery_handoff"
    | "legacy"
    | "ambiguous";
  status?: string;
  artifact_type?: string;
  artifact_ref?: string;
  review_goal?: string;
  requested_reviewers: string[];
  readiness_reviewer_evidence?: ReadinessReviewerEvidence;
  unresolved_blockers: string[];
  blockers: string[];
};

type ReadinessReviewerEvidence = {
  present: boolean;
  artifact_fingerprint?: string;
  completed_at?: string;
  gate_outcome?: string;
  baseline_reviewers: string[];
  selected_dynamic_reviewers_present: boolean;
  selected_dynamic_reviewers: string[];
  per_reviewer_status: Record<string, string>;
  skipped_reviewers: string[];
  skipped_rationale: string[];
  blocking_findings: string[];
};

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-review.ts <detect|request-template|validate-request|validate-planning-diff|gate-template|validate-ledger> [--file path]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "request-template") {
    printRequestTemplate();
    return;
  }

  if (command === "gate-template") {
    printGateTemplate();
    return;
  }

  if (command === "planning-review-template") {
    printPlanningReviewTemplate();
    return;
  }

  const input = readInput(args);
  if (command === "validate-request") {
    validateRequest(input);
    return;
  }

  if (command === "validate-planning-diff") {
    validatePlanningDiff(args, input);
    return;
  }

  if (command === "validate-planning-review") {
    validatePlanningReview(input);
    return;
  }

  validateLedger(input);
}

function detect(): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const remoteText = remotes.toLowerCase();

  const result = {
    repo_root: repoRoot,
    branch,
    head_sha: headSha,
    remotes: remotes.split("\n").filter(Boolean),
    artifact_host_hint:
      remoteText.includes("gitlab") || remoteText.includes("git.fullscript.io")
        ? "gitlab"
        : remoteText.includes("github")
          ? "github"
          : null,
    openspec_present: existsSync(join(repoRoot, "openspec")),
    plan_dirs_present: [".agents/plans", "plans", "docs"].filter((path) =>
      existsSync(join(repoRoot, path)),
    ),
  };

  console.log(JSON.stringify(result, null, 2));
}

function printRequestTemplate(): void {
  console.log(`## Readable Summary

- Status: ready for hosted plan review.
- Artifact: openspec/changes/example-change.
- Review goal: validate the plan before implementation.
- Requested reviewers: copied from the hosted-review route.
- Readiness evidence: copied from the validated plan-ready output.

\`\`\`yaml
plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - <copy each hosted-review reviewer required by the selected route>
  readiness_reviewer_evidence:
    artifact_fingerprint: <copy plan-ready review.reviewer_evidence.artifact_fingerprint>
    completed_at: <copy plan-ready review.reviewer_evidence.completed_at>
    gate_outcome: passed
    baseline_reviewers:
      - <copy each plan-ready baseline reviewer>
    selected_dynamic_reviewers:
      - <copy each selected plan-ready dynamic reviewer, or [] when plan-ready emitted []>
    per_reviewer_status:
      <copy every plan-ready per-reviewer status, including selected dynamic reviewers>
    skipped_reviewers:
      - <copy each plan-ready skipped reviewer, or [] when plan-ready emitted []>
    skipped_rationale:
      - <copy each plan-ready skipped rationale, or [] when plan-ready emitted []>
    blocking_findings: []
  unresolved_blockers: []
\`\`\`
`);
}

function printGateTemplate(): void {
  console.log(`## Readable Summary

- Review state: every plan-review gate has a verdict and evidence.
- Hosted artifact: PR or MR is planning-only.
- Finish condition: developer review is pending, feedback is incorporated, or the plan review is blocked with evidence.

\`\`\`yaml
plan_review_gate_ledger:
${LEDGER_GATES.map(
  (gate) => `  ${gate}:
    status: passed
    evidence: <evidence>`,
).join("\n")}
\`\`\`
`);
}

function printPlanningReviewTemplate(): void {
  console.log(`## Readable Summary

- Status: reviewed planning is ready for implementation sequencing.
- Artifact: openspec/changes/example-change.
- Mode: stacked delivery from the reviewed planning PR or MR head.
- Gate: hosted planning review is complete and the planning head is ready for stack-based implementation.

\`\`\`yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab planning MR URL>
  head_sha: <planning artifact head sha>
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - <request command, note URL, or discussion evidence>
  start:
    status: started
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro acknowledgement or review-start evidence>
  completion:
    status: clean
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed

planning_review:
  status: reviewed
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_artifact: <planning PR or MR URL>
  mode: stacked_delivery
  gate_outcome: ready_for_stack
  target_branch: main
  target_base_sha: <target branch sha reviewed by planning artifact>
  planning_branch: <planning branch name>
  reviewed_head: <planning artifact head sha>
  stack_base_ref: <planning PR or MR branch/ref>
  stack_base_evidence: <latest-head review evidence proving this head is the stack base>
  stack_identity:
    expected_base_ref: <planning PR or MR branch/ref>
    expected_base_sha: <planning artifact head sha>
    predecessor_artifact:
    restack_required: false
  task_state_fingerprint: <sha256 of reviewed plan or OpenSpec task state>
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning PR or MR latest-head feedback completed with no unresolved actionable findings
  planning_feedback_disposition:
    status: complete
    evidence:
      - Every Nitro-authored planning note and discussion across review rounds was enumerated by note ID and disposition.
    items:
      - note_id: <Nitro planning note id>
        discussion_id: <discussion id when present, or omitted for individual non-resolvable notes>
        resolvable: false
        resolved: false
        disposition: fixed_in_planning
        evidence: <planning commit, implementation task deferral, non-actionable rationale, or blocked reason>
  blockers: []
\`\`\`
`);
}

function validateRequest(input: string): void {
  const request = parseRequest(input);
  const errors: string[] = [];

  if (request.source === "ambiguous") {
    console.error(
      "Invalid ambiguous:\n- provide exactly one of plan_review_request or plan_delivery_handoff",
    );
    process.exit(1);
  }

  if (request.source === "legacy") {
    console.error(
      "Invalid legacy:\n- legacy handoffs are unsupported; rerun plan-ready",
    );
    process.exit(1);
  }

  requireValue(request.status, "status", errors);
  requireValue(request.artifact_type, "artifact_type", errors);
  requireValue(request.artifact_ref, "artifact_ref", errors);

  if (request.source === "plan_review_request") {
    requireValue(request.review_goal, "review_goal", errors);

    if (request.status && !includes(REQUEST_STATUSES, request.status)) {
      errors.push(`status must be one of: ${REQUEST_STATUSES.join(", ")}`);
    }

    if (request.requested_reviewers.length === 0) {
      errors.push("requested_reviewers must include at least one reviewer");
    }

    for (const reviewer of request.requested_reviewers) {
      if (!includes(REQUESTED_REVIEWERS, reviewer)) {
        errors.push(`unknown requested reviewer: ${reviewer}`);
      }
    }

    errors.push(
      ...readinessReviewerEvidenceErrors(request.readiness_reviewer_evidence),
    );
  } else {
    if (request.status && request.status !== "ready") {
      errors.push("plan_delivery_handoff status must be ready");
    }

    if (request.blockers.length > 0) {
      errors.push("plan_delivery_handoff blockers must be empty");
    }
  }

  if (
    request.artifact_type &&
    !includes(ARTIFACT_TYPES, request.artifact_type)
  ) {
    errors.push(`artifact_type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (request.unresolved_blockers.length > 0) {
    errors.push(
      "unresolved_blockers must be empty before publishing for review",
    );
  }

  if (errors.length > 0) {
    console.error(
      `Invalid ${request.source}:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log(`${request.source} valid`);
}

function validatePlanningDiff(args: string[], stdinInput: string): void {
  const artifactType = requiredArg(args, "--artifact-type");
  const diffFile = optionalArg(args, "--diff-file");
  const diffText = diffFile
    ? readDiffFile(diffFile)
    : stdinInput.trim()
      ? stdinInput
      : gitDiffNameStatus(args);

  if (!includes(ARTIFACT_TYPES, artifactType)) {
    fail(`artifact_type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  const entries = parseNameStatus(diffText);
  const planPathEntries = entries.filter((entry) =>
    entry.paths.some(isAgentsPlanPath),
  );

  if (artifactType === "openspec" && planPathEntries.length > 0) {
    console.error(
      [
        "Invalid planning diff:",
        "- artifact_type openspec planning diffs must not include .agents/plans paths",
        ...planPathEntries.map(
          (entry) =>
            `- ${entry.status}: ${entry.paths.filter(isAgentsPlanPath).join(" -> ")}`,
        ),
      ].join("\n"),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "planning_diff_valid",
        artifact_type: artifactType,
        checked_entries: entries.length,
      },
      null,
      2,
    ),
  );
}

function validateLedger(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_review_gate_ledger");
  const errors: string[] = [];

  for (const gate of LEDGER_GATES) {
    const gateSection = findSection(section, gate);
    if (!gateSection) {
      errors.push(`${gate} is required`);
      continue;
    }

    const status = scalar(gateSection, "status");
    const evidence = scalar(gateSection, "evidence");

    if (!status) {
      errors.push(`${gate}.status is required`);
    } else if (!includes(LEDGER_STATUSES, status)) {
      errors.push(
        `${gate}.status must be one of: ${LEDGER_STATUSES.join(", ")}`,
      );
    } else if (
      status === "not_applicable" &&
      !includes(LEDGER_NOT_APPLICABLE_GATES, gate)
    ) {
      errors.push(`${gate}.status cannot be not_applicable`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${gate}.evidence is required`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid plan_review_gate_ledger:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("plan_review_gate_ledger valid");
}

function parseRequest(input: string): ParsedRequest {
  const body = extractYaml(input);
  const reviewSection = findSection(body, "plan_review_request");
  const handoffSection = findSection(body, "plan_delivery_handoff");
  const legacyErrors = legacyPlanContractErrors(input);

  if (reviewSection && handoffSection) {
    return {
      source: "ambiguous",
      requested_reviewers: [],
      unresolved_blockers: [],
      blockers: [],
    };
  }

  if (legacyErrors.length > 0) {
    return {
      source: "legacy",
      requested_reviewers: [],
      unresolved_blockers: [],
      blockers: [],
    };
  }

  if (reviewSection) {
    return {
      source: "plan_review_request",
      status: scalar(reviewSection, "status"),
      artifact_type: scalar(reviewSection, "artifact_type"),
      artifact_ref: scalar(reviewSection, "artifact_ref"),
      review_goal: scalar(reviewSection, "review_goal"),
      requested_reviewers: list(reviewSection, "requested_reviewers"),
      readiness_reviewer_evidence:
        parseReadinessReviewerEvidence(reviewSection),
      unresolved_blockers: list(reviewSection, "unresolved_blockers"),
      blockers: [],
    };
  }

  const handoffBody = handoffSection ?? body;
  const artifact = findSection(handoffBody, "artifact") ?? "";
  return {
    source: "plan_delivery_handoff",
    status: scalar(handoffBody, "status"),
    artifact_type: scalar(artifact, "type"),
    artifact_ref: scalar(artifact, "ref"),
    review_goal: scalar(handoffBody, "review_goal"),
    requested_reviewers: list(handoffBody, "requested_reviewers"),
    unresolved_blockers: list(handoffBody, "unresolved_blockers"),
    blockers: list(handoffBody, "blockers"),
  };
}

function parseReadinessReviewerEvidence(
  requestSection: string,
): ReadinessReviewerEvidence {
  const section = findSection(requestSection, "readiness_reviewer_evidence");
  const body = section ?? "";

  return {
    present: Boolean(section),
    artifact_fingerprint: scalar(body, "artifact_fingerprint"),
    completed_at: scalar(body, "completed_at"),
    gate_outcome: scalar(body, "gate_outcome"),
    baseline_reviewers: list(body, "baseline_reviewers"),
    selected_dynamic_reviewers_present: hasKey(
      body,
      "selected_dynamic_reviewers",
    ),
    selected_dynamic_reviewers: list(body, "selected_dynamic_reviewers"),
    per_reviewer_status: map(body, "per_reviewer_status"),
    skipped_reviewers: list(body, "skipped_reviewers"),
    skipped_rationale: list(body, "skipped_rationale"),
    blocking_findings: list(body, "blocking_findings"),
  };
}

function readinessReviewerEvidenceErrors(
  evidence: ReadinessReviewerEvidence | undefined,
): string[] {
  const errors: string[] = [];
  const label = "readiness_reviewer_evidence";

  if (!evidence?.present) {
    return [`${label} is required`];
  }

  requireValue(
    evidence.artifact_fingerprint,
    `${label}.artifact_fingerprint`,
    errors,
  );
  requireValue(evidence.completed_at, `${label}.completed_at`, errors);
  requireValue(evidence.gate_outcome, `${label}.gate_outcome`, errors);

  if (
    evidence.gate_outcome &&
    !includes(READINESS_GATE_OUTCOMES, evidence.gate_outcome)
  ) {
    errors.push(
      `${label}.gate_outcome must be one of: ${READINESS_GATE_OUTCOMES.join(", ")}`,
    );
  }

  if (
    evidence.completed_at &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
      evidence.completed_at,
    )
  ) {
    errors.push(`${label}.completed_at must be an ISO-8601 UTC timestamp`);
  }

  if (evidence.baseline_reviewers.length === 0) {
    errors.push(`${label}.baseline_reviewers is required`);
  }

  if (!evidence.selected_dynamic_reviewers_present) {
    errors.push(`${label}.selected_dynamic_reviewers is required`);
  }

  const requiredReviewers = [
    ...evidence.baseline_reviewers,
    ...evidence.selected_dynamic_reviewers,
  ];

  for (const reviewer of requiredReviewers) {
    const status = evidence.per_reviewer_status[reviewer];
    if (!status) {
      errors.push(`${label}.per_reviewer_status must include ${reviewer}`);
    } else if (status !== "passed") {
      errors.push(`${label}.per_reviewer_status.${reviewer} must be passed`);
    }
  }

  for (const [reviewer, status] of Object.entries(
    evidence.per_reviewer_status,
  )) {
    if (!includes(READINESS_REVIEWER_STATUSES, status)) {
      errors.push(
        `${label}.per_reviewer_status.${reviewer} must be passed, failed, blocked, or skipped`,
      );
    }

    if (
      !requiredReviewers.includes(reviewer) &&
      !evidence.skipped_reviewers.includes(reviewer)
    ) {
      errors.push(
        `${label}.per_reviewer_status contains unlisted reviewer: ${reviewer}`,
      );
    }

    if (
      status === "skipped" &&
      !evidence.skipped_reviewers.includes(reviewer)
    ) {
      errors.push(
        `${label}.per_reviewer_status.${reviewer} is skipped but ${reviewer} is not listed in skipped_reviewers`,
      );
    }
  }

  for (const reviewer of evidence.skipped_reviewers) {
    if (requiredReviewers.includes(reviewer)) {
      errors.push(`${label}.skipped_reviewers cannot include ${reviewer}`);
    }
  }

  if (
    evidence.skipped_reviewers.length > 0 &&
    evidence.skipped_rationale.length < evidence.skipped_reviewers.length
  ) {
    errors.push(
      `${label}.skipped_rationale must explain each skipped reviewer`,
    );
  }

  if (evidence.blocking_findings.length > 0) {
    errors.push(`${label}.blocking_findings must be empty`);
  }

  return errors;
}

function map(input: string, key: string): Record<string, string> {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return {};
  }

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const values: Record<string, string> = {};
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }

    const match = line.trim().match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (match) {
      values[match[1]] = cleanScalar(match[2]);
    }
  }

  return values;
}

function validatePlanningReview(input: string): void {
  const errors = legacyPlanContractErrors(input);
  validatePlanningReviewContract(input, errors);
  errors.push(
    ...nitroFeedbackGateErrors(input).map((error) =>
      error.startsWith("nitro_feedback_gate.")
        ? error
        : `nitro_feedback_gate.${error}`,
    ),
  );

  if (errors.length > 0) {
    console.error(
      `Invalid planning_review:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("planning_review valid");
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "request-template",
    "validate-request",
    "validate-planning-diff",
    "planning-review-template",
    "validate-planning-review",
    "gate-template",
    "validate-ledger",
  ].includes(command ?? "");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

type NameStatusEntry = {
  status: string;
  paths: string[];
};

function parseNameStatus(input: string): NameStatusEntry[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split(/\t+/);
      return { status, paths };
    });
}

function gitDiffNameStatus(args: string[]): string {
  const base = optionalArg(args, "--base");
  const head = optionalArg(args, "--head");
  if (!base) {
    fail(
      "validate-planning-diff requires --base <ref> [--head <ref>], --diff-file <path>, or name-status diff on stdin",
    );
  }

  const refs = head ? [base, head] : [base];
  const result = spawnSync(
    "git",
    ["diff", "--name-status", "--find-renames", "--find-copies", ...refs],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function readDiffFile(path: string): string {
  if (!existsSync(path)) {
    fail(`diff_file_missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function isAgentsPlanPath(path: string): boolean {
  return path === ".agents/plans" || path.startsWith(".agents/plans/");
}

function optionalArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function requiredArg(args: string[], name: string): string {
  const value = optionalArg(args, name);
  if (!value) {
    fail(`${name} is required`);
  }
  return value;
}
