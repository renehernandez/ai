#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nitroFeedbackGateErrors } from "./lib/nitro-feedback-gate.ts";
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
} from "./lib/planning-contracts.ts";
import {
  artifactHostHintFromRemoteText,
  validateDeliveryUnitDelta,
  validateUnitTaskDelta,
} from "./lib/stack-state.ts";

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
  "ax-and-skill-compatibility",
] as const;

const REVIEW_PASSES = [
  "implementation-review",
  "implementation-scrutiny",
  "code-quality-review",
  "code-simplifier",
  "deslop",
  "ai-readiness-upkeep",
  "docs-alignment-review",
  "security-review",
] as const;

const REQUIRED_REVIEW_PASSES = [
  "implementation-review",
  "implementation-scrutiny",
  "code-quality-review",
  "code-simplifier",
  "deslop",
  "docs-alignment-review",
] as const;

const MUST_PASS_REVIEW_PASSES = [
  "implementation-review",
  "implementation-scrutiny",
  "code-quality-review",
] as const;

const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;

const LEDGER_GATES = [
  "handoff_validation",
  "session_start",
  "slice_status",
  "implementation",
  "unit_artifact_boundary",
  "delivery_unit_delta",
  "local_verification",
  "refactoring_execution",
  "reviewer_passes",
  "implementation_review",
  "implementation_scrutiny",
  "code_quality_review",
  "code_simplifier",
  "deslop",
  "security_review",
  "ai_readiness_upkeep",
  "docs_alignment",
  "review_feedback_routing",
  "implementation_artifact_separation",
  "description_policy",
  "artifact_creation_update",
  "stack_identity",
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
  "delivery_unit_delta",
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
  expected_base_ref?: string;
  expected_base_sha?: string;
  predecessor_artifact?: string;
  selected_unit_base_sha?: string;
  restack_required?: string;
  completion_updates: string[];
  required_reviewers: string[];
  optional_reviewers: string[];
  blockers: string[];
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-unit-delivery.ts <detect|validate-handoff|reviewer-template|validate-launch-report|validate-review-report|refactoring-template|gate-template|validate-ledger|validate-task-delta> [--file path|--base path --head path --unit id|--task id] [--expected-head-sha sha] [--expected-artifact url]",
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

  validateLedger(input, args);
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
    artifact_host_hint: artifactHostHintFromRemoteText(remoteText),
    openspec_present: existsSync(join(repoRoot, "openspec")),
  };

  console.log(JSON.stringify(result, null, 2));
}

function printGateTemplate(): void {
  const gateLines = LEDGER_GATES.map((gate) => {
    const base = `  ${gate}:
    status: passed
    evidence: <evidence>`;
    if (gate !== "stack_identity") {
      if (gate === "delivery_unit_delta") {
        return `${base}
    command: <validate-task-delta --unit command, or omit when selected_unit_id is atomic>
    output: <validate-task-delta output containing delivery_unit_delta_valid, or omit when selected_unit_id is atomic>`;
      }

      if (gate === "description_policy") {
        return `${base}
    owner: change-request-create | glab-mr-create | github-pr-create | equivalent_provider_adapter
    artifact: <implementation PR or MR URL>
    head_sha: <implementation artifact latest head sha>
    update_mode: created | updated | reused_current
    materiality_decision: material_update | metadata_only_reuse
    reuse_rationale: <required when update_mode is reused_current>
    readback_head_sha: <implementation artifact latest head sha>
    read_before_update: true | not_applicable_for_created
    pre_update_body_evidence: <summary, hash, artifact note, recovery evidence, or not_applicable_for_created>
    readback_after_update: true
    readback_outcome: clean | restored | blocked
    preserved_manual_sections: true | not_applicable_for_created
    rollback_or_restore_evidence: none | not_applicable_for_created | <restore evidence>
    omitted_process_history: true
    omitted_private_artifacts: true`;
      }

      return base;
    }

    return `${base}
    selected_unit_id: <OpenSpec delivery unit id>
    completed_work_item_ids: <comma-separated nested work item ids completed in this MR>
    selected_unit_base_sha: <selected unit base sha>
    predecessor_artifact: <predecessor PR or MR URL, or none for first implementation unit>
    implementation_artifact: <implementation PR or MR URL>
    implementation_head_sha: <implementation artifact latest head sha>
    restack_required: false`;
  }).join("\n");

  console.log(`## Readable Summary

- Delivery state: all required gates have evidence.
- Verification: one delivery-unit MR boundary, local checks, reviewer outcomes, artifact separation, hosted review, pipelines, and automatic feedback wait are accounted for.
- Finish condition: stack-ready or blocked with evidence.

\`\`\`yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab implementation MR URL>
  head_sha: <implementation artifact latest head sha>
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

delivery_gate_ledger:
${gateLines}
\`\`\`
`);
}

