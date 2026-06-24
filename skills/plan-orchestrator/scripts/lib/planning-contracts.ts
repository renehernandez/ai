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

  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
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
