import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, posix } from "node:path";

export const AGENTS_PLANS_ROOT = ".agents/plans";

export const PLAN_SUPPORT_ARTIFACT_KINDS = [
  "review-request",
  "reviewer-selection",
  "handoff",
  "blueprint",
  "ledger",
  "report",
  "validation-input",
  "validation-output",
] as const;

const STRUCTURED_SUPPORT_EXTENSIONS = new Set([
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
]);

export type PlanSupportArtifactKind =
  (typeof PLAN_SUPPORT_ARTIFACT_KINDS)[number];

export type AgentsPlanArtifactClassification =
  | {
      type: "not_plan_artifact";
      normalizedPath: null;
    }
  | {
      type:
        | "primary_markdown_plan"
        | "support_sidecar"
        | "other_agents_plan_artifact";
      normalizedPath: string;
      extension: string;
      supportKind?: PlanSupportArtifactKind;
    };

export type PlanArtifactWorkspaceIdentity = {
  repoHash: string;
  normalizedPlanPath: string;
  planPathHash: string;
  planSlug: string;
  workspacePath: string;
  artifactsPath: string;
  manifestPath: string;
  indexPath: string;
};

export function normalizeRepoRelativePath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("\0") || isAbsoluteLikePath(trimmed)) {
    return null;
  }

  const normalized = posix.normalize(trimmed.replace(/\\/g, "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../")
  ) {
    return null;
  }

  return normalized;
}

export function normalizeAgentsPlanRef(input: string): string | null {
  const normalized = normalizeRepoRelativePath(input);
  return normalized && isNormalizedAgentsPlanPath(normalized)
    ? normalized
    : null;
}

export function isAgentsPlanPath(input: string): boolean {
  const normalized = normalizeRepoRelativePath(input);
  return normalized !== null && isNormalizedAgentsPlanPath(normalized);
}

export function isSafeAgentsPlanRef(input: string): boolean {
  return normalizeAgentsPlanRef(input) !== null;
}

export function classifyAgentsPlanArtifact(
  input: string,
): AgentsPlanArtifactClassification {
  const normalizedPath = normalizeAgentsPlanRef(input);
  if (!normalizedPath || normalizedPath === AGENTS_PLANS_ROOT) {
    return { type: "not_plan_artifact", normalizedPath: null };
  }

  const filename = posix.basename(normalizedPath).toLowerCase();
  const extension = posix.extname(filename);
  const supportKind = supportKindForFilename(filename);
  if (supportKind || STRUCTURED_SUPPORT_EXTENSIONS.has(extension)) {
    return {
      type: "support_sidecar",
      normalizedPath,
      extension,
      supportKind,
    };
  }

  if (extension === ".md") {
    return { type: "primary_markdown_plan", normalizedPath, extension };
  }

  return { type: "other_agents_plan_artifact", normalizedPath, extension };
}

export function isPrimaryMarkdownPlan(input: string): boolean {
  return classifyAgentsPlanArtifact(input).type === "primary_markdown_plan";
}

export function isPlanSupportSidecar(input: string): boolean {
  return classifyAgentsPlanArtifact(input).type === "support_sidecar";
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function derivePlanArtifactWorkspaceIdentity(options: {
  repoKey: string;
  planPath: string;
  axPlansRoot?: string;
}): PlanArtifactWorkspaceIdentity {
  const normalizedPlanPath = normalizeAgentsPlanRef(options.planPath);
  if (!normalizedPlanPath) {
    throw new Error("planPath must be a safe .agents/plans path");
  }

  const repoKey = options.repoKey.trim();
  if (!repoKey) {
    throw new Error("repoKey is required");
  }

  const repoHash = sha256Hex(repoKey);
  const planPathHash = sha256Hex(normalizedPlanPath);
  const planSlug = `${sanitizePlanSlug(normalizedPlanPath)}-${planPathHash.slice(0, 12)}`;
  const root = options.axPlansRoot ?? join(homedir(), ".ax", "plans");
  const workspacePath = join(
    root,
    "repos",
    `sha256-${repoHash}`,
    "plans",
    planSlug,
  );

  return {
    repoHash,
    normalizedPlanPath,
    planPathHash,
    planSlug,
    workspacePath,
    artifactsPath: join(workspacePath, "artifacts"),
    manifestPath: join(workspacePath, "manifest.json"),
    indexPath: join(workspacePath, "index.jsonl"),
  };
}

function isAbsoluteLikePath(input: string): boolean {
  return (
    input.startsWith("/") ||
    input.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(input)
  );
}

function isNormalizedAgentsPlanPath(path: string): boolean {
  return path === AGENTS_PLANS_ROOT || path.startsWith(`${AGENTS_PLANS_ROOT}/`);
}

function supportKindForFilename(
  filename: string,
): PlanSupportArtifactKind | undefined {
  return PLAN_SUPPORT_ARTIFACT_KINDS.find(
    (kind) => filename.includes(`.${kind}.`) || filename.endsWith(`.${kind}`),
  );
}

function sanitizePlanSlug(normalizedPlanPath: string): string {
  const extension = posix.extname(normalizedPlanPath);
  const filename = posix.basename(normalizedPlanPath, extension);
  const slug = filename
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "plan";
}