function printReviewerTemplate(): void {
  console.log(`## Readable Summary

- Reviewer launch: required implementation reviewers have been launched or explicitly skipped with reason.
- Reviewer outcome: every launched reviewer has a reconciled result.
- Blocking rule: unresolved findings or blocked reviewer outcomes stop delivery.

\`\`\`yaml
reviewer_launch:
  status: launched
  launched_reviewers:
    - implementation-review
    - implementation-scrutiny
    - code-quality-review
    - code-simplifier
    - deslop
    - docs-alignment-review
  skipped_reviewers:
    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review: not_applicable - no security-sensitive surface changed
  review_pass_ids:
    - implementation-review: <inline or subagent evidence id>
    - implementation-scrutiny: <inline or subagent evidence id>
    - code-quality-review: <inline or subagent evidence id>
    - code-simplifier: <inline or subagent evidence id>
    - deslop: <inline or subagent evidence id>
    - docs-alignment-review: <inline or subagent evidence id>

reviewer_report:
  status: complete
  launched_reviewers:
    - implementation-review
    - implementation-scrutiny
    - code-quality-review
    - code-simplifier
    - deslop
    - docs-alignment-review
  skipped_reviewers:
    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review: not_applicable - no security-sensitive surface changed
  outcomes:
    - implementation-review: passed - no actionable correctness or regression findings
    - implementation-scrutiny: passed - scrutiny verdict ship
    - code-quality-review: passed - no critical or warning maintainability findings
    - code-simplifier: passed - simplification applied or not needed
    - deslop: passed - AI-shaped clutter removed or not present
    - docs-alignment-review: passed - docs alignment clean or updated

review_execution_rules:
  - Run each review pass with the matching skill or review rubric.
  - Available local, cloud, or custom subagents may be used for independent review lanes when available.
  - Omit model overrides unless the user explicitly asks for one.
  - Print and validate reviewer_launch before waiting for review outcomes.
  - Validate reviewer_report before PR/MR creation or final delivery.
\`\`\`
`);
}

function printRefactoringExecutionTemplate(): void {
  console.log(`## Readable Summary

- Refactoring state: local cleanup stayed inside the approved unit.
- Deferred work: broader refactors are recorded as carry-forward, not mixed into this unit.
- Verification: run the narrowest behavior-preserving check.

\`\`\`yaml
refactoring_execution:
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
\`\`\`
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
  requireValue(
    handoff.expected_base_ref,
    "delivery.stack_identity.expected_base_ref",
    errors,
  );
  requireValue(
    handoff.expected_base_sha,
    "delivery.stack_identity.expected_base_sha",
    errors,
  );
  requireValue(
    handoff.predecessor_artifact,
    "delivery.stack_identity.predecessor_artifact",
    errors,
  );
  requireValue(
    handoff.selected_unit_base_sha,
    "delivery.stack_identity.selected_unit_base_sha",
    errors,
  );
  requireValue(
    handoff.restack_required,
    "delivery.stack_identity.restack_required",
    errors,
  );

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
    !["github_pr", "gitlab_mr"].includes(handoff.expected_host)
  ) {
    errors.push("delivery.expected_host must be one of: github_pr, gitlab_mr");
  }
  if (
    handoff.restack_required &&
    !["true", "false"].includes(handoff.restack_required)
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
  const expectedUnitId = optionalArg(args, "--unit");
  const expectedTaskId = optionalArg(args, "--task");
  if (!expectedUnitId && !expectedTaskId) {
    fail("validate-task-delta requires --unit <unit-id> or --task <task-id>");
  }

  if (expectedUnitId) {
    const delta = validateDeliveryUnitDelta(
      readFileSync(basePath, "utf8"),
      readFileSync(headPath, "utf8"),
      expectedUnitId,
    );
    if (delta.errors.length > 0) {
      console.error(
        `Invalid delivery_unit_delta:\n${delta.errors.map((error) => `- ${error}`).join("\n")}`,
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          status: "delivery_unit_delta_valid",
          added_unit: delta.addedUnit,
          added_work_items: delta.addedWorkItems,
        },
        null,
        2,
      ),
    );
    return;
  }

  const delta = validateUnitTaskDelta(
    readFileSync(basePath, "utf8"),
    readFileSync(headPath, "utf8"),
    expectedTaskId ?? "",
  );
  if (delta.errors.length > 0) {
    console.error(
      `Invalid unit_task_delta:\n${delta.errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "unit_task_delta_valid",
        added_task: delta.addedTask,
      },
      null,
      2,
    ),
  );
}

