#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  extractSection,
  extractYaml,
  fail,
  legacyPlanContractErrors,
  list,
  readInput,
  requireValue,
  scalar,
  validatePlanningReviewContract,
} from "../../../scripts/planning-contracts.ts";

type Command =
  | "detect"
  | "plan-review-request-template"
  | "validate-planning-review"
  | "validate-openspec-change"
  | "resume-template"
  | "validate-resume"
  | "stack-ready-template"
  | "validate-stack-ready";

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-orchestrator.ts <detect|plan-review-request-template|validate-planning-review|validate-openspec-change|resume-template|validate-resume|stack-ready-template|validate-stack-ready> [--file path|change-id]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "plan-review-request-template") {
    printPlanReviewRequestTemplate();
    return;
  }

  if (command === "resume-template") {
    printResumeTemplate();
    return;
  }

  if (command === "stack-ready-template") {
    printStackReadyTemplate();
    return;
  }

  if (command === "validate-planning-review") {
    validatePlanningReview(readInput(args));
    return;
  }

  if (command === "validate-resume") {
    validateResume(readInput(args));
    return;
  }

  if (command === "validate-stack-ready") {
    validateStackReady(readInput(args));
    return;
  }

  validateOpenSpecChange(args[0]);
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
        plans_dir_present: existsSync(join(repoRoot, ".agents", "plans")),
        openspec_present: existsSync(join(repoRoot, "openspec")),
      },
      null,
      2,
    ),
  );
}

function printPlanReviewRequestTemplate(): void {
  console.log(`## Readable Summary

- Status: ready to publish planning-only hosted review.
- Artifact: openspec/changes/example-change.
- Review goal: validate planning before implementation.
- Next action: run plan-review and wait for planning_review.

\`\`\`yaml
plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - nitro
    - developers
  unresolved_blockers: []
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

function printResumeTemplate(): void {
  console.log(`## Readable Summary

- Status: existing planning and stack state inspected.
- Intake: ready plan, OpenSpec blueprint, existing OpenSpec, or continue/resume.
- Stack: planning MR, implementation order, current tip, Nitro states, task state, and restack need recorded.
- Next action: continue the current blocked gate or select the next implementation unit from stack-tip state.

\`\`\`yaml
orchestrator_resume:
  status: inspected
  intake: ready_plan | openspec_blueprint | existing_openspec | continue_resume
  planning_artifact: <plan file or OpenSpec change>
  planning_review_state: reviewed | missing | blocked
  planning_artifact_ref: <planning MR URL or branch>
  current_stack_tip: <MR URL or branch>
  task_state_fingerprint: <sha256 of stack-tip task state>
  implementation_stack:
    - artifact: <planning or implementation MR URL>
      role: planning | implementation
      head_sha: <latest head sha>
      nitro_gate_outcome: passed | blocked | pending
  restack_required: false
  restack_evidence:
    - <evidence no earlier MR changed after descendants>
  blockers: []
\`\`\`
`);
}

function printStackReadyTemplate(): void {
  console.log(`## Readable Summary

- Status: full reviewed stack is ready.
- Stack: planning MR and every implementation MR have latest-head Nitro gates passed.
- Integrity: base/head relationships and task state are valid.
- Next action: hand off to merge follow-through.

\`\`\`yaml
stack_ready:
  status: ready
  planning_artifact: <plan file or OpenSpec change>
  target_branch: main
  stack_tip: <latest implementation MR URL or branch>
  task_state:
    all_deliverable_tasks_checked: true
    fingerprint: <sha256 of stack-tip task state>
  stack:
    - artifact: <planning MR URL>
      role: planning
      base_sha: <target base sha>
      head_sha: <planning head sha>
      nitro_gate_outcome: passed
    - artifact: <implementation MR URL>
      role: implementation
      base_sha: <predecessor head sha>
      head_sha: <implementation head sha>
      nitro_gate_outcome: passed
  restack_required: false
  integrity_evidence:
    - <stack order and base/head evidence>
  blockers: []
\`\`\`
`);
}

