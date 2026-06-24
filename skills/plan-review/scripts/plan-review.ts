#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { nitroFeedbackGateErrors } from "./lib/nitro-feedback-gate.ts";
import {
  firstUncheckedDeliverable,
  parseTasks,
  validateTasks,
} from "./lib/openspec-tasks.ts";
import {
  isAgentsPlanPath,
  isPlanSupportSidecar,
} from "./lib/plan-artifacts.ts";
import {
  extractSection,
  extractYaml,
  fail,
  findSection,
  includes,
  legacyPlanContractErrors,
  list,
  parseDescriptionPolicySection,
  readInput,
  requireValue,
  scalar,
  validateDescriptionPolicy,
  validatePlanningReviewContract,
} from "./lib/planning-contracts.ts";

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
  "openspec_task_shape",
  "review_feedback_routing",
  "description_policy",
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

type Command =
  | "detect"
  | "request-template"
  | "validate-request"
  | "validate-planning-diff"
  | "validate-openspec-tasks"
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
  unresolved_blockers: string[];
  blockers: string[];
};

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-review.ts <detect|request-template|validate-request|validate-planning-diff|validate-openspec-tasks|planning-review-template|validate-planning-review|gate-template|validate-ledger> [--file path] [--expected-head-sha sha] [--expected-artifact url]",
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

  if (command === "validate-openspec-tasks") {
    validateOpenSpecTasks(args);
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
    validatePlanningReview(input, args);
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
- Requested reviewers: Nitro and developers.

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

function printGateTemplate(): void {
  console.log(`## Readable Summary

- Review state: every plan-review gate has a verdict and evidence.
- Hosted artifact: PR or MR is planning-only.
- Finish condition: developer review is pending, feedback is incorporated, or the plan review is blocked with evidence.

\`\`\`yaml
plan_review_gate_ledger:
${LEDGER_GATES.map((gate) => {
  const base = `  ${gate}:
    status: passed
    evidence: <evidence>`;
  if (gate !== "description_policy") {
    return base;
  }

  return `${base}
    owner: change-request-create | glab-mr-create | github-pr-create | equivalent_provider_adapter
    artifact: <hosted planning PR or MR URL>
    head_sha: <current planning artifact head sha>
    update_mode: created | updated | reused_current
    materiality_decision: material_update | metadata_only_reuse
    reuse_rationale: <required when update_mode is reused_current>
    readback_head_sha: <current planning artifact head sha>
    read_before_update: true | not_applicable_for_created
    pre_update_body_evidence: <summary, hash, artifact note, recovery evidence, or not_applicable_for_created>
    readback_after_update: true
    readback_outcome: clean | restored | blocked
    preserved_manual_sections: true | not_applicable_for_created
    rollback_or_restore_evidence: none | not_applicable_for_created | <restore evidence>
    omitted_process_history: true
    omitted_private_artifacts: true`;
}).join("\n")}
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
  description_policy:
    status: passed
    owner: change-request-create | glab-mr-create | github-pr-create | equivalent_provider_adapter
    artifact: <planning PR or MR URL>
    head_sha: <planning artifact head sha>
    update_mode: created | updated | reused_current
    materiality_decision: material_update | metadata_only_reuse
    reuse_rationale: <required when update_mode is reused_current>
    readback_head_sha: <planning artifact head sha>
    read_before_update: true | not_applicable_for_created
    pre_update_body_evidence: <summary, hash, artifact note, recovery evidence, or not_applicable_for_created>
    readback_after_update: true
    readback_outcome: clean | restored | blocked
    preserved_manual_sections: true | not_applicable_for_created
    rollback_or_restore_evidence: none | not_applicable_for_created | <restore evidence>
    evidence:
      - <description create/update/readback evidence>
    omitted_process_history: true
    omitted_private_artifacts: true
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

  const supportSidecarEntries = planPathEntries.filter((entry) =>
    entry.paths.some(isPlanSupportSidecar),
  );
  if (artifactType === "plan" && supportSidecarEntries.length > 0) {
    console.error(
      [
        "Invalid planning diff:",
        "- artifact_type plan planning diffs must not include .agents/plans support sidecars",
        "- store support artifacts in thread evidence or the private AX plan workspace instead of .agents/plans/**",
        ...supportSidecarEntries.map(
          (entry) =>
            `- ${entry.status}: ${entry.paths.filter(isPlanSupportSidecar).join(" -> ")}`,
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

function validateOpenSpecTasks(args: string[]): void {
  const explicitTasksPath = optionalArg(args, "--tasks");
  const artifactTasksPath = taskPathFromArtifact(args);
  const tasksPath = explicitTasksPath ?? artifactTasksPath;
  if (!tasksPath) {
    fail(
      "validate-openspec-tasks requires --tasks <path> or --artifact-ref <openspec/changes/id>",
    );
  }

  const resolvedTasksPath = resolveTasksPath(tasksPath, {
    artifactRef: artifactTasksPath !== undefined,
  });
  if (!existsSync(resolvedTasksPath)) {
    fail(`openspec_tasks_missing: ${tasksPath}`);
  }

  const tasks = parseTasks(readFileSync(resolvedTasksPath, "utf8"));
  const errors = validateTasks(tasks, { requireObjectiveProof: true });
  const nextTask = firstUncheckedDeliverable(tasks);

  if (errors.length > 0) {
    const invalidTasks = tasks
      .filter((task) => task.kind === "needs_spec_redesign")
      .map((task) => ({
        id: task.id,
        title: task.title,
        line: task.line,
        heading: task.heading,
        reason: task.shape_reason ?? "not a deliverable implementation unit",
      }));
    const hasRedesignError = errors.some((error) =>
      error.startsWith("needs_spec_redesign"),
    );
    const status =
      invalidTasks.length > 0 || hasRedesignError
        ? "needs_spec_redesign"
        : "invalid";

    console.log(
      JSON.stringify(
        {
          status,
          errors,
          invalid_tasks: invalidTasks,
          next_action:
            status === "needs_spec_redesign"
              ? "ask_user_for_redesign_direction"
              : "fix_tasks",
        },
        null,
        2,
      ),
    );
    console.error(
      `Invalid openspec_tasks:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );

    if (status === "needs_spec_redesign") {
      console.error(
        [
          "Invalid plan-review OpenSpec task shape:",
          "- needs_spec_redesign from openspec-tasks audit",
          "- ask the user whether to redo the spec, brainstorm, narrow the scope, or choose another planning route",
          "- do not create or update the planning PR/MR until the task shape is fixed",
        ].join("\n"),
      );
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "pass",
        next_deliverable: nextTask ?? null,
        manual_pending: tasks.filter(
          (task) => !task.checked && task.kind === "manual",
        ),
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

    if (gate === "description_policy") {
      validateDescriptionPolicy(
        parseDescriptionPolicySection(gateSection),
        "description_policy",
        errors,
      );
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

function validatePlanningReview(input: string, args: string[] = []): void {
  const errors = legacyPlanContractErrors(input);
  validatePlanningReviewContract(input, errors, {
    expectedReviewArtifact: optionalArg(args, "--expected-artifact"),
    expectedReviewedHead: optionalArg(args, "--expected-head-sha"),
  });
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
    "validate-openspec-tasks",
    "planning-review-template",
    "validate-planning-review",
    "gate-template",
    "validate-ledger",
  ].includes(command ?? "");
}

function taskPathFromArtifact(args: string[]): string | undefined {
  const artifactRef = optionalArg(args, "--artifact-ref");
  return artifactRef ? join(artifactRef, "tasks.md") : undefined;
}

function resolveTasksPath(
  tasksPath: string,
  options: { artifactRef: boolean },
): string {
  if (isAbsolute(tasksPath)) {
    return tasksPath;
  }

  if (!options.artifactRef && existsSync(tasksPath)) {
    return tasksPath;
  }

  const repoRoot = git(["rev-parse", "--show-toplevel"]) ?? findRepoRoot();
  return repoRoot ? join(repoRoot, tasksPath) : tasksPath;
}

function findRepoRoot(): string | null {
  let current = process.cwd();

  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, "skills"))
    ) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    env: withoutGitRepositoryEnv(),
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const next = { ...process.env };
  delete next.GIT_DIR;
  delete next.GIT_WORK_TREE;
  delete next.GIT_COMMON_DIR;
  delete next.GIT_INDEX_FILE;
  return next;
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
      return { status, paths: paths.map(unquoteGitPath) };
    });
}

function unquoteGitPath(path: string): string {
  if (!path.startsWith('"') || !path.endsWith('"')) {
    return path;
  }

  return path
    .slice(1, -1)
    .replace(/\\([0-7]{1,3}|.)/g, (_match, escaped: string) => {
      if (/^[0-7]+$/.test(escaped)) {
        return String.fromCharCode(Number.parseInt(escaped, 8));
      }

      switch (escaped) {
        case "a":
          return "\x07";
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "v":
          return "\v";
        default:
          return escaped;
      }
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

function optionalArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${name} requires a value`);
  }

  return value;
}

function requiredArg(args: string[], name: string): string {
  const value = optionalArg(args, name);
  if (!value) {
    fail(`${name} is required`);
  }
  return value;
}