function validateLedger(input: string, args: string[] = []): void {
  const body = extractYaml(input);
  const section = extractSection(body, "delivery_gate_ledger");
  const errors: string[] = [];
  errors.push(
    ...nitroFeedbackGateErrors(input).map((error) =>
      error.startsWith("nitro_feedback_gate.")
        ? error
        : `nitro_feedback_gate.${error}`,
    ),
  );

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

  validateDeliveryGateSemantics(body, section, errors, {
    expectedArtifact: optionalArg(args, "--expected-artifact"),
    expectedHeadSha: optionalArg(args, "--expected-head-sha"),
  });

  if (errors.length > 0) {
    console.error(
      `Invalid delivery_gate_ledger:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("delivery_gate_ledger valid");
}

function validateDeliveryGateSemantics(
  body: string,
  section: string,
  errors: string[],
  options: {
    expectedArtifact?: string;
    expectedHeadSha?: string;
  } = {},
): void {
  const nitroArtifact = scalar(body, "artifact");
  const nitroHeadSha = scalar(body, "head_sha");
  const stackIdentityGate = findSection(section, "stack_identity");
  const implementationArtifact = stackIdentityGate
    ? scalar(stackIdentityGate, "implementation_artifact")
    : undefined;
  const implementationHeadSha = stackIdentityGate
    ? scalar(stackIdentityGate, "implementation_head_sha")
    : undefined;
  const selectedTaskId = stackIdentityGate
    ? scalar(stackIdentityGate, "selected_unit_id")
    : undefined;
  const selectedTaskBaseSha = stackIdentityGate
    ? scalar(stackIdentityGate, "selected_unit_base_sha")
    : undefined;
  const completedWorkItemIds = stackIdentityGate
    ? scalar(stackIdentityGate, "completed_work_item_ids")
    : undefined;
  const predecessorArtifact = stackIdentityGate
    ? scalar(stackIdentityGate, "predecessor_artifact")
    : undefined;
  const restackRequired = stackIdentityGate
    ? scalar(stackIdentityGate, "restack_required")
    : undefined;

  requireValue(selectedTaskId, "stack_identity.selected_unit_id", errors);
  requireValue(
    completedWorkItemIds,
    "stack_identity.completed_work_item_ids",
    errors,
  );
  requireValue(
    selectedTaskBaseSha,
    "stack_identity.selected_unit_base_sha",
    errors,
  );
  requireValue(
    predecessorArtifact,
    "stack_identity.predecessor_artifact",
    errors,
  );
  requireValue(
    implementationArtifact,
    "stack_identity.implementation_artifact",
    errors,
  );
  requireValue(
    implementationHeadSha,
    "stack_identity.implementation_head_sha",
    errors,
  );
  requireValue(restackRequired, "stack_identity.restack_required", errors);
  if (restackRequired && !["true", "false"].includes(restackRequired)) {
    errors.push("stack_identity.restack_required must be true or false");
  }
  if (
    nitroArtifact &&
    implementationArtifact &&
    nitroArtifact !== implementationArtifact
  ) {
    errors.push(
      "nitro_feedback_gate.artifact must match stack_identity.implementation_artifact",
    );
  }
  if (
    nitroHeadSha &&
    implementationHeadSha &&
    nitroHeadSha !== implementationHeadSha
  ) {
    errors.push(
      "nitro_feedback_gate.head_sha must match stack_identity.implementation_head_sha",
    );
  }
  if (
    options.expectedArtifact &&
    implementationArtifact &&
    implementationArtifact !== options.expectedArtifact
  ) {
    errors.push(
      "stack_identity.implementation_artifact must match expected artifact",
    );
  }
  if (
    options.expectedHeadSha &&
    implementationHeadSha &&
    implementationHeadSha !== options.expectedHeadSha
  ) {
    errors.push(
      "stack_identity.implementation_head_sha must match expected current artifact head",
    );
  }

  validateDescriptionPolicy(
    parseDescriptionPolicySection(
      findSection(section, "description_policy") ?? "",
    ),
    "description_policy",
    errors,
    {
      expectedArtifact: options.expectedArtifact ?? implementationArtifact,
      expectedHeadSha: options.expectedHeadSha ?? implementationHeadSha,
    },
  );

  const deliveryUnitDeltaGate = findSection(section, "delivery_unit_delta");
  const deliveryUnitDeltaStatus = deliveryUnitDeltaGate
    ? scalar(deliveryUnitDeltaGate, "status")
    : undefined;
  const deliveryUnitDeltaCommand = deliveryUnitDeltaGate
    ? scalar(deliveryUnitDeltaGate, "command")
    : undefined;
  const deliveryUnitDeltaOutput = deliveryUnitDeltaGate
    ? scalarOrBlock(deliveryUnitDeltaGate, "output")
    : undefined;
  const atomicPlanDelivery =
    selectedTaskId === "atomic" && deliveryUnitDeltaStatus === "not_applicable";

  if (atomicPlanDelivery) {
    if (deliveryUnitDeltaCommand || deliveryUnitDeltaOutput) {
      errors.push(
        "delivery_unit_delta.command and output must be omitted for atomic plan delivery",
      );
    }
  } else {
    requireValue(
      deliveryUnitDeltaCommand,
      "delivery_unit_delta.command",
      errors,
    );
    requireValue(deliveryUnitDeltaOutput, "delivery_unit_delta.output", errors);
    if (
      deliveryUnitDeltaCommand &&
      !deliveryUnitDeltaCommand.includes("validate-task-delta")
    ) {
      errors.push("delivery_unit_delta.command must run validate-task-delta");
    }
    if (
      deliveryUnitDeltaOutput &&
      !deliveryUnitDeltaOutput.includes("delivery_unit_delta_valid")
    ) {
      errors.push(
        "delivery_unit_delta.output must include delivery_unit_delta_valid",
      );
    }
    if (deliveryUnitDeltaCommand && selectedTaskId) {
      const commandUnitId = parseTaskDeltaCommandUnit(deliveryUnitDeltaCommand);
      if (!commandUnitId) {
        errors.push(
          "delivery_unit_delta.command must include --unit <selected_unit_id>",
        );
      } else if (commandUnitId !== selectedTaskId) {
        errors.push(
          "delivery_unit_delta.command --unit must match stack_identity.selected_unit_id",
        );
      }
    }
    if (deliveryUnitDeltaOutput && selectedTaskId) {
      const parsedOutput = parseDeliveryUnitDeltaOutput(
        deliveryUnitDeltaOutput,
      );
      if (!parsedOutput) {
        errors.push(
          "delivery_unit_delta.output must be parseable validator JSON",
        );
      } else {
        if (parsedOutput.status !== "delivery_unit_delta_valid") {
          errors.push(
            "delivery_unit_delta.output status must be delivery_unit_delta_valid",
          );
        }
        if (parsedOutput.addedUnitId !== selectedTaskId) {
          errors.push(
            "delivery_unit_delta.output added_unit.id must match stack_identity.selected_unit_id",
          );
        }
        const completedIds = parseCompletedWorkItemIds(completedWorkItemIds);
        const missingIds = completedIds.filter(
          (id) => !parsedOutput.addedWorkItemIds.includes(id),
        );
        if (missingIds.length > 0) {
          errors.push(
            `delivery_unit_delta.output added_work_items must include stack_identity.completed_work_item_ids ${missingIds.join(", ")}`,
          );
        }
      }
    }
  }

  const docsAlignmentGate = findSection(section, "docs_alignment");
  const docsAlignmentEvidence = docsAlignmentGate
    ? scalar(docsAlignmentGate, "evidence")
    : undefined;
  if (
    docsAlignmentEvidence &&
    !docsAlignmentEvidence.match(/\bdocs-alignment-review\b/i)
  ) {
    errors.push(
      "docs_alignment.evidence must reference a docs-alignment-review verdict",
    );
  }
  if (
    docsAlignmentEvidence &&
    !docsAlignmentEvidence.match(
      /\b(clean|resolved|not[ _-]?applicable|not needed)\b/i,
    )
  ) {
    errors.push(
      "docs_alignment.evidence must record a clean, resolved, or not-applicable docs-alignment verdict",
    );
  }

  const artifactBoundaryGate = findSection(section, "unit_artifact_boundary");
  const artifactBoundaryEvidence = artifactBoundaryGate
    ? scalar(artifactBoundaryGate, "evidence")
    : undefined;
  if (
    artifactBoundaryEvidence &&
    !artifactBoundaryEvidence.match(
      /\b(one|single|separate)\b.*\b(PR|MR|pull request|merge request|artifact)\b/i,
    )
  ) {
    errors.push(
      "unit_artifact_boundary.evidence must prove the approved delivery unit is delivered in one separate PR/MR or implementation artifact",
    );
  }

  const separationGate = findSection(
    section,
    "implementation_artifact_separation",
  );
  const separationEvidence = separationGate
    ? scalar(separationGate, "evidence")
    : undefined;
  if (
    separationEvidence &&
    !separationEvidence.match(/\b(separate|different|distinct)\b/i)
  ) {
    errors.push(
      "implementation_artifact_separation.evidence must prove the implementation artifact is separate from the planning review artifact",
    );
  }

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
      /\b(resolved|no nitro feedback|none posted|timeout|timed out|unavailable)\b/i,
    )
  ) {
    errors.push(
      "automatic_review_feedback_wait.evidence must show resolved Nitro feedback, no posted feedback after timeout, or unavailable review system evidence",
    );
  }
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

function scalarOrBlock(input: string, key: string): string | undefined {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*[|>]\\s*$`)),
  );
  if (keyIndex === -1) {
    return scalar(input, key);
  }

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const blockLines: string[] = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      blockLines.push("");
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }

    blockLines.push(line.slice(Math.min(indent, keyIndent + 2)));
  }

  const value = blockLines.join("\n").trim();
  return value || undefined;
}

