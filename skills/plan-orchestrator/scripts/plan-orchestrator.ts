#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, unlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  extractSection,
  extractYaml,
  fail,
  findSection,
  legacyPlanContractErrors,
  list,
  readInput,
  requireValue,
  scalar,
  validatePlanningReviewContract,
} from "../../../scripts/planning-contracts.ts";
import {
  artifactHostHintFromRemoteText,
  fullscriptGitLabMergeRequestErrors,
  isFullscriptGitLabMergeRequest,
  type TaskArtifactEvidence,
  validateStackTipTaskState,
} from "../../../scripts/stack-state.ts";

type Command =
  | "detect"
  | "plan-review-request-template"
  | "validate-planning-review"
  | "validate-openspec-change"
  | "cleanup-source-plan"
  | "resume-template"
  | "validate-resume"
  | "stack-ready-template"
  | "validate-stack-ready";

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-orchestrator.ts <detect|plan-review-request-template|validate-planning-review|validate-openspec-change|cleanup-source-plan|resume-template|validate-resume|stack-ready-template|validate-stack-ready> [--file path|change-id]",
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

  if (command === "cleanup-source-plan") {
    cleanupSourcePlan(args);
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
        artifact_host_hint: artifactHostHintFromRemoteText(remoteText),
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
- Readiness evidence: copied from the validated plan-ready output.
- Blueprint provenance: recorded when an OpenSpec change was materialized.
- Next action: run plan-review and wait for planning_review.

\`\`\`yaml
plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  hosted_review_routing: <copy review-feedback-routing or plan-review host route>
  requested_reviewers:
    - <copy each hosted-review reviewer required by the selected route>
  readiness_reviewer_evidence:
    artifact_fingerprint: <copy plan-ready review.reviewer_evidence.artifact_fingerprint>
    completed_at: <copy plan-ready review.reviewer_evidence.completed_at>
    gate_outcome: <copy plan-ready review.reviewer_evidence.gate_outcome>
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
    blocking_findings:
      - <copy each plan-ready blocking finding, or [] for ready outputs>
  blueprint_provenance:
    source: openspec_blueprint
    source_plan:
      ref: <openspec_blueprint.source_plan.ref>
      change_id: <openspec_blueprint.source_plan.change_id>
      artifact_fingerprint: <openspec_blueprint.review.reviewer_evidence.artifact_fingerprint>
    generated_change:
      change_id: example-change
      ref: openspec/changes/example-change
      generated_paths:
        - openspec/changes/example-change/proposal.md
        - openspec/changes/example-change/tasks.md
        - openspec/changes/example-change/specs/<spec>/spec.md
    validation_evidence:
      - openspec validate example-change --strict --no-interactive
      - pnpm ax openspec validate
    cleanup_evidence:
      - scripts/plan-orchestrator.ts cleanup-source-plan --source-plan <path> --expected-source-plan <source_plan.ref> --expected-change-id <change-id> --change-id <change-id>
  unresolved_blockers: []
\`\`\`
`);
}

