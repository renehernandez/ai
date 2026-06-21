#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type GitResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type Worktree = {
  path: string;
  branch?: string;
  head?: string;
};

type SyncOptions = {
  cwd: string;
  remote: string;
  branch?: string;
};

type SyncResult = {
  status: "synced" | "skipped" | "failed";
  messages: string[];
};

const HOOK_NAME = "startup-git-sync";
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const GIT_TIMEOUT_MS = 15_000;

function git(cwd: string, args: string[]): GitResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: GIT_TIMEOUT_MS,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function checkedGit(cwd: string, args: string[]): string {
  const result = git(cwd, args);
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result.stdout.trim();
}

function gitPath(cwd: string, name: string): string {
  return checkedGit(cwd, ["rev-parse", "--git-path", name]);
}

function currentWorktreePath(cwd: string): string {
  return checkedGit(cwd, ["rev-parse", "--show-toplevel"]);
}

function normalizePath(path: string): string {
  return existsSync(path) ? realpathSync(path) : path;
}

function remoteDefaultBranch(cwd: string, remote: string): string {
  const lsRemote = git(cwd, ["ls-remote", "--symref", remote, "HEAD"]);
  if (lsRemote.status === 0) {
    const match = /^ref: refs\/heads\/(.+)\s+HEAD$/mu.exec(lsRemote.stdout);
    if (match) {
      return match[1];
    }
  }

  const symbolicRef = git(cwd, [
    "symbolic-ref",
    "--quiet",
    "--short",
    `refs/remotes/${remote}/HEAD`,
  ]);
  if (symbolicRef.status === 0) {
    return symbolicRef.stdout.trim().replace(`${remote}/`, "");
  }

  throw new Error(`Could not resolve default branch for remote '${remote}'`);
}

function isInsideWorktree(cwd: string): boolean {
  const result = git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return result.status === 0 && result.stdout.trim() === "true";
}

function parseWorktrees(input: string): Worktree[] {
  const worktrees: Worktree[] = [];
  let current: Worktree | undefined;
  for (const line of input.split("\n")) {
    if (!line.trim()) {
      if (current) {
        worktrees.push(current);
        current = undefined;
      }
      continue;
    }
    const [key, ...rest] = line.split(" ");
    const value = rest.join(" ");
    if (key === "worktree") {
      if (current) {
        worktrees.push(current);
      }
      current = { path: value };
      continue;
    }
    if (!current) {
      continue;
    }
    if (key === "branch") {
      current.branch = value;
    } else if (key === "HEAD") {
      current.head = value;
    }
  }
  if (current) {
    worktrees.push(current);
  }
  return worktrees;
}

function worktrees(cwd: string): Worktree[] {
  return parseWorktrees(checkedGit(cwd, ["worktree", "list", "--porcelain"]));
}

function primaryDefaultBranchWorktree(
  cwd: string,
  branch: string,
): Worktree | undefined {
  return worktrees(cwd).find(
    (worktree) => worktree.branch === `refs/heads/${branch}`,
  );
}

function hasInProgressGitState(cwd: string): string | undefined {
  const statePaths = [
    "rebase-merge",
    "rebase-apply",
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
  ];
  for (const statePath of statePaths) {
    if (existsSync(gitPath(cwd, statePath))) {
      return statePath;
    }
  }
  return undefined;
}

