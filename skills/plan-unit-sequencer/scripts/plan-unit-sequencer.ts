#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractSection,
  extractYaml,
  fail,
  includes,
  legacyPlanContractErrors,
  list,
  readInput,
  requireValue,
  scalar,
  validatePlanningReviewContract,
} from "../../../scripts/planning-contracts.ts";
import {
  firstUncheckedDeliverable,
  parseTasks,
  validateTasks,
} from "../../openspec-tasks/scripts/openspec-tasks.ts";

const ROUTES = ["atomic_plan", "openspec_task"] as const;
const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const EXPECTED_HOSTS = ["github_pr", "gitlab_mr", "direct_publish"] as const;
const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
  "refactoring-opportunities",
] as const;
type Command =
  | "detect"
  | "planning-review-template"
  | "validate-planning-review"
  | "handoff-template"
  | "validate-handoff"
  | "select-next-task";

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-unit-sequencer.ts <detect|planning-review-template|validate-planning-review|handoff-template|validate-handoff|select-next-task> [--file path|tasks.md]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "handoff-template") {
    printHandoffTemplate();
    return;
  }

  if (command === "planning-review-template") {
    printPlanningReviewTemplate();
    return;
  }

  if (command === "select-next-task") {
    selectNextTask(args[0]);
    return;
  }

  const input = readInput(args);
  if (command === "validate-planning-review") {
    validatePlanningReview(input);
    return;
  }

  validateHandoff(input);
}

function detect(): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const remoteText = remotes.toLowerCase();

  console.log(
    JSON.stringify(
      {
        repo_root: repoRoot,
        branch,
        head_sha: headSha,
        remotes: remotes.split("\n").filter(Boolean),
        artifact_host_hint:
          remoteText.includes("gitlab") ||
          remoteText.includes("git.fullscript.io")
            ? "gitlab"
            : remoteText.includes("github")
              ? "github"
              : null,
        openspec_present: existsSync(join(repoRoot, "openspec")),
      },
      null,
      2,
    ),
  );
}

function printHandoffTemplate(): void {
  console.log(`## Readable Summary

- Status: ready for one selected OpenSpec task.
- Route: OpenSpec task.
- Artifact: openspec/changes/example-change.
- Selected task: 1.1.
- Delivery: mark only that task complete in one separate implementation PR/MR.

\`\`\`yaml
plan_delivery_handoff:
  status: ready
  route: openspec_task
  artifact:
    type: openspec
    ref: openspec/changes/example-change
    fingerprint: <target commit sha>
  approved_unit:
    id: "1.1"
    title: <OpenSpec task title>
    scope: <one paragraph>
    acceptance:
      - <observable result>
    verification:
      - <required command, check, or manual proof>
  constraints:
    files_or_areas:
      - <expected ownership area>
    out_of_scope:
      - <explicit non-goal>
  delivery:
    expected_host: github_pr | gitlab_mr | direct_publish
    completion_updates:
      - Mark OpenSpec task checkbox complete in one separate implementation PR/MR.
  review:
    required_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    optional_reviewers: []
  blockers: []
\`\`\`
`);
}

function printPlanningReviewTemplate(): void {
  console.log(`## Readable Summary

- Status: reviewed planning is required before selecting implementation units.
- Artifact: openspec/changes/example-change.
- Mode: ship then continue after the planning PR or MR merges.
- Next action: validate this handoff, then emit exactly one plan_delivery_handoff.

\`\`\`yaml
planning_review:
  status: reviewed
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_artifact: <planning PR or MR URL>
  mode: ship_then_continue
  gate_outcome: approved
  target_branch: main
  target_base_sha: <target branch sha reviewed by planning artifact>
  planning_branch: <planning branch name>
  reviewed_head: <planning artifact head sha>
  stack_base_ref:
  stack_base_evidence:
  task_state_fingerprint: <sha256 of reviewed task state>
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning PR or MR merged after feedback was addressed
  blockers: []
\`\`\`
`);
}

