import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

export const HASH_VERSION = "sha256-tree-v1" as const;
export const ABSENT_HASH = "absent" as const;

export type ContentHash = `sha256:${string}`;
export type ObservedHash = ContentHash | typeof ABSENT_HASH;

type TreeEntry = {
  path: string;
  kind: "directory" | "file" | "symlink";
  executable: boolean;
  payload: Buffer;
};

export type SourceSnapshot = {
  path: string;
  contentHash: ContentHash;
  sourceKind: "git-local" | "directory-local" | "remote";
  resolvedCommit?: string;
};

export type SourceSnapshotManagerOptions = {
  cacheRoot: string;
  temporaryRoot?: string;
  maxLocalSnapshotAttempts?: number;
};

/**
 * Hash one filesystem entry with the canonical AX sha256-tree-v1 stream.
 * Root directories and empty directories are entries, and symlinks are never
 * dereferenced.
 */
export function hashPath(path: string): ObservedHash {
  if (!existsOrSymlink(path)) {
    return ABSENT_HASH;
  }
  const entries = collectTreeEntries(resolve(path));
  const hash = createHash("sha256");
  appendLengthPrefixed(hash, Buffer.from(HASH_VERSION, "utf-8"));
  for (const entry of entries) {
    appendLengthPrefixed(hash, Buffer.from(entry.path, "utf-8"));
    appendLengthPrefixed(hash, Buffer.from(entry.kind, "utf-8"));
    appendLengthPrefixed(
      hash,
      Buffer.from(entry.executable ? "executable" : "non-executable", "utf-8"),
    );
    appendLengthPrefixed(hash, entry.payload);
  }
  return `sha256:${hash.digest("hex")}`;
}

export function sha256Bytes(value: string | Buffer): ContentHash {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function copyPath(source: string, target: string): void {
  const sourceStats = lstatSync(source);
  mkdirSync(dirname(target), { recursive: true });
  if (sourceStats.isSymbolicLink()) {
    rmSync(target, { force: true, recursive: true });
    symlinkSync(readlinkSync(source), target);
    return;
  }
  cpSync(source, target, {
    dereference: false,
    force: true,
    preserveTimestamps: false,
    recursive: sourceStats.isDirectory(),
    verbatimSymlinks: true,
  });
  if (sourceStats.isFile()) {
    chmodSync(target, sourceStats.mode & 0o111 ? 0o755 : 0o644);
  }
}

export class SourceSnapshotManager {
  readonly cacheRoot: string;
  readonly temporaryRoot: string;
  readonly maxLocalSnapshotAttempts: number;

  readonly #snapshots = new Map<string, SourceSnapshot>();
  readonly #ownedTemporaryRoots = new Set<string>();

  constructor(options: SourceSnapshotManagerOptions) {
    this.cacheRoot = resolve(options.cacheRoot);
    this.temporaryRoot = resolve(options.temporaryRoot ?? tmpdir());
    this.maxLocalSnapshotAttempts = options.maxLocalSnapshotAttempts ?? 3;
    mkdirSync(this.cacheRoot, { recursive: true });
    mkdirSync(this.temporaryRoot, { recursive: true });
  }

  snapshotLocal(sourcePath: string): SourceSnapshot {
    const source = realpathSync(resolve(sourcePath));
    const key = `local\0${source}`;
    const existing = this.#snapshots.get(key);
    if (existing) {
      return existing;
    }

    const git = cleanGitSource(source);
    const snapshot = git
      ? this.#snapshotCleanGitSource(source, git.repoRoot, git.commit)
      : this.#snapshotDirectorySource(source);
    this.#snapshots.set(key, snapshot);
    return snapshot;
  }

  snapshotRemote(url: string, ref: string): SourceSnapshot {
    const key = `remote\0${url}\0${ref}`;
    const existing = this.#snapshots.get(key);
    if (existing) {
      return existing;
    }

    const cacheKey = sha256Bytes(key).slice("sha256:".length);
    const repository = join(this.cacheRoot, `${cacheKey}.git`);
    if (existsSync(repository)) {
      const valid = git([
        "--git-dir",
        repository,
        "rev-parse",
        "--is-bare-repository",
      ]);
      if (valid.status !== 0 || valid.stdout.trim() !== "true") {
        rmSync(repository, { force: true, recursive: true });
      }
    }
    if (!existsSync(repository)) {
      runGit(["clone", "--mirror", url, repository]);
    }

    runGit(["--git-dir", repository, "fetch", "--force", "--prune", url, ref]);
    const resolvedCommit = runGit([
      "--git-dir",
      repository,
      "rev-parse",
      "FETCH_HEAD^{commit}",
    ]).trim();
    const root = this.#newTemporaryDirectory("ax-remote-snapshot-");
    extractGitArchive(repository, resolvedCommit, root);
    const snapshot: SourceSnapshot = {
      path: root,
      contentHash: requireContentHash(hashPath(root)),
      sourceKind: "remote",
      resolvedCommit,
    };
    this.#snapshots.set(key, snapshot);
    return snapshot;
  }

  dispose(): void {
    for (const root of this.#ownedTemporaryRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    this.#ownedTemporaryRoots.clear();
  }

  #snapshotCleanGitSource(
    source: string,
    repoRoot: string,
    commit: string,
  ): SourceSnapshot {
    const extractionRoot = this.#newTemporaryDirectory("ax-git-snapshot-");
    const relativeSource = normalizeRelativePath(relative(repoRoot, source));
    extractGitArchive(repoRoot, commit, extractionRoot, relativeSource);
    const extracted =
      relativeSource === "."
        ? extractionRoot
        : join(extractionRoot, relativeSource);
    if (!existsOrSymlink(extracted)) {
      throw new Error(`Git tree snapshot omitted local source: ${source}`);
    }
    const stableRoot = this.#newTemporaryDirectory("ax-source-snapshot-");
    const target = join(stableRoot, basename(source));
    copyPath(extracted, target);
    return {
      path: target,
      contentHash: requireContentHash(hashPath(target)),
      sourceKind: "git-local",
      resolvedCommit: commit,
    };
  }

  #snapshotDirectorySource(source: string): SourceSnapshot {
    for (
      let attempt = 1;
      attempt <= this.maxLocalSnapshotAttempts;
      attempt += 1
    ) {
      const before = requireContentHash(hashPath(source));
      const root = this.#newTemporaryDirectory("ax-directory-snapshot-");
      const target = join(root, basename(source));
      copyPath(source, target);
      const candidate = requireContentHash(hashPath(target));
      const after = requireContentHash(hashPath(source));
      if (before === candidate && candidate === after) {
        return {
          path: target,
          contentHash: candidate,
          sourceKind: "directory-local",
        };
      }
      rmSync(root, { force: true, recursive: true });
      this.#ownedTemporaryRoots.delete(root);
    }
    throw new Error(
      `source_changed_during_snapshot: ${source} changed during ${this.maxLocalSnapshotAttempts} snapshot attempts`,
    );
  }

  #newTemporaryDirectory(prefix: string): string {
    const root = mkdtempSync(join(this.temporaryRoot, prefix));
    this.#ownedTemporaryRoots.add(root);
    return root;
  }
}

