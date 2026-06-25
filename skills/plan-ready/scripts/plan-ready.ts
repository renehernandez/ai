#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { analyzeObjectiveProof } from "./lib/objective-proof.ts";
import { classifyTaskShape } from "./lib/openspec-tasks.ts";
import { isSafeAgentsPlanRef } from "./lib/plan-artifacts.ts";
import {
  cleanScalar,
  escapeRegExp,
  extractSection,
  extractYaml,
  fail,
  hasKey,
  hasSection,
  includes,
  LEGACY_PLAN_KEYS,
  LEGACY_PLAN_ROOTS,
  list,
  readInput,
  requireValue,
  scalar,
} from "./lib/planning-contracts.ts";
import type {
  ReviewGateResultInput,
  ReviewGateValidation,
  ReviewGateWriteResult,
} from "./lib/review-gate.ts";
import {
  hasStagedDiff,
  stagedDiffHash,
  validateReviewGateForCommit,
  writeActiveReviewGate,
  writeReviewGateInvalidation,
} from "./lib/review-gate.ts";

const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
  "refactoring-opportunities",
] as const;

const OPTIONAL_REVIEWER_DESCRIPTIONS = {
  "security-and-auth":
    "auth, authorization, secrets, token handling, sensitive data, webhooks, dependency trust",
  "data-migration-and-backfill":
    "schema changes, data corrections, reprocessing, idempotency, rollback, irreversible writes",
  "ci-and-release-impact":
    "CI config, package publishing, deployment, release automation, branch protection, required checks",
  "frontend-ux-accessibility":
    "UI flows, responsive layout, accessibility, visual verification, interaction states",
  "infra-and-cloud":
    "Terraform, Kubernetes, Cloudflare, AWS, DNS, queues, storage, environment config",
  "docs-and-agent-alignment":
    "docs, agent instructions, skill/rule updates, automation prompts, background-review rubrics, PR description expectations, local workflow artifact boundaries",
  "performance-and-scale":
    "hot paths, concurrency, caching, queues, rate limits, batch behavior, operational limits",
  "ax-and-skill-compatibility":
    "skill structure, SKILL.md conventions, adapter prompts, install/update paths, bundled scripts, internal subagent routing, runtime compatibility",
} as const;

const OPTIONAL_REVIEWERS = Object.keys(OPTIONAL_REVIEWER_DESCRIPTIONS) as Array<
  keyof typeof OPTIONAL_REVIEWER_DESCRIPTIONS
>;
const PLAN_READY_REVIEW_PHASE = "plan-ready";
const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const ROUTES = ["atomic_plan", "openspec_task"] as const;
const EXPECTED_HOSTS = ["github_pr", "gitlab_mr"] as const;
type Command =
  | "detect"
  | "reviewer-template"
  | "validate-selection"
  | "handoff-template"
  | "validate-handoff"
  | "blueprint-template"
  | "validate-blueprint"
  | "review-gate-input"
  | "activate-review-gate";

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
  out_of_scope: string[];
  expected_host?: string;
  completion_updates: string[];
  required_reviewers: string[];
  optional_reviewers: string[];
  reviewer_evidence: ReviewerEvidenceContract;
  blockers: string[];
};

type BlueprintTask = {
  id?: string;
  title?: string;
  deliverable?: string;
  acceptance: string[];
  verification: string[];
  dependencies: string[];
};

type ParsedBlueprint = {
  status?: string;
  source_plan_ref?: string;
  source_plan_change_id?: string;
  suggested_id?: string;
  title?: string;
  objective?: string;
  scope_in: string[];
  scope_out: string[];
  affected_or_new_specs: string[];
  proposed_requirements: string[];
  tasks: BlueprintTask[];
  recommended_first_task?: string;
  has_required_reviewers: boolean;
  has_optional_reviewers: boolean;
  required_reviewers: string[];
  optional_reviewers: string[];
  reviewers_used: string[];
  reviewer_evidence: ReviewerEvidenceContract;
  findings: string[];
  risks: string[];
  blockers: string[];
  next_action?: string;
};

type ActiveReviewGateResultInput = {
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
  results: Record<string, ActiveReviewGateResultInput>;
  blockingFindings?: unknown[];
};

type ReviewerEvidenceContract = {
  present: boolean;
  keys: Set<string>;
  artifact_fingerprint?: string;
  completed_at?: string;
  gate_outcome?: string;
  baseline_reviewers: string[];
  selected_dynamic_reviewers: string[];
  per_reviewer_status: Record<string, string>;
  skipped_reviewers: string[];
  skipped_rationale: string[];
  blocking_findings: string[];
};

const REQUIRED_REVIEWER_EVIDENCE_KEYS = [
  "baseline_reviewers",
  "selected_dynamic_reviewers",
  "per_reviewer_status",
  "skipped_reviewers",
  "skipped_rationale",
  "blocking_findings",
] as const;

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-ready.ts <detect|reviewer-template|validate-selection|handoff-template|validate-handoff|blueprint-template|validate-blueprint|review-gate-input|activate-review-gate> [artifact-ref] [--file path]",
    );
  }

  if (command === "detect") {
    detect(args[0]);
    return;
  }

  if (command === "reviewer-template") {
    printReviewerTemplate();
    return;
  }

  if (command === "validate-selection") {
    validateSelection(readInput(args));
    return;
  }

  if (command === "handoff-template") {
    printHandoffTemplate();
    return;
  }

  if (command === "blueprint-template") {
    printBlueprintTemplate();
    return;
  }

  if (command === "review-gate-input") {
    printReviewGateInput(args);
    return;
  }

  if (command === "activate-review-gate") {
    activateReviewGate(args);
    return;
  }

  if (command === "validate-blueprint") {
    validateBlueprint(args);
    return;
  }

  validateHandoff(readInput(args));
}

function detect(artifactRef?: string): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const relativeArtifact = artifactRef
    ? toRepoRelative(repoRoot, artifactRef)
    : "";
  const artifactType = inferArtifactType(relativeArtifact || artifactRef || "");

  const result = {
    repo_root: repoRoot,
    branch,
    head_sha: headSha,
    remotes: remotes.split("\n").filter(Boolean),
    openspec_present: existsSync(join(repoRoot, "openspec")),
    plan_directories: [".agents/plans", "plans", "specs", "docs/specs"].filter(
      (path) => existsSync(join(repoRoot, path)),
    ),
    artifact_ref: artifactRef ?? null,
    artifact_type_hint: artifactType,
  };

  console.log(JSON.stringify(result, null, 2));
}

