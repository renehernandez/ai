import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gitRepositoryEnv } from "../../scripts/charter-validator-git.ts";
import { createIndexReader } from "../../scripts/charter-validator-reader.ts";

const gitRepositoryEnvironmentNames = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_PREFIX",
  "GIT_QUARANTINE_PATH",
  "GIT_WORK_TREE",
] as const;

const cleanGitEnvironment = (): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  for (const name of gitRepositoryEnvironmentNames) {
    delete environment[name];
  }
  return environment;
};

test("hook index object storage survives repository redirection cleanup", () => {
  const inherited = { ...process.env };
  try {
    process.env.GIT_DIR = "/tmp/decoy-git-dir";
    process.env.GIT_WORK_TREE = "/tmp/decoy-worktree";
    process.env.GIT_INDEX_FILE = "/tmp/hook-index";
    process.env.GIT_OBJECT_DIRECTORY = "/tmp/hook-objects";
    process.env.GIT_ALTERNATE_OBJECT_DIRECTORIES = "/tmp/repository-objects";
    process.env.GIT_QUARANTINE_PATH = "/tmp/quarantine";

    const environment = gitRepositoryEnv("/tmp/repository");

    assert.equal(environment.GIT_DIR, undefined);
    assert.equal(environment.GIT_WORK_TREE, undefined);
    assert.equal(environment.GIT_QUARANTINE_PATH, undefined);
    assert.equal(environment.GIT_INDEX_FILE, "/tmp/hook-index");
    assert.equal(environment.GIT_OBJECT_DIRECTORY, "/tmp/hook-objects");
    assert.equal(
      environment.GIT_ALTERNATE_OBJECT_DIRECTORIES,
      "/tmp/repository-objects",
    );
  } finally {
    process.env = inherited;
  }
});

test("repository evidence remains bound to the captured staged blob", () => {
  const root = mkdtempSync(join(tmpdir(), "charter-reader-"));
  const gitEnvironment = cleanGitEnvironment();
  try {
    execFileSync("git", ["init", root], { env: gitEnvironment });
    writeFileSync(join(root, "owner.md"), "staged owner\n");
    execFileSync("git", ["-C", root, "add", "owner.md"], {
      env: gitEnvironment,
    });

    const decoy = join(root, "decoy");
    execFileSync("git", ["init", decoy], { env: gitEnvironment });
    writeFileSync(join(decoy, "owner.md"), "decoy owner\n");
    execFileSync("git", ["-C", decoy, "add", "owner.md"], {
      env: gitEnvironment,
    });
    const inheritedGitEnvironment = Object.fromEntries(
      gitRepositoryEnvironmentNames.map((name) => [name, process.env[name]]),
    );
    for (const name of gitRepositoryEnvironmentNames) {
      delete process.env[name];
    }
    process.env.GIT_DIR = join(decoy, ".git");
    let read: (path: string) => string;
    try {
      read = createIndexReader(root);
    } finally {
      for (const name of gitRepositoryEnvironmentNames) {
        const value = inheritedGitEnvironment[name];
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
    const ownerObject = execFileSync(
      "git",
      ["-C", root, "rev-parse", ":owner.md"],
      { encoding: "utf8", env: gitEnvironment },
    ).trim();
    const replacementObject = execFileSync(
      "git",
      ["-C", root, "hash-object", "-w", "--stdin"],
      {
        encoding: "utf8",
        env: gitEnvironment,
        input: "replacement object\n",
      },
    ).trim();
    execFileSync(
      "git",
      ["-C", root, "replace", ownerObject, replacementObject],
      { env: gitEnvironment },
    );
    writeFileSync(join(root, "owner.md"), "worktree replacement\n");
    execFileSync("git", ["-C", root, "add", "owner.md"], {
      env: gitEnvironment,
    });

    assert.equal(read("owner.md"), "staged owner\n");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