function collectTreeEntries(root: string): TreeEntry[] {
  const entries: TreeEntry[] = [];
  const visit = (absolutePath: string, relativePath: string): void => {
    const stats = lstatSync(absolutePath);
    const path = normalizeRelativePath(relativePath || ".");
    if (stats.isSymbolicLink()) {
      entries.push({
        path,
        kind: "symlink",
        executable: false,
        payload: Buffer.from(readlinkSync(absolutePath), "utf-8"),
      });
      return;
    }
    if (stats.isDirectory()) {
      entries.push({
        path,
        kind: "directory",
        executable: false,
        payload: Buffer.alloc(0),
      });
      for (const entry of readdirSync(absolutePath).sort((left, right) =>
        left.localeCompare(right),
      )) {
        visit(
          join(absolutePath, entry),
          relativePath ? join(relativePath, entry) : entry,
        );
      }
      return;
    }
    if (!stats.isFile()) {
      throw new Error(
        `Unsupported filesystem entry in ${HASH_VERSION}: ${absolutePath}`,
      );
    }
    entries.push({
      path,
      kind: "file",
      executable: Boolean(stats.mode & 0o111),
      payload: readFileSync(absolutePath),
    });
  };
  visit(root, "");
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function appendLengthPrefixed(
  hash: ReturnType<typeof createHash>,
  value: Buffer,
): void {
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(value.byteLength));
  hash.update(length);
  hash.update(value);
}

function normalizeRelativePath(path: string): string {
  const normalized = path.split(sep).join("/") || ".";
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Path escapes hash root: ${path}`);
  }
  return normalized;
}

function cleanGitSource(
  source: string,
): { repoRoot: string; commit: string } | undefined {
  const topLevel = git(["-C", source, "rev-parse", "--show-toplevel"]);
  if (topLevel.status !== 0) {
    return undefined;
  }
  const repoRoot = topLevel.stdout.trim();
  const status = git([
    "-C",
    repoRoot,
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.status !== 0 || status.stdout.trim() !== "") {
    return undefined;
  }
  const commit = git(["-C", repoRoot, "rev-parse", "HEAD"]);
  if (commit.status !== 0) {
    return undefined;
  }
  return { repoRoot, commit: commit.stdout.trim() };
}

function extractGitArchive(
  repository: string,
  commit: string,
  destination: string,
  relativeSource?: string,
): void {
  const archivePath = join(tmpdir(), `ax-archive-${randomUUID()}.tar`);
  const gitArgs =
    existsSync(join(repository, "HEAD")) && repository.endsWith(".git")
      ? [
          "--git-dir",
          repository,
          "archive",
          "--format=tar",
          "-o",
          archivePath,
          commit,
        ]
      : [
          "-C",
          repository,
          "archive",
          "--format=tar",
          "-o",
          archivePath,
          commit,
        ];
  if (relativeSource && relativeSource !== ".") {
    gitArgs.push("--", relativeSource);
  }
  try {
    runGit(gitArgs);
    const result = spawnSync("tar", ["-xf", archivePath, "-C", destination], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      throw new Error(
        `tar extraction failed: ${result.stderr || result.stdout}`,
      );
    }
  } finally {
    rmSync(archivePath, { force: true });
  }
}

function runGit(args: string[]): string {
  const result = git(args);
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function git(args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("git", args, {
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
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

function existsOrSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function requireContentHash(hash: ObservedHash): ContentHash {
  if (hash === ABSENT_HASH) {
    throw new Error("Expected content but path was absent");
  }
  return hash;
}
