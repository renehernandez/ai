#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseTasks,
  validateTasks,
} from "../../openspec-tasks/scripts/openspec-tasks.ts";

const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
  "refactoring-opportunities",
] as const;

const OPTIONAL_REVIEWERS = [
  "security-and-auth",
  "data-migration-and-backfill",
  "ci-and-release-impact",
  "frontend-ux-accessibility",
  "infra-and-cloud",
  "docs-and-agent-alignment",
  "performance-and-scale",
  "agent-runtime-and-skill-compatibility",
] as const;

const REVIEW_SUBAGENTS = [
  "implementation-review-agent",
  "implementation-scrutiny-agent",
  "code-quality-review-agent",
  "code-simplifier-agent",
  "deslop-agent",
  "ai-readiness-upkeep-agent",
  "docs-alignment-review-agent",
  "security-review-agent",
] as const;

const REQUIRED_REVIEW_SUBAGENTS = [
  "implementation-review-agent",
  "implementation-scrutiny-agent",
  "code-quality-review-agent",
  "code-simplifier-agent",
  "deslop-agent",
  "docs-alignment-review-agent",
] as const;

const MUST_PASS_REVIEW_SUBAGENTS = [
  "implementation-review-agent",
  "implementation-scrutiny-agent",
  "code-quality-review-agent",
] as const;

const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;

const LEDGER_GATES = [
  "handoff_validation",
  "session_start",
  "slice_status",
  "implementation",
  "local_verification",
  "refactoring_execution",
  "reviewer_subagents",
  "implementation_review",
  "implementation_scrutiny",
  "code_quality_review",
  "code_simplifier",
  "deslop",
  "security_review",
  "ai_readiness_upkeep",
  "docs_alignment",
  "review_feedback_routing",
  "artifact_creation_update",
  "artifact_host_review",
  "pipeline_monitoring",
  "automatic_review_feedback_wait",
] as const;

const LEDGER_NOT_APPLICABLE_GATES = [
  "code_simplifier",
  "deslop",
  "security_review",
  "ai_readiness_upkeep",
  "docs_alignment",
] as const;

const LEDGER_STATUSES = ["passed", "blocked", "not_applicable"] as const;
const REVIEW_OUTCOME_STATUSES = [
  "passed",
  "findings",
  "blocked",
  "not_applicable",
] as const;
type Command =
  | "detect"
  | "validate-handoff"
  | "reviewer-template"
  | "validate-launch-report"
  | "validate-review-report"
  | "refactoring-template"
  | "gate-template"
  | "validate-ledger"
  | "validate-task-delta";

type ParsedHandoff = {
  status?: string;
  route?: string;
  artifact_type?: string;
  artifact_ref?: string;
  artifact_fingerprint?: string;
  approved_unit_id?: string;
  approved_unit_title?: string;
  approved_unit_scope?: string;
  acceptance: string[];
  verification: string[];
  files_or_areas: string[];
  expected_host?: string;
  completion_updates: string[];
  required_reviewers: string[];
  optional_reviewers: string[];
  blockers: string[];
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-unit-delivery.ts <detect|validate-handoff|reviewer-template|validate-launch-report|validate-review-report|refactoring-template|gate-template|validate-ledger|validate-task-delta> [--file path|--base path --head path --task id]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "gate-template") {
    printGateTemplate();
    return;
  }

  if (command === "reviewer-template") {
    printReviewerTemplate();
    return;
  }

  if (command === "refactoring-template") {
    printRefactoringExecutionTemplate();
    return;
  }

  if (command === "validate-task-delta") {
    validateTaskDelta(args);
    return;
  }

  const input = readInput(args);
  if (command === "validate-handoff") {
    validateHandoff(input);
    return;
  }

  if (command === "validate-launch-report") {
    validateLaunchReport(input);
    return;
  }

  if (command === "validate-review-report") {
    validateReviewReport(input);
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
  };

  console.log(JSON.stringify(result, null, 2));
}