function validateResume(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "orchestrator_resume");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const intake = scalar(section, "intake");
  const planningReviewState = scalar(section, "planning_review_state");
  const restackRequired = scalar(section, "restack_required");
  const stackArtifacts = allScalars(section, "artifact");
  const nitroStates = allScalars(section, "nitro_gate_outcome");
  const restackEvidence = list(section, "restack_evidence");
  const blockers = list(section, "blockers");

  requireValue(status, "orchestrator_resume.status", errors);
  requireValue(intake, "orchestrator_resume.intake", errors);
  requireValue(
    scalar(section, "planning_artifact"),
    "orchestrator_resume.planning_artifact",
    errors,
  );
  requireValue(
    planningReviewState,
    "orchestrator_resume.planning_review_state",
    errors,
  );
  requireValue(
    scalar(section, "current_stack_tip"),
    "orchestrator_resume.current_stack_tip",
    errors,
  );
  requireValue(restackRequired, "orchestrator_resume.restack_required", errors);

  if (status && status !== "inspected") {
    errors.push("orchestrator_resume.status must be inspected");
  }
  if (
    intake &&
    ![
      "ready_plan",
      "openspec_blueprint",
      "existing_openspec",
      "continue_resume",
    ].includes(intake)
  ) {
    errors.push(
      "orchestrator_resume.intake must be one of: ready_plan, openspec_blueprint, existing_openspec, continue_resume",
    );
  }
  if (
    planningReviewState &&
    !["reviewed", "missing", "blocked"].includes(planningReviewState)
  ) {
    errors.push(
      "orchestrator_resume.planning_review_state must be one of: reviewed, missing, blocked",
    );
  }
  if (stackArtifacts.length === 0) {
    errors.push("orchestrator_resume.implementation_stack is required");
  }
  if (
    nitroStates.some(
      (state) => !["passed", "blocked", "pending"].includes(state),
    )
  ) {
    errors.push(
      "orchestrator_resume.implementation_stack nitro_gate_outcome must be passed, blocked, or pending",
    );
  }
  if (restackRequired && !["true", "false"].includes(restackRequired)) {
    errors.push("orchestrator_resume.restack_required must be true or false");
  }
  if (restackEvidence.length === 0) {
    errors.push("orchestrator_resume.restack_evidence is required");
  }
  if (blockers.length > 0 && planningReviewState === "reviewed") {
    errors.push(
      "orchestrator_resume.blockers must be empty when planning is reviewed",
    );
  }

  if (errors.length > 0) {
    console.error(
      `Invalid orchestrator_resume:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("orchestrator_resume valid");
}

function validateStackReady(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "stack_ready");
  const taskState = extractSection(section, "task_state");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const restackRequired = scalar(section, "restack_required");
  const allTasksChecked = scalar(taskState, "all_deliverable_tasks_checked");
  const stackArtifacts = allScalars(section, "artifact");
  const roles = allScalars(section, "role");
  const nitroStates = allScalars(section, "nitro_gate_outcome");
  const integrityEvidence = list(section, "integrity_evidence");
  const blockers = list(section, "blockers");

  requireValue(status, "stack_ready.status", errors);
  requireValue(
    scalar(section, "planning_artifact"),
    "stack_ready.planning_artifact",
    errors,
  );
  requireValue(
    scalar(section, "target_branch"),
    "stack_ready.target_branch",
    errors,
  );
  requireValue(scalar(section, "stack_tip"), "stack_ready.stack_tip", errors);
  requireValue(
    allTasksChecked,
    "stack_ready.task_state.all_deliverable_tasks_checked",
    errors,
  );
  requireValue(
    scalar(taskState, "fingerprint"),
    "stack_ready.task_state.fingerprint",
    errors,
  );
  requireValue(restackRequired, "stack_ready.restack_required", errors);

  if (status && status !== "ready") {
    errors.push("stack_ready.status must be ready");
  }
  if (allTasksChecked !== "true") {
    errors.push(
      "stack_ready.task_state.all_deliverable_tasks_checked must be true",
    );
  }
  if (stackArtifacts.length < 2) {
    errors.push(
      "stack_ready.stack must include planning and implementation artifacts",
    );
  }
  if (!roles.includes("planning") || !roles.includes("implementation")) {
    errors.push(
      "stack_ready.stack must include planning and implementation roles",
    );
  }
  if (nitroStates.some((state) => state !== "passed")) {
    errors.push(
      "stack_ready.stack nitro_gate_outcome must be passed for every artifact",
    );
  }
  if (restackRequired !== "false") {
    errors.push("stack_ready.restack_required must be false");
  }
  if (integrityEvidence.length === 0) {
    errors.push("stack_ready.integrity_evidence is required");
  }
  if (blockers.length > 0) {
    errors.push("stack_ready.blockers must be empty");
  }

  if (errors.length > 0) {
    console.error(
      `Invalid stack_ready:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("stack_ready valid");
}

function validateOpenSpecChange(changeId: string | undefined): void {
  if (!changeId) {
    fail("validate-openspec-change requires a change id");
  }

  const result = spawnSync(
    "openspec",
    ["validate", changeId, "--strict", "--no-interactive"],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  process.stdout.write(result.stdout);
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "plan-review-request-template",
    "validate-planning-review",
    "validate-openspec-change",
    "resume-template",
    "validate-resume",
    "stack-ready-template",
    "validate-stack-ready",
  ].includes(command ?? "");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function allScalars(input: string, key: string): string[] {
  const pattern = new RegExp(`^\\s*(?:-\\s*)?${key}:\\s*(.+?)\\s*$`, "gm");
  return [...input.matchAll(pattern)].map((match) => match[1].trim());
}