function validatePlanningReview(input: string): void {
  const errors = legacyPlanContractErrors(input);
  const review = validatePlanningReviewContract(input, errors);

  if (
    review.review_artifact &&
    !isFullscriptGitLabMergeRequest(review.review_artifact)
  ) {
    errors.push(
      "delivery_blocked: unsupported stack/review host; Nitro-reviewed stacked delivery requires a Fullscript GitLab merge request review_artifact",
    );
  }

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
  status: resume_ready | delivery_blocked
  intake: ready_plan | openspec_blueprint | existing_openspec | continue_resume
  planning_artifact: <plan file or OpenSpec change>
  planning_review_state: reviewed | missing | blocked
  planning_artifact_ref: <Fullscript GitLab planning MR URL>
  current_stack_tip: <Fullscript GitLab stack-tip MR URL>
  task_state_fingerprint: <sha256 of stack-tip task state>
  task_state:
    fingerprint: <sha256 of stack-tip task state>
    tasks_markdown: |
      ## 1. Implementation

      - [x] 1.1 Delivered task
      - [ ] 1.2 Undelivered future task
  phase_evidence:
    readiness:
      owner: plan-ready
      status: fresh
      artifact_fingerprint: <plan-ready reviewer evidence artifact fingerprint>
      expected_artifact_fingerprint: <current planning artifact fingerprint>
      route_to:
    planning_commit:
      owner: plan-review
      status: fresh
      reviewed_head: <planning MR latest head sha>
      expected_head_sha: <planning stack entry head sha>
      route_to:
    delivery:
      owner: plan-unit-delivery
      status: fresh
      task_state_fingerprint: <delivery evidence task-state fingerprint>
      expected_task_state_fingerprint: <current stack-tip task_state.fingerprint>
      route_to:
  task_artifacts:
    - task_id: "1.1"
      artifact: <implementation MR URL for task 1.1>
  implementation_stack:
    - artifact: <Fullscript GitLab planning or implementation MR URL>
      role: planning | implementation
      head_sha: <latest head sha>
      nitro_gate_outcome: passed | blocked | pending
      predecessor_artifact: <previous stack MR URL or empty for planning>
      task_delta_validated: true | false
      cumulative_task_state_valid: true | false
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
  stack_tip: <Fullscript GitLab latest implementation MR URL>
  task_state:
    fingerprint: <sha256 of stack-tip task state>
    tasks_markdown: |
      ## 1. Implementation

      - [x] 1.1 First deliverable
      - [x] 1.2 Second deliverable
  task_artifacts:
    - task_id: "1.1"
      artifact: <implementation MR URL for task 1.1>
    - task_id: "1.2"
      artifact: <implementation MR URL for task 1.2>
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
  const taskState = extractSection(section, "task_state");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const intake = scalar(section, "intake");
  const planningReviewState = scalar(section, "planning_review_state");
  const planningArtifactRef = scalar(section, "planning_artifact_ref");
  const currentStackTip = scalar(section, "current_stack_tip");
  const restackRequired = scalar(section, "restack_required");
  const tasksMarkdown = blockScalar(taskState, "tasks_markdown");
  const taskArtifacts = taskArtifactEvidence(section);
  const stackArtifacts = allScalars(section, "artifact");
  const roles = allScalars(section, "role");
  const nitroStates = allScalars(section, "nitro_gate_outcome");
  const stackEntries = implementationStackEntries(section);
  const implementationEntries = stackEntries.filter(
    (entry) => entry.role === "implementation",
  );
  const planningEntry = stackEntries.find((entry) => entry.role === "planning");
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
    currentStackTip,
    "orchestrator_resume.current_stack_tip",
    errors,
  );
  requireValue(
    scalar(taskState, "fingerprint"),
    "orchestrator_resume.task_state.fingerprint",
    errors,
  );
  requireValue(restackRequired, "orchestrator_resume.restack_required", errors);
  const unsupportedArtifacts = [
    planningArtifactRef,
    currentStackTip,
    ...stackArtifacts,
  ].filter((artifact) => artifact && !isFullscriptGitLabMergeRequest(artifact));
  if (unsupportedArtifacts.length > 0) {
    errors.push(
      "delivery_blocked: unsupported stack/review host; orchestrator_resume artifacts must be Fullscript GitLab merge requests",
    );
  }

  if (status && !["resume_ready", "delivery_blocked"].includes(status)) {
    errors.push(
      "orchestrator_resume.status must be resume_ready or delivery_blocked",
    );
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
  if (!roles.includes("planning") || !roles.includes("implementation")) {
    errors.push(
      "orchestrator_resume.implementation_stack must include planning and implementation roles",
    );
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
  errors.push(
    ...phaseEvidenceErrors(section, {
      requireFresh: status === "resume_ready",
      planningHeadSha: planningEntry?.headSha,
      taskStateFingerprint:
        scalar(taskState, "fingerprint") ??
        scalar(section, "task_state_fingerprint"),
    }),
  );

  if (status === "resume_ready") {
    if (planningReviewState !== "reviewed") {
      errors.push(
        "orchestrator_resume.planning_review_state must be reviewed when status is resume_ready",
      );
    }
    if (nitroStates.some((state) => state !== "passed")) {
      errors.push(
        "orchestrator_resume.implementation_stack nitro_gate_outcome must be passed before resume_ready",
      );
    }
    if (restackRequired !== "false") {
      errors.push(
        "orchestrator_resume.restack_required must be false before resume_ready",
      );
    }
    if (blockers.length > 0) {
      errors.push(
        "orchestrator_resume.blockers must be empty before resume_ready",
      );
    }
    const missingPredecessorArtifacts = implementationEntries.filter(
      (entry) => !entry.predecessorArtifact,
    );
    if (missingPredecessorArtifacts.length > 0) {
      errors.push(
        "orchestrator_resume.implementation_stack predecessor_artifact evidence is required before resume_ready",
      );
    }
    const invalidTaskDeltaEntries = implementationEntries.filter(
      (entry) => entry.taskDeltaValidated !== "true",
    );
    if (invalidTaskDeltaEntries.length > 0) {
      errors.push(
        "orchestrator_resume.implementation_stack task_delta_validated must be true for every implementation artifact before resume_ready",
      );
    }
    const invalidCumulativeTaskEntries = implementationEntries.filter(
      (entry) => entry.cumulativeTaskStateValid !== "true",
    );
    if (invalidCumulativeTaskEntries.length > 0) {
      errors.push(
        "orchestrator_resume.implementation_stack cumulative_task_state_valid must be true before resume_ready",
      );
    }
    errors.push(
      ...validateStackTipTaskState(tasksMarkdown ?? "", taskArtifacts, {
        context: "orchestrator_resume",
        requireAllDeliverablesChecked: false,
      }),
    );
  } else if (status === "delivery_blocked" && blockers.length === 0) {
    errors.push(
      "orchestrator_resume.blockers must explain why resume is delivery_blocked",
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
  const stackTip = scalar(section, "stack_tip");
  const tasksMarkdown = blockScalar(taskState, "tasks_markdown");
  const taskArtifacts = taskArtifactEvidence(section);
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
  requireValue(stackTip, "stack_ready.stack_tip", errors);
  requireValue(
    scalar(taskState, "fingerprint"),
    "stack_ready.task_state.fingerprint",
    errors,
  );
  requireValue(restackRequired, "stack_ready.restack_required", errors);

  if (status && status !== "ready") {
    errors.push("stack_ready.status must be ready");
  }
  if (allTasksChecked !== undefined) {
    errors.push(
      "stack_ready.task_state.all_deliverable_tasks_checked is self-attested; provide tasks_markdown instead",
    );
  }
  errors.push(...validateStackTipTaskState(tasksMarkdown ?? "", taskArtifacts));
  if (stackArtifacts.length < 2) {
    errors.push(
      "stack_ready.stack must include planning and implementation artifacts",
    );
  }
  errors.push(
    ...fullscriptGitLabMergeRequestErrors(
      [stackTip, ...stackArtifacts],
      "delivery_blocked: unsupported stack/review host; stack_ready.stack artifacts must be Fullscript GitLab merge requests",
    ),
  );
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

function cleanupSourcePlan(args: string[]): void {
  const sourcePlan = requiredArg(args, "--source-plan");
  const expectedSourcePlan = requiredArg(args, "--expected-source-plan");
  const changeId = requiredArg(args, "--change-id");
  const expectedChangeId = requiredArg(args, "--expected-change-id");
  const targetBase = optionalArg(args, "--target-base") ?? "HEAD";
  const skipRepoValidation = args.includes("--skip-repo-openspec-validation");
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const runRepoValidation =
    !skipRepoValidation && repoOpenSpecValidationAvailable(repoRoot);
  const source = normalizeAgentsPlanPath(repoRoot, sourcePlan, "--source-plan");
  const expected = normalizeAgentsPlanPath(
    repoRoot,
    expectedSourcePlan,
    "--expected-source-plan",
  );

  if (expectedChangeId !== changeId) {
    fail(
      "source_plan_context_mismatch: expected source plan context must match --change-id",
    );
  }

  if (source.relativePath !== expected.relativePath) {
    fail(
      "source_plan_context_mismatch: --source-plan must match --expected-source-plan",
    );
  }

  if (
    existsInRef("HEAD", source.relativePath) ||
    existsInRef(targetBase, source.relativePath)
  ) {
    fail(
      "source_plan_committed: source plan is already committed; repair the planning branch instead of publishing a deletion-only OpenSpec diff",
    );
  }

  if (!existsSync(source.absolutePath)) {
    fail("source_plan_missing: source plan must exist before cleanup");
  }

  validateOpenSpecChange(changeId);

  if (runRepoValidation) {
    const result = spawnSync("pnpm", ["ax", "openspec", "validate"], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }
    process.stdout.write(result.stdout);
  }

  removeFromIndexIfStaged(source.relativePath);
  unlinkSync(source.absolutePath);
  console.log(
    JSON.stringify(
      {
        status: "source_plan_cleanup_complete",
        source_plan: source.relativePath,
        expected_source_plan: expected.relativePath,
        change_id: changeId,
        repo_openspec_validation: runRepoValidation ? "passed" : "skipped",
      },
      null,
      2,
    ),
  );
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "plan-review-request-template",
    "validate-planning-review",
    "validate-openspec-change",
    "cleanup-source-plan",
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

function existsInRef(ref: string, path: string): boolean {
  const result = spawnSync("git", ["cat-file", "-e", `${ref}:${path}`], {
    encoding: "utf8",
  });
  return result.status === 0;
}

function removeFromIndexIfStaged(path: string): void {
  const staged = spawnSync(
    "git",
    ["diff", "--cached", "--name-only", "--", path],
    {
      encoding: "utf8",
    },
  );
  if (staged.status !== 0 || staged.stdout.trim() === "") {
    return;
  }

  const result = spawnSync("git", ["rm", "--cached", "--quiet", "--", path], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
}

function repoOpenSpecValidationAvailable(repoRoot: string): boolean {
  if (!existsSync(join(repoRoot, "package.json"))) {
    return false;
  }

  const result = spawnSync("pnpm", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function isAgentsPlanPath(path: string): boolean {
  return path === ".agents/plans" || path.startsWith(".agents/plans/");
}

function normalizeAgentsPlanPath(
  repoRoot: string,
  input: string,
  label: string,
): { absolutePath: string; relativePath: string } {
  const absolutePath = resolve(repoRoot, input);
  const relativePath = relative(repoRoot, absolutePath);
  if (
    relativePath.startsWith("..") ||
    relativePath === "" ||
    !isAgentsPlanPath(relativePath)
  ) {
    fail(`${label}_invalid: ${label} must be under .agents/plans`);
  }

  if (existsSync(absolutePath)) {
    const realRelativePath = relative(repoRoot, realpathSync(absolutePath));
    if (
      realRelativePath.startsWith("..") ||
      realRelativePath === "" ||
      !isAgentsPlanPath(realRelativePath)
    ) {
      fail(`${label}_invalid: ${label} must not escape .agents/plans`);
    }
  }

  return { absolutePath, relativePath };
}

function requiredArg(args: string[], name: string): string {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) {
    fail(`${name} is required`);
  }
  return args[index + 1];
}

function optionalArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  if (!args[index + 1]) {
    fail(`${name} requires a value`);
  }
  return args[index + 1];
}

function allScalars(input: string, key: string): string[] {
  const pattern = new RegExp(`^\\s*(?:-\\s*)?${key}:\\s*(.+?)\\s*$`, "gm");
  return [...input.matchAll(pattern)].map((match) => match[1].trim());
}

function blockScalar(input: string, key: string): string | undefined {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${key}:\\s*\\|\\s*$`)),
  );
  if (keyIndex === -1) {
    return undefined;
  }

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const blockLines: string[] = [];
  let blockIndent: number | undefined;
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      blockLines.push("");
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }

    blockIndent ??= indent;
    blockLines.push(line.slice(Math.min(indent, blockIndent)));
  }

  return blockLines.join("\n").trimEnd();
}

function taskArtifactEvidence(input: string): TaskArtifactEvidence[] {
  const taskArtifacts = extractSection(input, "task_artifacts");
  const entries: TaskArtifactEvidence[] = [];
  let current: TaskArtifactEvidence | undefined;

  for (const line of taskArtifacts.split(/\r?\n/)) {
    const taskId = line.match(/^\s*-\s+task_id:\s*(.+?)\s*$/);
    if (taskId) {
      if (current) {
        entries.push(current);
      }
      current = { taskId: cleanInlineScalar(taskId[1]), artifact: "" };
      continue;
    }

    const artifact = line.match(/^\s*artifact:\s*(.+?)\s*$/);
    if (artifact && current) {
      current.artifact = cleanInlineScalar(artifact[1]);
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function implementationStackEntries(input: string): Array<{
  artifact: string;
  headSha?: string;
  role?: string;
  predecessorArtifact?: string;
  taskDeltaValidated?: string;
  cumulativeTaskStateValid?: string;
}> {
  const stack = extractSection(input, "implementation_stack");
  const entries: Array<{
    artifact: string;
    headSha?: string;
    role?: string;
    predecessorArtifact?: string;
    taskDeltaValidated?: string;
    cumulativeTaskStateValid?: string;
  }> = [];
  let current:
    | {
        artifact: string;
        headSha?: string;
        role?: string;
        predecessorArtifact?: string;
        taskDeltaValidated?: string;
        cumulativeTaskStateValid?: string;
      }
    | undefined;

  for (const line of stack.split(/\r?\n/)) {
    const artifact = line.match(/^\s*-\s+artifact:\s*(.+?)\s*$/);
    if (artifact) {
      if (current) {
        entries.push(current);
      }
      current = { artifact: cleanInlineScalar(artifact[1]) };
      continue;
    }

    if (!current) {
      continue;
    }

    const role = line.match(/^\s*role:\s*(.+?)\s*$/);
    if (role) {
      current.role = cleanInlineScalar(role[1]);
      continue;
    }

    const headSha = line.match(/^\s*head_sha:\s*(.+?)\s*$/);
    if (headSha) {
      current.headSha = cleanInlineScalar(headSha[1]);
      continue;
    }

    const predecessorArtifact = line.match(
      /^\s*predecessor_artifact:\s*(.*?)\s*$/,
    );
    if (predecessorArtifact) {
      current.predecessorArtifact = cleanInlineScalar(predecessorArtifact[1]);
      continue;
    }

    const taskDeltaValidated = line.match(
      /^\s*task_delta_validated:\s*(.+?)\s*$/,
    );
    if (taskDeltaValidated) {
      current.taskDeltaValidated = cleanInlineScalar(taskDeltaValidated[1]);
      continue;
    }

    const cumulativeTaskStateValid = line.match(
      /^\s*cumulative_task_state_valid:\s*(.+?)\s*$/,
    );
    if (cumulativeTaskStateValid) {
      current.cumulativeTaskStateValid = cleanInlineScalar(
        cumulativeTaskStateValid[1],
      );
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function cleanInlineScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function phaseEvidenceErrors(
  resumeSection: string,
  context: {
    requireFresh: boolean;
    planningHeadSha?: string;
    taskStateFingerprint?: string;
  },
): string[] {
  const phaseEvidence = findSection(resumeSection, "phase_evidence");
  if (!phaseEvidence) {
    return [
      "orchestrator_resume.phase_evidence is required; route missing phase evidence to the owning phase",
    ];
  }

  return [
    ...singlePhaseEvidenceErrors(phaseEvidence, {
      name: "readiness",
      owner: "plan-ready",
      requireFresh: context.requireFresh,
      evidenceKey: "artifact_fingerprint",
      expectedKey: "expected_artifact_fingerprint",
    }),
    ...singlePhaseEvidenceErrors(phaseEvidence, {
      name: "planning_commit",
      owner: "plan-review",
      requireFresh: context.requireFresh,
      evidenceKey: "reviewed_head",
      expectedKey: "expected_head_sha",
      expectedValue: context.planningHeadSha,
    }),
    ...singlePhaseEvidenceErrors(phaseEvidence, {
      name: "delivery",
      owner: "plan-unit-delivery",
      requireFresh: context.requireFresh,
      evidenceKey: "task_state_fingerprint",
      expectedKey: "expected_task_state_fingerprint",
      expectedValue: context.taskStateFingerprint,
    }),
  ];
}

function singlePhaseEvidenceErrors(
  phaseEvidence: string,
  options: {
    name: string;
    owner: string;
    requireFresh: boolean;
    evidenceKey: string;
    expectedKey: string;
    expectedValue?: string;
  },
): string[] {
  const phase = findSection(phaseEvidence, options.name);
  if (!phase) {
    return [
      `orchestrator_resume.phase_evidence.${options.name} is missing; route_to ${options.owner}`,
    ];
  }

  const errors: string[] = [];
  const owner = scalar(phase, "owner");
  const status = scalar(phase, "status");
  const routeTo = scalar(phase, "route_to");
  const evidenceValue = scalar(phase, options.evidenceKey);
  const declaredExpectedValue = scalar(phase, options.expectedKey);
  const comparisonValue = options.expectedValue ?? declaredExpectedValue;

  if (owner !== options.owner) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name}.owner must be ${options.owner}`,
    );
  }
  if (!status || !["fresh", "missing", "stale"].includes(status)) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name}.status must be fresh, missing, or stale`,
    );
  }
  if (status !== "fresh" && routeTo !== options.owner) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name} must route_to ${options.owner} when evidence is ${status ?? "missing"}`,
    );
  }
  if (options.requireFresh && status !== "fresh") {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name} must be fresh before resume_ready; route_to ${options.owner}`,
    );
  }
  if (status === "fresh" && routeTo) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name}.route_to must be empty when evidence is fresh`,
    );
  }
  if (status === "fresh" && !evidenceValue) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name}.${options.evidenceKey} is required when evidence is fresh`,
    );
  }
  if (status === "fresh" && !declaredExpectedValue) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name}.${options.expectedKey} is required when evidence is fresh`,
    );
  }
  if (
    status === "fresh" &&
    options.expectedValue &&
    declaredExpectedValue &&
    declaredExpectedValue !== options.expectedValue
  ) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name} is stale; route_to ${options.owner}`,
    );
  }
  if (
    status === "fresh" &&
    evidenceValue &&
    comparisonValue &&
    evidenceValue !== comparisonValue
  ) {
    errors.push(
      `orchestrator_resume.phase_evidence.${options.name} is stale; route_to ${options.owner}`,
    );
  }

  return errors;
}
