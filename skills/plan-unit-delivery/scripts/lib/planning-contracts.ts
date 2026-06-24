import { readFileSync } from "node:fs";

export const LEGACY_PLAN_ROOTS = [
  "slice_plan_review",
  "plan_coordinate_handoff",
  "plan_ready_handoff",
  "plan_followthrough_slice_handoff",
  "plan_followthrough_ledger",
] as const;

export const LEGACY_PLAN_KEYS = ["reviewed_slices"] as const;

export const PLANNING_REVIEW_MODES = ["stacked_delivery"] as const;

export const PLANNING_REVIEW_OUTCOMES = ["ready_for_stack"] as const;

export const PLANNING_REVIEW_ARTIFACT_TYPES = [
  "plan",
  "openspec",
  "linear",
] as const;

const DESCRIPTION_POLICY_OWNERS = [
  "change-request-create",
  "glab-mr-create",
  "github-pr-create",
  "equivalent_provider_adapter",
] as const;

const DESCRIPTION_POLICY_UPDATE_MODES = [
  "created",
  "updated",
  "reused_current",
] as const;

const DESCRIPTION_POLICY_MATERIALITY_DECISIONS = [
  "material_update",
  "metadata_only_reuse",
] as const;

export type PlanningReview = {
  status?: string;
  artifact_type?: string;
  artifact_ref?: string;
  review_artifact?: string;
  mode?: string;
  gate_outcome?: string;
  target_branch?: string;
  target_base_sha?: string;
  planning_branch?: string;
  reviewed_head?: string;
  description_policy?: DescriptionPolicy;
  stack_base_ref?: string;
  stack_base_evidence?: string;
  stack_identity_expected_base_ref?: string;
  stack_identity_expected_base_sha?: string;
  stack_identity_predecessor_artifact?: string;
  stack_identity_restack_required?: string;
  task_state_fingerprint?: string;
  validation_evidence: string[];
  review_evidence: string[];
  planning_feedback_status?: string;
  planning_feedback_evidence: string[];
  planning_feedback_items: PlanningFeedbackDispositionItem[];
  blockers: string[];
};

type PlanningReviewValidationOptions = {
  expectedReviewArtifact?: string;
  expectedReviewedHead?: string;
};

export type DescriptionPolicy = {
  status?: string;
  owner?: string;
  artifact?: string;
  head_sha?: string;
  update_mode?: string;
  materiality_decision?: string;
  reuse_rationale?: string;
  readback_head_sha?: string;
  read_before_update?: string;
  pre_update_body_evidence?: string;
  readback_after_update?: string;
  readback_outcome?: string;
  preserved_manual_sections?: string;
  rollback_or_restore_evidence?: string;
  evidence: string[];
  omitted_process_history?: string;
  omitted_private_artifacts?: string;
};

type PlanningFeedbackDispositionItem = {
  note_id?: string;
  discussion_id?: string;
  resolvable?: string;
  resolved?: string;
  disposition?: string;
  implementation_task?: string;
  evidence?: string;
};

const PLANNING_FEEDBACK_DISPOSITIONS = [
  "fixed_in_planning",
  "deferred_to_task",
  "non_actionable",
  "blocked",
] as const;

const DESCRIPTION_POLICY_READBACK_OUTCOMES = [
  "clean",
  "restored",
  "blocked",
] as const;

export function readInput(args: string[]): string {
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

export function extractYaml(input: string): string {
  const fenced = input.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
  return (fenced?.[1] ?? input).trim();
}

export function extractSection(input: string, sectionName: string): string {
  return findSection(input, sectionName) ?? input;
}

export function findSection(input: string, sectionName: string): string | null {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return null;
  }

  const sectionIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0;
  const sectionLines: string[] = [];

  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      sectionLines.push("");
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= sectionIndent) {
      break;
    }

    sectionLines.push(line.slice(Math.min(indent, sectionIndent + 2)));
  }

  return sectionLines.join("\n");
}

export function hasSection(input: string, sectionName: string): boolean {
  return new RegExp(`^\\s*${escapeRegExp(sectionName)}:\\s*$`, "m").test(input);
}

export function hasKey(input: string, key: string): boolean {
  return new RegExp(`^\\s*${escapeRegExp(key)}:\\s*`, "m").test(input);
}

export function scalar(input: string, key: string): string | undefined {
  const match = input.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"),
  );
  return match ? cleanScalar(match[1]) : undefined;
}

export function list(input: string, key: string): string[] {
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

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const values: string[] = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }

    const item = line.trim().match(/^- (.+)$/);
    if (item) {
      values.push(cleanScalar(item[1]));
    }
  }

  return values.filter(Boolean);
}

