#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
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
const READINESS_GATE_OUTCOMES = ["passed"] as const;
const READINESS_REVIEWER_STATUSES = [
  "passed",
  "failed",
  "blocked",
  "skipped",
] as const;
const OPENSPEC_CHANGE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Command =
  | "detect"
  | "request-template"
  | "validate-request"
  | "review-gate-input"
  | "commit-planning"
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
  readiness_reviewer_evidence?: ReadinessReviewerEvidence;
  blueprint_provenance?: BlueprintProvenance;
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

type ReviewGateResultInput = {
  status: "passed" | "failed" | "blocked";
  diffHash: string;
  completedAt?: string;
  summary?: string;
};

type ActiveReviewGateInput = {
  workflow: string;
  unit?: {
    id?: string;
    title?: string;
  };
  sourceProvenance: {
    kind: string;
    ref: string;
    phase?: string;
    evidence?: string[];
  };
  requiredReviewPasses: string[];
  results: Record<string, ReviewGateResultInput>;
  blockingFindings?: unknown[];
};

type ReviewGateResult = ReviewGateResultInput;

type ReviewGateIdentity = {
  gitCommonDir: string;
  gitDir: string;
  worktreeRoot: string;
  branchRef: string | null;
  headSha: string | null;
  stagedDiffHash: string;
  workflow: string;
  unitId: string | null;
};

type ReviewGateState = {
  version: 1;
  active: boolean;
  status: "active";
  workflow: string;
  unit?: ActiveReviewGateInput["unit"];
  sourceProvenance: ActiveReviewGateInput["sourceProvenance"];
  identity: ReviewGateIdentity;
  stagedDiffHash: string;
  requiredReviewPasses: string[];
  results: Record<string, ReviewGateResult>;
  blockingFindings: unknown[];
  updatedAt: string;
};

type ReviewGateWriteResult = {
  statePath: string;
  state: ReviewGateState;
};

type ReviewGateValidation = {
  ok: boolean;
  errors: string[];
  stagedDiffHash: string;
  requiredReviewPasses: string[];
};

