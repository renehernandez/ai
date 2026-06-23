import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import {
  extname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";

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

export const PLAN_ARTIFACT_RECORD_KINDS = [
  "review_request",
  "reviewer_selection",
  "handoff",
  "blueprint",
  "ledger",
  "report",
  "validation_input",
  "validation_output",
] as const;

const STRUCTURED_SUPPORT_EXTENSIONS = new Set([
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
]);
const WRITE_LOCK_STALE_MS = 5 * 60 * 1000;

export type PlanSupportArtifactKind =
  (typeof PLAN_SUPPORT_ARTIFACT_KINDS)[number];

export type PlanArtifactRecordKind =
  (typeof PLAN_ARTIFACT_RECORD_KINDS)[number];

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

export type PlanArtifactRecordResult = {
  status: "recorded";
  repoKey: string;
  normalizedPlanPath: string;
  planPathHash: string;
  planSlug: string;
  planContentFingerprint: string;
  revisionId: string;
  artifactKind: PlanArtifactRecordKind;
  artifactContentFingerprint: string;
  privateWorkspaceRelativePath: string;
  artifactRelativePath: string;
  manifestRelativePath: string;
  metadataRelativePath: string;
  indexRelativePath: string;
};

export type PlanArtifactIdentity = {
  repoKey: string;
  repoHash: string;
  normalizedPlanPath: string;
  planPathHash: string;
  planSlug: string;
  planContentFingerprint: string;
};

type PlanArtifactStoredRecord = {
  recordedAt: string;
  artifactKind: PlanArtifactRecordKind;
  artifactContentFingerprint: string;
  artifactRelativePath: string;
};

type PlanArtifactRevisionRecord = {
  revisionId: string;
  createdAt: string;
  planContentFingerprint: string;
  metadataRelativePath: string;
  artifacts: PlanArtifactStoredRecord[];
};

type PlanArtifactManifest = {
  version: 1;
  repoKey: string;
  repoHash: string;
  normalizedPlanPath: string;
  planPathHash: string;
  planSlug: string;
  revisions: PlanArtifactRevisionRecord[];
};

type PlanArtifactRevisionMetadata = PlanArtifactRevisionRecord & {
  version: 1;
  repoKey: string;
  repoHash: string;
  normalizedPlanPath: string;
  planPathHash: string;
  planSlug: string;
};

type PlanArtifactIndexRecord = PlanArtifactStoredRecord & {
  version: 1;
  repoKey: string;
  repoHash: string;
  normalizedPlanPath: string;
  planPathHash: string;
  planSlug: string;
  revisionId: string;
  planContentFingerprint: string;
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

export function normalizePlanArtifactRecordKind(
  input: string,
): PlanArtifactRecordKind | null {
  const normalized = input.trim();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return PLAN_ARTIFACT_RECORD_KINDS.includes(
    normalized as PlanArtifactRecordKind,
  )
    ? (normalized as PlanArtifactRecordKind)
    : null;
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

export function recordPlanArtifact(options: {
  targetRoot: string;
  planPath: string;
  kind: string;
  filePath: string;
  axPlansRoot?: string;
  artifactRemoteName?: string;
}): PlanArtifactRecordResult {
  const targetRoot = realpathSync(options.targetRoot);
  const artifactKind = normalizePlanArtifactRecordKind(options.kind);
  if (!artifactKind) {
    throw new Error(
      "--kind must be one of: review_request, reviewer_selection, handoff, blueprint, ledger, report, validation_input, validation_output",
    );
  }

  const artifactIdentity = derivePlanArtifactIdentity({
    targetRoot,
    planPath: options.planPath,
    artifactRemoteName: options.artifactRemoteName,
  });

  const artifactRealPath = realpathSync(resolve(targetRoot, options.filePath));
  assertPathInside(
    artifactRealPath,
    targetRoot,
    "--file must resolve inside target repo for artifact record v1",
  );

  const identity = derivePlanArtifactWorkspaceIdentity({
    repoKey: artifactIdentity.repoKey,
    planPath: artifactIdentity.normalizedPlanPath,
    axPlansRoot: options.axPlansRoot,
  });
  const axPlansRoot = resolve(
    options.axPlansRoot ?? join(homedir(), ".ax", "plans"),
  );
  const repoRoot = join(axPlansRoot, "repos", `sha256-${identity.repoHash}`);
  ensurePrivateDirectory(axPlansRoot);
  ensurePrivateDirectory(join(axPlansRoot, "repos"));
  ensurePrivateDirectory(repoRoot);
  ensurePrivateDirectory(join(repoRoot, "plans"));
  ensurePrivateDirectory(resolve(identity.workspacePath));

  const artifactContentFingerprint = sha256Hex(readFileSync(artifactRealPath));
  const revisionId = `plan-${artifactIdentity.planContentFingerprint.slice(0, 16)}`;
  const workspaceRealPath = realpathSync(identity.workspacePath);
  const releaseLock = acquirePlanArtifactWriteLock(workspaceRealPath);
  let artifactPath = "";
  let artifactRelativePath = "";
  let metadataPath = "";
  let metadataRelativePath = "";
  try {
    const manifestPath = join(workspaceRealPath, "manifest.json");
    const indexPath = join(workspaceRealPath, "index.jsonl");
    const revisionsPath = join(workspaceRealPath, "revisions");
    ensurePrivateDirectory(revisionsPath);
    const revisionPath = join(revisionsPath, revisionId);
    ensurePrivateDirectory(revisionPath);
    const revisionArtifactsPath = join(revisionPath, "artifacts");
    ensurePrivateDirectory(revisionArtifactsPath);
    const artifactsRealPath = realpathSync(revisionArtifactsPath);
    artifactPath = join(
      artifactsRealPath,
      `${artifactKind}-${artifactContentFingerprint}${safeArtifactExtension(artifactRealPath)}`,
    );
    assertPathInside(
      artifactPath,
      workspaceRealPath,
      "artifact destination must remain inside private plan workspace",
    );
    copyImmutableFile(
      artifactRealPath,
      artifactPath,
      artifactContentFingerprint,
    );

    metadataPath = join(revisionPath, "metadata.json");
    artifactRelativePath = relative(workspaceRealPath, artifactPath)
      .split(sep)
      .join("/");
    metadataRelativePath = relative(workspaceRealPath, metadataPath)
      .split(sep)
      .join("/");
    const createdAt = new Date().toISOString();
    const manifest = readPlanArtifactManifest(manifestPath);
    assertManifestMatchesIdentity(manifest, artifactIdentity, identity);
    const existingRevision = manifest?.revisions.find(
      (revision) => revision.revisionId === revisionId,
    );
    const existingArtifact = existingRevision?.artifacts.find(
      (artifact) =>
        artifact.artifactKind === artifactKind &&
        artifact.artifactContentFingerprint === artifactContentFingerprint,
    );
    const artifactRecord = existingArtifact ?? {
      recordedAt: createdAt,
      artifactKind,
      artifactContentFingerprint,
      artifactRelativePath,
    };
    const revisionRecord = existingRevision
      ? {
          ...existingRevision,
          artifacts: existingArtifact
            ? existingRevision.artifacts
            : [...existingRevision.artifacts, artifactRecord],
        }
      : {
          revisionId,
          createdAt,
          planContentFingerprint: artifactIdentity.planContentFingerprint,
          metadataRelativePath,
          artifacts: [artifactRecord],
        };
    const revisionMetadata: PlanArtifactRevisionMetadata = {
      version: 1,
      repoKey: artifactIdentity.repoKey,
      repoHash: identity.repoHash,
      normalizedPlanPath: artifactIdentity.normalizedPlanPath,
      planPathHash: artifactIdentity.planPathHash,
      planSlug: artifactIdentity.planSlug,
      ...revisionRecord,
    };
    atomicWriteJson(metadataPath, revisionMetadata);

    const nextManifest: PlanArtifactManifest = manifest
      ? {
          ...manifest,
          revisions: existingRevision
            ? manifest.revisions.map((revision) =>
                revision.revisionId === revisionId ? revisionRecord : revision,
              )
            : [...manifest.revisions, revisionRecord],
        }
      : {
          version: 1,
          repoKey: artifactIdentity.repoKey,
          repoHash: identity.repoHash,
          normalizedPlanPath: artifactIdentity.normalizedPlanPath,
          planPathHash: artifactIdentity.planPathHash,
          planSlug: artifactIdentity.planSlug,
          revisions: [revisionRecord],
        };
    atomicWriteJson(manifestPath, nextManifest);
    appendIndexRecordIfMissing(
      indexPath,
      {
        version: 1,
        repoKey: artifactIdentity.repoKey,
        repoHash: identity.repoHash,
        normalizedPlanPath: artifactIdentity.normalizedPlanPath,
        planPathHash: artifactIdentity.planPathHash,
        planSlug: artifactIdentity.planSlug,
        revisionId,
        planContentFingerprint: artifactIdentity.planContentFingerprint,
        ...artifactRecord,
      },
      workspaceRealPath,
    );
  } finally {
    releaseLock();
  }
  const axPlansRealPath = realpathSync(axPlansRoot);

  return {
    status: "recorded",
    repoKey: artifactIdentity.repoKey,
    normalizedPlanPath: artifactIdentity.normalizedPlanPath,
    planPathHash: artifactIdentity.planPathHash,
    planSlug: artifactIdentity.planSlug,
    planContentFingerprint: artifactIdentity.planContentFingerprint,
    revisionId,
    artifactKind,
    artifactContentFingerprint,
    privateWorkspaceRelativePath: relative(axPlansRealPath, artifactPath)
      .split(sep)
      .join("/"),
    artifactRelativePath,
    manifestRelativePath: relative(
      axPlansRealPath,
      realpathSync(join(workspaceRealPath, "manifest.json")),
    )
      .split(sep)
      .join("/"),
    metadataRelativePath: relative(axPlansRealPath, metadataPath)
      .split(sep)
      .join("/"),
    indexRelativePath: relative(
      axPlansRealPath,
      realpathSync(join(workspaceRealPath, "index.jsonl")),
    )
      .split(sep)
      .join("/"),
  };
}

export function derivePlanArtifactIdentity(options: {
  targetRoot: string;
  planPath: string;
  artifactRemoteName?: string;
}): PlanArtifactIdentity {
  const targetRoot = realpathSync(options.targetRoot);
  const normalizedPlanPath = normalizeAgentsPlanRef(options.planPath);
  if (!normalizedPlanPath || !isPrimaryMarkdownPlan(normalizedPlanPath)) {
    throw new Error(
      "--plan must be a primary markdown file under .agents/plans",
    );
  }

  const planRealPath = realpathSync(join(targetRoot, normalizedPlanPath));
  assertPathInside(
    planRealPath,
    targetRoot,
    "--plan must resolve inside target repo",
  );

  const repoKey = repoKeyForTargetRoot(targetRoot, options.artifactRemoteName);
  const workspaceIdentity = derivePlanArtifactWorkspaceIdentity({
    repoKey,
    planPath: normalizedPlanPath,
  });
  return {
    repoKey,
    repoHash: workspaceIdentity.repoHash,
    normalizedPlanPath,
    planPathHash: workspaceIdentity.planPathHash,
    planSlug: workspaceIdentity.planSlug,
    planContentFingerprint: sha256Hex(readFileSync(planRealPath)),
  };
}

function repoKeyForTargetRoot(
  targetRoot: string,
  artifactRemoteName?: string,
): string {
  const originUrl = gitRemoteUrlForRoot(targetRoot, "origin");
  const remoteUrl =
    originUrl ??
    (artifactRemoteName
      ? gitRemoteUrlForRoot(targetRoot, artifactRemoteName)
      : undefined);
  if (!remoteUrl) {
    throw new Error(
      "Target repository has no origin fetch URL or selected artifact-host remote; provide a repo identity before recording plan artifacts.",
    );
  }
  return canonicalRepoRemoteUrl(remoteUrl);
}

function gitRemoteUrlForRoot(
  targetRoot: string,
  remoteName: string,
): string | undefined {
  const result = spawnSync(
    "git",
    ["-C", targetRoot, "remote", "get-url", remoteName],
    {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim() || undefined;
}

function canonicalRepoRemoteUrl(remoteUrl: string): string {
  const trimmed = remoteUrl.trim();
  const scpLike = /^([^@]+@)?([^:]+):(.+)$/.exec(trimmed);
  if (scpLike && !trimmed.includes("://")) {
    return `${scpLike[2].toLowerCase()}/${normalizeRemotePath(scpLike[3])}`;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.port
      ? `${parsed.hostname.toLowerCase()}:${parsed.port}`
      : parsed.hostname.toLowerCase();
    return `${host}/${normalizeRemotePath(parsed.pathname)}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

function normalizeRemotePath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
}

function ensurePrivateDirectory(path: string): void {
  if (existsSync(path)) {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Private plan workspace path must not be a symlink: ${path}`,
      );
    }
    if (!stats.isDirectory()) {
      throw new Error(
        `Private plan workspace path is not a directory: ${path}`,
      );
    }
    if ((stats.mode & 0o077) !== 0) {
      throw new Error(
        `Private plan workspace directory must not be readable, writable, or traversable by other users: ${path}`,
      );
    }
    return;
  }
  mkdirSync(path, { mode: 0o700, recursive: true });
}

function copyImmutableFile(
  sourcePath: string,
  destinationPath: string,
  expectedFingerprint: string,
): void {
  if (existsSync(destinationPath)) {
    const stats = lstatSync(destinationPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(
        `Private plan artifact blob must be a regular file: ${destinationPath}`,
      );
    }
    const existingFingerprint = sha256Hex(readFileSync(destinationPath));
    if (existingFingerprint !== expectedFingerprint) {
      throw new Error(
        `Private plan artifact blob is incomplete or corrupt and must be repaired before recording: ${destinationPath}`,
      );
    }
    return;
  }

  const temporaryPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;
  copyFileSync(sourcePath, temporaryPath);
  renameSync(temporaryPath, destinationPath);
}

function acquirePlanArtifactWriteLock(workspacePath: string): () => void {
  const lockPath = join(workspacePath, ".write.lock");
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      return () => {
        rmSync(lockPath, { force: true, recursive: true });
      };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
      const stats = lstatSync(lockPath);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(
          `Private plan artifact lock path is not a directory: ${lockPath}`,
        );
      }
      if (Date.now() - stats.mtimeMs > WRITE_LOCK_STALE_MS) {
        rmSync(lockPath, { force: true, recursive: true });
        continue;
      }
      sleepSync(50);
    }
  }

  throw new Error(
    `Timed out waiting for private plan artifact writer lock: ${lockPath}`,
  );
}

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function appendIndexRecordIfMissing(
  path: string,
  record: PlanArtifactIndexRecord,
  workspaceRoot: string,
): void {
  assertPathInside(
    resolve(path),
    workspaceRoot,
    "index destination must remain inside private plan workspace",
  );

  let stats: ReturnType<typeof lstatSync> | null = null;
  try {
    stats = lstatSync(path);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }

  if (stats) {
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(
        `Private plan artifact index must be a regular file: ${path}`,
      );
    }
    assertPathInside(
      realpathSync(path),
      workspaceRoot,
      "index destination must remain inside private plan workspace",
    );
    const rows = readFileSync(path, "utf-8")
      .split("\n")
      .filter((line) => line.trim() !== "");
    for (const row of rows) {
      let parsed: {
        revisionId?: unknown;
        artifactKind?: unknown;
        artifactContentFingerprint?: unknown;
      };
      try {
        parsed = JSON.parse(row);
      } catch (error) {
        throw new Error(
          `Private plan artifact index is corrupt and must be repaired before recording: ${path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (
        parsed.revisionId === record.revisionId &&
        parsed.artifactKind === record.artifactKind &&
        parsed.artifactContentFingerprint === record.artifactContentFingerprint
      ) {
        return;
      }
    }
  }

  appendFileSync(path, `${JSON.stringify(record)}\n`, "utf-8");
}

function atomicWriteJson(path: string, value: unknown): void {
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf-8",
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
}

function readPlanArtifactManifest(path: string): PlanArtifactManifest | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as {
      version?: unknown;
      revisions?: unknown;
    };
    if (parsed.version !== 1 || !Array.isArray(parsed.revisions)) {
      throw new Error("invalid manifest shape");
    }
    return parsed as PlanArtifactManifest;
  } catch (error) {
    throw new Error(
      `Private plan artifact manifest is corrupt and must be repaired before recording: ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function assertManifestMatchesIdentity(
  manifest: PlanArtifactManifest | null,
  artifactIdentity: PlanArtifactIdentity,
  workspaceIdentity: PlanArtifactWorkspaceIdentity,
): void {
  if (!manifest) {
    return;
  }

  if (
    manifest.repoKey !== artifactIdentity.repoKey ||
    manifest.repoHash !== workspaceIdentity.repoHash ||
    manifest.normalizedPlanPath !== artifactIdentity.normalizedPlanPath ||
    manifest.planPathHash !== artifactIdentity.planPathHash ||
    manifest.planSlug !== artifactIdentity.planSlug
  ) {
    throw new Error(
      "Private plan artifact manifest identity does not match the selected plan",
    );
  }
}

function assertPathInside(path: string, root: string, message: string): void {
  const relativePath = relative(root, path);
  if (
    relativePath !== "" &&
    (relativePath.startsWith("..") || isAbsolute(relativePath))
  ) {
    throw new Error(message);
  }
}

function safeArtifactExtension(path: string): string {
  const extension = extname(path).toLowerCase();
  return extension && /^\.[a-z0-9]+$/.test(extension) ? extension : ".artifact";
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