export function legacyPlanContractErrors(input: string): string[] {
  const body = extractYaml(input);
  const errors: string[] = [];

  for (const root of LEGACY_PLAN_ROOTS) {
    if (hasSection(body, root)) {
      errors.push(`${root} is legacy; rerun plan-ready`);
    }
  }

  for (const key of LEGACY_PLAN_KEYS) {
    if (hasKey(body, key)) {
      errors.push(`${key} is legacy; rerun plan-ready`);
    }
  }

  return errors;
}

export function parsePlanningReview(input: string): PlanningReview {
  const body = extractYaml(input);
  const section = findSection(body, "planning_review") ?? "";
  const descriptionPolicy = findSection(section, "description_policy") ?? "";
  const stackIdentity = findSection(section, "stack_identity") ?? "";
  const validation = findSection(section, "validation") ?? "";
  const review = findSection(section, "review") ?? "";
  const planningFeedback =
    findSection(section, "planning_feedback_disposition") ?? "";

  return {
    status: scalar(section, "status"),
    artifact_type: scalar(section, "artifact_type"),
    artifact_ref: scalar(section, "artifact_ref"),
    review_artifact: scalar(section, "review_artifact"),
    mode: scalar(section, "mode"),
    gate_outcome: scalar(section, "gate_outcome"),
    target_branch: scalar(section, "target_branch"),
    target_base_sha: scalar(section, "target_base_sha"),
    planning_branch: scalar(section, "planning_branch"),
    reviewed_head: scalar(section, "reviewed_head"),
    description_policy: parseDescriptionPolicySection(descriptionPolicy),
    stack_base_ref: scalar(section, "stack_base_ref"),
    stack_base_evidence: scalar(section, "stack_base_evidence"),
    stack_identity_expected_base_ref: scalar(
      stackIdentity,
      "expected_base_ref",
    ),
    stack_identity_expected_base_sha: scalar(
      stackIdentity,
      "expected_base_sha",
    ),
    stack_identity_predecessor_artifact: scalar(
      stackIdentity,
      "predecessor_artifact",
    ),
    stack_identity_restack_required: scalar(stackIdentity, "restack_required"),
    task_state_fingerprint: scalar(section, "task_state_fingerprint"),
    validation_evidence: list(validation || section, "evidence"),
    review_evidence: list(review || section, "evidence"),
    planning_feedback_status: scalar(planningFeedback, "status"),
    planning_feedback_evidence: list(planningFeedback, "evidence"),
    planning_feedback_items: parseObjectList(planningFeedback, "items"),
    blockers: list(section, "blockers"),
  };
}