function printReviewerTemplate(): void {
  console.log(`reviewer_selection_judge:
  verdict: baseline_sufficient | add_optional_reviewers
  baseline_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `    - ${reviewer}`).join("\n")}
  optional_reviewer_catalog:
${OPTIONAL_REVIEWERS.map((reviewer) => `    - ${reviewer}: ${OPTIONAL_REVIEWER_DESCRIPTIONS[reviewer]}`).join("\n")}
  selected_optional_reviewers: []
  rationale:
    default: <why the selected reviewers are sufficient>

selection_rules:
  - Select docs-and-agent-alignment for reusable workflow, docs, skills, rules, automation prompt, background review, reviewer rubric, local workflow artifact boundary, or PR/MR description contract changes.
  - Select ax-and-skill-compatibility for skill folder structure, skill metadata, bundled script, adapter prompt, internal subagent routing, install/update, or Agents Experience changes.
  - For OpenSpec or blueprint readiness work, every baseline reviewer must treat lifecycle-only task groups, validation-only tasks, proof-only tasks, final documentation or validation phases, and checkbox-only delivery units as blocking planning-readiness findings before status ready.
  - For workflow artifacts, every baseline reviewer must block committed local readiness reports, reviewer reports, followthrough ledgers, screenshots, or other private workflow state in work-project repositories.
  - Report these blockers as required spec or plan redesign with needs_spec_redesign when task shape is the failing surface; do not downgrade them to suggestions, follow-up cleanup, or implementation nits.
  - Select only from optional_reviewer_catalog; do not invent reviewer names.
  - Use baseline_sufficient only after explaining why no optional catalog reviewer is needed.

baseline_reviewer_blocking_rubric:
  implementation-readiness:
    - Block lifecycle-only groups, validation-only tasks, proof-only tasks, final documentation or validation phases, and checkbox-only delivery units because they are not implementation-sized deliverables.
  edge-cases-and-risks:
    - Block plans that defer risk discovery, rollback confidence, or verification to a final documentation, validation, testing, linting, review, or proof phase instead of attaching it to the related deliverable.
  simplification-and-scope-control:
    - Block standalone lifecycle groups, checklist bookkeeping units, and committed local workflow artifacts in work-project repositories.
  refactoring-opportunities:
    - Block cleanup, verification, documentation, or refactoring tasks that are independent OpenSpec units unless that reviewer, rule, test, documentation, runtime-validation, or reusable AI workflow machinery is itself the feature.
`);
}

function printHandoffTemplate(): void {
  console.log(`## Readable Summary

- Status: ready for one atomic delivery unit.
- Route: atomic plan.
- Artifact: .agents/plans/example.md.
- Delivery: create one PR or MR for the approved unit.
- Verification: run the listed checks before delivery.

\`\`\`yaml
plan_delivery_handoff:
  status: ready
  route: atomic_plan
  artifact:
    type: plan
    ref: .agents/plans/example.md
    fingerprint: <sha256 of artifact ref or current commit sha>
  approved_unit:
    id: atomic
    title: <short title>
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
    completion_updates: []
  review:
    required_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    optional_reviewers: []
    reviewer_evidence:
      artifact_fingerprint: <sha256 of artifact ref or current commit sha>
      completed_at: <ISO-8601 timestamp>
      gate_outcome: passed
      baseline_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `        - ${reviewer}`).join("\n")}
      selected_dynamic_reviewers: []
      per_reviewer_status:
${BASELINE_REVIEWERS.map((reviewer) => `        ${reviewer}: passed`).join("\n")}
      skipped_reviewers: []
      skipped_rationale: []
      blocking_findings: []
  blockers: []
\`\`\`
`);
}

function printBlueprintTemplate(): void {
  console.log(`## Readable Summary

- Status: ready to create an OpenSpec change.
- Change: <OpenSpec change title>.
- Scope: reviewed multi-deliverable work with explicit in/out boundaries.
- First task: 1.1.
- Next action: create the OpenSpec change files mechanically from this blueprint.

\`\`\`yaml
openspec_blueprint:
  status: ready_for_openspec
  source_plan:
    ref: .agents/plans/example.md
    change_id: <verb-noun-change-id>
  change:
    suggested_id: <verb-noun-change-id>
    title: <OpenSpec change title>
    objective: <one paragraph objective>
  scope:
    in:
      - <included outcome>
    out:
      - <explicit non-goal>
  specs:
    affected_or_new:
      - <existing capability or new spec area>
    proposed_requirements:
      - <requirement summary for OpenSpec spec delta>
  tasks:
    - id: "1.1"
      title: <minor deliverable title>
      deliverable: <PR/MR-sized outcome>
      acceptance:
        - <observable result, including deliverable-scoped docs or proof work when needed>
      verification:
        - <required command, check, or manual proof>
      dependencies: []
  recommended_first_task: "1.1"
  review:
    required_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    optional_reviewers: []
    reviewers_used:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    reviewer_evidence:
      artifact_fingerprint: <sha256 of source plan or reviewed artifact>
      completed_at: <ISO-8601 timestamp>
      gate_outcome: passed
      baseline_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `        - ${reviewer}`).join("\n")}
      selected_dynamic_reviewers: []
      per_reviewer_status:
${BASELINE_REVIEWERS.map((reviewer) => `        ${reviewer}: passed`).join("\n")}
      skipped_reviewers: []
      skipped_rationale: []
      blocking_findings: []
    findings:
      - <review finding that shaped the blueprint>
  risks:
    - <risk or rollout concern>
  blockers: []
  next_action: create_openspec_change
\`\`\`
`);
}

function validateHandoff(input: string): void {
  try {
    validatedHandoff(input);
  } catch (error) {
    fail(errorMessage(error));
  }
  console.log("plan_delivery_handoff valid");
}

