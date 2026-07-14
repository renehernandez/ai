import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const hookPath = join(repoRoot, "hooks", "startup-git-sync.ts");
const tsxLoader = pathToFileURL(
  join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;
const gitBinary = [
  process.env.GIT_BINARY,
  "/usr/bin/git",
  "/opt/homebrew/bin/git",
].find((path): path is string => Boolean(path && existsSync(path)));

assert.ok(gitBinary, "git binary is required for startup Git sync tests");

type GitFixture = {
  directory: string;
  remote: string;
  primary: string;
};

type DiscoveryPayload = {
  argv: string[];
  command: string;
};

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

function runGit(args: string[], cwd: string): string {
  const result = spawnSync(gitBinary, args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stderr}\n${result.stdout}`,
  );
  return result.stdout.trim();
}

function configureUser(cwd: string): void {
  runGit(["config", "user.email", "ax@example.test"], cwd);
  runGit(["config", "user.name", "AX Test"], cwd);
}

function resolvedGitPath(cwd: string, name: string): string {
  const path = runGit(["rev-parse", "--git-path", name], cwd);
  return isAbsolute(path) ? path : join(cwd, path);
}

function commitFile(
  cwd: string,
  path: string,
  content: string,
  message: string,
): string {
  writeFileSync(join(cwd, path), content, "utf-8");
  runGit(["add", path], cwd);
  runGit(["commit", "-m", message], cwd);
  return runGit(["rev-parse", "HEAD"], cwd);
}

function withGitFixture(callback: (fixture: GitFixture) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "startup-git-sync-"));
  const remote = join(directory, "remote.git");
  const seed = join(directory, "seed");
  const primary = join(directory, "primary");
  try {
    runGit(["init", "--bare", remote], directory);
    runGit(["init", seed], directory);
    runGit(["checkout", "-b", "main"], seed);
    configureUser(seed);
    commitFile(seed, "README.md", "base\n", "base");
    runGit(["remote", "add", "origin", remote], seed);
    runGit(["push", "-u", "origin", "main"], seed);
    runGit(["symbolic-ref", "HEAD", "refs/heads/main"], remote);
    runGit(["clone", remote, primary], directory);
    configureUser(primary);
    callback({ directory, remote, primary });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function pushRemoteUpdate(fixture: GitFixture, content: string): string {
  const updater = mkdtempSync(join(fixture.directory, "updater-"));
  runGit(["clone", fixture.remote, updater], fixture.directory);
  configureUser(updater);
  const commit = commitFile(updater, "README.md", content, "remote update");
  runGit(["push", "origin", "main"], updater);
  return commit;
}

function discoverInvocation(): DiscoveryPayload {
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath, "--agent-discovery"],
    {
      cwd: repoRoot,
      encoding: "utf-8",
      env: withoutGitRepositoryEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout) as DiscoveryPayload;
  assert.ok(Array.isArray(payload.argv));
  assert.ok(payload.argv.length >= 4);
  assert.match(payload.command, /startup-git-sync\.ts/);
  return payload;
}

function runHook(
  cwd: string,
  extraArgs: string[] = [],
  env: Record<string, string> = {},
): ReturnType<typeof spawnSync> {
  return spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath, "--remote", "origin", ...extraArgs],
    {
      cwd,
      encoding: "utf-8",
      env: {
        ...withoutGitRepositoryEnv(),
        PATH: `${dirname(gitBinary)}:${process.env.PATH ?? ""}`,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

test("startup Git sync fast-forwards the primary default-branch worktree selected by branch ref", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const remoteCommit = pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(feature);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), remoteCommit);
    assert.equal(
      readFileSync(join(fixture.primary, "README.md"), "utf-8"),
      "remote\n",
    );
    assert.match(result.stderr, /Fast-forwarded primary worktree/);
  });
});

test("startup Git sync discards primary uncommitted changes before fast-forwarding", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const remoteCommit = pushRemoteUpdate(fixture, "remote\n");
    writeFileSync(join(fixture.primary, "README.md"), "staged\n", "utf-8");
    runGit(["add", "README.md"], fixture.primary);
    writeFileSync(join(fixture.primary, "README.md"), "unstaged\n", "utf-8");
    mkdirSync(join(fixture.primary, "scratch"));
    writeFileSync(
      join(fixture.primary, "scratch", "untracked.txt"),
      "untracked\n",
      "utf-8",
    );
    const excludePath = resolvedGitPath(fixture.primary, "info/exclude");
    writeFileSync(excludePath, "ignored.txt\n", "utf-8");
    writeFileSync(join(fixture.primary, "ignored.txt"), "ignored\n", "utf-8");

    const result = runHook(feature);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), remoteCommit);
    assert.equal(
      readFileSync(join(fixture.primary, "README.md"), "utf-8"),
      "remote\n",
    );
    assert.equal(existsSync(join(fixture.primary, "scratch")), false);
    assert.equal(existsSync(join(fixture.primary, "ignored.txt")), true);
    assert.match(result.stderr, /Discarded uncommitted changes/);
  });
});

test("startup Git sync runs directly from the primary default-branch worktree", () => {
  withGitFixture((fixture) => {
    const remoteCommit = pushRemoteUpdate(fixture, "remote\n");
    writeFileSync(join(fixture.primary, "README.md"), "dirty\n", "utf-8");
    writeFileSync(join(fixture.primary, "pending.txt"), "pending\n", "utf-8");

    const result = runHook(fixture.primary);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), remoteCommit);
    assert.equal(
      readFileSync(join(fixture.primary, "README.md"), "utf-8"),
      "remote\n",
    );
    assert.equal(existsSync(join(fixture.primary, "pending.txt")), false);
    assert.match(
      result.stderr,
      /Current worktree is the primary default-branch worktree/,
    );
  });
});

test("startup Git sync preserves a diverged primary worktree and its uncommitted changes", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const localCommit = commitFile(
      fixture.primary,
      "local-commit.txt",
      "local\n",
      "local commit",
    );
    writeFileSync(join(fixture.primary, "pending.txt"), "pending\n", "utf-8");
    pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(feature);

    assert.notEqual(result.status, 0);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), localCommit);
    assert.equal(existsSync(join(fixture.primary, "pending.txt")), true);
    assert.match(result.stderr, /local commits would be lost/);
  });
});

test("startup Git sync preserves a primary worktree with an in-progress Git operation", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const rebaseState = resolvedGitPath(fixture.primary, "rebase-merge");
    mkdirSync(rebaseState, { recursive: true });
    writeFileSync(join(fixture.primary, "pending.txt"), "pending\n", "utf-8");
    pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(feature);

    assert.notEqual(result.status, 0);
    assert.equal(existsSync(join(fixture.primary, "pending.txt")), true);
    assert.match(result.stderr, /in-progress git state/);
  });
});

test("startup Git sync reports when primary cleanup precedes a fast-forward failure", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const originalHead = runGit(["rev-parse", "HEAD"], fixture.primary);
    pushRemoteUpdate(fixture, "remote\n");
    writeFileSync(join(fixture.primary, "pending.txt"), "pending\n", "utf-8");
    const wrapperDirectory = join(fixture.directory, "git-wrapper");
    const wrapperPath = join(wrapperDirectory, "git");
    mkdirSync(wrapperDirectory);
    writeFileSync(
      wrapperPath,
      `#!/bin/sh
if [ "$1" = "merge" ]; then
  echo "simulated merge failure" >&2
  exit 1
fi
exec "${gitBinary}" "$@"
`,
      "utf-8",
    );
    chmodSync(wrapperPath, 0o755);

    const result = runHook(feature, [], {
      PATH: `${wrapperDirectory}:${process.env.PATH ?? ""}`,
    });

    assert.notEqual(result.status, 0);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), originalHead);
    assert.equal(existsSync(join(fixture.primary, "pending.txt")), false);
    assert.match(result.stderr, /was cleaned but could not fast-forward/);
    assert.match(result.stderr, /simulated merge failure/);
  });
});

test("startup Git sync advances a clean detached task worktree", () => {
  withGitFixture((fixture) => {
    const detached = join(fixture.directory, "detached");
    runGit(["worktree", "add", "--detach", detached, "HEAD"], fixture.primary);
    const remoteCommit = pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(detached);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), remoteCommit);
    assert.equal(runGit(["rev-parse", "HEAD"], detached), remoteCommit);
    assert.match(result.stderr, /Advanced detached worktree/);
  });
});

test("startup Git sync rebases clean current worktrees", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    configureUser(feature);
    commitFile(feature, "feature.txt", "feature\n", "feature");
    const remoteCommit = pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(feature);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stderr, /Rebased current worktree/);
    assert.equal(
      runGit(["merge-base", "--is-ancestor", remoteCommit, "HEAD"], feature),
      "",
    );
    assert.equal(
      readFileSync(join(feature, "feature.txt"), "utf-8"),
      "feature\n",
    );
  });
});

test("startup Git sync fails for dirty current worktrees", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const originalHead = runGit(["rev-parse", "HEAD"], feature);
    pushRemoteUpdate(fixture, "remote\n");
    writeFileSync(join(feature, "local.txt"), "dirty\n", "utf-8");

    const result = runHook(feature);

    assert.notEqual(result.status, 0);
    assert.equal(runGit(["rev-parse", "HEAD"], feature), originalHead);
    assert.match(result.stderr, /Failed current worktree sync: dirty worktree/);
  });
});

test("startup Git sync fails for in-progress current Git operation state", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    const originalHead = runGit(["rev-parse", "HEAD"], feature);
    const rebaseState = runGit(
      ["rev-parse", "--git-path", "rebase-merge"],
      feature,
    );
    mkdirSync(rebaseState, { recursive: true });
    pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(feature);

    assert.notEqual(result.status, 0);
    assert.equal(runGit(["rev-parse", "HEAD"], feature), originalHead);
    assert.match(result.stderr, /in-progress git state/);
  });
});

test("startup Git sync aborts conflicted rebases and leaves no rebase state", () => {
  withGitFixture((fixture) => {
    const feature = join(fixture.directory, "feature");
    runGit(
      ["worktree", "add", "-b", "feature", feature, "HEAD"],
      fixture.primary,
    );
    configureUser(feature);
    const originalHead = commitFile(
      feature,
      "README.md",
      "feature\n",
      "feature",
    );
    pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(feature);
    const rebaseMerge = runGit(
      ["rev-parse", "--git-path", "rebase-merge"],
      feature,
    );
    const rebaseApply = runGit(
      ["rev-parse", "--git-path", "rebase-apply"],
      feature,
    );

    assert.notEqual(result.status, 0);
    assert.equal(runGit(["rev-parse", "HEAD"], feature), originalHead);
    assert.equal(existsSync(rebaseMerge), false);
    assert.equal(existsSync(rebaseApply), false);
    assert.equal(
      runGit(["status", "--porcelain=v1", "--untracked-files=all"], feature),
      "",
    );
    assert.match(result.stderr, /aborted rebase/);
  });
});

test("startup Git sync fails for detached local commits", () => {
  withGitFixture((fixture) => {
    runGit(["checkout", "--detach"], fixture.primary);
    configureUser(fixture.primary);
    const localHead = commitFile(
      fixture.primary,
      "README.md",
      "detached\n",
      "detached local",
    );
    pushRemoteUpdate(fixture, "remote\n");

    const result = runHook(fixture.primary);

    assert.notEqual(result.status, 0);
    assert.equal(runGit(["rev-parse", "HEAD"], fixture.primary), localHead);
    assert.match(result.stderr, /Failed detached HEAD sync: local commits/);
  });
});

test("startup Git sync runs from a repository without project-local node_modules", () => {
  withGitFixture((fixture) => {
    const path = `${dirname(process.execPath)}:${dirname(gitBinary)}`;
    const discovery = discoverInvocation();

    const result = spawnSync(
      discovery.argv[0],
      [...discovery.argv.slice(1), "--branch", "main"],
      {
        cwd: fixture.primary,
        encoding: "utf-8",
        env: { ...withoutGitRepositoryEnv(), PATH: path },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(join(fixture.primary, "node_modules")), false);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  });
});

test("startup Git sync skips non-Git startup directories", () => {
  const directory = mkdtempSync(join(tmpdir(), "startup-git-sync-non-git-"));
  try {
    const result = runHook(directory);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stderr, /outside a Git worktree/);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
