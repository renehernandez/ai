import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RESULT_STATUSES = new Set(["passed", "failed", "blocked"]);

export type ReviewGateResult = {
  status?: "passed" | "failed" | "blocked";
  diffHash?: string;
  completedAt?: string;
  summary?: string;
};

export type ReviewGateState = {
  version: 1;
  active: boolean;
  workflow?: string;
  unit?: {
    id?: string;
    title?: string;
  };
  stagedDiffHash?: string;
  requiredReviewPasses?: string[];
  results?: Record<string, ReviewGateResult>;
  blockingFindings?: unknown[];
  updatedAt?: string;
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

  let state: ReviewGateState;
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8")) as ReviewGateState;
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

  if (!state.active) {
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

  if (state.stagedDiffHash && state.stagedDiffHash !== currentDiffHash) {
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

function validateStateShape(state: ReviewGateState): string[] {
  const errors: string[] = [];
  if (state.version !== 1) {
    errors.push("Review gate state version must be 1.");
  }
  if (typeof state.active !== "boolean") {
    errors.push("Review gate state active must be boolean.");
  }
  if (state.active) {
    if (!state.stagedDiffHash) {
      errors.push("Active review gate requires stagedDiffHash.");
    }
    if (!state.requiredReviewPasses) {
      errors.push("Active review gate requires requiredReviewPasses.");
    }
    if (!state.results) {
      errors.push("Active review gate requires results.");
    }
    if (!state.blockingFindings) {
      errors.push("Active review gate requires blockingFindings.");
    }
  }
  if (
    state.requiredReviewPasses &&
    !Array.isArray(state.requiredReviewPasses)
  ) {
    errors.push("requiredReviewPasses must be an array.");
  }
  if (Array.isArray(state.requiredReviewPasses)) {
    if (state.active && state.requiredReviewPasses.length === 0) {
      errors.push("Active review gate requires at least one review pass.");
    }
    for (const [index, value] of state.requiredReviewPasses.entries()) {
      if (typeof value !== "string" || value.length === 0) {
        errors.push(
          `requiredReviewPasses[${index}] must be a non-empty string.`,
        );
      }
    }
  }
  if (state.stagedDiffHash && !isDiffHash(state.stagedDiffHash)) {
    errors.push("stagedDiffHash must be a sha256 diff hash.");
  }
  if (state.results && !isPlainRecord(state.results)) {
    errors.push("results must be an object.");
  }
  if (isPlainRecord(state.results)) {
    for (const [reviewPass, value] of Object.entries(state.results)) {
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
      if (value.completedAt && typeof value.completedAt !== "string") {
        errors.push(`results.${reviewPass}.completedAt must be a string.`);
      }
      if (value.summary && typeof value.summary !== "string") {
        errors.push(`results.${reviewPass}.summary must be a string.`);
      }
    }
  }
  if (state.blockingFindings && !Array.isArray(state.blockingFindings)) {
    errors.push("blockingFindings must be an array.");
  }
  return errors;
}

function normalizeState(state: ReviewGateState): {
  errors: string[];
  requiredReviewPasses: string[];
  results: Record<string, ReviewGateResult>;
  blockingFindings: unknown[];
} {
  const errors = validateStateShape(state);
  return {
    errors,
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

function isDiffHash(value: string): boolean {
  return HASH_PATTERN.test(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "(none)";
}