function printGateTemplate(): void {
  console.log(`delivery_gate_ledger:
${LEDGER_GATES.map(
  (gate) => `  ${gate}:
    status: passed
    evidence: <evidence>`,
).join("\n")}
`);
}

function printReviewerTemplate(): void {
  console.log(`reviewer_subagent_launch:
  status: launched
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  subagent_ids:
    - implementation-review-agent: <returned subagent id>
    - implementation-scrutiny-agent: <returned subagent id>
    - code-quality-review-agent: <returned subagent id>
    - code-simplifier-agent: <returned subagent id>
    - deslop-agent: <returned subagent id>
    - docs-alignment-review-agent: <returned subagent id>

reviewer_subagent_report:
  status: complete
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  outcomes:
    - implementation-review-agent: passed - no actionable correctness or regression findings
    - implementation-scrutiny-agent: passed - scrutiny verdict ship
    - code-quality-review-agent: passed - no critical or warning maintainability findings
    - code-simplifier-agent: passed - simplification applied or not needed
    - deslop-agent: passed - AI-shaped clutter removed or not present
    - docs-alignment-review-agent: passed - docs alignment clean or updated

review_execution_rules:
  - In Codex, run reviewer agents with the internal Codex subagent tool exposed by the current harness.
  - Do not use the dispatch skill, Claude Code Task, or external Claude harness for Codex plan-unit-delivery reviewers.
  - Omit model overrides unless the user explicitly asks for one.
  - Print and validate reviewer_subagent_launch immediately after spawning reviewers and before waiting for outcomes.
  - Validate reviewer_subagent_report before PR/MR creation or final delivery.
`);
}

function printRefactoringExecutionTemplate(): void {
  console.log(`refactoring_execution:
  minor_in_slice:
    - <local behavior-preserving refactor inside the approved slice boundary>
  deferred_minor:
    - <minor refactor deferred with evidence>
  rejected_as_premature:
    - <abstraction rejected because it lacks a named consumer>
  significant_refactor_suggestions:
    - title: <short suggested refactoring slice or none>
      discovered_during: implementation | local_review | hosted_review | ci_fix
      why_not_in_scope: <why this changes slice scope, sequencing, boundary, contract, or acceptance criteria>
      suggested_planning_action: add_refactor_slice | revisit_sequence | reject_later
      affected_slices: []
  verification:
    - <fastest behavior-preserving verification>
`);
}

