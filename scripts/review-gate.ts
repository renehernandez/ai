import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RESULT_STATUSES = new Set(["passed", "failed", "blocked"]);
const GATE_STATUSES = new Set(["active", "consumed", "cleared"]);

export type ReviewGateResult = {
  status?: "passed" | "failed" | "blocked";
  diffHash?: string;
  completedAt?: string;
  summary?: string;
};

export type ReviewGateStatus = "active" | "consumed" | "cleared";

export type ReviewGateSourceProvenance = {
  kind: string;
  ref: string;
  evidence?: string[];
};

export type ReviewGateState = {
  version: 1;
  active: boolean;
  status?: ReviewGateStatus;
  workflow?: string;
  unit?: {
    id?: string;
    title?: string;
  };
  sourceProvenance?: ReviewGateSourceProvenance;
  stagedDiffHash?: string;
  requiredReviewPasses?: string[];
  results?: Record<string, ReviewGateResult>;
  blockingFindings?: unknown[];
  updatedAt?: string;
  consumedAt?: string;
  clearedAt?: string;
};

export type ReviewGateValidation = {
  ok: boolean;
  statePath: string;
  active: boolean;
  stagedDiffHash: string;
  requiredReviewPasses: string[];
  completedReviewPasses: string[];
  missingReviewPasses: string[];
  staleReviewPasses: string[];
  blockingFindings: unknown[];
  errors: string[];
  note?: string;
};

export type ReviewGateResultInput = Omit<ReviewGateResult, "diffHash"> & {
  status: "passed" | "failed" | "blocked";
  diffHash: string;
};

export type ActiveReviewGateInput = {
  workflow: string;
  unit?: ReviewGateState["unit"];
  sourceProvenance: ReviewGateSourceProvenance;
  requiredReviewPasses: string[];
  results: Record<string, ReviewGateResultInput>;
  blockingFindings?: unknown[];
};

export type ReviewGateWriteResult = {
  statePath: string;
  state: ReviewGateState;
};

export type ReviewGateConsumeResult = {
  statePath: string;
  consumed: boolean;
  state?: ReviewGateState;
  note?: string;
};

type ReviewGateReadResult =
  | { exists: false }
  | { exists: true; ok: true; state: unknown }
  | { exists: true; ok: false; error: string };

export function reviewGateStatePath(cwd = process.cwd()): string {
  const gitDir = gitOutput(["rev-parse", "--git-dir"], cwd);
  const resolvedGitDir = isAbsolute(gitDir) ? gitDir : resolve(cwd, gitDir);
  return resolve(resolvedGitDir, "ax", "review-gate.json");
}

export function ensureReviewGateStateDirectory(cwd = process.cwd()): string {
  const statePath = reviewGateStatePath(cwd);
  mkdirSync(dirname(statePath), { recursive: true });
  return statePath;
}

export function stagedDiffHash(cwd = process.cwd()): string {
  const diff = gitOutputBuffer(["diff", "--cached", "--binary"], cwd);
  return `sha256:${createHash("sha256").update(diff).digest("hex")}`;
}

export function hasStagedDiff(cwd = process.cwd()): boolean {
  const result = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd,
    encoding: "utf-8",
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

export function writeActiveReviewGate(
  input: ActiveReviewGateInput,
  cwd = process.cwd(),
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
    stagedDiffHash: diffHash,
    requiredReviewPasses: input.requiredReviewPasses,
    results: normalizeResultInput(input.results, diffHash),
    blockingFindings: input.blockingFindings ?? [],
    updatedAt: now,
  };

  writeValidatedState(statePath, state);
  return { statePath, state };
}