function parseTaskDeltaCommandUnit(command: string): string | undefined {
  const match = command.match(
    /(?:^|\s)--unit(?:=|\s+)(?:"([^"]+)"|'([^']+)'|(\S+))/,
  );
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function parseDeliveryUnitDeltaOutput(
  output: string,
):
  | { status?: string; addedUnitId?: string; addedWorkItemIds: string[] }
  | undefined {
  try {
    const parsed = JSON.parse(output) as {
      status?: unknown;
      added_unit?: unknown;
      added_work_items?: unknown;
    };
    const addedUnit = parsed.added_unit;
    const addedUnitId =
      typeof addedUnit === "string"
        ? addedUnit
        : addedUnit && typeof addedUnit === "object" && "id" in addedUnit
          ? String((addedUnit as { id?: unknown }).id ?? "")
          : undefined;
    const addedWorkItemIds = Array.isArray(parsed.added_work_items)
      ? parsed.added_work_items
          .map((item) =>
            item && typeof item === "object" && "id" in item
              ? String((item as { id?: unknown }).id ?? "")
              : "",
          )
          .filter(Boolean)
      : [];
    return {
      status: typeof parsed.status === "string" ? parsed.status : undefined,
      addedUnitId: addedUnitId || undefined,
      addedWorkItemIds,
    };
  } catch {
    return undefined;
  }
}

function parseCompletedWorkItemIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateLaunchReport(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_launch");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const launchedReviewers = list(section, "launched_reviewers");
  const skippedReviewers = list(section, "skipped_reviewers");
  const reviewPassIds = list(section, "review_pass_ids");
  const skippedReviewerNames = parseSkippedReviewers(skippedReviewers, errors);
  const reviewPassIdReviewers = new Set<string>();

  if (status !== "launched") {
    errors.push("reviewer_launch.status must be launched");
  }

  requireRequiredReviewers(launchedReviewers, errors);
  requireKnownReviewers(launchedReviewers, "launched", errors);
  requireConditionalReviewerAccounting(
    "security-review",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );
  requireConditionalReviewerAccounting(
    "ai-readiness-upkeep",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );

  for (const reviewPassId of reviewPassIds) {
    const parsed = reviewPassId.match(/^([^:]+):\s*(.+)$/);
    if (!parsed) {
      errors.push(
        `review pass id must use '<reviewer>: <inline or subagent evidence id>': ${reviewPassId}`,
      );
      continue;
    }

    const reviewer = parsed[1].trim();
    const id = parsed[2].trim();

    if (!includes(REVIEW_PASSES, reviewer)) {
      errors.push(`unknown review pass id reviewer: ${reviewer}`);
    }

    if (!id || id.startsWith("<")) {
      errors.push(`${reviewer} review pass id is required`);
    }

    reviewPassIdReviewers.add(reviewer);
  }

  for (const reviewer of launchedReviewers) {
    if (!reviewPassIdReviewers.has(reviewer)) {
      errors.push(`missing review pass id for launched reviewer: ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid reviewer_launch:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("reviewer_launch valid");
}

function validateReviewReport(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_report");
  const errors: string[] = [];
  const status = scalar(section, "status");
  const launchedReviewers = list(section, "launched_reviewers");
  const skippedReviewers = list(section, "skipped_reviewers");
  const outcomes = list(section, "outcomes");
  const outcomeReviewers = new Set<string>();
  const skippedReviewerNames = parseSkippedReviewers(skippedReviewers, errors);

  if (status !== "complete") {
    errors.push("reviewer_report.status must be complete");
  }

  requireRequiredReviewers(launchedReviewers, errors);
  requireKnownReviewers(launchedReviewers, "launched", errors);
  requireConditionalReviewerAccounting(
    "security-review",
    launchedReviewers,
    skippedReviewerNames,
    errors,
  );
  requireConditionalReviewerAccounting(
    "ai-readiness-upkeep",
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

    if (!includes(REVIEW_PASSES, reviewer)) {
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
      includes(MUST_PASS_REVIEW_PASSES, reviewer) &&
      outcomeStatus !== "passed"
    ) {
      errors.push(`${reviewer} outcome must be passed`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${reviewer} outcome evidence is required`);
    }

    if (
      reviewer === "ai-readiness-upkeep" &&
      !evidence.match(
        /validate-report|validated ai_readiness_upkeep_report|ai_readiness_upkeep_report valid/i,
      )
    ) {
      errors.push(
        "ai-readiness-upkeep outcome evidence must mention validate-report or a validated ai_readiness_upkeep_report",
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
      `Invalid reviewer_report:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("reviewer_report valid");
}

function requireRequiredReviewers(
  launchedReviewers: string[],
  errors: string[],
): void {
  for (const reviewer of REQUIRED_REVIEW_PASSES) {
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
    if (!includes(REVIEW_PASSES, reviewer)) {
      errors.push(`unknown ${label} reviewer: ${reviewer}`);
    }
  }
}

function requireConditionalReviewerAccounting(
  reviewer: (typeof REVIEW_PASSES)[number],
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

    if (!includes(REVIEW_PASSES, reviewer)) {
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
  const stackIdentity = findSection(delivery, "stack_identity") ?? "";
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
    expected_base_ref: scalar(stackIdentity, "expected_base_ref"),
    expected_base_sha: scalar(stackIdentity, "expected_base_sha"),
    predecessor_artifact: scalar(stackIdentity, "predecessor_artifact"),
    selected_unit_base_sha:
      scalar(stackIdentity, "selected_unit_base_sha") ??
      scalar(stackIdentity, "selected_task_base_sha"),
    restack_required: scalar(stackIdentity, "restack_required"),
    completion_updates: list(delivery, "completion_updates"),
    required_reviewers: list(review, "required_reviewers"),
    optional_reviewers: list(review, "optional_reviewers"),
    blockers: list(section, "blockers"),
  };
}

const legacyErrors = legacyPlanContractErrors;

function requiredArg(args: string[], flag: string): string {
  const value = optionalArg(args, flag);
  if (!value) {
    fail(`validate-task-delta requires ${flag}`);
  }
  return value;
}

function isKnownReviewer(reviewer: string): boolean {
  return (
    includes(BASELINE_REVIEWERS, reviewer) ||
    includes(OPTIONAL_REVIEWERS, reviewer)
  );
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

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

main();