type BlueprintProvenance = {
  present: boolean;
  source?: string;
  source_plan: {
    ref?: string;
    change_id?: string;
    artifact_fingerprint?: string;
  };
  generated_change: {
    change_id?: string;
    ref?: string;
    generated_paths: string[];
  };
  validation_evidence: string[];
  cleanup_evidence: string[];
};

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-review.ts <detect|request-template|validate-request|review-gate-input|commit-planning|validate-planning-diff|validate-openspec-tasks|planning-review-template|validate-planning-review|gate-template|validate-ledger> [--file path] [--expected-head-sha sha] [--expected-artifact url]",
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

  if (command === "review-gate-input") {
    printReviewGateInput(args, input);
    return;
  }

  if (command === "commit-planning") {
    commitPlanning(args, input);
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
  const errors = requestValidationErrors(request);

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

  if (errors.length > 0) {
    console.error(
      `Invalid ${request.source}:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log(`${request.source} valid`);
}

function requestValidationErrors(request: ParsedRequest): string[] {
  const errors: string[] = [];

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

  return errors;
}

function printReviewGateInput(args: string[], input: string): void {
  const diffHashIndex = args.indexOf("--diff-hash");
  const diffHash = diffHashIndex === -1 ? undefined : args[diffHashIndex + 1];
  if (!diffHash || diffHash.startsWith("--")) {
    fail("review-gate-input requires --diff-hash");
  }

  try {
    const evidenceRef =
      optionalArg(args, "--source-ref") ?? optionalArg(args, "--file");
    const reviewGateInput = buildPlanReviewGateInput(input, {
      diffHash,
      evidenceRef,
    });
    console.log(JSON.stringify(reviewGateInput, null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function commitPlanning(args: string[], input: string): void {
  const cwd = optionalArg(args, "--cwd") ?? process.cwd();
  const message = optionalArg(args, "--message") ?? optionalArg(args, "-m");
  if (!message) {
    fail("commit-planning requires --message <message>");
  }

  if (!hasStagedDiff(cwd)) {
    fail("commit-planning requires a staged planning diff");
  }

  const diffHash = stagedDiffHash(cwd);
  const evidenceRef =
    optionalArg(args, "--source-ref") ?? optionalArg(args, "--file");
  validateOpenSpecBlueprintProvenanceBeforeGate(input, cwd, args);
  const reviewGateInput = buildPlanReviewGateInput(input, {
    diffHash,
    evidenceRef,
  });
  const writeResult = writeActiveReviewGate(reviewGateInput, cwd);
  const validation = validateReviewGateForCommit(cwd);
  if (!validation.ok) {
    fail(
      [
        "commit-planning wrote a review gate that is not commit-ready:",
        ...validation.errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  const commitCommand = planningCommitCommand(args, message);
  const result = spawnSync(commitCommand.command, commitCommand.args, {
    cwd,
    encoding: "utf8",
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(
    JSON.stringify(
      {
        status: "planning_commit_committed",
        gate_outcome: "passed",
        state_path: writeResult.statePath,
        staged_diff_hash: validation.stagedDiffHash,
        required_review_passes: validation.requiredReviewPasses,
      },
      null,
      2,
    ),
  );
}

function hasStagedDiff(cwd: string): boolean {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    encoding: "utf8",
    env: withoutGitRepositoryEnv(),
  });
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }
  throw new Error((result.stderr || result.stdout || "git diff failed").trim());
}

function stagedDiffHash(cwd: string): string {
  const diff = gitOutputBuffer(["diff", "--cached", "--binary"], cwd);
  return `sha256:${createHash("sha256").update(diff).digest("hex")}`;
}

function writeActiveReviewGate(
  input: ActiveReviewGateInput,
  cwd: string,
): ReviewGateWriteResult {
  const statePath = reviewGateStatePath(cwd);
  const diffHash = stagedDiffHash(cwd);
  const now = new Date().toISOString();
  const state: ReviewGateState = {
    version: 1,
    active: true,
    status: "active",
    workflow: input.workflow,
    unit: input.unit,
    sourceProvenance: input.sourceProvenance,
    identity: currentReviewGateIdentity({
      cwd,
      stagedDiffHash: diffHash,
      workflow: input.workflow,
      unit: input.unit,
    }),
    stagedDiffHash: diffHash,
    requiredReviewPasses: input.requiredReviewPasses,
    results: normalizeReviewGateResults(input.results, diffHash),
    blockingFindings: input.blockingFindings ?? [],
    updatedAt: now,
  };

  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  rmSync(reviewGateInvalidationPath(cwd), { force: true });
  return { statePath, state };
}

function validateReviewGateForCommit(cwd: string): ReviewGateValidation {
  const statePath = reviewGateStatePath(cwd);
  const currentDiffHash = stagedDiffHash(cwd);
  const errors: string[] = [];
  let state: ReviewGateState | undefined;

  try {
    state = JSON.parse(readFileSync(statePath, "utf8")) as ReviewGateState;
  } catch (error) {
    errors.push(`Review gate state is not readable: ${String(error)}`);
  }

  if (state) {
    if (!state.active || state.status !== "active") {
      errors.push("Review gate state must be active.");
    }
    if (state.stagedDiffHash !== currentDiffHash) {
      errors.push("Review gate staged diff hash must match the staged diff.");
    }
    if (state.requiredReviewPasses.length === 0) {
      errors.push("Review gate requires at least one review pass.");
    }
    for (const reviewPass of state.requiredReviewPasses) {
      const result = state.results[reviewPass];
      if (!result) {
        errors.push(`Review gate missing required pass: ${reviewPass}.`);
      } else if (
        result.status !== "passed" ||
        result.diffHash !== currentDiffHash
      ) {
        errors.push(`Review gate required pass is stale: ${reviewPass}.`);
      }
    }
    if (state.blockingFindings.length > 0) {
      errors.push("Review gate has unresolved blocking findings.");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stagedDiffHash: currentDiffHash,
    requiredReviewPasses: state?.requiredReviewPasses ?? [],
  };
}

function normalizeReviewGateResults(
  results: Record<string, ReviewGateResultInput>,
  currentDiffHash: string,
): Record<string, ReviewGateResult> {
  const normalized: Record<string, ReviewGateResult> = {};
  for (const [reviewPass, result] of Object.entries(results)) {
    if (result.diffHash !== currentDiffHash) {
      throw new Error(
        `Review pass ${reviewPass} has stale diff hash ${result.diffHash}; expected ${currentDiffHash}.`,
      );
    }
    normalized[reviewPass] = { ...result };
  }
  return normalized;
}

function currentReviewGateIdentity(input: {
  cwd: string;
  stagedDiffHash: string;
  workflow: string;
  unit?: ActiveReviewGateInput["unit"];
}): ReviewGateIdentity {
  return {
    gitCommonDir: absoluteGitPath(
      gitOutput(["rev-parse", "--git-common-dir"], input.cwd),
      input.cwd,
    ),
    gitDir: absoluteGitPath(
      gitOutput(["rev-parse", "--git-dir"], input.cwd),
      input.cwd,
    ),
    worktreeRoot: absoluteGitPath(
      gitOutput(["rev-parse", "--show-toplevel"], input.cwd),
      input.cwd,
    ),
    branchRef: gitOutputOptional(
      ["symbolic-ref", "--quiet", "HEAD"],
      input.cwd,
    ),
    headSha: gitOutputOptional(["rev-parse", "--verify", "HEAD"], input.cwd),
    stagedDiffHash: input.stagedDiffHash,
    workflow: input.workflow,
    unitId: input.unit?.id ?? null,
  };
}

function reviewGateStatePath(cwd: string): string {
  return resolve(
    absoluteGitPath(gitOutput(["rev-parse", "--git-dir"], cwd), cwd),
    "ax",
    "review-gate.json",
  );
}

function reviewGateInvalidationPath(cwd: string): string {
  return resolve(
    dirname(reviewGateStatePath(cwd)),
    "review-gate.invalidated.json",
  );
}

function absoluteGitPath(path: string, cwd: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function gitOutputBuffer(args: string[], cwd: string): Buffer {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "buffer",
    env: withoutGitRepositoryEnv(),
  });
  if (result.status !== 0) {
    throw new Error(
      (
        result.stderr.toString() ||
        result.stdout.toString() ||
        "git failed"
      ).trim(),
    );
  }
  return result.stdout;
}

function gitOutput(args: string[], cwd: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: withoutGitRepositoryEnv(),
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed").trim());
  }
  return result.stdout.trim();
}

function gitOutputOptional(args: string[], cwd: string): string | null {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: withoutGitRepositoryEnv(),
  });
  return result.status === 0 ? result.stdout.trim() : null;
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
      readiness_reviewer_evidence:
        parseReadinessReviewerEvidence(reviewSection),
      blueprint_provenance: parseBlueprintProvenance(reviewSection),
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

function parseBlueprintProvenance(requestSection: string): BlueprintProvenance {
  const section = findChildSection(requestSection, "blueprint_provenance");
  const body = section ?? "";
  const sourcePlan = findChildSection(body, "source_plan") ?? "";
  const generatedChange = findChildSection(body, "generated_change") ?? "";

  return {
    present: Boolean(section),
    source: scalar(body, "source"),
    source_plan: {
      ref: scalar(sourcePlan, "ref"),
      change_id: scalar(sourcePlan, "change_id"),
      artifact_fingerprint: scalar(sourcePlan, "artifact_fingerprint"),
    },
    generated_change: {
      change_id: scalar(generatedChange, "change_id"),
      ref: scalar(generatedChange, "ref"),
      generated_paths: list(generatedChange, "generated_paths"),
    },
    validation_evidence: list(body, "validation_evidence"),
    cleanup_evidence: list(body, "cleanup_evidence"),
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

function validateOpenSpecBlueprintProvenanceBeforeGate(
  input: string,
  cwd: string,
  args: string[],
): void {
  const request = parseRequest(input);
  if (
    request.source !== "plan_review_request" ||
    request.artifact_type !== "openspec"
  ) {
    return;
  }

  const errors = blueprintProvenanceErrors(request, cwd);
  if (errors.length > 0) {
    fail(
      [
        "openspec_blueprint_provenance_blocked: rerun readiness reviewers on the materialized OpenSpec diff before plan-review commit",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  runStrictOpenSpecValidation(request.blueprint_provenance, cwd, args);
}

function blueprintProvenanceErrors(
  request: ParsedRequest,
  cwd: string,
): string[] {
  const errors: string[] = [];
  const provenance = request.blueprint_provenance;
  const evidence = request.readiness_reviewer_evidence;
  const artifactRef = request.artifact_ref;

  if (!provenance?.present) {
    return ["blueprint_provenance is required for OpenSpec planning commits"];
  }

  if (provenance.source !== "openspec_blueprint") {
    errors.push("blueprint_provenance.source must be openspec_blueprint");
  }

  requireValue(
    provenance.source_plan.ref,
    "blueprint_provenance.source_plan.ref",
    errors,
  );
  requireValue(
    provenance.source_plan.change_id,
    "blueprint_provenance.source_plan.change_id",
    errors,
  );
  requireValue(
    provenance.source_plan.artifact_fingerprint,
    "blueprint_provenance.source_plan.artifact_fingerprint",
    errors,
  );
  requireValue(
    provenance.generated_change.change_id,
    "blueprint_provenance.generated_change.change_id",
    errors,
  );
  requireValue(
    provenance.generated_change.ref,
    "blueprint_provenance.generated_change.ref",
    errors,
  );

  if (
    provenance.source_plan.ref &&
    !isConcreteAgentsPlanFile(provenance.source_plan.ref)
  ) {
    errors.push(
      "blueprint_provenance.source_plan.ref must point to a concrete .agents/plans file",
    );
  }

  if (
    provenance.source_plan.ref &&
    provenance.source_plan.artifact_fingerprint
  ) {
    errors.push(...sourcePlanFingerprintErrors(provenance, cwd));
  }

  if (
    evidence?.artifact_fingerprint &&
    provenance.source_plan.artifact_fingerprint &&
    evidence.artifact_fingerprint !==
      provenance.source_plan.artifact_fingerprint
  ) {
    errors.push(
      "blueprint_provenance.source_plan.artifact_fingerprint must match readiness_reviewer_evidence.artifact_fingerprint",
    );
  }

  if (
    artifactRef &&
    provenance.generated_change.ref &&
    artifactRef !== provenance.generated_change.ref
  ) {
    errors.push(
      "blueprint_provenance.generated_change.ref must match artifact_ref",
    );
  }

  const changeIdFromRef = artifactRef?.match(
    /^openspec\/changes\/([^/]+)$/,
  )?.[1];
  if (artifactRef && !changeIdFromRef) {
    errors.push(
      "artifact_ref must match openspec/changes/<change-id> for OpenSpec planning commits",
    );
  }

  for (const [label, changeId] of [
    [
      "blueprint_provenance.source_plan.change_id",
      provenance.source_plan.change_id,
    ],
    [
      "blueprint_provenance.generated_change.change_id",
      provenance.generated_change.change_id,
    ],
    ["artifact_ref change id", changeIdFromRef],
  ] as const) {
    if (changeId && !OPENSPEC_CHANGE_ID_PATTERN.test(changeId)) {
      errors.push(`${label} must be a lowercase OpenSpec change id slug`);
    }
  }

  const expectedGeneratedRef = provenance.generated_change.change_id
    ? `openspec/changes/${provenance.generated_change.change_id}`
    : undefined;
  if (
    expectedGeneratedRef &&
    (artifactRef !== expectedGeneratedRef ||
      provenance.generated_change.ref !== expectedGeneratedRef)
  ) {
    errors.push(
      `blueprint_provenance.generated_change.ref and artifact_ref must be ${expectedGeneratedRef}`,
    );
  }

  const changeIds = [
    provenance.source_plan.change_id,
    provenance.generated_change.change_id,
    changeIdFromRef,
  ].filter(Boolean);
  if (new Set(changeIds).size > 1) {
    errors.push(
      "blueprint_provenance source_plan.change_id, generated_change.change_id, and artifact_ref change id must match",
    );
  }

  const generatedPaths = provenance.generated_change.generated_paths;
  if (generatedPaths.length === 0) {
    errors.push(
      "blueprint_provenance.generated_change.generated_paths is required",
    );
  }

  for (const generatedPath of generatedPaths) {
    if (
      generatedPath.startsWith("/") ||
      generatedPath.split("/").includes("..")
    ) {
      errors.push(
        `blueprint_provenance.generated_change.generated_paths contains invalid path: ${generatedPath}`,
      );
      continue;
    }

    if (
      provenance.generated_change.ref &&
      generatedPath !== provenance.generated_change.ref &&
      !generatedPath.startsWith(`${provenance.generated_change.ref}/`)
    ) {
      errors.push(
        `blueprint_provenance.generated_change.generated_paths must stay under ${provenance.generated_change.ref}: ${generatedPath}`,
      );
    }

    if (!existsSync(join(cwd, generatedPath))) {
      errors.push(
        `blueprint_provenance.generated_change.generated_paths missing from working tree: ${generatedPath}`,
      );
    }
  }

  const stagedEntries = stagedNameStatus(cwd);
  const stagedPlanPathEntries = stagedEntries.filter((entry) =>
    entry.paths.some(isAgentsPlanPath),
  );
  for (const entry of stagedPlanPathEntries) {
    errors.push(
      `OpenSpec planning commits must not stage .agents/plans paths: ${entry.status}: ${entry.paths.filter(isAgentsPlanPath).join(" -> ")}`,
    );
  }

  const stagedArtifactTouchedPaths = artifactRef
    ? stagedEntries.flatMap((entry) =>
        stagedArtifactBoundaryPaths(entry, artifactRef),
      )
    : [];
  const stagedArtifactPaths = stagedArtifactTouchedPaths.filter((path) =>
    artifactRef
      ? path === artifactRef || path.startsWith(`${artifactRef}/`)
      : false,
  );
  if (stagedArtifactPaths.length === 0) {
    errors.push(
      "staged OpenSpec diff must include at least one path under artifact_ref",
    );
  }

  const undeclaredStagedPaths = stagedArtifactTouchedPaths.filter(
    (path) => !generatedPaths.includes(path),
  );
  for (const stagedPath of undeclaredStagedPaths) {
    errors.push(
      `staged OpenSpec path is not declared in blueprint_provenance.generated_change.generated_paths: ${stagedPath}`,
    );
  }

  if (
    stagedArtifactPaths.length > 0 &&
    !stagedArtifactPaths.some((path) => generatedPaths.includes(path))
  ) {
    errors.push(
      "staged OpenSpec diff must include at least one generated path declared by blueprint_provenance",
    );
  }

  const dirtyGeneratedPaths = unstagedOrUntrackedPaths(
    cwd,
    artifactRef ? [artifactRef] : generatedPaths,
  );
  for (const generatedPath of dirtyGeneratedPaths) {
    errors.push(
      `OpenSpec artifact has unstaged or untracked changes outside the staged diff: ${generatedPath}`,
    );
  }

  const strictValidationCommand = provenance.generated_change.change_id
    ? `openspec validate ${provenance.generated_change.change_id} --strict --no-interactive`
    : undefined;
  if (
    strictValidationCommand &&
    !provenance.validation_evidence.includes(strictValidationCommand)
  ) {
    errors.push(
      `blueprint_provenance.validation_evidence must include ${strictValidationCommand}`,
    );
  }

  return errors;
}

function sourcePlanFingerprintErrors(
  provenance: BlueprintProvenance,
  cwd: string,
): string[] {
  const ref = provenance.source_plan.ref;
  const expectedFingerprint = provenance.source_plan.artifact_fingerprint;
  const changeId = provenance.source_plan.change_id;
  const errors: string[] = [];

  if (!ref || !expectedFingerprint) {
    return errors;
  }

  const path = join(cwd, ref);
  if (existsSync(path)) {
    const plansRoot = join(cwd, ".agents", "plans");
    const realCwd = realpathSync(cwd);
    const realPlansRoot = realpathSync(plansRoot);
    const realPath = realpathSync(path);
    if (
      !realPlansRoot.startsWith(`${realCwd}${sep}`) ||
      !realPath.startsWith(`${realPlansRoot}${sep}`)
    ) {
      return [
        "blueprint_provenance.source_plan.ref must resolve inside .agents/plans",
      ];
    }

    if (lstatSync(path).isSymbolicLink()) {
      return [
        "blueprint_provenance.source_plan.ref must not point to a symlink",
      ];
    }

    const stat = statSync(path);
    if (!stat.isFile()) {
      return [
        "blueprint_provenance.source_plan.ref must point to a regular source plan file",
      ];
    }

    const actualFingerprint = fingerprint(path);
    if (actualFingerprint !== expectedFingerprint) {
      return [
        "blueprint_provenance.source_plan.artifact_fingerprint must match source_plan.ref content",
      ];
    }

    return errors;
  }

  if (!hasCleanupEvidence(provenance, ref, changeId)) {
    errors.push(
      "blueprint_provenance.cleanup_evidence must prove source_plan.ref cleanup when the source plan file is absent",
    );
  }

  return errors;
}

function hasCleanupEvidence(
  provenance: BlueprintProvenance,
  ref: string,
  changeId: string | undefined,
): boolean {
  return provenance.cleanup_evidence.some((evidence) => {
    const args = shellWords(evidence);
    if (!changeId) {
      return false;
    }

    return arraysEqual(args, [
      "scripts/plan-orchestrator.ts",
      "cleanup-source-plan",
      "--source-plan",
      ref,
      "--expected-source-plan",
      ref,
      "--expected-change-id",
      changeId,
      "--change-id",
      changeId,
    ]);
  });
}

function shellWords(input: string): string[] {
  return input.match(/"[^"]*"|'[^']*'|\S+/g)?.map(cleanScalar) ?? [];
}

function arraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function runStrictOpenSpecValidation(
  provenance: BlueprintProvenance | undefined,
  cwd: string,
  args: string[],
): void {
  const changeId = provenance?.generated_change.change_id;
  if (!changeId) {
    return;
  }

  const commandOverride = optionalArg(args, "--openspec-command");
  if (
    commandOverride &&
    process.env.AX_PLAN_REVIEW_ALLOW_OPENSPEC_COMMAND_OVERRIDE !== "1"
  ) {
    fail(
      "openspec_command_override_forbidden: --openspec-command is only available to plan-review unit tests",
    );
  }

  const command = commandOverride ?? "openspec";
  const commandArgs = ["validate", changeId, "--strict", "--no-interactive"];
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
  });
  if (result.error) {
    fail(
      [
        `openspec_strict_validation_failed: ${["openspec", ...commandArgs].join(" ")}`,
        result.error.message,
        "next action: ensure the OpenSpec CLI is installed and on PATH, then rerun `pnpm ax openspec status` or `pnpm ax openspec validate` before retrying.",
      ].join("\n"),
    );
  }

  if (result.status === 0) {
    return;
  }

  fail(
    [
      `openspec_strict_validation_failed: ${["openspec", ...commandArgs].join(" ")}`,
      (result.stderr ?? "").trim(),
      (result.stdout ?? "").trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  );
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

function findChildSection(input: string, sectionName: string): string | null {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex(
    (line) =>
      line.trim() === `${sectionName}:` &&
      (line.match(/^(\s*)/)?.[1].length ?? 0) === 0,
  );
  if (start === -1) {
    return null;
  }

  const sectionIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0;
  const childIndent = sectionIndent + 2;
  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      values.push("");
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= sectionIndent) {
      break;
    }

    values.push(
      line.startsWith(" ".repeat(childIndent)) ? line.slice(childIndent) : line,
    );
  }

  return values.join("\n");
}

function buildPlanReviewGateInput(
  input: string,
  options: {
    diffHash: string;
    evidenceRef?: string;
  },
): ActiveReviewGateInput {
  const request = parseRequest(input);
  if (request.source !== "plan_review_request") {
    throw new Error("review-gate-input requires plan_review_request");
  }

  const errors = requestValidationErrors(request);
  if (errors.length > 0) {
    throw new Error(
      `Invalid plan_review_request:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  const evidence = request.readiness_reviewer_evidence;
  if (!evidence) {
    throw new Error("readiness_reviewer_evidence is required");
  }

  const requiredReviewPasses = unique([
    ...evidence.baseline_reviewers,
    ...evidence.selected_dynamic_reviewers,
  ]);

  return {
    workflow: "plan-review",
    unit: {
      id: request.artifact_ref,
      title: request.review_goal,
    },
    sourceProvenance: {
      kind: "plan_review_request",
      ref: request.artifact_ref ?? options.evidenceRef ?? "unknown",
      phase: "plan-review",
      evidence: options.evidenceRef ? [options.evidenceRef] : [],
    },
    requiredReviewPasses,
    results: readinessReviewGateResults(
      requiredReviewPasses,
      evidence,
      options.diffHash,
    ),
    blockingFindings: evidence.blocking_findings,
  };
}

function readinessReviewGateResults(
  reviewers: string[],
  evidence: ReadinessReviewerEvidence,
  diffHash: string,
): Record<string, ReviewGateResultInput> {
  return Object.fromEntries(
    reviewers.map((reviewer) => [
      reviewer,
      {
        status: "passed",
        diffHash,
        completedAt: evidence.completed_at,
        summary: `PlanReview readiness evidence satisfied ${reviewer}.`,
      },
    ]),
  );
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
    "review-gate-input",
    "commit-planning",
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
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

function stagedArtifactBoundaryPaths(
  entry: NameStatusEntry,
  artifactRef: string,
): string[] {
  if (entry.status.startsWith("R")) {
    return entry.paths.some((path) => isArtifactPath(path, artifactRef))
      ? entry.paths
      : [];
  }

  if (entry.status.startsWith("C")) {
    const destination = entry.paths[entry.paths.length - 1];
    return destination && isArtifactPath(destination, artifactRef)
      ? [destination]
      : [];
  }

  const path = entry.paths[0];
  return path && isArtifactPath(path, artifactRef) ? [path] : [];
}

function isArtifactPath(path: string, artifactRef: string): boolean {
  return path === artifactRef || path.startsWith(`${artifactRef}/`);
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

function stagedNameStatus(cwd: string): NameStatusEntry[] {
  const result = spawnSync(
    "git",
    ["diff", "--cached", "--name-status", "--find-renames", "--find-copies"],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return parseNameStatus(result.stdout);
}

function unstagedOrUntrackedPaths(cwd: string, paths: string[]): string[] {
  if (paths.length === 0) {
    return [];
  }

  const result = spawnSync(
    "git",
    ["status", "--porcelain=v1", "--", ...paths],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .flatMap((line) => {
      const status = line.slice(0, 2);
      const pathText = line.slice(3);
      const path = pathText.includes(" -> ")
        ? pathText.split(" -> ").at(-1)
        : pathText;

      if (status === "??" || status[1] !== " ") {
        return path ? [path] : [];
      }

      return [];
    });
}

function readDiffFile(path: string): string {
  if (!existsSync(path)) {
    fail(`diff_file_missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function isConcreteAgentsPlanFile(path: string): boolean {
  return (
    path.startsWith(".agents/plans/") &&
    !path.endsWith("/") &&
    !path.split("/").includes("..") &&
    path !== ".agents/plans"
  );
}

function fingerprint(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
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

function allOptionalArgs(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) {
      values.push(args[index + 1]);
    }
  }
  return values;
}

function requiredArg(args: string[], name: string): string {
  const value = optionalArg(args, name);
  if (!value) {
    fail(`${name} is required`);
  }
  return value;
}

function planningCommitCommand(
  args: string[],
  message: string,
): { command: string; args: string[] } {
  const customCommand = optionalArg(args, "--ax-command");
  return {
    command: customCommand ?? "pnpm",
    args: [
      ...(customCommand ? allOptionalArgs(args, "--ax-arg") : ["ax"]),
      "commit",
      "--require-review-gate",
      "-m",
      message,
    ],
  };
}