export function consumeReviewGate(
  cwd = process.cwd(),
): ReviewGateConsumeResult {
  const statePath = reviewGateStatePath(cwd);
  const readResult = readReviewGateState(statePath);
  if (!readResult.exists) {
    return {
      statePath,
      consumed: false,
      note: "No review gate state found; nothing to consume.",
    };
  }
  if (!readResult.ok) {
    throw new Error(
      `Cannot consume invalid review gate state: Review gate state is not valid JSON: ${readResult.error}`,
    );
  }
  const state = readResult.state;
  const schemaErrors = validateStateShape(state);
  if (schemaErrors.length > 0) {
    throw new Error(
      `Cannot consume invalid review gate state: ${schemaErrors.join("; ")}`,
    );
  }
  if (!isPlainRecord(state)) {
    throw new Error("Cannot consume invalid review gate state.");
  }
  const reviewGateState = state as ReviewGateState;
  if (!reviewGateState.active) {
    return {
      statePath,
      consumed: false,
      state: reviewGateState,
      note: "Review gate is already inactive; nothing to consume.",
    };
  }

  const now = new Date().toISOString();
  const consumedState: ReviewGateState = {
    ...reviewGateState,
    active: false,
    status: "consumed",
    updatedAt: now,
    consumedAt: now,
  };
  writeValidatedState(statePath, consumedState);
  return { statePath, consumed: true, state: consumedState };
}

export function clearReviewGate(cwd = process.cwd()): ReviewGateWriteResult {
  const statePath = reviewGateStatePath(cwd);
  const now = new Date().toISOString();
  const state: ReviewGateState = {
    version: 1,
    active: false,
    status: "cleared",
    requiredReviewPasses: [],
    results: {},
    blockingFindings: [],
    updatedAt: now,
    clearedAt: now,
  };
  writeValidatedState(statePath, state);
  return { statePath, state };
}

export function validateReviewGateForCommit(
  cwd = process.cwd(),
): ReviewGateValidation {
  const statePath = reviewGateStatePath(cwd);
  const currentDiffHash = stagedDiffHash(cwd);
  const base: Omit<ReviewGateValidation, "ok" | "errors"> = {
    statePath,
    active: false,
    stagedDiffHash: currentDiffHash,
    requiredReviewPasses: [],
    completedReviewPasses: [],
    missingReviewPasses: [],
    staleReviewPasses: [],
    blockingFindings: [],
  };

  if (!existsSync(statePath)) {
    return {
      ...base,
      ok: true,
      errors: [],
      note: "No review gate state found; allowing commit.",
    };
  }

  let state: unknown;
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  } catch (error) {
    return {
      ...base,
      ok: false,
      errors: [`Review gate state is not valid JSON: ${errorMessage(error)}`],
    };
  }

  const normalized = normalizeState(state);
  const schemaErrors = normalized.errors;
  const requiredReviewPasses = normalized.requiredReviewPasses;
  const results = normalized.results;
  const active = normalized.active;
  const stateDiffHash = normalized.stagedDiffHash;
  const completedReviewPasses = requiredReviewPasses.filter((reviewPass) => {
    const result = results[reviewPass];
    return result?.status === "passed" && result.diffHash === currentDiffHash;
  });
  const missingReviewPasses = requiredReviewPasses.filter(
    (reviewPass) => !results[reviewPass],
  );
  const staleReviewPasses = requiredReviewPasses.filter((reviewPass) => {
    const result = results[reviewPass];
    return Boolean(result && result.diffHash !== currentDiffHash);
  });
  const blockingFindings = normalized.blockingFindings;

  if (!active) {
    return {
      ...base,
      ok: schemaErrors.length === 0,
      active: false,
      requiredReviewPasses,
      completedReviewPasses,
      missingReviewPasses,
      staleReviewPasses,
      blockingFindings,
      errors: schemaErrors,
      note:
        schemaErrors.length === 0
          ? "Review gate is inactive; allowing commit."
          : undefined,
    };
  }

  const errors = [
    ...schemaErrors,
    ...missingReviewPasses.map(
      (reviewPass) => `Missing required review pass: ${reviewPass}`,
    ),
    ...staleReviewPasses.map(
      (reviewPass) =>
        `Stale review pass for current staged diff: ${reviewPass}`,
    ),
  ];

  for (const reviewPass of requiredReviewPasses) {
    const result = results[reviewPass];
    if (result && result.status !== "passed") {
      errors.push(`Review pass is not passed: ${reviewPass}`);
    }
  }

  if (blockingFindings.length > 0) {
    errors.push("Review gate has unresolved blocking findings.");
  }

  if (stateDiffHash && stateDiffHash !== currentDiffHash) {
    errors.push("Review gate staged diff hash is stale.");
  }

  return {
    ...base,
    ok: errors.length === 0,
    active: true,
    requiredReviewPasses,
    completedReviewPasses,
    missingReviewPasses,
    staleReviewPasses,
    blockingFindings,
    errors,
  };
}

