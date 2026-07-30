import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

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

export function gitRepositoryEnv(
  root: string,
  inheritedIndex = process.env.GIT_INDEX_FILE,
): NodeJS.ProcessEnv {
  const env = withoutGitRepositoryEnv();
  if (inheritedIndex) {
    env.GIT_INDEX_FILE = resolve(root, inheritedIndex);
    if (process.env.GIT_OBJECT_DIRECTORY) {
      env.GIT_OBJECT_DIRECTORY = process.env.GIT_OBJECT_DIRECTORY;
    }
    if (process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES) {
      env.GIT_ALTERNATE_OBJECT_DIRECTORIES =
        process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
    }
  }
  return env;
}

export function stagedPaths(root: string, indexFile?: string): string[] {
  return execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMRD"],
    { cwd: root, encoding: "utf8", env: gitRepositoryEnv(root, indexFile) },
  )
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
}

export function stagedDiff(
  root: string,
  path: string,
  indexFile?: string,
): string {
  return execFileSync("git", ["diff", "--cached", "--unified=0", "--", path], {
    cwd: root,
    encoding: "utf8",
    env: gitRepositoryEnv(root, indexFile),
  });
}

export function stagedContent(
  root: string,
  path: string,
  indexFile?: string,
): string {
  return execFileSync("git", ["show", `:${path}`], {
    cwd: root,
    encoding: "utf8",
    env: gitRepositoryEnv(root, indexFile),
  });
}

export function optionalStagedContent(
  root: string,
  path: string,
  indexFile?: string,
): string | undefined {
  try {
    return stagedContent(root, path, indexFile);
  } catch {
    return undefined;
  }
}

export function addedText(diff: string): string {
  return diff
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

export function rangePaths(
  root: string,
  targetBase: string,
  sourceHead: string,
): string[] {
  return execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "--diff-filter=ACMRD",
      `${targetBase}..${sourceHead}`,
    ],
    { cwd: root, encoding: "utf8", env: withoutGitRepositoryEnv() },
  )
    .split(/\r?\n/)
    .map((path) => path.trim())
    .filter(Boolean);
}

export function rangeDiff(
  root: string,
  targetBase: string,
  sourceHead: string,
  path: string,
): string {
  return execFileSync(
    "git",
    ["diff", "--unified=0", `${targetBase}..${sourceHead}`, "--", path],
    { cwd: root, encoding: "utf8", env: withoutGitRepositoryEnv() },
  );
}

export function revisionContent(
  root: string,
  revision: string,
  path: string,
): string | undefined {
  try {
    return execFileSync("git", ["show", `${revision}:${path}`], {
      cwd: root,
      encoding: "utf8",
      env: withoutGitRepositoryEnv(),
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}