export function validatePlanningReviewContract(
  input: string,
  errors: string[] = [],
  options: PlanningReviewValidationOptions = {},
): PlanningReview {
  const review = parsePlanningReview(input);

  requireValue(review.status, "planning_review.status", errors);
  requireValue(review.artifact_type, "planning_review.artifact_type", errors);
  requireValue(review.artifact_ref, "planning_review.artifact_ref", errors);
  requireValue(
    review.review_artifact,
    "planning_review.review_artifact",
    errors,
  );
  requireValue(review.mode, "planning_review.mode", errors);
  requireValue(review.gate_outcome, "planning_review.gate_outcome", errors);
  requireValue(review.target_branch, "planning_review.target_branch", errors);
  requireValue(
    review.target_base_sha,
    "planning_review.target_base_sha",
    errors,
  );
  requireValue(
    review.planning_branch,
    "planning_review.planning_branch",
    errors,
  );
  requireValue(review.reviewed_head, "planning_review.reviewed_head", errors);
  if (
    options.expectedReviewArtifact &&
    review.review_artifact &&
    review.review_artifact !== options.expectedReviewArtifact
  ) {
    errors.push("planning_review.review_artifact must match expected artifact");
  }
  if (
    options.expectedReviewedHead &&
    review.reviewed_head &&
    review.reviewed_head !== options.expectedReviewedHead
  ) {
    errors.push(
      "planning_review.reviewed_head must match expected current artifact head",
    );
  }
  validateDescriptionPolicy(
    review.description_policy,
    "planning_review.description_policy",
    errors,
    {
      expectedArtifact:
        options.expectedReviewArtifact ?? review.review_artifact,
      expectedHeadSha: options.expectedReviewedHead ?? review.reviewed_head,
    },
  );
  requireValue(
    review.task_state_fingerprint,
    "planning_review.task_state_fingerprint",
    errors,
  );

  if (review.status && review.status !== "reviewed") {
    errors.push("planning_review.status must be reviewed");
  }

  if (
    review.artifact_type &&
    !includes(PLANNING_REVIEW_ARTIFACT_TYPES, review.artifact_type)
  ) {
    errors.push(
      `planning_review.artifact_type must be one of: ${PLANNING_REVIEW_ARTIFACT_TYPES.join(", ")}`,
    );
  }

  if (
    review.mode === "ship_then_continue" ||
    review.mode === "stack_when_ready"
  ) {
    errors.push(
      `planning_review.mode ${review.mode} is legacy; rerun plan-ready and plan-review with stacked_delivery`,
    );
  } else if (review.mode && !includes(PLANNING_REVIEW_MODES, review.mode)) {
    errors.push(
      `planning_review.mode must be one of: ${PLANNING_REVIEW_MODES.join(", ")}`,
    );
  }

  if (
    review.gate_outcome &&
    !includes(PLANNING_REVIEW_OUTCOMES, review.gate_outcome)
  ) {
    errors.push(
      `planning_review.gate_outcome must be one of: ${PLANNING_REVIEW_OUTCOMES.join(", ")}`,
    );
  }

  if (review.mode === "stacked_delivery") {
    requireValue(
      review.stack_base_ref,
      "planning_review.stack_base_ref",
      errors,
    );
    requireValue(
      review.stack_base_evidence,
      "planning_review.stack_base_evidence",
      errors,
    );
    requireValue(
      review.stack_identity_expected_base_ref,
      "planning_review.stack_identity.expected_base_ref",
      errors,
    );
    requireValue(
      review.stack_identity_expected_base_sha,
      "planning_review.stack_identity.expected_base_sha",
      errors,
    );
    requireValue(
      review.stack_identity_restack_required,
      "planning_review.stack_identity.restack_required",
      errors,
    );
    if (review.gate_outcome !== "ready_for_stack") {
      errors.push(
        "planning_review.gate_outcome must be ready_for_stack for stacked_delivery",
      );
    }
  }

  if (
    review.stack_identity_restack_required &&
    !["true", "false"].includes(review.stack_identity_restack_required)
  ) {
    errors.push(
      "planning_review.stack_identity.restack_required must be true or false",
    );
  }

  if (review.validation_evidence.length === 0) {
    errors.push("planning_review.validation.evidence is required");
  }

  if (review.review_evidence.length === 0) {
    errors.push("planning_review.review.evidence is required");
  }

  validatePlanningFeedbackDisposition(review, errors);

  if (review.blockers.length > 0) {
    errors.push("planning_review.blockers must be empty before sequencing");
  }

  return review;
}

export function parseDescriptionPolicySection(
  section: string,
): DescriptionPolicy | undefined {
  if (!section.trim()) {
    return undefined;
  }

  return {
    status: scalar(section, "status"),
    owner: scalar(section, "owner"),
    artifact: scalar(section, "artifact"),
    head_sha: scalar(section, "head_sha"),
    update_mode: scalar(section, "update_mode"),
    materiality_decision: scalar(section, "materiality_decision"),
    reuse_rationale: scalar(section, "reuse_rationale"),
    readback_head_sha: scalar(section, "readback_head_sha"),
    read_before_update: scalar(section, "read_before_update"),
    pre_update_body_evidence: scalar(section, "pre_update_body_evidence"),
    readback_after_update: scalar(section, "readback_after_update"),
    readback_outcome: scalar(section, "readback_outcome"),
    preserved_manual_sections: scalar(section, "preserved_manual_sections"),
    rollback_or_restore_evidence: scalar(
      section,
      "rollback_or_restore_evidence",
    ),
    evidence: descriptionPolicyEvidence(section),
    omitted_process_history: scalar(section, "omitted_process_history"),
    omitted_private_artifacts: scalar(section, "omitted_private_artifacts"),
  };
}

function descriptionPolicyEvidence(section: string): string[] {
  const listed = list(section, "evidence");
  if (listed.length > 0) {
    return listed;
  }

  const inline = scalar(section, "evidence");
  return inline ? [inline] : [];
}