export function formatReviewGateStatus(
  validation: ReviewGateValidation,
): string {
  const lines = [
    `state_path: ${validation.statePath}`,
    `active: ${validation.active}`,
    `staged_diff_hash: ${validation.stagedDiffHash}`,
    `required_review_passes: ${formatList(validation.requiredReviewPasses)}`,
    `completed_review_passes: ${formatList(validation.completedReviewPasses)}`,
    `missing_review_passes: ${formatList(validation.missingReviewPasses)}`,
    `stale_review_passes: ${formatList(validation.staleReviewPasses)}`,
    `blocking_findings: ${validation.blockingFindings.length}`,
  ];

  if (validation.note) {
    lines.push(`note: ${validation.note}`);
  }
  if (validation.errors.length > 0) {
    lines.push("errors:");
    lines.push(...validation.errors.map((error) => `- ${error}`));
    lines.push(
      "next: complete or rerun required local reviews, then retry ax commit",
    );
  } else {
    lines.push("next: ax commit");
  }

  return `${lines.join("\n")}\n`;
}

function validateStateShape(state: unknown): string[] {
  const errors: string[] = [];
  if (!isPlainRecord(state)) {
    return ["Review gate state must be an object."];
  }
  const active = state.active;
  const status = state.status;
  const workflow = state.workflow;
  const unit = state.unit;
  const sourceProvenance = state.sourceProvenance;
  const stagedDiffHashValue = state.stagedDiffHash;
  const requiredReviewPassesValue = state.requiredReviewPasses;
  const resultsValue = state.results;
  const blockingFindingsValue = state.blockingFindings;
  const updatedAt = state.updatedAt;
  const consumedAt = state.consumedAt;
  const clearedAt = state.clearedAt;

  if (state.version !== 1) {
    errors.push("Review gate state version must be 1.");
  }
  if (typeof active !== "boolean") {
    errors.push("Review gate state active must be boolean.");
  }
  if (
    hasOwn(state, "status") &&
    (typeof status !== "string" || !GATE_STATUSES.has(status))
  ) {
    errors.push(
      "Review gate state status must be active, consumed, or cleared.",
    );
  }
  if (active === true && hasOwn(state, "status") && status !== "active") {
    errors.push("Active review gate status must be active.");
  }
  if (active === false && status === "active") {
    errors.push("Inactive review gate status must not be active.");
  }
  if (
    hasOwn(state, "workflow") &&
    (typeof workflow !== "string" || workflow.length === 0)
  ) {
    errors.push("workflow must be a non-empty string.");
  }
  if (hasOwn(state, "unit") && !isPlainRecord(unit)) {
    errors.push("unit must be an object.");
  }
  if (isPlainRecord(unit)) {
    if (
      hasOwn(unit, "id") &&
      (typeof unit.id !== "string" || unit.id.length === 0)
    ) {
      errors.push("unit.id must be a non-empty string.");
    }
    if (
      hasOwn(unit, "title") &&
      (typeof unit.title !== "string" || unit.title.length === 0)
    ) {
      errors.push("unit.title must be a non-empty string.");
    }
  }
  if (hasOwn(state, "sourceProvenance")) {
    validateSourceProvenance(sourceProvenance, errors);
  }
  if (active === true) {
    if (!workflow) {
      errors.push("Active review gate requires workflow.");
    }
    if (!sourceProvenance) {
      errors.push("Active review gate requires sourceProvenance.");
    }
    if (!stagedDiffHashValue) {
      errors.push("Active review gate requires stagedDiffHash.");
    }
    if (!requiredReviewPassesValue) {
      errors.push("Active review gate requires requiredReviewPasses.");
    }
    if (!resultsValue) {
      errors.push("Active review gate requires results.");
    }
    if (!blockingFindingsValue) {
      errors.push("Active review gate requires blockingFindings.");
    }
  }
  if (
    hasOwn(state, "requiredReviewPasses") &&
    !Array.isArray(requiredReviewPassesValue)
  ) {
    errors.push("requiredReviewPasses must be an array.");
  }
  if (Array.isArray(requiredReviewPassesValue)) {
    if (active === true && requiredReviewPassesValue.length === 0) {
      errors.push("Active review gate requires at least one review pass.");
    }
    for (const [index, value] of requiredReviewPassesValue.entries()) {
      if (typeof value !== "string" || value.length === 0) {
        errors.push(
          `requiredReviewPasses[${index}] must be a non-empty string.`,
        );
      }
    }
  }
  if (
    hasOwn(state, "stagedDiffHash") &&
    (typeof stagedDiffHashValue !== "string" ||
      !isDiffHash(stagedDiffHashValue))
  ) {
    errors.push("stagedDiffHash must be a sha256 diff hash.");
  }
  if (hasOwn(state, "results") && !isPlainRecord(resultsValue)) {
    errors.push("results must be an object.");
  }
  if (isPlainRecord(resultsValue)) {
    for (const [reviewPass, value] of Object.entries(resultsValue)) {
      if (!isPlainRecord(value)) {
        errors.push(`results.${reviewPass} must be an object.`);
        continue;
      }
      if (!RESULT_STATUSES.has(String(value.status))) {
        errors.push(
          `results.${reviewPass}.status must be passed, failed, or blocked.`,
        );
      }
      if (typeof value.diffHash !== "string" || !isDiffHash(value.diffHash)) {
        errors.push(
          `results.${reviewPass}.diffHash must be a sha256 diff hash.`,
        );
      }
      if (
        hasOwn(value, "completedAt") &&
        typeof value.completedAt !== "string"
      ) {
        errors.push(`results.${reviewPass}.completedAt must be a string.`);
      }
      if (hasOwn(value, "summary") && typeof value.summary !== "string") {
        errors.push(`results.${reviewPass}.summary must be a string.`);
      }
    }
  }
  if (
    hasOwn(state, "blockingFindings") &&
    !Array.isArray(blockingFindingsValue)
  ) {
    errors.push("blockingFindings must be an array.");
  }
  if (hasOwn(state, "updatedAt") && typeof updatedAt !== "string") {
    errors.push("updatedAt must be a string.");
  }
  if (hasOwn(state, "consumedAt") && typeof consumedAt !== "string") {
    errors.push("consumedAt must be a string.");
  }
  if (hasOwn(state, "clearedAt") && typeof clearedAt !== "string") {
    errors.push("clearedAt must be a string.");
  }
  return errors;
}