function validateHandoff(input: string): void {
  const handoff = parseHandoff(input);
  const errors = legacyErrors(input);

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.route, "route", errors);
  requireValue(handoff.artifact_type, "artifact_type", errors);
  requireValue(handoff.artifact_ref, "artifact_ref", errors);
  requireValue(handoff.artifact_fingerprint, "artifact_fingerprint", errors);
  requireValue(handoff.approved_unit_id, "approved_unit.id", errors);
  requireValue(handoff.approved_unit_title, "approved_unit.title", errors);
  requireValue(handoff.approved_unit_scope, "approved_unit.scope", errors);
  requireValue(handoff.expected_host, "delivery.expected_host", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }

  if (
    handoff.route &&
    !["atomic_plan", "openspec_task"].includes(handoff.route)
  ) {
    errors.push("route must be one of: atomic_plan, openspec_task");
  }

  if (
    handoff.artifact_type &&
    !includes(ARTIFACT_TYPES, handoff.artifact_type)
  ) {
    errors.push(`artifact_type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (
    handoff.expected_host &&
    !["github_pr", "gitlab_mr", "direct_publish"].includes(
      handoff.expected_host,
    )
  ) {
    errors.push(
      "delivery.expected_host must be one of: github_pr, gitlab_mr, direct_publish",
    );
  }

  if (handoff.acceptance.length === 0) {
    errors.push("approved_unit.acceptance must include at least one item");
  }

  if (handoff.verification.length === 0) {
    errors.push("approved_unit.verification must include at least one item");
  }

  if (handoff.files_or_areas.length === 0) {
    errors.push("constraints.files_or_areas must include at least one item");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!handoff.required_reviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of [
    ...handoff.required_reviewers,
    ...handoff.optional_reviewers,
  ]) {
    if (!isKnownReviewer(reviewer)) {
      errors.push(`unknown reviewer: ${reviewer}`);
    }
  }

  for (const reviewer of handoff.optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(
        `optional_reviewers can include only optional reviewers: ${reviewer}`,
      );
    }
  }

  if (handoff.blockers.length > 0) {
    errors.push("blockers must be empty before implementation");
  }

  if (
    handoff.route === "atomic_plan" &&
    handoff.approved_unit_id !== "atomic"
  ) {
    errors.push("atomic_plan route requires approved_unit.id atomic");
  }

  if (handoff.route === "openspec_task") {
    if (handoff.artifact_type !== "openspec") {
      errors.push("openspec_task route requires artifact_type openspec");
    }
    if (handoff.completion_updates.length === 0) {
      errors.push("openspec_task route requires delivery.completion_updates");
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid plan_delivery_handoff:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("plan_delivery_handoff valid");
}

function validateTaskDelta(args: string[]): void {
  const basePath = requiredArg(args, "--base");
  const headPath = requiredArg(args, "--head");
  const expectedTaskId = requiredArg(args, "--task");
  const errors: string[] = [];
  const baseTasks = parseTasks(readFileSync(basePath, "utf8"));
  const headTasks = parseTasks(readFileSync(headPath, "utf8"));
  const baseErrors = validateTasks(baseTasks);
  const headErrors = validateTasks(headTasks);

  errors.push(
    ...baseErrors.map((error) => `base tasks.md: ${error}`),
    ...headErrors.map((error) => `head tasks.md: ${error}`),
  );

  const baseById = new Map(baseTasks.map((task) => [task.id, task]));
  const headById = new Map(headTasks.map((task) => [task.id, task]));
  const expectedBaseTask = baseById.get(expectedTaskId);
  const expectedHeadTask = headById.get(expectedTaskId);

  if (!expectedBaseTask || !expectedHeadTask) {
    errors.push(
      `unit_task_delta_unexpected: expected task ${expectedTaskId} must exist in both base and head tasks.md`,
    );
  }

  for (const baseTask of baseTasks) {
    if (!headById.has(baseTask.id)) {
      errors.push(
        `unit_task_delta_invalid_tasks: task ${baseTask.id} missing from head tasks.md`,
      );
    }
  }

  for (const headTask of headTasks) {
    if (!baseById.has(headTask.id)) {
      errors.push(
        `unit_task_delta_invalid_tasks: task ${headTask.id} missing from base tasks.md`,
      );
    }
  }

  const newlyChecked = headTasks.filter((headTask) => {
    const baseTask = baseById.get(headTask.id);
    return baseTask && !baseTask.checked && headTask.checked;
  });
  const newlyCheckedDeliverables = newlyChecked.filter(
    (task) => task.kind === "deliverable",
  );
  const uncheckedPreviouslyChecked = baseTasks.filter((baseTask) => {
    const headTask = headById.get(baseTask.id);
    return baseTask.checked && headTask && !headTask.checked;
  });

  for (const task of uncheckedPreviouslyChecked) {
    errors.push(
      `unit_task_delta_invalid_tasks: task ${task.id} was unchecked relative to base`,
    );
  }

  if (expectedBaseTask?.checked && expectedHeadTask?.checked) {
    errors.push(
      `unit_task_delta_unexpected: expected task ${expectedTaskId} was already checked in base`,
    );
  } else if (expectedHeadTask && !expectedHeadTask.checked) {
    errors.push(
      `unit_task_delta_missing: expected task ${expectedTaskId} was not checked`,
    );
  }

  if (newlyCheckedDeliverables.length > 1) {
    errors.push(
      `unit_task_delta_multiple: checked deliverable tasks ${newlyCheckedDeliverables.map((task) => task.id).join(", ")}`,
    );
  }

  if (
    newlyCheckedDeliverables.length === 1 &&
    newlyCheckedDeliverables[0].id !== expectedTaskId
  ) {
    errors.push(
      `unit_task_delta_unexpected: checked ${newlyCheckedDeliverables[0].id} instead of ${expectedTaskId}`,
    );
  }

  const unexpectedNewlyChecked = newlyChecked.filter(
    (task) => task.id !== expectedTaskId,
  );
  if (
    unexpectedNewlyChecked.length > 0 &&
    newlyCheckedDeliverables.length <= 1
  ) {
    errors.push(
      `unit_task_delta_unexpected: checked extra tasks ${unexpectedNewlyChecked.map((task) => task.id).join(", ")}`,
    );
  }

  if (errors.length > 0) {
    console.error(
      `Invalid unit_task_delta:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "unit_task_delta_valid",
        added_task: expectedHeadTask,
      },
      null,
      2,
    ),
  );
}