export function validateDescriptionPolicy(
  policy: DescriptionPolicy | undefined,
  label: string,
  errors: string[],
  options: {
    expectedArtifact?: string;
    expectedHeadSha?: string;
  } = {},
): void {
  if (!policy) {
    errors.push(`${label} is required`);
    return;
  }

  requireValue(policy.status, `${label}.status`, errors);
  requireValue(policy.owner, `${label}.owner`, errors);
  requireValue(policy.artifact, `${label}.artifact`, errors);
  requireValue(policy.head_sha, `${label}.head_sha`, errors);
  requireValue(policy.update_mode, `${label}.update_mode`, errors);
  requireValue(
    policy.materiality_decision,
    `${label}.materiality_decision`,
    errors,
  );
  requireValue(policy.readback_head_sha, `${label}.readback_head_sha`, errors);
  requireValue(
    policy.read_before_update,
    `${label}.read_before_update`,
    errors,
  );
  requireValue(
    policy.pre_update_body_evidence,
    `${label}.pre_update_body_evidence`,
    errors,
  );
  requireValue(
    policy.readback_after_update,
    `${label}.readback_after_update`,
    errors,
  );
  requireValue(policy.readback_outcome, `${label}.readback_outcome`, errors);
  requireValue(
    policy.preserved_manual_sections,
    `${label}.preserved_manual_sections`,
    errors,
  );
  requireValue(
    policy.rollback_or_restore_evidence,
    `${label}.rollback_or_restore_evidence`,
    errors,
  );
  requireValue(
    policy.omitted_process_history,
    `${label}.omitted_process_history`,
    errors,
  );
  requireValue(
    policy.omitted_private_artifacts,
    `${label}.omitted_private_artifacts`,
    errors,
  );

  if (policy.status && policy.status !== "passed") {
    errors.push(`${label}.status must be passed`);
  }
  if (
    policy.readback_outcome &&
    !includes(DESCRIPTION_POLICY_READBACK_OUTCOMES, policy.readback_outcome)
  ) {
    errors.push(
      `${label}.readback_outcome must be one of: ${DESCRIPTION_POLICY_READBACK_OUTCOMES.join(", ")}`,
    );
  }
  if (policy.readback_outcome === "blocked") {
    errors.push(`${label}.readback_outcome blocked prevents readiness`);
  }
  if (policy.owner && !includes(DESCRIPTION_POLICY_OWNERS, policy.owner)) {
    errors.push(
      `${label}.owner must be one of: ${DESCRIPTION_POLICY_OWNERS.join(", ")}`,
    );
  }
  if (
    policy.update_mode &&
    !includes(DESCRIPTION_POLICY_UPDATE_MODES, policy.update_mode)
  ) {
    errors.push(
      `${label}.update_mode must be one of: ${DESCRIPTION_POLICY_UPDATE_MODES.join(", ")}`,
    );
  }
  if (
    policy.materiality_decision &&
    !includes(
      DESCRIPTION_POLICY_MATERIALITY_DECISIONS,
      policy.materiality_decision,
    )
  ) {
    errors.push(
      `${label}.materiality_decision must be one of: ${DESCRIPTION_POLICY_MATERIALITY_DECISIONS.join(", ")}`,
    );
  }

  if (policy.evidence.length === 0) {
    errors.push(`${label}.evidence is required`);
  }
  if (policy.evidence.some((item) => item.startsWith("<"))) {
    errors.push(`${label}.evidence must not contain placeholder values`);
  }
  if (
    policy.readback_outcome === "restored" &&
    (!policy.rollback_or_restore_evidence ||
      policy.rollback_or_restore_evidence === "none" ||
      policy.rollback_or_restore_evidence === "not_applicable_for_created")
  ) {
    errors.push(
      `${label}.rollback_or_restore_evidence is required when readback_outcome is restored`,
    );
  }

  validateBooleanOrCreatedNotApplicable(
    policy.read_before_update,
    `${label}.read_before_update`,
    policy.update_mode,
    errors,
  );
  validateBooleanOrCreatedNotApplicable(
    policy.preserved_manual_sections,
    `${label}.preserved_manual_sections`,
    policy.update_mode,
    errors,
  );
  for (const key of [
    ["readback_after_update", policy.readback_after_update],
    ["omitted_process_history", policy.omitted_process_history],
    ["omitted_private_artifacts", policy.omitted_private_artifacts],
  ] as const) {
    if (key[1] && key[1] !== "true") {
      errors.push(`${label}.${key[0]} must be true`);
    }
  }

  if (
    options.expectedArtifact &&
    policy.artifact &&
    policy.artifact !== options.expectedArtifact
  ) {
    errors.push(`${label}.artifact must match current artifact`);
  }
  if (
    options.expectedHeadSha &&
    policy.head_sha &&
    policy.head_sha !== options.expectedHeadSha
  ) {
    errors.push(`${label}.head_sha must match current artifact head`);
  }
  if (
    options.expectedHeadSha &&
    policy.readback_head_sha &&
    policy.readback_head_sha !== options.expectedHeadSha
  ) {
    errors.push(`${label}.readback_head_sha must match current artifact head`);
  }
  if (
    policy.head_sha &&
    policy.readback_head_sha &&
    policy.head_sha !== policy.readback_head_sha
  ) {
    errors.push(`${label}.readback_head_sha must match head_sha`);
  }
  if (policy.update_mode === "reused_current") {
    if (policy.materiality_decision !== "metadata_only_reuse") {
      errors.push(
        `${label}.update_mode reused_current requires materiality_decision metadata_only_reuse`,
      );
    }
    requireValue(policy.reuse_rationale, `${label}.reuse_rationale`, errors);
    if (policy.reuse_rationale?.startsWith("<")) {
      errors.push(`${label}.reuse_rationale is required`);
    }
  } else if (policy.materiality_decision === "metadata_only_reuse") {
    errors.push(
      `${label}.materiality_decision metadata_only_reuse requires update_mode reused_current`,
    );
  }
}