function dirtyReason(cwd: string): string | undefined {
  const inProgress = hasInProgressGitState(cwd);
  if (inProgress) {
    return `in-progress git state (${inProgress})`;
  }
  const status = checkedGit(cwd, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  if (status.length > 0) {
    return "dirty worktree";
  }
  return undefined;
}

function currentBranch(cwd: string): string | undefined {
  const result = git(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (result.status === 0) {
    return result.stdout.trim();
  }
  return undefined;
}

function currentHead(cwd: string): string {
  return checkedGit(cwd, ["rev-parse", "HEAD"]);
}

function isAncestor(
  cwd: string,
  ancestor: string,
  descendant: string,
): boolean {
  return (
    git(cwd, ["merge-base", "--is-ancestor", ancestor, descendant]).status === 0
  );
}

function hasRebaseState(cwd: string): boolean {
  return (
    existsSync(gitPath(cwd, "rebase-merge")) ||
    existsSync(gitPath(cwd, "rebase-apply"))
  );
}

function abortRebase(cwd: string): GitResult | undefined {
  if (hasRebaseState(cwd)) {
    return git(cwd, ["rebase", "--abort"]);
  }
  return undefined;
}

function fastForwardPrimary(
  primary: Worktree | undefined,
  remoteRef: string,
  messages: string[],
): void {
  if (!primary) {
    messages.push(
      "No primary default-branch worktree found; skipped primary fast-forward.",
    );
    return;
  }
  const reason = dirtyReason(primary.path);
  if (reason) {
    messages.push(
      `Skipped primary fast-forward for ${primary.path}: ${reason}.`,
    );
    return;
  }
  checkedGit(primary.path, ["merge", "--ff-only", remoteRef]);
  messages.push(
    `Fast-forwarded primary worktree ${primary.path} to ${remoteRef}.`,
  );
}

function syncCurrentWorktree(
  cwd: string,
  branch: string,
  remoteRef: string,
  primary: Worktree | undefined,
  messages: string[],
): "synced" | "skipped" | "failed" {
  const currentPath = currentWorktreePath(cwd);
  if (primary && normalizePath(primary.path) === normalizePath(currentPath)) {
    messages.push("Current worktree is the primary default-branch worktree.");
    return "synced";
  }

  const reason = dirtyReason(cwd);
  if (reason) {
    messages.push(`Skipped current worktree sync: ${reason}.`);
    return "skipped";
  }

  const current = currentBranch(cwd);
  if (!current) {
    const head = currentHead(cwd);
    if (!isAncestor(cwd, head, remoteRef)) {
      messages.push(
        "Skipped detached HEAD with local commits not reachable from the remote default branch.",
      );
      return "skipped";
    }
    messages.push(
      "Skipped detached HEAD already reachable from the remote default branch.",
    );
    return "skipped";
  }

  if (current === branch) {
    messages.push(
      "Current worktree is on the default branch but is not the selected primary worktree.",
    );
    return "skipped";
  }

  const rebase = git(cwd, ["rebase", remoteRef]);
  if (rebase.status === 0) {
    messages.push(`Rebased current worktree ${currentPath} onto ${remoteRef}.`);
    return "synced";
  }

  const abort = abortRebase(cwd);
  if (abort && (abort.status !== 0 || hasRebaseState(cwd))) {
    messages.push(
      `Rebase conflict while syncing current worktree; failed to abort rebase and checkout may need manual recovery: ${(abort.stderr || abort.stdout).trim()}`,
    );
    return "failed";
  }
  messages.push(
    `Rebase conflict while syncing current worktree; aborted rebase and left checkout unchanged: ${(rebase.stderr || rebase.stdout).trim()}`,
  );
  return "failed";
}

export function syncStartupGit(options: SyncOptions): SyncResult {
  const messages: string[] = [];
  if (!isInsideWorktree(options.cwd)) {
    return {
      status: "skipped",
      messages: ["Skipped startup Git sync outside a Git worktree."],
    };
  }
  const branch =
    options.branch ?? remoteDefaultBranch(options.cwd, options.remote);
  checkedGit(options.cwd, ["fetch", "--prune", options.remote, branch]);
  const remoteRef = `refs/remotes/${options.remote}/${branch}`;
  const primary = primaryDefaultBranchWorktree(options.cwd, branch);
  fastForwardPrimary(primary, remoteRef, messages);
  const status = syncCurrentWorktree(
    options.cwd,
    branch,
    remoteRef,
    primary,
    messages,
  );
  return { status, messages };
}

function managedTsxLoaderPath(): string {
  return join(
    dirname(SCRIPT_PATH),
    "..",
    "node_modules",
    "tsx",
    "dist",
    "loader.mjs",
  );
}

function discoveryArgv(): string[] {
  return [process.execPath, "--import", managedTsxLoaderPath(), SCRIPT_PATH];
}

function printDiscovery(): void {
  const argv = discoveryArgv();
  process.stdout.write(
    `${JSON.stringify({
      name: HOOK_NAME,
      type: "startup",
      description:
        "Conservatively fetches the remote default branch, fast-forwards the primary worktree, and rebases only clean safe current worktrees.",
      command: argv.map((arg) => JSON.stringify(arg)).join(" "),
      argv,
    })}\n`,
  );
}

function printHelp(): void {
  process.stdout.write(`${HOOK_NAME}

Usage:
  startup-git-sync.ts [--remote origin] [--branch main] [--cwd <path>]
  startup-git-sync.ts --agent-discovery

The hook never stashes, resets, force pushes, or creates merge commits.
`);
}

function parseArgs(argv: string[]): SyncOptions | "help" | "discovery" {
  let cwd = process.cwd();
  let remote = "origin";
  let branch: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      return "help";
    }
    if (arg === "--agent-discovery" || arg === "--hook-info") {
      return "discovery";
    }
    if (arg === "--cwd") {
      cwd = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--remote") {
      remote = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--branch") {
      branch = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return { cwd, remote, branch };
}

function readOptionValue(
  argv: string[],
  index: number,
  option: string,
): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === "help") {
    printHelp();
    return;
  }
  if (parsed === "discovery") {
    printDiscovery();
    return;
  }

  try {
    const result = syncStartupGit(parsed);
    for (const message of result.messages) {
      process.stderr.write(`[${HOOK_NAME}] ${message}\n`);
    }
    if (result.status === "failed") {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`[${HOOK_NAME}] ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
