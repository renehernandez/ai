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
} from "./lib/planning-contracts.ts";
import { artifactHostHintFromRemoteText } from "./lib/stack-state.ts";
import {
  firstUncheckedDeliverable,
  firstUncheckedDeliveryUnit,
  parseDeliveryUnits,
  validateDeliveryUnits,
} from "../../openspec-tasks/scripts/openspec-tasks.ts";

const ROUTES = ["atomic_plan", "openspec_task"] as const;
const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const EXPECTED_HOSTS = ["github_pr", "gitlab_mr"] as const;
const CALLERS = ["direct", "plan_orchestrator"] as const;
const DELIVERY_GOALS = [
  "next_task",
  "complete_change",
  "bounded_sequence",
] as const;
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
type Caller = (typeof CALLERS)[number];
type DeliveryGoal = (typeof DELIVERY_GOALS)[number];

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-unit-sequencer.ts <detect|planning-review-template|validate-planning-review|handoff-template|validate-handoff|select-next-task> [--file path|tasks.md] [--caller direct|plan_orchestrator] [--goal next_task|complete_change|bounded_sequence]",
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
    selectNextTask(args);
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
        artifact_host_hint: artifactHostHintFromRemoteText(remoteText),
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
    expected_host: github_pr | gitlab_mr
    stack_identity:
      expected_base_ref: <planning PR or MR branch/ref>
      expected_base_sha: <planning artifact head sha>
      predecessor_artifact: <planning PR or MR URL>
      selected_task_base_sha: <stack tip sha used to select this unit>
      restack_required: false
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
- Mode: stacked delivery from the reviewed planning PR or MR head.
- Next action: validate this handoff, then emit exactly one plan_delivery_handoff.

\`\`\`yaml
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
  task_state_fingerprint: <sha256 of reviewed task state>
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning PR or MR latest-head feedback completed with no unresolved actionable findings
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
  requireValue(
    handoff.expectedBaseRef,
    "delivery.stack_identity.expected_base_ref",
    errors,
  );
  requireValue(
    handoff.expectedBaseSha,
    "delivery.stack_identity.expected_base_sha",
    errors,
  );
  requireValue(
    handoff.predecessorArtifact,
    "delivery.stack_identity.predecessor_artifact",
    errors,
  );
  requireValue(
    handoff.selectedTaskBaseSha,
    "delivery.stack_identity.selected_task_base_sha",
    errors,
  );
  requireValue(
    handoff.restackRequired,
    "delivery.stack_identity.restack_required",
    errors,
  );

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
  if (
    handoff.restackRequired &&
    !["true", "false"].includes(handoff.restackRequired)
  ) {
    errors.push(
      "delivery.stack_identity.restack_required must be true or false",
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

function selectNextTask(args: string[]): void {
  const options = parseSelectOptions(args);
  const path = options.path;
  if (!path) {
    fail("select-next-task requires tasks.md path");
  }

  const deliveryUnits = parseDeliveryUnits(readFileSync(path, "utf8"));
  const tasks = deliveryUnits.flatMap((unit) => unit.work_items);
  const errors = validateDeliveryUnits(deliveryUnits);
  if (errors.length > 0) {
    console.error(
      `Invalid openspec_tasks:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  const task = firstUncheckedDeliverable(tasks);
  const deliveryUnit = firstUncheckedDeliveryUnit(deliveryUnits);
  const effectiveGoal =
    options.caller === "plan_orchestrator" ? "complete_change" : options.goal;
  const completionTarget =
    effectiveGoal === "next_task" ? "one_task" : "all_deliverable_tasks";

  if (!task) {
    console.log(
      JSON.stringify(
        {
          status:
            effectiveGoal === "next_task" ? "complete" : "openspec_complete",
          caller: options.caller,
          delivery_goal: effectiveGoal,
          completion_target: completionTarget,
          next_delivery_unit: null,
          next_task: null,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        status: "ready",
        caller: options.caller,
        delivery_goal: effectiveGoal,
        completion_target: completionTarget,
        next_delivery_unit: deliveryUnit,
        next_task: task,
      },
      null,
      2,
    ),
  );
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
  expectedBaseRef?: string;
  expectedBaseSha?: string;
  predecessorArtifact?: string;
  selectedTaskBaseSha?: string;
  restackRequired?: string;
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
  const stackIdentity = extractSection(delivery, "stack_identity");
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
    expectedBaseRef: scalar(stackIdentity, "expected_base_ref"),
    expectedBaseSha: scalar(stackIdentity, "expected_base_sha"),
    predecessorArtifact: scalar(stackIdentity, "predecessor_artifact"),
    selectedTaskBaseSha: scalar(stackIdentity, "selected_task_base_sha"),
    restackRequired: scalar(stackIdentity, "restack_required"),
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

function parseSelectOptions(args: string[]): {
  caller: Caller;
  goal: DeliveryGoal;
  path?: string;
} {
  let caller: Caller = "direct";
  let goal: DeliveryGoal = "next_task";
  let path: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--caller") {
      caller = parseOptionValue(args[index + 1], CALLERS, "--caller");
      index += 1;
      continue;
    }
    if (arg === "--goal") {
      goal = parseOptionValue(args[index + 1], DELIVERY_GOALS, "--goal");
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      fail(`unknown select-next-task option: ${arg}`);
    }
    if (path) {
      fail("select-next-task accepts exactly one tasks.md path");
    }
    path = arg;
  }

  return { caller, goal, path };
}

function parseOptionValue<const T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  flag: string,
): T[number] {
  if (!value) {
    fail(`${flag} requires a value`);
  }
  if (!includes(allowed, value)) {
    fail(`${flag} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

main();