function validateBooleanOrCreatedNotApplicable(
  value: string | undefined,
  label: string,
  updateMode: string | undefined,
  errors: string[],
): void {
  if (!value || value === "true") {
    return;
  }

  if (value === "not_applicable_for_created" && updateMode === "created") {
    return;
  }

  errors.push(`${label} must be true unless update_mode is created`);
}

function validatePlanningFeedbackDisposition(
  review: PlanningReview,
  errors: string[],
): void {
  requireValue(
    review.planning_feedback_status,
    "planning_review.planning_feedback_disposition.status",
    errors,
  );
  if (
    review.planning_feedback_status &&
    review.planning_feedback_status !== "complete"
  ) {
    errors.push(
      "planning_review.planning_feedback_disposition.status must be complete",
    );
  }
  if (review.planning_feedback_evidence.length === 0) {
    errors.push(
      "planning_review.planning_feedback_disposition.evidence is required",
    );
  }
  if (review.planning_feedback_items.length === 0) {
    errors.push(
      "planning_review.planning_feedback_disposition.items must enumerate Nitro planning feedback or record an explicit none item",
    );
  }

  for (const [index, item] of review.planning_feedback_items.entries()) {
    const label = `planning_review.planning_feedback_disposition.items[${index}]`;
    requireValue(item.note_id, `${label}.note_id`, errors);
    requireValue(item.disposition, `${label}.disposition`, errors);
    requireValue(item.evidence, `${label}.evidence`, errors);

    if (
      item.disposition &&
      !includes(PLANNING_FEEDBACK_DISPOSITIONS, item.disposition)
    ) {
      errors.push(
        `${label}.disposition must be one of: ${PLANNING_FEEDBACK_DISPOSITIONS.join(", ")}`,
      );
    }
    if (item.disposition === "blocked") {
      errors.push(`${label}.disposition blocked prevents implementation`);
    }
    if (item.disposition === "deferred_to_task") {
      requireValue(
        item.implementation_task,
        `${label}.implementation_task`,
        errors,
      );
    }

    if (item.resolvable && !["true", "false"].includes(item.resolvable)) {
      errors.push(`${label}.resolvable must be true or false`);
    }
    if (item.resolved && !["true", "false"].includes(item.resolved)) {
      errors.push(`${label}.resolved must be true or false`);
    }
    if (item.resolvable === "true") {
      requireValue(item.discussion_id, `${label}.discussion_id`, errors);
      requireValue(item.resolved, `${label}.resolved`, errors);
      if (
        item.resolved === "false" &&
        item.disposition !== "deferred_to_task" &&
        item.disposition !== "non_actionable"
      ) {
        errors.push(
          `${label} unresolved resolvable discussion must be resolved in GitLab or dispositioned as deferred_to_task/non_actionable`,
        );
      }
    }
  }
}

function parseObjectList(input: string, key: string): Record<string, string>[] {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return [];
  }

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const items: Record<string, string>[] = [];
  let current: Record<string, string> | undefined;

  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }

    const newItem = line.trim().match(/^- (?:(\w+):\s*(.*))?$/);
    if (newItem) {
      current = {};
      items.push(current);
      if (newItem[1]) {
        current[newItem[1]] = cleanScalar(newItem[2] ?? "");
      }
      continue;
    }

    const pair = line.trim().match(/^(\w+):\s*(.*)$/);
    if (pair && current) {
      current[pair[1]] = cleanScalar(pair[2]);
    }
  }

  return items;
}

export function requireValue(
  value: string | undefined,
  label: string,
  errors: string[],
): void {
  if (!value || value.startsWith("<")) {
    errors.push(`${label} is required`);
  }
}

export function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value as T[number]);
}

export function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