function normalizeResultInput(
  results: Record<string, ReviewGateResultInput>,
  currentDiffHash: string,
): Record<string, ReviewGateResult> {
  const normalized: Record<string, ReviewGateResult> = {};
  for (const [reviewPass, result] of Object.entries(results)) {
    if (!isPlainRecord(result)) {
      throw new Error(`Review pass ${reviewPass} result must be an object.`);
    }
    const diffHash = result.diffHash;
    if (typeof diffHash !== "string") {
      throw new Error(`Review pass ${reviewPass} requires a diff hash.`);
    }
    if (diffHash !== currentDiffHash) {
      throw new Error(
        `Review pass ${reviewPass} has stale diff hash ${diffHash}; expected ${currentDiffHash}.`,
      );
    }
    normalized[reviewPass] = {
      status: result.status,
      diffHash,
      completedAt: result.completedAt,
      summary: result.summary,
    };
  }
  return normalized;
}

function validateSourceProvenance(value: unknown, errors: string[]): void {
  if (!isPlainRecord(value)) {
    errors.push("sourceProvenance must be an object.");
    return;
  }
  if (typeof value.kind !== "string" || value.kind.length === 0) {
    errors.push("sourceProvenance.kind must be a non-empty string.");
  }
  if (typeof value.ref !== "string" || value.ref.length === 0) {
    errors.push("sourceProvenance.ref must be a non-empty string.");
  }
  if (hasOwn(value, "evidence")) {
    if (!Array.isArray(value.evidence)) {
      errors.push("sourceProvenance.evidence must be an array.");
      return;
    }
    for (const [index, evidence] of value.evidence.entries()) {
      if (typeof evidence !== "string" || evidence.length === 0) {
        errors.push(
          `sourceProvenance.evidence[${index}] must be a non-empty string.`,
        );
      }
    }
  }
}

