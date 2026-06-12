#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
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
  "implementation",
  "local_verification",
  "reviewer_subagents",
  "implementation_review",
  "implementation_scrutiny",
  "code_quality_review",
  "code_simplifier",
  "deslop",
  "security_review",
  "docs_alignment",
  "review_feedback_routing",
  "artifact_creation_update",
  "artifact_host_review",
  "review_feedback",
  "ci",
] as const;

const LEDGER_NOT_APPLICABLE_GATES = [
  "code_simplifier",
  "deslop",
  "security_review",
  "docs_alignment",
] as const;

const LEDGER_STATUSES = ["passed", "blocked", "not_applicable"] as const;
const REVIEW_OUTCOME_STATUSES = ["passed", "findings", "blocked", "not_applicable"] as const;

type Command =
  | "detect"
  | "validate-handoff"
  | "reviewer-template"
  | "validate-launch-report"
  | "validate-review-report"
  | "gate-template"
  | "validate-ledger";

type ParsedHandoff = {
  status?: string;
  artifact_type?: string;
  artifact_ref?: string;
  approved_slice?: string;
  required_reviewers: string[];
  optional_reviewers_selected: string[];
  unresolved_blockers: string[];
  scrutiny_verdict?: string;
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-to-pr.ts <detect|validate-handoff|reviewer-template|validate-launch-report|validate-review-report|gate-template|validate-ledger> [--file path]",
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
    artifact_host_hint: remoteText.includes("gitlab") || remoteText.includes("git.fullscript.io")
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
  - Do not use the dispatch skill, Claude Code Task, or external Claude harness for Codex plan-to-pr reviewers.
  - Omit model overrides unless the user explicitly asks for one.
  - Print and validate reviewer_subagent_launch immediately after spawning reviewers and before waiting for outcomes.
  - Validate reviewer_subagent_report before PR/MR creation or final delivery.
`);
}

function validateHandoff(input: string): void {
  const handoff = parseHandoff(input);
  const errors: string[] = [];

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.artifact_type, "artifact_type", errors);
  requireValue(handoff.artifact_ref, "artifact_ref", errors);
  requireValue(handoff.approved_slice, "approved_slice", errors);
  requireValue(handoff.scrutiny_verdict, "scrutiny_verdict", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }

  if (handoff.artifact_type && !includes(ARTIFACT_TYPES, handoff.artifact_type)) {
    errors.push(`artifact_type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (handoff.scrutiny_verdict && handoff.scrutiny_verdict !== "ship") {
    errors.push("scrutiny_verdict must be ship");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!handoff.required_reviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of [...handoff.required_reviewers, ...handoff.optional_reviewers_selected]) {
    if (!isKnownReviewer(reviewer)) {
      errors.push(`unknown reviewer: ${reviewer}`);
    }
  }

  for (const reviewer of handoff.optional_reviewers_selected) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(`optional_reviewers_selected can include only optional reviewers: ${reviewer}`);
    }
  }

  if (handoff.unresolved_blockers.length > 0) {
    errors.push("unresolved_blockers must be empty before implementation");
  }

  if (errors.length > 0) {
    console.error(`Invalid plan_ready_handoff:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }

  console.log("plan_ready_handoff valid");
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
      errors.push(`${gate}.status must be one of: ${LEDGER_STATUSES.join(", ")}`);
    } else if (status === "not_applicable" && !includes(LEDGER_NOT_APPLICABLE_GATES, gate)) {
      errors.push(`${gate}.status cannot be not_applicable`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${gate}.evidence is required`);
    }
  }

  if (errors.length > 0) {
    console.error(`Invalid delivery_gate_ledger:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }

  console.log("delivery_gate_ledger valid");
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
  requireSecurityAccounting(launchedReviewers, skippedReviewerNames, errors);

  for (const subagentId of subagentIds) {
    const parsed = subagentId.match(/^([^:]+):\s*(.+)$/);
    if (!parsed) {
      errors.push(`subagent id must use '<reviewer>: <returned subagent id>': ${subagentId}`);
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
    console.error(`Invalid reviewer_subagent_launch:\n${errors.map((error) => `- ${error}`).join("\n")}`);
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
  requireSecurityAccounting(launchedReviewers, skippedReviewerNames, errors);

  if (outcomes.length === 0) {
    errors.push("outcomes must include each launched reviewer");
  }

  for (const outcome of outcomes) {
    const parsed = outcome.match(/^([^:]+):\s*([a-z_]+)\b\s*-\s*(.+)$/);
    if (!parsed) {
      errors.push(`outcome must use '<reviewer>: <status> - <evidence>': ${outcome}`);
      continue;
    }

    const reviewer = parsed[1].trim();
    const outcomeStatus = parsed[2].trim();
    const evidence = parsed[3].trim();

    if (!includes(REVIEW_SUBAGENTS, reviewer)) {
      errors.push(`unknown outcome reviewer: ${reviewer}`);
    }

    if (!includes(REVIEW_OUTCOME_STATUSES, outcomeStatus)) {
      errors.push(`${reviewer} outcome must be one of: ${REVIEW_OUTCOME_STATUSES.join(", ")}`);
    }

    if (outcomeStatus === "findings" || outcomeStatus === "blocked") {
      errors.push(`${reviewer} outcome must be reconciled before final report: ${outcomeStatus}`);
    }

    if (includes(MUST_PASS_REVIEW_SUBAGENTS, reviewer) && outcomeStatus !== "passed") {
      errors.push(`${reviewer} outcome must be passed`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${reviewer} outcome evidence is required`);
    }

    outcomeReviewers.add(reviewer);
  }

  for (const reviewer of launchedReviewers) {
    if (!outcomeReviewers.has(reviewer)) {
      errors.push(`missing outcome for launched reviewer: ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Invalid reviewer_subagent_report:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }

  console.log("reviewer_subagent_report valid");
}

function requireRequiredReviewers(launchedReviewers: string[], errors: string[]): void {
  for (const reviewer of REQUIRED_REVIEW_SUBAGENTS) {
    if (!launchedReviewers.includes(reviewer)) {
      errors.push(`launched_reviewers must include required reviewer: ${reviewer}`);
    }
  }
}

function requireKnownReviewers(reviewers: string[], label: string, errors: string[]): void {
  for (const reviewer of reviewers) {
    if (!includes(REVIEW_SUBAGENTS, reviewer)) {
      errors.push(`unknown ${label} reviewer: ${reviewer}`);
    }
  }
}

function requireSecurityAccounting(
  launchedReviewers: string[],
  skippedReviewerNames: Set<string>,
  errors: string[],
): void {
  if (!launchedReviewers.includes("security-review-agent") && !skippedReviewerNames.has("security-review-agent")) {
    errors.push("security-review-agent must be launched or listed under skipped_reviewers with not_applicable evidence");
  }
}

function parseSkippedReviewers(skippedReviewers: string[], errors: string[]): Set<string> {
  const skippedReviewerNames = new Set<string>();

  for (const skippedReviewer of skippedReviewers) {
    const parsed = skippedReviewer.match(/^([^:]+):\s*not_applicable\b\s*-\s*(.+)$/);
    if (!parsed) {
      errors.push(`skipped reviewer must use '<reviewer>: not_applicable - <evidence>': ${skippedReviewer}`);
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
  const section = extractSection(body, "plan_ready_handoff");

  return {
    status: scalar(section, "status"),
    artifact_type: scalar(section, "artifact_type"),
    artifact_ref: scalar(section, "artifact_ref"),
    approved_slice: scalar(section, "approved_slice"),
    required_reviewers: list(section, "required_reviewers"),
    optional_reviewers_selected: list(section, "optional_reviewers_selected"),
    unresolved_blockers: list(section, "unresolved_blockers"),
    scrutiny_verdict: scalar(section, "scrutiny_verdict"),
  };
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

function scalar(input: string, key: string): string | undefined {
  const match = input.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"));
  if (!match) {
    return undefined;
  }

  return cleanScalar(match[1]);
}

function list(input: string, key: string): string[] {
  const inline = input.match(new RegExp(`^${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"));
  if (inline) {
    const raw = inline[1].trim();
    return raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
  }

  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => line.match(new RegExp(`^${escapeRegExp(key)}:\\s*$`)));
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

function requireValue(value: string | undefined, key: string, errors: string[]): void {
  if (!value || value.startsWith("<")) {
    errors.push(`${key} is required`);
  }
}

function isKnownReviewer(reviewer: string): boolean {
  return includes(BASELINE_REVIEWERS, reviewer) || includes(OPTIONAL_REVIEWERS, reviewer);
}

function includes<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "validate-handoff",
    "reviewer-template",
    "validate-launch-report",
    "validate-review-report",
    "gate-template",
    "validate-ledger",
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