function validateLedger(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "delivery_gate_ledger");
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

  validateDeliveryGateSemantics(section, errors);

  if (errors.length > 0) {
    console.error(
      `Invalid delivery_gate_ledger:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("delivery_gate_ledger valid");
}

function validateDeliveryGateSemantics(
  section: string,
  errors: string[],
): void {
  const automaticReviewGate = findSection(
    section,
    "automatic_review_feedback_wait",
  );
  const evidence = automaticReviewGate
    ? scalar(automaticReviewGate, "evidence")
    : undefined;
  if (
    evidence &&
    !evidence.match(
      /\b(resolved|no automatic review feedback|none posted|timeout|timed out|unavailable)\b/i,
    )
  ) {
    errors.push(
      "automatic_review_feedback_wait.evidence must show resolved feedback, no posted feedback after timeout, or unavailable review system evidence",
    );
  }
}

function validateLaunchReport(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_subagent_launch");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const launchedReviewers = list(section, "launched_reviewers");
  const skippedReviewers = list(section, "skipped_reviewers");
  const subagentIds = list(section, "subagent_ids");
  const skippedReviewerNames = parseSkippedReviewers(skippedReviewers, errors);
  const subagentIdReviewers = new Set<string>();

  if (status !== "launched") {
    errors.push("reviewer_subagent_launch.status must be launched");
  }

  requireRequiredReviewers(launchedReviewers, errors);
  requireKnownReviewers(launchedReviewers, "launched", errors);
  requireConditionalReviewerAccounting(
    "security-review-agent",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );
  requireConditionalReviewerAccounting(
    "ai-readiness-upkeep-agent",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );

  for (const subagentId of subagentIds) {
    const parsed = subagentId.match(/^([^:]+):\s*(.+)$/);
    if (!parsed) {
      errors.push(
        `subagent id must use '<reviewer>: <returned subagent id>': ${subagentId}`,
      );
      continue;
    }

    const reviewer = parsed[1].trim();
    const id = parsed[2].trim();

    if (!includes(REVIEW_SUBAGENTS, reviewer)) {
      errors.push(`unknown subagent id reviewer: ${reviewer}`);
    }

    if (!id || id.startsWith("<")) {
      errors.push(`${reviewer} subagent id is required`);
    }

    subagentIdReviewers.add(reviewer);
  }

  for (const reviewer of launchedReviewers) {
    if (!subagentIdReviewers.has(reviewer)) {
      errors.push(`missing subagent id for launched reviewer: ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid reviewer_subagent_launch:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("reviewer_subagent_launch valid");
}

function validateReviewReport(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_subagent_report");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const launchedReviewers = list(section, "launched_reviewers");
  const skippedReviewers = list(section, "skipped_reviewers");
  const outcomes = list(section, "outcomes");
  const outcomeReviewers = new Set<string>();
  const skippedReviewerNames = parseSkippedReviewers(skippedReviewers, errors);

  if (status !== "complete") {
    errors.push("reviewer_subagent_report.status must be complete");
  }

  requireRequiredReviewers(launchedReviewers, errors);
  requireKnownReviewers(launchedReviewers, "launched", errors);
  requireConditionalReviewerAccounting(
    "security-review-agent",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );
  requireConditionalReviewerAccounting(
    "ai-readiness-upkeep-agent",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );

  if (outcomes.length === 0) {
    errors.push("outcomes must include each launched reviewer");
  }

  for (const outcome of outcomes) {
    const parsed = outcome.match(/^([^:]+):\s*([a-z_]+)\b\s*-\s*(.+)$/);
    if (!parsed) {
      errors.push(
        `outcome must use '<reviewer>: <status> - <evidence>': ${outcome}`,
      );
      continue;
    }

    const reviewer = parsed[1].trim();
    const outcomeStatus = parsed[2].trim();
    const evidence = parsed[3].trim();

    if (!includes(REVIEW_SUBAGENTS, reviewer)) {
      errors.push(`unknown outcome reviewer: ${reviewer}`);
    }

    if (!includes(REVIEW_OUTCOME_STATUSES, outcomeStatus)) {
      errors.push(
        `${reviewer} outcome must be one of: ${REVIEW_OUTCOME_STATUSES.join(", ")}`,
      );
    }

    if (outcomeStatus === "findings" || outcomeStatus === "blocked") {
      errors.push(
        `${reviewer} outcome must be reconciled before final report: ${outcomeStatus}`,
      );
    }

    if (
      includes(MUST_PASS_REVIEW_SUBAGENTS, reviewer) &&
      outcomeStatus !== "passed"
    ) {
      errors.push(`${reviewer} outcome must be passed`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${reviewer} outcome evidence is required`);
    }

    if (
      reviewer === "ai-readiness-upkeep-agent" &&
      !evidence.match(
        /validate-report|validated ai_readiness_upkeep_report|ai_readiness_upkeep_report valid/i,
      )
    ) {
      errors.push(
        "ai-readiness-upkeep-agent outcome evidence must mention validate-report or a validated ai_readiness_upkeep_report",
      );
    }

    outcomeReviewers.add(reviewer);
  }

  for (const reviewer of launchedReviewers) {
    if (!outcomeReviewers.has(reviewer)) {
      errors.push(`missing outcome for launched reviewer: ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid reviewer_subagent_report:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("reviewer_subagent_report valid");
}

function requireRequiredReviewers(
  launchedReviewers: string[],
  errors: string[],
): void {
  for (const reviewer of REQUIRED_REVIEW_SUBAGENTS) {
    if (!launchedReviewers.includes(reviewer)) {
      errors.push(
        `launched_reviewers must include required reviewer: ${reviewer}`,
      );
    }
  }
}

function requireKnownReviewers(
  reviewers: string[],
  label: string,
  errors: string[],
): void {
  for (const reviewer of reviewers) {
    if (!includes(REVIEW_SUBAGENTS, reviewer)) {
      errors.push(`unknown ${label} reviewer: ${reviewer}`);
    }
  }
}

function requireConditionalReviewerAccounting(
  reviewer: (typeof REVIEW_SUBAGENTS)[number],
  launchedReviewers: string[],
  skippedReviewerNames: Set<string>,
  errors: string[],
): void {
  if (
    !launchedReviewers.includes(reviewer) &&
    !skippedReviewerNames.has(reviewer)
  ) {
    errors.push(
      `${reviewer} must be launched or listed under skipped_reviewers with not_applicable evidence`,
    );
  }
}

function parseSkippedReviewers(
  skippedReviewers: string[],
  errors: string[],
): Set<string> {
  const skippedReviewerNames = new Set<string>();

  for (const skippedReviewer of skippedReviewers) {
    const parsed = skippedReviewer.match(
      /^([^:]+):\s*not_applicable\b\s*-\s*(.+)$/,
    );
    if (!parsed) {
      errors.push(
        `skipped reviewer must use '<reviewer>: not_applicable - <evidence>': ${skippedReviewer}`,
      );
      continue;
    }

    const reviewer = parsed[1].trim();
    const evidence = parsed[2].trim();

    if (!includes(REVIEW_SUBAGENTS, reviewer)) {
      errors.push(`unknown skipped reviewer: ${reviewer}`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${reviewer} skipped evidence is required`);
    }

    skippedReviewerNames.add(reviewer);
  }

  return skippedReviewerNames;
}

function parseHandoff(input: string): ParsedHandoff {
  const body = extractYaml(input);
  const section = findSection(body, "plan_delivery_handoff") ?? "";
  const artifact = findSection(section, "artifact") ?? "";
  const approvedUnit = findSection(section, "approved_unit") ?? "";
  const constraints = findSection(section, "constraints") ?? "";
  const delivery = findSection(section, "delivery") ?? "";
  const review = findSection(section, "review") ?? "";

  return {
    status: scalar(section, "status"),
    route: scalar(section, "route"),
    artifact_type: scalar(artifact, "type"),
    artifact_ref: scalar(artifact, "ref"),
    artifact_fingerprint: scalar(artifact, "fingerprint"),
    approved_unit_id: scalar(approvedUnit, "id"),
    approved_unit_title: scalar(approvedUnit, "title"),
    approved_unit_scope: scalar(approvedUnit, "scope"),
    acceptance: list(approvedUnit, "acceptance"),
    verification: list(approvedUnit, "verification"),
    files_or_areas: list(constraints, "files_or_areas"),
    expected_host: scalar(delivery, "expected_host"),
    completion_updates: list(delivery, "completion_updates"),
    required_reviewers: list(review, "required_reviewers"),
    optional_reviewers: list(review, "optional_reviewers"),
    blockers: list(section, "blockers"),
  };
}

function legacyErrors(input: string): string[] {
  const body = extractYaml(input);
  const errors: string[] = [];
  for (const legacy of [
    "slice_plan_review",
    "plan_coordinate_handoff",
    "plan_ready_handoff",
    "plan_followthrough_slice_handoff",
    "plan_followthrough_ledger",
  ]) {
    if (new RegExp(`^\\s*${escapeRegExp(legacy)}:\\s*$`, "m").test(body)) {
      errors.push(`${legacy} is legacy; rerun plan-ready`);
    }
  }
  if (/^\s*reviewed_slices:\s*/m.test(body)) {
    errors.push("reviewed_slices is legacy; rerun plan-ready");
  }
  return errors;
}

function extractYaml(input: string): string {
  const fenced = input.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
  return (fenced?.[1] ?? input).trim();
}

function extractSection(input: string, sectionName: string): string {
  return findSection(input, sectionName) ?? input;
}

function findSection(input: string, sectionName: string): string | null {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return null;
  }

  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
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
  if (!match) {
    return undefined;
  }

  return cleanScalar(match[1]);
}

function list(input: string, key: string): string[] {
  const inline = input.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"),
  );
  if (inline) {
    const raw = inline[1].trim();
    return raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
  }

  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return [];
  }

  const values: string[] = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (!line.startsWith("  ")) {
      break;
    }

    const item = line.trim().match(/^- (.+)$/);
    if (item) {
      values.push(cleanScalar(item[1]));
    }
  }

  return values.filter(Boolean);
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

function requiredArg(args: string[], flag: string): string {
  const index = args.indexOf(flag);
  if (index === -1) {
    fail(`validate-task-delta requires ${flag}`);
  }
  const value = args[index + 1];
  if (!value) {
    fail(`${flag} requires a value`);
  }
  return value;
}

function requireValue(
  value: string | undefined,
  key: string,
  errors: string[],
): void {
  if (!value || value.startsWith("<")) {
    errors.push(`${key} is required`);
  }
}

function isKnownReviewer(reviewer: string): boolean {
  return (
    includes(BASELINE_REVIEWERS, reviewer) ||
    includes(OPTIONAL_REVIEWERS, reviewer)
  );
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value as T[number]);
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "validate-handoff",
    "reviewer-template",
    "validate-launch-report",
    "validate-review-report",
    "refactoring-template",
    "gate-template",
    "validate-ledger",
    "validate-task-delta",
  ].includes(command ?? "");
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