function readReviewGateState(statePath: string): ReviewGateReadResult {
  if (!existsSync(statePath)) {
    return { exists: false };
  }
  try {
    return {
      exists: true,
      ok: true,
      state: JSON.parse(readFileSync(statePath, "utf-8")),
    };
  } catch (error) {
    return { exists: true, ok: false, error: errorMessage(error) };
  }
}

function writeValidatedState(statePath: string, state: ReviewGateState): void {
  const errors = validateStateShape(state);
  if (errors.length > 0) {
    throw new Error(
      `Cannot write invalid review gate state: ${errors.join("; ")}`,
    );
  }
  atomicWriteJson(statePath, state);
}

function atomicWriteJson(statePath: string, state: ReviewGateState): void {
  const directory = dirname(statePath);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = resolve(
    directory,
    `.${basename(statePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  renameSync(temporaryPath, statePath);
}

function normalizeState(state: unknown): {
  errors: string[];
  active: boolean;
  stagedDiffHash?: string;
  requiredReviewPasses: string[];
  results: Record<string, ReviewGateResult>;
  blockingFindings: unknown[];
} {
  const errors = validateStateShape(state);
  if (!isPlainRecord(state)) {
    return {
      errors,
      active: false,
      stagedDiffHash: undefined,
      requiredReviewPasses: [],
      results: {},
      blockingFindings: [],
    };
  }
  return {
    errors,
    active: state.active === true,
    stagedDiffHash:
      typeof state.stagedDiffHash === "string"
        ? state.stagedDiffHash
        : undefined,
    requiredReviewPasses: Array.isArray(state.requiredReviewPasses)
      ? state.requiredReviewPasses.filter((value) => typeof value === "string")
      : [],
    results: isPlainRecord(state.results)
      ? (state.results as Record<string, ReviewGateResult>)
      : {},
    blockingFindings: Array.isArray(state.blockingFindings)
      ? state.blockingFindings
      : [],
  };
}

function gitOutput(args: string[], cwd: string): string {
  return gitOutputRaw(args, cwd).trimEnd();
}

function gitOutputRaw(args: string[], cwd: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed").trim());
  }
  return result.stdout;
}

function gitOutputBuffer(args: string[], cwd: string): Buffer {
  const result = spawnSync("git", args, {
    cwd,
    env: withoutGitRepositoryEnv(),
  });
  if (result.status !== 0) {
    throw new Error(
      (
        result.stderr.toString("utf-8") ||
        result.stdout.toString("utf-8") ||
        "git failed"
      ).trim(),
    );
  }
  return result.stdout;
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_PREFIX;
  delete env.GIT_QUARANTINE_PATH;
  delete env.GIT_WORK_TREE;
  return env;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
}

function isDiffHash(value: string): boolean {
  return HASH_PATTERN.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}