function validatedHandoff(input: string): ParsedHandoff {
  const handoff = parseHandoff(input);
  const errors = handoffValidationErrors(input, handoff);

  if (errors.length > 0) {
    throw new Error(
      `Invalid plan_delivery_handoff:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  return handoff;
}

function handoffValidationErrors(
  input: string,
  handoff: ParsedHandoff,
): string[] {
  const errors = legacyErrors(input);

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.route, "route", errors);
  requireValue(handoff.artifact_type, "artifact.type", errors);
  requireValue(handoff.artifact_ref, "artifact.ref", errors);
  requireValue(handoff.artifact_fingerprint, "artifact.fingerprint", errors);
  requireValue(handoff.approved_unit_id, "approved_unit.id", errors);
  requireValue(handoff.approved_unit_title, "approved_unit.title", errors);
  requireValue(handoff.approved_unit_scope, "approved_unit.scope", errors);
  requireValue(handoff.expected_host, "delivery.expected_host", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }

  if (handoff.route && !includes(ROUTES, handoff.route)) {
    errors.push(`route must be one of: ${ROUTES.join(", ")}`);
  }

  if (
    handoff.artifact_type &&
    !includes(ARTIFACT_TYPES, handoff.artifact_type)
  ) {
    errors.push(`artifact.type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (
    handoff.expected_host &&
    !includes(EXPECTED_HOSTS, handoff.expected_host)
  ) {
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

  for (const reviewer of handoff.required_reviewers) {
    if (!includes(BASELINE_REVIEWERS, reviewer)) {
      errors.push(
        `required_reviewers can include only baseline reviewers: ${reviewer}`,
      );
    }
  }

  for (const reviewer of handoff.optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(
        `optional_reviewers can include only optional reviewers: ${reviewer}`,
      );
    }
  }

  errors.push(
    ...reviewerEvidenceValidationErrors({
      label: "review.reviewer_evidence",
      evidence: handoff.reviewer_evidence,
      baselineReviewers: handoff.required_reviewers,
      selectedDynamicReviewers: handoff.optional_reviewers,
      expectedArtifactFingerprint: handoff.artifact_fingerprint,
    }),
  );

  if (handoff.blockers.length > 0) {
    errors.push("blockers must be empty before status ready");
  }

  if (
    handoff.route === "atomic_plan" &&
    handoff.approved_unit_id !== "atomic"
  ) {
    errors.push("atomic_plan route requires approved_unit.id atomic");
  }

  if (handoff.route === "openspec_task") {
    if (handoff.artifact_type !== "openspec") {
      errors.push("openspec_task route requires artifact.type openspec");
    }
    if (handoff.completion_updates.length === 0) {
      errors.push(
        "openspec_task route requires delivery.completion_updates to mark the task checkbox complete in the same PR/MR",
      );
    }
  }

  if (handoff.artifact_ref && existsSync(handoff.artifact_ref)) {
    const expected = fingerprint(handoff.artifact_ref);
    if (
      handoff.artifact_fingerprint &&
      handoff.artifact_fingerprint !== expected
    ) {
      errors.push(
        "artifact.fingerprint must match current artifact.ref content",
      );
    }
  }

  return errors;
}

type ReviewGateInputOptions = {
  diffHash: string;
  cwd?: string;
  evidenceRef?: string;
  fallbackRef?: string;
  results?: Record<string, ReviewGateResultInput>;
};

type ReviewerEvidence = {
  results: Record<string, ReviewGateResultInput>;
  blockingFindings: string[];
};

function buildPlanReadyReviewGateInput(
  input: string,
  options: ReviewGateInputOptions,
): ActiveReviewGateInput {
  const body = extractYaml(input);
  if (hasSection(body, "plan_delivery_handoff")) {
    return handoffReviewGateInput(validatedHandoff(input), options);
  }
  if (hasSection(body, "openspec_blueprint")) {
    return blueprintReviewGateInput(
      validatedBlueprint(input, { cwd: options.cwd }),
      options,
    );
  }

  throw new Error(
    "review-gate input requires plan_delivery_handoff or openspec_blueprint",
  );
}

function printReviewGateInput(args: string[]): void {
  const diffHash = optionValue(args, "--diff-hash");
  if (!diffHash) {
    fail("review-gate-input requires --diff-hash");
  }

  const cwd = optionValue(args, "--cwd") ?? process.cwd();
  const input = readInput(args);
  const evidenceRef =
    optionValue(args, "--source-ref") ?? optionValue(args, "--file");
  let reviewGateInput: ActiveReviewGateInput;
  try {
    reviewGateInput = buildPlanReadyReviewGateInput(input, {
      diffHash,
      cwd,
      evidenceRef,
      fallbackRef: evidenceRef,
    });
  } catch (error) {
    fail(errorMessage(error));
  }
  console.log(JSON.stringify(reviewGateInput, null, 2));
}

function activateReviewGate(args: string[]): void {
  const cwd = optionValue(args, "--cwd") ?? process.cwd();
  const input = readInput(args);
  let reviewGateInput: ActiveReviewGateInput;
  let diffHash = "";

  try {
    if (!hasStagedDiff(cwd)) {
      emitBlockedReviewGate(["plan-ready review gate requires a staged diff"]);
    }
    diffHash = stagedDiffHash(cwd);

    const evidenceRef =
      optionValue(args, "--source-ref") ?? optionValue(args, "--file");
    const reviewerEvidence = readReviewerEvidence(args, diffHash);
    reviewGateInput = buildPlanReadyReviewGateInput(input, {
      diffHash,
      cwd,
      evidenceRef,
      fallbackRef: evidenceRef,
      results: reviewerEvidence.results,
    });
    reviewGateInput.blockingFindings = [
      ...(reviewGateInput.blockingFindings ?? []),
      ...reviewerEvidence.blockingFindings,
    ];
    assertReviewerEvidenceComplete(reviewGateInput, reviewerEvidence);
  } catch (error) {
    emitBlockedReviewGate([errorMessage(error)], undefined, cwd, diffHash);
  }

  try {
    const writeResult = writeActiveReviewGate(reviewGateInput, cwd);
    const validation = validateReviewGateForCommit(cwd);
    if (!validation.ok) {
      emitBlockedReviewGate(validation.errors, validation, cwd, diffHash);
    }

    console.log(
      JSON.stringify(
        {
          status: "ready",
          gate_outcome: "passed",
          state_path: writeResult.statePath,
          staged_diff_hash: validation.stagedDiffHash,
          required_review_passes: validation.requiredReviewPasses,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    emitBlockedReviewGate([errorMessage(error)], undefined, cwd, diffHash);
  }
}

function emitBlockedReviewGate(
  blockers: string[],
  validation?: ReviewGateValidation,
  cwd?: string,
  diffHash?: string,
): never {
  let blockedGate: ReviewGateWriteResult | undefined;
  if (cwd && diffHash) {
    try {
      blockedGate = writeBlockedReviewGate(cwd, diffHash, blockers);
    } catch (error) {
      try {
        const invalidation = writeReviewGateInvalidation(
          cwd,
          diffHash,
          blockers,
        );
        blockers.push(
          `failed to write blocked review gate; wrote invalidation marker to block stale prior gates: ${invalidation.invalidationPath}; cause: ${errorMessage(error)}`,
        );
      } catch (invalidationError) {
        blockers.push(
          `failed to write blocked review gate and failed to write invalidation marker; stale prior gate may remain: ${errorMessage(error)}; invalidation error: ${errorMessage(invalidationError)}`,
        );
      }
    }
  }
  console.log(
    JSON.stringify(
      {
        status: "blocked",
        gate_outcome: "blocked",
        blockers,
        state_path: validation?.statePath ?? blockedGate?.statePath,
        staged_diff_hash: validation?.stagedDiffHash ?? diffHash,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

function writeBlockedReviewGate(
  cwd: string,
  diffHash: string,
  blockers: string[],
): ReviewGateWriteResult {
  return writeActiveReviewGate(
    {
      workflow: "plan-ready",
      unit: {
        id: "blocked_readiness",
        title: "Blocked PlanReady readiness gate",
      },
      sourceProvenance: {
        kind: "blocked_readiness",
        ref: "plan-ready",
        phase: PLAN_READY_REVIEW_PHASE,
      },
      requiredReviewPasses: ["plan-ready-readiness"],
      results: {
        "plan-ready-readiness": {
          status: "blocked",
          diffHash,
          summary: blockers.join("; "),
        },
      },
      blockingFindings: blockers,
    },
    cwd,
  );
}

function readReviewerEvidence(
  args: string[],
  diffHash: string,
): ReviewerEvidence {
  const path = optionValue(args, "--review-results-file");
  if (!path) {
    throw new Error("activate-review-gate requires --review-results-file");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `reviewer evidence is not valid JSON: ${errorMessage(error)}`,
    );
  }

  if (!isRecord(parsed)) {
    throw new Error("reviewer evidence must be an object");
  }

  const rawResults = parsed.reviewer_results;
  if (!Array.isArray(rawResults)) {
    throw new Error("reviewer evidence requires reviewer_results array");
  }

  const results: Record<string, ReviewGateResultInput> = {};
  const blockingFindings: string[] = stringArray(parsed.blocking_findings);
  for (const item of rawResults) {
    if (!isRecord(item)) {
      throw new Error("reviewer_results entries must be objects");
    }
    const reviewer = stringField(item, "reviewer");
    const status = stringField(item, "status");
    const itemDiffHash = stringField(item, "diff_hash");
    const summary = stringField(item, "summary");

    if (!reviewer || !isKnownReviewer(reviewer)) {
      throw new Error(
        `reviewer_results entry has unknown reviewer: ${reviewer || "<missing>"}`,
      );
    }
    if (!status || !["passed", "failed", "blocked"].includes(status)) {
      throw new Error(
        `reviewer_results.${reviewer}.status must be passed, failed, or blocked`,
      );
    }
    if (!itemDiffHash) {
      throw new Error(`reviewer_results.${reviewer}.diff_hash is required`);
    }
    if (itemDiffHash !== diffHash) {
      throw new Error(
        `reviewer_results.${reviewer}.diff_hash is stale for current staged diff`,
      );
    }
    if (results[reviewer]) {
      throw new Error(
        `reviewer_results contains duplicate reviewer: ${reviewer}`,
      );
    }
    results[reviewer] = {
      status: status as "passed" | "failed" | "blocked",
      diffHash: itemDiffHash,
      summary: summary || `PlanReady reviewer evidence satisfied ${reviewer}.`,
    };
    if (status !== "passed") {
      blockingFindings.push(`Reviewer ${reviewer} did not pass: ${status}`);
    }
  }

  return { results, blockingFindings };
}

function assertReviewerEvidenceComplete(
  input: ActiveReviewGateInput,
  evidence: ReviewerEvidence,
): void {
  const missing = input.requiredReviewPasses.filter(
    (reviewer) => !evidence.results[reviewer],
  );
  if (missing.length > 0) {
    throw new Error(
      `missing reviewer evidence for required reviewers: ${missing.join(", ")}`,
    );
  }

  const notPassed = input.requiredReviewPasses.filter(
    (reviewer) => evidence.results[reviewer]?.status !== "passed",
  );
  if (notPassed.length > 0) {
    throw new Error(
      `reviewer evidence is not passing for required reviewers: ${notPassed.join(", ")}`,
    );
  }

  if ((input.blockingFindings ?? []).length > 0) {
    throw new Error("blocking reviewer findings remain");
  }
}

function handoffReviewGateInput(
  handoff: ParsedHandoff,
  options: ReviewGateInputOptions,
): ActiveReviewGateInput {
  const requiredReviewPasses = readinessReviewers(
    handoff.reviewer_evidence.baseline_reviewers,
    handoff.reviewer_evidence.selected_dynamic_reviewers,
  );

  return {
    workflow: "plan-ready",
    unit: {
      id: handoff.approved_unit_id,
      title: handoff.approved_unit_title,
    },
    sourceProvenance: {
      kind: "plan_delivery_handoff",
      ref: handoff.artifact_ref ?? options.fallbackRef ?? "unknown",
      phase: PLAN_READY_REVIEW_PHASE,
      evidence: sourceEvidence(options),
    },
    requiredReviewPasses,
    results:
      options.results ??
      synthesizedReviewerResults(requiredReviewPasses, options.diffHash),
    blockingFindings: handoff.blockers,
  };
}

function blueprintReviewGateInput(
  blueprint: ParsedBlueprint,
  options: ReviewGateInputOptions,
): ActiveReviewGateInput {
  const requiredReviewPasses = readinessReviewers(
    blueprint.reviewer_evidence.baseline_reviewers,
    blueprint.reviewer_evidence.selected_dynamic_reviewers,
  );

  return {
    workflow: "plan-ready",
    unit: {
      id: blueprint.suggested_id,
      title: blueprint.title,
    },
    sourceProvenance: {
      kind: "openspec_blueprint",
      ref: blueprint.source_plan_ref ?? options.fallbackRef ?? "unknown",
      phase: PLAN_READY_REVIEW_PHASE,
      evidence: sourceEvidence(options),
    },
    requiredReviewPasses,
    results:
      options.results ??
      synthesizedReviewerResults(requiredReviewPasses, options.diffHash),
    blockingFindings: blueprint.blockers,
  };
}

function readinessReviewers(
  requiredReviewers: string[],
  ...optionalReviewerSources: string[][]
): string[] {
  return unique([
    ...baselineReviewers(requiredReviewers),
    ...optionalReviewerSources.flatMap(optionalReviewers),
  ]);
}

function baselineReviewers(reviewers: string[]): string[] {
  return reviewers.filter((reviewer) => includes(BASELINE_REVIEWERS, reviewer));
}

function optionalReviewers(reviewers: string[]): string[] {
  return reviewers.filter((reviewer) => includes(OPTIONAL_REVIEWERS, reviewer));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  value: Record<string, unknown>,
  field: string,
): string | undefined {
  const raw = value[field];
  return typeof raw === "string" ? raw : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function synthesizedReviewerResults(
  reviewers: string[],
  diffHash: string,
): ActiveReviewGateInput["results"] {
  return Object.fromEntries(
    reviewers.map((reviewer) => [
      reviewer,
      {
        status: "passed" as const,
        diffHash,
        summary: `PlanReady reviewer evidence satisfied ${reviewer}.`,
      },
    ]),
  );
}

function sourceEvidence(options: ReviewGateInputOptions): string[] {
  return options.evidenceRef ? [options.evidenceRef] : [];
}

function validateBlueprint(args: string[]): void {
  const cwd = optionValue(args, "--cwd") ?? process.cwd();
  try {
    validatedBlueprint(readInput(args), { cwd });
  } catch (error) {
    fail(errorMessage(error));
  }
  console.log("openspec_blueprint valid");
}

function validatedBlueprint(
  input: string,
  options: { cwd?: string } = {},
): ParsedBlueprint {
  const blueprint = parseBlueprint(input);
  const errors = blueprintValidationErrors(input, blueprint, options);

  if (errors.length > 0) {
    throw new Error(
      `Invalid openspec_blueprint:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }

  return blueprint;
}

function blueprintValidationErrors(
  input: string,
  blueprint: ParsedBlueprint,
  options: { cwd?: string } = {},
): string[] {
  const errors = legacyErrors(input);
  const taskIds = blueprint.tasks
    .map((task) => task.id)
    .filter((id): id is string => Boolean(id));

  requireValue(blueprint.status, "status", errors);
  requireValue(blueprint.source_plan_ref, "source_plan.ref", errors);
  requireValue(
    blueprint.source_plan_change_id,
    "source_plan.change_id",
    errors,
  );
  requireValue(blueprint.suggested_id, "change.suggested_id", errors);
  requireValue(blueprint.title, "change.title", errors);
  requireValue(blueprint.objective, "change.objective", errors);
  requireValue(
    blueprint.recommended_first_task,
    "recommended_first_task",
    errors,
  );
  requireValue(blueprint.next_action, "next_action", errors);

  if (blueprint.status && blueprint.status !== "ready_for_openspec") {
    errors.push("status must be ready_for_openspec");
  }

  if (
    blueprint.source_plan_ref &&
    !isSafeAgentsPlanRef(blueprint.source_plan_ref)
  ) {
    errors.push("source_plan.ref must be under .agents/plans");
  }

  if (
    blueprint.source_plan_ref &&
    isSafeAgentsPlanRef(blueprint.source_plan_ref) &&
    !existsSync(
      sourcePlanPath(blueprint.source_plan_ref, options.cwd ?? process.cwd()),
    )
  ) {
    errors.push(
      "source_plan.ref must exist before reviewer evidence can be accepted",
    );
  }

  if (
    blueprint.suggested_id &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blueprint.suggested_id)
  ) {
    errors.push("change.suggested_id must be a lowercase kebab-case id");
  }

  if (
    blueprint.source_plan_change_id &&
    blueprint.suggested_id &&
    blueprint.source_plan_change_id !== blueprint.suggested_id
  ) {
    errors.push("source_plan.change_id must match change.suggested_id");
  }

  if (blueprint.scope_in.length === 0) {
    errors.push("scope.in must include at least one item");
  }

  if (blueprint.affected_or_new_specs.length === 0) {
    errors.push("specs.affected_or_new must include at least one item");
  }

  if (blueprint.proposed_requirements.length === 0) {
    errors.push("specs.proposed_requirements must include at least one item");
  }

  if (blueprint.tasks.length === 0) {
    errors.push("tasks must include at least one minor deliverable");
  }

  const duplicateIds = taskIds.filter(
    (id, index) => taskIds.indexOf(id) !== index,
  );
  for (const id of new Set(duplicateIds)) {
    errors.push(`duplicate task id: ${id}`);
  }

  for (const [index, task] of blueprint.tasks.entries()) {
    const label = task.id ? `tasks.${task.id}` : `tasks[${index}]`;
    requireValue(task.id, `${label}.id`, errors);
    requireValue(task.title, `${label}.title`, errors);
    requireValue(task.deliverable, `${label}.deliverable`, errors);
    const taskShape = classifyTaskShape(
      task.title ?? "",
      task.deliverable ?? task.title ?? "",
    );
    const deliverableShape = classifyTaskShape("", task.deliverable ?? "");
    const rejectedShape =
      taskShape.kind === "needs_spec_redesign" ? taskShape : deliverableShape;
    if (rejectedShape.kind === "needs_spec_redesign") {
      errors.push(
        `needs_spec_redesign: ${label} is ${rejectedShape.reason ?? "not a deliverable implementation unit"}`,
      );
    }
    if (task.acceptance.length === 0) {
      errors.push(`${label}.acceptance must include at least one item`);
    }
    if (task.verification.length === 0) {
      errors.push(`${label}.verification must include at least one item`);
    }
    for (const dependency of task.dependencies) {
      if (!taskIds.includes(dependency)) {
        errors.push(
          `${label}.dependencies includes unknown task ${dependency}`,
        );
      }
    }
  }

  const objectiveProof = analyzeObjectiveProof(
    blueprint.tasks.map((task) => ({
      id: task.id ?? "unknown",
      text: [
        task.title,
        task.deliverable,
        ...task.acceptance,
        ...task.verification,
      ]
        .filter(Boolean)
        .join("\n"),
      setupText: [task.title, task.deliverable, ...task.acceptance]
        .filter(Boolean)
        .join("\n"),
    })),
  );
  if (objectiveProof.status === "needs_spec_redesign") {
    for (const issue of objectiveProof.issues) {
      errors.push(issue.message);
    }
  }

  if (
    blueprint.recommended_first_task &&
    !taskIds.includes(blueprint.recommended_first_task)
  ) {
    errors.push("recommended_first_task must match an existing task id");
  }

  const recommendedTask = blueprint.tasks.find(
    (task) => task.id === blueprint.recommended_first_task,
  );
  if (recommendedTask && recommendedTask.dependencies.length > 0) {
    errors.push("recommended_first_task must not have dependencies");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!blueprint.required_reviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }

    if (!blueprint.reviewers_used.includes(reviewer)) {
      errors.push(`reviewers_used must include ${reviewer}`);
    }
  }

  for (const reviewer of blueprint.optional_reviewers) {
    if (!blueprint.reviewers_used.includes(reviewer)) {
      errors.push(
        `reviewers_used must include selected optional reviewer ${reviewer}`,
      );
    }
  }

  errors.push(
    ...sameMembersErrors(
      blueprint.reviewers_used,
      unique([...BASELINE_REVIEWERS, ...blueprint.optional_reviewers]),
      "reviewers_used",
      "baseline plus selected optional reviewers",
    ),
  );

  if (!blueprint.has_required_reviewers) {
    errors.push("review.required_reviewers is required");
  }

  if (!blueprint.has_optional_reviewers) {
    errors.push("review.optional_reviewers is required");
  }

  for (const reviewer of blueprint.required_reviewers) {
    if (!includes(BASELINE_REVIEWERS, reviewer)) {
      errors.push(
        `required_reviewers can include only baseline reviewers: ${reviewer}`,
      );
    }
  }

  for (const reviewer of blueprint.optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(
        `optional_reviewers can include only optional reviewers: ${reviewer}`,
      );
    }
  }

  for (const reviewer of blueprint.reviewers_used) {
    if (!isKnownReviewer(reviewer)) {
      errors.push(`unknown reviewer: ${reviewer}`);
    }
  }

  errors.push(
    ...reviewerEvidenceValidationErrors({
      label: "review.reviewer_evidence",
      evidence: blueprint.reviewer_evidence,
      baselineReviewers: blueprint.required_reviewers,
      selectedDynamicReviewers: blueprint.optional_reviewers,
      expectedArtifactFingerprint: sourcePlanFingerprint(
        blueprint,
        options.cwd ?? process.cwd(),
      ),
      expectedArtifactFingerprintLabel: "source_plan.ref content",
    }),
  );

  if (blueprint.findings.length === 0) {
    errors.push("review.findings must include at least one item");
  }

  if (blueprint.blockers.length > 0) {
    errors.push("blockers must be empty before status ready_for_openspec");
  }

  if (
    blueprint.next_action &&
    blueprint.next_action !== "create_openspec_change"
  ) {
    errors.push("next_action must be create_openspec_change");
  }

  return errors;
}

function validateSelection(input: string): void {
  const selection = parseSelection(input);
  const errors: string[] = [];

  if (!selection.verdict) {
    errors.push("reviewer_selection_judge.verdict is required");
  } else if (
    !["baseline_sufficient", "add_optional_reviewers"].includes(
      selection.verdict,
    )
  ) {
    errors.push(
      "reviewer_selection_judge.verdict must be baseline_sufficient or add_optional_reviewers",
    );
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!selection.baseline_reviewers.includes(reviewer)) {
      errors.push(`baseline_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of selection.baseline_reviewers) {
    if (!includes(BASELINE_REVIEWERS, reviewer)) {
      errors.push(
        `baseline_reviewers can include only baseline reviewers: ${reviewer}`,
      );
    }
  }

  if (selection.baseline_reviewers.length !== BASELINE_REVIEWERS.length) {
    errors.push(
      `baseline_reviewers must contain exactly: ${BASELINE_REVIEWERS.join(", ")}`,
    );
  }

  for (const reviewer of selection.selected_optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(
        `selected_optional_reviewers can include only optional reviewers: ${reviewer}`,
      );
    }
  }

  if (
    selection.verdict === "add_optional_reviewers" &&
    selection.selected_optional_reviewers.length === 0
  ) {
    errors.push(
      "add_optional_reviewers requires at least one selected_optional_reviewer",
    );
  }

  if (
    selection.verdict === "baseline_sufficient" &&
    selection.selected_optional_reviewers.length > 0
  ) {
    errors.push(
      "baseline_sufficient must not include selected_optional_reviewers",
    );
  }

  if (!selection.rationalePresent) {
    errors.push("rationale is required");
  }

  if (
    selection.verdict === "baseline_sufficient" &&
    !selection.rationale.default
  ) {
    errors.push("baseline_sufficient requires a rationale.default explanation");
  }

  for (const reviewer of selection.selected_optional_reviewers) {
    if (!selection.rationale[reviewer]) {
      errors.push(`selected optional reviewer requires rationale: ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid reviewer_selection_judge:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("reviewer_selection_judge valid");
}

function parseHandoff(input: string): ParsedHandoff {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_delivery_handoff");
  const artifact = extractSection(section, "artifact");
  const approvedUnit = extractSection(section, "approved_unit");
  const constraints = extractSection(section, "constraints");
  const delivery = extractSection(section, "delivery");
  const review = extractSection(section, "review");

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
    out_of_scope: list(constraints, "out_of_scope"),
    expected_host: scalar(delivery, "expected_host"),
    completion_updates: list(delivery, "completion_updates"),
    required_reviewers: list(review, "required_reviewers"),
    optional_reviewers: list(review, "optional_reviewers"),
    reviewer_evidence: parseReviewerEvidence(review),
    blockers: list(section, "blockers"),
  };
}

function parseBlueprint(input: string): ParsedBlueprint {
  const body = extractYaml(input);
  const section = extractSection(body, "openspec_blueprint");
  const sourcePlan = extractSection(section, "source_plan");
  const change = extractSection(section, "change");
  const scope = extractSection(section, "scope");
  const specs = extractSection(section, "specs");
  const review = extractSection(section, "review");

  return {
    status: scalar(section, "status"),
    source_plan_ref: scalar(sourcePlan, "ref"),
    source_plan_change_id: scalar(sourcePlan, "change_id"),
    suggested_id: scalar(change, "suggested_id"),
    title: scalar(change, "title"),
    objective: scalar(change, "objective"),
    scope_in: list(scope, "in"),
    scope_out: list(scope, "out"),
    affected_or_new_specs: list(specs, "affected_or_new"),
    proposed_requirements: list(specs, "proposed_requirements"),
    tasks: parseBlueprintTasks(extractSection(section, "tasks")),
    recommended_first_task: scalar(section, "recommended_first_task"),
    has_required_reviewers: hasKey(review, "required_reviewers"),
    has_optional_reviewers: hasKey(review, "optional_reviewers"),
    required_reviewers: list(review, "required_reviewers"),
    optional_reviewers: list(review, "optional_reviewers"),
    reviewers_used: list(review, "reviewers_used"),
    reviewer_evidence: parseReviewerEvidence(review),
    findings: list(review, "findings"),
    risks: list(section, "risks"),
    blockers: list(section, "blockers"),
    next_action: scalar(section, "next_action"),
  };
}

function parseReviewerEvidence(
  reviewSection: string,
): ReviewerEvidenceContract {
  const evidence = extractSection(reviewSection, "reviewer_evidence");

  return {
    present: hasSection(reviewSection, "reviewer_evidence"),
    keys: new Set(
      REQUIRED_REVIEWER_EVIDENCE_KEYS.filter((key) => hasKey(evidence, key)),
    ),
    artifact_fingerprint: scalar(evidence, "artifact_fingerprint"),
    completed_at: scalar(evidence, "completed_at"),
    gate_outcome: scalar(evidence, "gate_outcome"),
    baseline_reviewers: list(evidence, "baseline_reviewers"),
    selected_dynamic_reviewers: list(evidence, "selected_dynamic_reviewers"),
    per_reviewer_status: map(evidence, "per_reviewer_status"),
    skipped_reviewers: list(evidence, "skipped_reviewers"),
    skipped_rationale: list(evidence, "skipped_rationale"),
    blocking_findings: list(evidence, "blocking_findings"),
  };
}

function reviewerEvidenceValidationErrors({
  label,
  evidence,
  baselineReviewers,
  selectedDynamicReviewers,
  expectedArtifactFingerprint,
  expectedArtifactFingerprintLabel = "artifact.fingerprint",
}: {
  label: string;
  evidence: ReviewerEvidenceContract;
  baselineReviewers: string[];
  selectedDynamicReviewers: string[];
  expectedArtifactFingerprint?: string;
  expectedArtifactFingerprintLabel?: string;
}): string[] {
  const errors: string[] = [];

  if (!evidence.present) {
    return [`${label} is required`];
  }

  requireValue(
    evidence.artifact_fingerprint,
    `${label}.artifact_fingerprint`,
    errors,
  );
  requireValue(evidence.completed_at, `${label}.completed_at`, errors);
  requireValue(evidence.gate_outcome, `${label}.gate_outcome`, errors);
  for (const key of REQUIRED_REVIEWER_EVIDENCE_KEYS) {
    if (!evidence.keys.has(key)) {
      errors.push(`${label}.${key} is required`);
    }
  }

  if (
    expectedArtifactFingerprint &&
    evidence.artifact_fingerprint &&
    evidence.artifact_fingerprint !== expectedArtifactFingerprint
  ) {
    errors.push(
      `${label}.artifact_fingerprint must match ${expectedArtifactFingerprintLabel}`,
    );
  }

  if (
    evidence.completed_at &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
      evidence.completed_at,
    ) ||
      !isValidUtcTimestamp(evidence.completed_at))
  ) {
    errors.push(`${label}.completed_at must be an ISO-8601 UTC timestamp`);
  }

  if (
    evidence.gate_outcome &&
    !["passed", "blocked"].includes(evidence.gate_outcome)
  ) {
    errors.push(`${label}.gate_outcome must be passed or blocked`);
  }

  if (evidence.gate_outcome && evidence.gate_outcome !== "passed") {
    errors.push(`${label}.gate_outcome must be passed for ready outputs`);
  }

  if (evidence.baseline_reviewers.length === 0) {
    errors.push(`${label}.baseline_reviewers is required`);
  }

  errors.push(
    ...sameMembersErrors(
      evidence.baseline_reviewers,
      baselineReviewers,
      `${label}.baseline_reviewers`,
      "review.required_reviewers",
    ),
  );
  errors.push(
    ...sameMembersErrors(
      evidence.selected_dynamic_reviewers,
      selectedDynamicReviewers,
      `${label}.selected_dynamic_reviewers`,
      "review.optional_reviewers",
    ),
  );

  const requiredStatusReviewers = unique([
    ...evidence.baseline_reviewers,
    ...evidence.selected_dynamic_reviewers,
  ]);
  for (const reviewer of requiredStatusReviewers) {
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
    if (
      !requiredStatusReviewers.includes(reviewer) &&
      !evidence.skipped_reviewers.includes(reviewer)
    ) {
      errors.push(
        `${label}.per_reviewer_status contains unlisted reviewer: ${reviewer}`,
      );
    }
    if (!["passed", "failed", "blocked", "skipped"].includes(status)) {
      errors.push(
        `${label}.per_reviewer_status.${reviewer} must be passed, failed, blocked, or skipped`,
      );
    }
    if (["failed", "blocked"].includes(status)) {
      errors.push(
        `${label}.per_reviewer_status.${reviewer} must not be ${status} for ready outputs`,
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
    if (!isKnownReviewer(reviewer)) {
      errors.push(
        `${label}.skipped_reviewers contains unknown reviewer: ${reviewer}`,
      );
    }
    if (requiredStatusReviewers.includes(reviewer)) {
      errors.push(
        `${label}.skipped_reviewers cannot include required reviewer ${reviewer}`,
      );
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
    errors.push(`${label}.blocking_findings must be empty for ready outputs`);
  }

  return errors;
}

function isValidUtcTimestamp(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const iso = date.toISOString();
  return iso === value || iso.replace(".000Z", "Z") === value;
}

function sameMembersErrors(
  actual: string[],
  expected: string[],
  actualLabel: string,
  expectedLabel: string,
): string[] {
  const errors: string[] = [];
  for (const item of expected) {
    if (!actual.includes(item)) {
      errors.push(`${actualLabel} must include ${item} from ${expectedLabel}`);
    }
  }
  for (const item of actual) {
    if (!expected.includes(item)) {
      errors.push(
        `${actualLabel} contains ${item} not listed in ${expectedLabel}`,
      );
    }
  }
  return errors;
}

function parseBlueprintTasks(input: string): BlueprintTask[] {
  const tasks: BlueprintTask[] = [];
  let current: BlueprintTask | undefined;
  let activeList:
    | keyof Pick<BlueprintTask, "acceptance" | "verification" | "dependencies">
    | null = null;

  for (const line of input.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }

    const idMatch = line.match(/^- id:\s*(.+)$/);
    if (idMatch) {
      current = {
        id: cleanScalar(idMatch[1]),
        acceptance: [],
        dependencies: [],
        verification: [],
      };
      tasks.push(current);
      activeList = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const scalarMatch = line.match(/^ {2}(title|deliverable):\s*(.+)$/);
    if (scalarMatch) {
      current[scalarMatch[1] as "title" | "deliverable"] = cleanScalar(
        scalarMatch[2],
      );
      activeList = null;
      continue;
    }

    const inlineListMatch = line.match(
      /^ {2}(acceptance|verification|dependencies):\s*\[(.*?)\]\s*$/,
    );
    if (inlineListMatch) {
      const key = inlineListMatch[1] as
        | "acceptance"
        | "verification"
        | "dependencies";
      const raw = inlineListMatch[2].trim();
      current[key] = raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
      activeList = null;
      continue;
    }

    const listStartMatch = line.match(
      /^ {2}(acceptance|verification|dependencies):\s*$/,
    );
    if (listStartMatch) {
      activeList = listStartMatch[1] as typeof activeList;
      continue;
    }

    const itemMatch = line.match(/^ {4}- (.+)$/);
    if (itemMatch && activeList) {
      current[activeList].push(cleanScalar(itemMatch[1]));
    }
  }

  return tasks;
}

function parseSelection(input: string): {
  verdict?: string;
  baseline_reviewers: string[];
  selected_optional_reviewers: string[];
  rationalePresent: boolean;
  rationale: Record<string, string>;
} {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_selection_judge");

  return {
    verdict: scalar(section, "verdict"),
    baseline_reviewers: list(section, "baseline_reviewers"),
    selected_optional_reviewers: list(section, "selected_optional_reviewers"),
    rationalePresent: hasRationale(section),
    rationale: map(section, "rationale"),
  };
}

function legacyErrors(input: string): string[] {
  const body = extractYaml(input);
  const errors: string[] = [];

  for (const root of LEGACY_PLAN_ROOTS) {
    if (hasSection(body, root)) {
      errors.push(
        `${root} is legacy; rerun plan-ready to produce plan_delivery_handoff or openspec_blueprint`,
      );
    }
  }

  for (const key of LEGACY_PLAN_KEYS) {
    if (hasKey(body, key)) {
      errors.push(
        `${key} is legacy; rerun plan-ready to produce plan_delivery_handoff or openspec_blueprint`,
      );
    }
  }

  return errors;
}

function fingerprint(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourcePlanFingerprint(
  blueprint: ParsedBlueprint,
  cwd: string,
): string | undefined {
  if (
    !blueprint.source_plan_ref ||
    !isSafeAgentsPlanRef(blueprint.source_plan_ref)
  ) {
    return undefined;
  }

  const path = sourcePlanPath(blueprint.source_plan_ref, cwd);
  return existsSync(path) ? fingerprint(path) : undefined;
}

function sourcePlanPath(sourcePlanRef: string, cwd: string): string {
  return join(cwd, sourcePlanRef);
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "reviewer-template",
    "validate-selection",
    "handoff-template",
    "validate-handoff",
    "blueprint-template",
    "validate-blueprint",
    "review-gate-input",
    "activate-review-gate",
  ].includes(command ?? "");
}

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  return value && !value.startsWith("-") ? value : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isKnownReviewer(reviewer: string): boolean {
  return (
    includes(BASELINE_REVIEWERS, reviewer) ||
    includes(OPTIONAL_REVIEWERS, reviewer)
  );
}

function inferArtifactType(artifactRef: string): string | null {
  if (!artifactRef) {
    return null;
  }

  if (
    artifactRef.includes("openspec/changes/") ||
    artifactRef.startsWith("openspec:")
  ) {
    return "openspec";
  }

  if (
    /^[A-Z][A-Z0-9]+-\d+$/.test(artifactRef) ||
    artifactRef.includes("linear.app")
  ) {
    return "linear";
  }

  if (
    artifactRef.endsWith(".md") ||
    artifactRef.includes(".agents/plans/") ||
    artifactRef.includes("plans/")
  ) {
    return "plan";
  }

  return null;
}

function toRepoRelative(repoRoot: string, artifactRef: string): string {
  const absolute = resolve(artifactRef);
  const relativePath = relative(repoRoot, absolute);
  return relativePath.startsWith("..") ? artifactRef : relativePath;
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
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
    const item = line.trim().match(/^([^:]+):\s*(.+)$/);
    if (item) {
      values[cleanScalar(item[1])] = cleanScalar(item[2]);
    }
  }

  return values;
}

function hasRationale(input: string): boolean {
  return Object.keys(map(input, "rationale")).length > 0;
}

main();