function validatePlanningReview(input: string): void {
  const errors = legacyPlanContractErrors(input);
  validatePlanningReviewContract(input, errors);

  if (errors.length > 0) {
    console.error(
      `Invalid planning_review:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("planning_review valid");
}

function validateHandoff(input: string): void {
  const errors = legacyErrors(input);
  const handoff = parseHandoff(input);

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.route, "route", errors);
  requireValue(handoff.artifactType, "artifact.type", errors);
  requireValue(handoff.artifactRef, "artifact.ref", errors);
  requireValue(handoff.artifactFingerprint, "artifact.fingerprint", errors);
  requireValue(handoff.unitId, "approved_unit.id", errors);
  requireValue(handoff.unitTitle, "approved_unit.title", errors);
  requireValue(handoff.unitScope, "approved_unit.scope", errors);
  requireValue(handoff.expectedHost, "delivery.expected_host", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }
  if (handoff.route && !includes(ROUTES, handoff.route)) {
    errors.push(`route must be one of: ${ROUTES.join(", ")}`);
  }
  if (handoff.artifactType && !includes(ARTIFACT_TYPES, handoff.artifactType)) {
    errors.push(`artifact.type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }
  if (handoff.expectedHost && !includes(EXPECTED_HOSTS, handoff.expectedHost)) {
    errors.push(
      `delivery.expected_host must be one of: ${EXPECTED_HOSTS.join(", ")}`,
    );
  }
  if (handoff.acceptance.length === 0) {
    errors.push("approved_unit.acceptance must include at least one item");
  }
  if (handoff.verification.length === 0) {
    errors.push("approved_unit.verification must include at least one item");
  }
  if (handoff.filesOrAreas.length === 0) {
    errors.push("constraints.files_or_areas must include at least one item");
  }
  for (const reviewer of BASELINE_REVIEWERS) {
    if (!handoff.requiredReviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }
  if (handoff.blockers.length > 0) {
    errors.push("blockers must be empty before status ready");
  }
  if (handoff.route === "atomic_plan" && handoff.unitId !== "atomic") {
    errors.push("atomic_plan route requires approved_unit.id atomic");
  }
  if (handoff.route === "openspec_task") {
    if (handoff.artifactType !== "openspec") {
      errors.push("openspec_task route requires artifact.type openspec");
    }
    if (handoff.completionUpdates.length === 0) {
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

function selectNextTask(path: string | undefined): void {
  if (!path) {
    fail("select-next-task requires tasks.md path");
  }

  const tasks = parseTasks(readFileSync(path, "utf8"));
  const errors = validateTasks(tasks);
  if (errors.length > 0) {
    console.error(
      `Invalid openspec_tasks:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  const task = firstUncheckedDeliverable(tasks);
  if (!task) {
    console.log(
      JSON.stringify({ status: "complete", next_task: null }, null, 2),
    );
    return;
  }

  console.log(JSON.stringify({ status: "ready", next_task: task }, null, 2));
}

function parseHandoff(input: string): {
  status?: string;
  route?: string;
  artifactType?: string;
  artifactRef?: string;
  artifactFingerprint?: string;
  unitId?: string;
  unitTitle?: string;
  unitScope?: string;
  acceptance: string[];
  verification: string[];
  filesOrAreas: string[];
  expectedHost?: string;
  completionUpdates: string[];
  requiredReviewers: string[];
  blockers: string[];
} {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_delivery_handoff");
  const artifact = extractSection(section, "artifact");
  const unit = extractSection(section, "approved_unit");
  const constraints = extractSection(section, "constraints");
  const delivery = extractSection(section, "delivery");
  const review = extractSection(section, "review");

  return {
    status: scalar(section, "status"),
    route: scalar(section, "route"),
    artifactType: scalar(artifact, "type"),
    artifactRef: scalar(artifact, "ref"),
    artifactFingerprint: scalar(artifact, "fingerprint"),
    unitId: scalar(unit, "id"),
    unitTitle: scalar(unit, "title"),
    unitScope: scalar(unit, "scope"),
    acceptance: list(unit, "acceptance"),
    verification: list(unit, "verification"),
    filesOrAreas: list(constraints, "files_or_areas"),
    expectedHost: scalar(delivery, "expected_host"),
    completionUpdates: list(delivery, "completion_updates"),
    requiredReviewers: list(review, "required_reviewers"),
    blockers: list(section, "blockers"),
  };
}

const legacyErrors = legacyPlanContractErrors;

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "planning-review-template",
    "validate-planning-review",
    "handoff-template",
    "validate-handoff",
    "select-next-task",
  ].includes(command ?? "");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

main();
