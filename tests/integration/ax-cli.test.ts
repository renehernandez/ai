import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

type Fixture = {
  configPath: string;
  runtimeDir: string;
};
type FixtureConfig = Record<string, unknown>;
type BackupManifest = {
  assetKind: string;
  targetName?: string;
  status: string;
  kind: string;
};

const repoRoot = process.cwd();
const runtimeScript = join(repoRoot, "scripts/ax.ts");
const runtimeBin = join(repoRoot, "bin", "ax.mjs");
const tsxLoader = pathToFileURL(
  join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;

type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
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

function withFixture(
  callback: (fixture: Fixture) => void,
  configureConfig: (config: FixtureConfig, runtimeDir: string) => void = () =>
    undefined,
): void {
  const runtimeDir = mkdtempSync(join(tmpdir(), "ax-cli-"));
  const configPath = join(runtimeDir, "config.json");
  const config = JSON.parse(
    readFileSync(join(repoRoot, "ax.config.json"), "utf-8"),
  ) as FixtureConfig;
  const runtime = config.runtime as Record<string, unknown>;
  runtime.canonicalSkillsDir = join(runtimeDir, "skills");
  runtime.skillSymlinkTargets = [join(runtimeDir, "claude", "skills")];
  runtime.backupsDir = join(runtimeDir, "backups");
  runtime.reusableScripts = [
    {
      sourcePath: join(repoRoot, "scripts/planning-contracts.ts"),
      targetPath: "scripts/planning-contracts.ts",
    },
    {
      sourcePath: join(repoRoot, "scripts/nitro-feedback-gate.ts"),
      targetPath: "scripts/nitro-feedback-gate.ts",
    },
    {
      sourcePath: join(repoRoot, "scripts/review-gate.ts"),
      targetPath: "scripts/review-gate.ts",
    },
    {
      sourcePath: join(repoRoot, "scripts/stack-state.ts"),
      targetPath: "scripts/stack-state.ts",
    },
  ];
  runtime.lockFile = join(runtimeDir, "lock.json");
  runtime.instructionSymlinkTargets = {
    agents: join(runtimeDir, "root"),
    claude: join(runtimeDir, "claude"),
  };
  runtime.hooks = {
    sourceDir: join(repoRoot, "hooks"),
    canonicalDir: join(runtimeDir, "agents", "hooks"),
    allowDisposableSource: true,
    targets: {
      claude: join(runtimeDir, "claude", "hooks"),
      codex: join(runtimeDir, "codex", "hooks"),
    },
    registration: {
      codexHooksJsonPath: join(runtimeDir, "codex", "hooks.json"),
      codexConfigTomlPath: join(runtimeDir, "codex", "config.toml"),
      claudeSettingsJsonPath: join(runtimeDir, "claude", "settings.json"),
    },
    startupRemote: {
      name: "origin",
    },
  };
  configureConfig(config, runtimeDir);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

  try {
    callback({ configPath, runtimeDir });
  } finally {
    rmSync(runtimeDir, { force: true, recursive: true });
  }
}

function withTempHome(callback: (homeDir: string) => void): void {
  const homeDir = mkdtempSync(join(tmpdir(), "ax-home-"));
  try {
    callback(homeDir);
  } finally {
    rmSync(homeDir, { force: true, recursive: true });
  }
}

function runAgentRuntime(
  args: string[],
  options: RunOptions = {},
): { stdout: string; stderr: string; status: number | null } {
  assertSafeRuntimeArgs(args);
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, runtimeScript, ...args],
    {
      cwd: options.cwd ?? repoRoot,
      encoding: "utf-8",
      env: { ...withoutGitRepositoryEnv(), ...options.env },
    },
  );
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function runAgentRuntimeBin(
  args: string[],
  options: RunOptions = {},
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [runtimeBin, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf-8",
    env: { ...withoutGitRepositoryEnv(), ...options.env },
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function assertSafeRuntimeArgs(args: string[]): void {
  if (args[0] === "shim") {
    return;
  }
  if (!args.some((arg) => arg === "--config")) {
    assert.equal(
      args.some((arg) => arg === "install" || arg === "update"),
      false,
      "mutating ax integration tests must pass an explicit fixture --config",
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function realPathIfPossible(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function runGit(args: string[], options: RunOptions = {}): string {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf-8",
    env: { ...withoutGitRepositoryEnv(), ...options.env },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createGitFixture(prefix = "ax-git-"): string {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  runGit(["init"], { cwd });
  runGit(["config", "user.email", "agent@example.com"], { cwd });
  runGit(["config", "user.name", "Agent Runtime"], { cwd });
  return cwd;
}

function stagedHash(cwd: string): string {
  const result = spawnSync("git", ["diff", "--cached", "--binary"], {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const diff = result.stdout;
  return `sha256:${createHash("sha256").update(diff).digest("hex")}`;
}

function writeReviewGateState(
  cwd: string,
  state: Record<string, unknown>,
): void {
  const gitDir = runGit(["rev-parse", "--git-dir"], { cwd });
  const gitPath = gitDir.startsWith(sep) ? gitDir : join(cwd, gitDir);
  mkdirSync(join(gitPath, "ax"), { recursive: true });
  writeFileSync(
    join(gitPath, "ax", "review-gate.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf-8",
  );
}

function matchCount(input: string, pattern: RegExp): number {
  return [...input.matchAll(pattern)].length;
}

function collectBackupManifests(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  const manifests: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      manifests.push(...collectBackupManifests(path));
    } else if (entry.isFile() && entry.name === "manifest.json") {
      manifests.push(path);
    }
  }
  return manifests.sort();
}

function readBackupManifest(path: string): BackupManifest {
  return JSON.parse(readFileSync(path, "utf-8")) as BackupManifest;
}

function findBackupManifest(
  manifests: string[],
  predicate: (manifest: BackupManifest, path: string) => boolean,
): string {
  const manifestPath = manifests.find((path) =>
    predicate(readBackupManifest(path), path),
  );
  assert.ok(manifestPath, "expected matching backup manifest");
  return manifestPath;
}

function cachePathForUrl(directory: string, url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return join(directory, ".ax", "cache", `skills-${hash}`);
}

function configureLocalSkillWithScript(
  config: FixtureConfig,
  runtimeDir: string,
  scriptContent: string,
): void {
  const localSkillsDir = join(runtimeDir, "local-skills");
  mkdirSync(join(localSkillsDir, "needs-script", "scripts"), {
    recursive: true,
  });
  writeFileSync(
    join(localSkillsDir, "needs-script", "SKILL.md"),
    "---\nname: needs-script\n---\n",
    "utf-8",
  );
  writeFileSync(
    join(localSkillsDir, "needs-script", "scripts", "entry.ts"),
    scriptContent,
    "utf-8",
  );

  config.blocks = {
    local: {
      skills: [{ localPath: localSkillsDir, names: ["needs-script"] }],
    },
  };
  config.profiles = {
    personal: { include: ["local"], paths: ["AGENTS.md"] },
  };
}

function addOpenSpecStub(
  runtimeDir: string,
  options: { recordPath?: string; failCommand?: string } = {},
): Record<string, string> {
  const binDir = join(runtimeDir, "bin");
  const openspecPath = join(binDir, "openspec");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    openspecPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function recordInvocation(command) {
  if (!process.env.OPENSPEC_STUB_RECORD_PATH) {
    return;
  }
  const configPath = process.env.XDG_CONFIG_HOME
    ? path.join(process.env.XDG_CONFIG_HOME, "openspec", "config.json")
    : "";
  const record = {
    command,
    argv: process.argv.slice(2),
    xdgConfigHome: process.env.XDG_CONFIG_HOME || "",
    config: configPath && fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, "utf-8"))
      : null,
  };
  fs.appendFileSync(process.env.OPENSPEC_STUB_RECORD_PATH, JSON.stringify(record) + "\\n");
}

if (process.argv.includes("--version")) {
  process.stdout.write("1.4.1\\n");
  process.exit(0);
}

const command = process.argv[2];
if (command === "init" || command === "update") {
  recordInvocation(command);
  if (process.env.OPENSPEC_STUB_FAIL_COMMAND === command) {
    process.stderr.write("forced openspec failure: " + command + "\\n");
    process.exit(42);
  }
  fs.mkdirSync("openspec", { recursive: true });
  if (!fs.existsSync("openspec/config.yaml")) {
    write("openspec/config.yaml", "defaultSchema: spec-driven\\n");
  }
  for (const tool of ["codex", "claude"]) {
    for (const skill of ["openspec-propose", "openspec-apply-change"]) {
      write(path.join("." + tool, "skills", skill, "SKILL.md"), "---\\nname: " + skill + "\\n---\\n");
    }
  }
  for (const commandName of ["propose", "apply"]) {
    write(path.join(".claude", "commands", "opsx", commandName + ".md"), "---\\nname: " + commandName + "\\n---\\n");
  }
  process.exit(0);
}

process.stderr.write("unexpected openspec command: " + process.argv.slice(2).join(" ") + "\\n");
process.exit(1);
`,
    "utf-8",
  );
  chmodSync(openspecPath, 0o755);
  return {
    PATH: `${binDir}:${process.env.PATH ?? ""}`,
    ...(options.recordPath
      ? { OPENSPEC_STUB_RECORD_PATH: options.recordPath }
      : {}),
    ...(options.failCommand
      ? { OPENSPEC_STUB_FAIL_COMMAND: options.failCommand }
      : {}),
  };
}

test("CLI validates all runtime scopes", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const result = runAgentRuntime([
      "validate",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Validated 1 profile/);
    assert.match(result.stdout, /Validated instruction configuration/);
    assert.deepEqual(collectBackupManifests(join(runtimeDir, "backups")), []);
  });
});

test("CLI accepts global config before the command", () => {
  withFixture(({ configPath }) => {
    const result = runAgentRuntime([
      "--config",
      configPath,
      "validate",
      "--profile",
      "work",
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Validated 1 profile/);
  });
});

test("global bin uses central config and target cwd for repo-local scope", () => {
  const targetDir = mkdtempSync(join(tmpdir(), "ax-target-"));
  try {
    writeFileSync(
      join(targetDir, "agent-runtime.config.json"),
      "not valid json\n",
      "utf-8",
    );
    const result = runAgentRuntimeBin(["openspec", "status"], {
      cwd: targetDir,
      env: addOpenSpecStub(targetDir),
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /OpenSpec CLI:/);
    assert.match(
      result.stdout,
      /\[missing\] OpenSpec config: openspec\/config.yaml/,
    );
  } finally {
    rmSync(targetDir, { force: true, recursive: true });
  }
});

test("global status reports runtime roots and target OpenSpec readiness", () => {
  const targetDir = mkdtempSync(join(tmpdir(), "ax-status-"));
  try {
    withTempHome((homeDir) => {
      writeFileSync(
        join(targetDir, "agent-runtime.config.json"),
        "not valid json\n",
        "utf-8",
      );
      const scriptsDir = join(homeDir, ".agents", "scripts");
      mkdirSync(scriptsDir, { recursive: true });
      for (const scriptName of [
        "nitro-feedback-gate.ts",
        "planning-contracts.ts",
        "review-gate.ts",
        "stack-state.ts",
      ]) {
        symlinkSync(
          join(repoRoot, "scripts", scriptName),
          join(scriptsDir, scriptName),
        );
      }
      const result = runAgentRuntimeBin(["status"], {
        cwd: targetDir,
        env: { ...addOpenSpecStub(targetDir), HOME: homeDir },
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /AX/);
      assert.match(
        result.stdout,
        new RegExp(`Source root: ${escapeRegExp(repoRoot)}`),
      );
      assert.match(
        result.stdout,
        new RegExp(
          `Config path: ${escapeRegExp(join(repoRoot, "ax.config.json"))}`,
        ),
      );
      assert.match(
        result.stdout,
        new RegExp(
          `Lock path: ${escapeRegExp(join(repoRoot, "ax.lock.json"))}`,
        ),
      );
      assert.match(
        result.stdout,
        new RegExp(
          `Cache path: ${escapeRegExp(join(repoRoot, ".ax", "cache"))}`,
        ),
      );
      assert.match(
        result.stdout,
        new RegExp(
          `Target root: ${escapeRegExp(realPathIfPossible(targetDir))}`,
        ),
      );
      assert.match(result.stdout, /\[ok\] Executable link:/);
      assert.match(result.stdout, /Shim/);
      assert.match(result.stdout, /\[missing\] Managed shim/);
      assert.match(result.stdout, /Reusable script/);
      assert.match(result.stdout, /OpenSpec/);
      assert.match(result.stdout, /Health/);
      assert.match(result.stdout, /\[warning\] Managed shim is not installed/);
      assert.match(
        result.stdout,
        /\[missing\] OpenSpec config: openspec\/config.yaml/,
      );
    });
  } finally {
    rmSync(targetDir, { force: true, recursive: true });
  }
});

test("global status keeps default lock and cache roots under source root with explicit config", () => {
  const targetDir = mkdtempSync(join(tmpdir(), "ax-status-target-"));
  try {
    withFixture(
      ({ configPath }) => {
        const install = runAgentRuntime([
          "skills",
          "install",
          "--all-profiles",
          "--config",
          configPath,
        ]);
        assert.equal(install.status, 0, install.stderr || install.stdout);

        withTempHome((homeDir) => {
          const result = runAgentRuntimeBin(
            ["status", "--config", configPath],
            {
              cwd: targetDir,
              env: { ...addOpenSpecStub(targetDir), HOME: homeDir },
            },
          );

          assert.equal(result.status, 0, result.stderr || result.stdout);
          assert.match(
            result.stdout,
            new RegExp(`Config path: ${escapeRegExp(configPath)}`),
          );
          assert.match(
            result.stdout,
            new RegExp(
              `Lock path: ${escapeRegExp(join(repoRoot, "ax.lock.json"))}`,
            ),
          );
          assert.match(
            result.stdout,
            new RegExp(
              `Cache path: ${escapeRegExp(join(repoRoot, ".ax", "cache"))}`,
            ),
          );
          assert.match(
            result.stdout,
            new RegExp(
              `Target root: ${escapeRegExp(realPathIfPossible(targetDir))}`,
            ),
          );
        });
      },
      (config) => {
        const runtime = config.runtime as Record<string, unknown>;
        delete runtime.lockFile;
      },
    );
  } finally {
    rmSync(targetDir, { force: true, recursive: true });
  }
});

test("global status honors explicit profile selection", () => {
  withFixture(({ configPath }) => {
    const install = runAgentRuntime([
      "skills",
      "install",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    withTempHome((homeDir) => {
      const result = runAgentRuntime(
        ["status", "--profile", "work", "--config", configPath],
        { env: { HOME: homeDir } },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout, /AX/);
      assert.match(result.stdout, /Validated 1 profile/);
      assert.match(result.stdout, /Profile work/);
      assert.doesNotMatch(result.stdout, /Profile personal/);
      assert.match(result.stdout, /Skills/);
      assert.match(result.stdout, /Instructions/);
      assert.match(result.stdout, /Hooks/);
      assert.match(result.stdout, /OpenSpec/);
      assert.match(result.stdout, /Health/);
    });
  });
});

test("global status reports shim target failures with non-zero exit", () => {
  withTempHome((homeDir) => {
    const localBin = join(homeDir, ".local", "bin");
    const shimPath = join(localBin, "ax");
    const staleRoot = join(homeDir, ".codex", "worktrees", "old", "ai");
    mkdirSync(localBin, { recursive: true });
    writeFileSync(
      shimPath,
      [
        "#!/bin/sh",
        "# AX_MANAGED_SHIM",
        `# AX_SOURCE_ROOT=${staleRoot}`,
        `exec '${join(staleRoot, "bin", "ax.mjs")}' "$@"`,
        "",
      ].join("\n"),
      "utf-8",
    );
    chmodSync(shimPath, 0o755);

    const result = runAgentRuntimeBin(["status"], {
      env: {
        HOME: homeDir,
        PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /\[stale\] Source root:/);
    assert.match(result.stdout, /\[detached\] Source root appears/);
    assert.match(result.stdout, /\[failure\] Managed shim source root/);
    assert.match(result.stderr, /AX status detected runtime failures/);
  });
});

test("global status reports missing reusable script targets as runtime failures", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const install = runAgentRuntime([
      "skills",
      "install",
      "--all-profiles",
      "--config",
      configPath,
    ]);
    assert.equal(install.status, 0, install.stderr || install.stdout);
    rmSync(join(runtimeDir, "scripts", "nitro-feedback-gate.ts"), {
      force: true,
    });

    const status = runAgentRuntime(["status", "--config", configPath]);

    assert.notEqual(status.status, 0);
    assert.match(status.stdout, /\[missing\] Reusable script/);
    assert.match(status.stdout, /\[failure\] \[missing\] Reusable script/);
    assert.match(status.stderr, /AX status detected runtime failures/);
  });
});

test("CLI shows global help", () => {
  const result = runAgentRuntime(["--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: ax/);
  assert.match(result.stdout, /Commands:/);
  assert.doesNotMatch(result.stdout, /\bagents\b/);
  assert.match(result.stdout, /hooks/);
  assert.match(result.stdout, /instructions/);
  assert.match(result.stdout, /openspec/);
  assert.match(result.stdout, /review-gate/);
  assert.match(result.stdout, /commit/);
  assert.match(result.stdout, /shim/);
  assert.match(result.stdout, /skills/);
});

test("CLI shows OpenSpec scope help", () => {
  const result = runAgentRuntime(["openspec", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: ax openspec/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /update/);
  assert.match(result.stdout, /validate/);
});

test("CLI shows hooks scope help", () => {
  const result = runAgentRuntime(["hooks", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: ax hooks/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /update/);
  assert.match(result.stdout, /validate/);
});

test("review-gate validate-commit allows missing inactive gate state", () => {
  const cwd = createGitFixture("ax-review-gate-missing-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(["review-gate", "validate-commit"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /No review gate state found; allowing commit/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review-gate status reports active gate diagnostics without failing", () => {
  const cwd = createGitFixture("ax-review-gate-status-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
      stagedDiffHash: stagedHash(cwd),
      requiredReviewPasses: ["implementation-review", "docs-alignment-review"],
      results: {
        "implementation-review": {
          status: "passed",
          diffHash: stagedHash(cwd),
        },
      },
      blockingFindings: [{ message: "docs missing" }],
    });

    const result = runAgentRuntime(["review-gate", "status"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /state_path:/);
    assert.match(result.stdout, /active: true/);
    assert.match(result.stdout, /required_review_passes:/);
    assert.match(result.stdout, /missing_review_passes: docs-alignment-review/);
    assert.match(result.stdout, /blocking_findings: 1/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review-gate validate-commit rejects missing review passes and blocking findings", () => {
  const cwd = createGitFixture("ax-review-gate-blocking-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
      stagedDiffHash: stagedHash(cwd),
      requiredReviewPasses: ["implementation-review"],
      results: {},
      blockingFindings: [{ message: "fix me" }],
    });

    const result = runAgentRuntime(["review-gate", "validate-commit"], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing required review pass/);
    assert.match(result.stderr, /unresolved blocking findings/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review-gate validate-commit rejects stale active review results", () => {
  const cwd = createGitFixture("ax-review-gate-stale-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
      stagedDiffHash: "sha256:old",
      requiredReviewPasses: ["implementation-review"],
      results: {
        "implementation-review": {
          status: "passed",
          diffHash: "sha256:old",
        },
      },
      blockingFindings: [],
    });

    const result = runAgentRuntime(["review-gate", "validate-commit"], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Stale review pass/);
    assert.match(result.stderr, /completed_review_passes: \(none\)/);
    assert.match(result.stderr, /Review gate staged diff hash is stale/);
    assert.match(result.stderr, /rerun required local reviews/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review-gate validate-commit rejects malformed gate JSON", () => {
  const cwd = createGitFixture("ax-review-gate-malformed-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    const gitDir = runGit(["rev-parse", "--git-dir"], { cwd });
    const gitPath = gitDir.startsWith(sep) ? gitDir : join(cwd, gitDir);
    mkdirSync(join(gitPath, "ax"), { recursive: true });
    writeFileSync(join(gitPath, "ax", "review-gate.json"), "{ nope\n", "utf-8");

    const result = runAgentRuntime(["review-gate", "validate-commit"], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /not valid JSON/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review-gate validate-commit rejects incomplete active gate state", () => {
  const cwd = createGitFixture("ax-review-gate-incomplete-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
    });

    const result = runAgentRuntime(["review-gate", "validate-commit"], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires stagedDiffHash/);
    assert.match(result.stderr, /requires requiredReviewPasses/);
    assert.match(result.stderr, /requires results/);
    assert.match(result.stderr, /requires blockingFindings/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("review-gate validate-commit accepts passed active review results", () => {
  const cwd = createGitFixture("ax-review-gate-passed-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    const hash = stagedHash(cwd);
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
      workflow: "plan-unit-delivery",
      sourceProvenance: {
        kind: "plan_delivery_handoff",
        ref: "/tmp/example-handoff.yaml",
      },
      stagedDiffHash: hash,
      requiredReviewPasses: ["implementation-review", "docs-alignment-review"],
      results: {
        "implementation-review": {
          status: "passed",
          diffHash: hash,
        },
        "docs-alignment-review": {
          status: "passed",
          diffHash: hash,
        },
      },
      blockingFindings: [],
    });

    const result = runAgentRuntime(["review-gate", "validate-commit"], { cwd });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /active: true/);
    assert.match(
      result.stdout,
      /completed_review_passes: implementation-review, docs-alignment-review/,
    );
    assert.match(result.stdout, /next: ax commit/);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit delegates normal staged commits after review-gate validation", () => {
  const cwd = createGitFixture("ax-commit-delegates-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(["commit", "-m", "add fixture file"], {
      cwd,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      runGit(["log", "-1", "--pretty=%s"], { cwd }),
      "add fixture file",
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit required review-gate mode fails without an active gate", () => {
  const cwd = createGitFixture("ax-commit-required-gate-missing-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(
      ["commit", "--require-review-gate", "-m", "add fixture file"],
      {
        cwd,
      },
    );

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /--require-review-gate requires an active fresh review gate/,
    );
    assert.match(
      result.stderr,
      /next: run required local reviews, activate the review gate, then retry ax commit --require-review-gate/,
    );
    assert.doesNotMatch(result.stderr, /allowing commit/);
    assert.doesNotMatch(
      result.stderr,
      /unknown option|Unsupported ax commit option|Pathspec commits are not supported/i,
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit required review-gate mode delegates with an active fresh gate", () => {
  const cwd = createGitFixture("ax-commit-required-gate-active-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    const hash = stagedHash(cwd);
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
      workflow: "plan-unit-delivery",
      sourceProvenance: {
        kind: "plan_delivery_handoff",
        ref: "/tmp/example-handoff.yaml",
      },
      stagedDiffHash: hash,
      requiredReviewPasses: ["implementation-review"],
      results: {
        "implementation-review": {
          status: "passed",
          diffHash: hash,
        },
      },
      blockingFindings: [],
    });

    const result = runAgentRuntime(
      ["commit", "--require-review-gate", "-m", "add fixture file"],
      {
        cwd,
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      runGit(["log", "-1", "--pretty=%s"], { cwd }),
      "add fixture file",
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit help documents required review-gate mode", () => {
  const result = runAgentRuntime(["commit", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /--require-review-gate/);
  assert.match(result.stdout, /Enable workflow-owned review-gate commit mode/);
});

test("ax commit ignores parent Git repository env when delegating", () => {
  const cwd = createGitFixture("ax-commit-sanitizes-env-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(["commit", "-m", "add fixture file"], {
      cwd,
      env: { GIT_INDEX_FILE: join(cwd, "alternate-index") },
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(
      runGit(["log", "-1", "--pretty=%s"], { cwd }),
      "add fixture file",
    );
    assert.equal(runGit(["status", "--short"], { cwd }), "");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit refuses commits when active review-gate validation fails", () => {
  const cwd = createGitFixture("ax-commit-blocked-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });
    writeReviewGateState(cwd, {
      version: 1,
      active: true,
      stagedDiffHash: "sha256:old",
      requiredReviewPasses: ["implementation-review"],
      results: {},
      blockingFindings: [],
    });

    const result = runAgentRuntime(["commit", "-m", "should not commit"], {
      cwd,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing required review pass/);
    assert.match(result.stderr, /Review gate staged diff hash is stale/);
    assert.equal(runGit(["status", "--short"], { cwd }), "A  file.txt");
    assert.notEqual(
      spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
        cwd,
        encoding: "utf-8",
        env: withoutGitRepositoryEnv(),
      }).status,
      0,
    );
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit rejects empty explicit commit messages without pathspec noise", () => {
  const cwd = createGitFixture("ax-commit-empty-message-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(["commit", "-m", ""], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /-m requires a commit message/);
    assert.doesNotMatch(result.stderr, /Pathspec commits are not supported/);
    assert.equal(runGit(["status", "--short"], { cwd }), "A  file.txt");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit rejects empty equals-form commit messages", () => {
  const cwd = createGitFixture("ax-commit-empty-equals-message-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(["commit", "--message="], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /--message requires a commit message/);
    assert.equal(runGit(["status", "--short"], { cwd }), "A  file.txt");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit reports review-gate git errors without stack traces", () => {
  const cwd = mkdtempSync(join(tmpdir(), "ax-commit-not-git-"));
  try {
    const result = runAgentRuntime(["commit", "-m", "outside git"], { cwd });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unable to validate review gate:/);
    assert.doesNotMatch(result.stderr, /Error:/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit rejects commit-shape-mutating flags", () => {
  const cwd = createGitFixture("ax-commit-rejects-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    const result = runAgentRuntime(["commit", "--amend", "-m", "rewrite"], {
      cwd,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported ax commit mode: --amend/);
    assert.equal(runGit(["status", "--short"], { cwd }), "A  file.txt");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("ax commit rejects autosquash and message-reuse commit modes", () => {
  const cwd = createGitFixture("ax-commit-rejects-autosquash-");
  try {
    writeFileSync(join(cwd, "file.txt"), "one\n", "utf-8");
    runGit(["add", "file.txt"], { cwd });

    for (const args of [
      ["commit", "--fixup=HEAD", "-m", "fixup"],
      ["commit", "--squash", "HEAD", "-m", "squash"],
      ["commit", "-C", "HEAD"],
      ["commit", "-c", "HEAD"],
    ]) {
      const result = runAgentRuntime(args, { cwd });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Unsupported ax commit mode/);
    }
    assert.equal(runGit(["status", "--short"], { cwd }), "A  file.txt");
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
});

test("CLI installs, reports, and uninstalls managed AX shim", () => {
  withTempHome((homeDir) => {
    const localBin = join(homeDir, ".local", "bin");
    const shimPath = join(localBin, "ax");
    const env = {
      HOME: homeDir,
      PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}`,
    };

    const install = runAgentRuntime(["shim", "install"], { env });
    assert.equal(install.status, 0, install.stderr || install.stdout);
    assert.equal(existsSync(shimPath), true);
    assert.match(readFileSync(shimPath, "utf-8"), /AX_MANAGED_SHIM/);
    assert.match(install.stdout, /Installed managed AX shim/);
    assert.match(install.stdout, /\[ok\] Managed shim/);
    assert.match(install.stdout, /\[ok\] Executable bit/);
    assert.match(install.stdout, /\[ok\] PATH includes/);
    assert.match(install.stdout, /\[ok\] PATH ax entry:/);

    const status = runAgentRuntime(["shim", "status"], { env });
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /\[ok\] Managed shim/);
    assert.match(status.stdout, /\[ok\] Executable bit/);
    assert.match(status.stdout, /\[ok\] Source root:/);
    assert.match(status.stdout, new RegExp(escapeRegExp(repoRoot)));

    const missingPathStatus = runAgentRuntime(["shim", "status"], {
      env: { HOME: homeDir, PATH: process.env.PATH ?? "" },
    });
    assert.equal(
      missingPathStatus.status,
      0,
      missingPathStatus.stderr || missingPathStatus.stdout,
    );
    assert.match(missingPathStatus.stdout, /\[missing\] PATH includes/);
    assert.match(missingPathStatus.stdout, /export PATH=/);

    const shadowBin = join(homeDir, "shadow-bin");
    mkdirSync(shadowBin, { recursive: true });
    writeFileSync(join(shadowBin, "ax"), "#!/bin/sh\nexit 0\n", "utf-8");
    chmodSync(join(shadowBin, "ax"), 0o755);
    const shadowedStatus = runAgentRuntime(["shim", "status"], {
      env: {
        HOME: homeDir,
        PATH: `${shadowBin}${delimiter}${localBin}${delimiter}${process.env.PATH ?? ""}`,
      },
    });
    assert.equal(
      shadowedStatus.status,
      0,
      shadowedStatus.stderr || shadowedStatus.stdout,
    );
    assert.match(shadowedStatus.stdout, /\[shadowing\] PATH ax entry:/);
    assert.match(shadowedStatus.stdout, /\[shadowed\] PATH ax entry:/);
    assert.match(shadowedStatus.stdout, /shadows the managed AX shim/);

    const uninstall = runAgentRuntime(["shim", "uninstall"], { env });
    assert.equal(uninstall.status, 0, uninstall.stderr || uninstall.stdout);
    assert.equal(existsSync(shimPath), false);
    assert.match(uninstall.stdout, /Removed managed AX shim/);
  });
});

test("CLI reports non-executable managed AX shim state", () => {
  withTempHome((homeDir) => {
    const localBin = join(homeDir, ".local", "bin");
    const shimPath = join(localBin, "ax");
    mkdirSync(localBin, { recursive: true });
    writeFileSync(
      shimPath,
      [
        "#!/bin/sh",
        "# AX_MANAGED_SHIM",
        `# AX_SOURCE_ROOT=${repoRoot}`,
        `exec '${runtimeBin}' "$@"`,
        "",
      ].join("\n"),
      "utf-8",
    );
    chmodSync(shimPath, 0o644);

    const status = runAgentRuntime(["shim", "status"], {
      env: {
        HOME: homeDir,
        PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}`,
      },
    });

    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /\[ok\] Managed shim/);
    assert.match(status.stdout, /\[not-executable\] Executable bit/);
  });
});

test("CLI refuses unmanaged AX shim replacement and removal", () => {
  withTempHome((homeDir) => {
    const localBin = join(homeDir, ".local", "bin");
    const shimPath = join(localBin, "ax");
    mkdirSync(localBin, { recursive: true });
    writeFileSync(shimPath, "#!/bin/sh\nexit 0\n", "utf-8");
    chmodSync(shimPath, 0o755);
    const env = {
      HOME: homeDir,
      PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}`,
    };

    const install = runAgentRuntime(["shim", "install"], { env });
    assert.notEqual(install.status, 0);
    assert.match(install.stderr, /Refusing to overwrite unmanaged ax shim/);

    const uninstall = runAgentRuntime(["shim", "uninstall"], { env });
    assert.notEqual(uninstall.status, 0);
    assert.match(uninstall.stderr, /Refusing to remove unmanaged ax shim/);
    assert.equal(existsSync(shimPath), true);
  });
});

test("CLI reports stale and detached managed AX shim targets", () => {
  withTempHome((homeDir) => {
    const localBin = join(homeDir, ".local", "bin");
    const shimPath = join(localBin, "ax");
    const detachedRoot = join(homeDir, ".codex", "worktrees", "old", "ai");
    mkdirSync(localBin, { recursive: true });
    writeFileSync(
      shimPath,
      [
        "#!/bin/sh",
        "# AX_MANAGED_SHIM",
        `# AX_SOURCE_ROOT=${detachedRoot}`,
        `exec '${join(detachedRoot, "bin", "ax.mjs")}' "$@"`,
        "",
      ].join("\n"),
      "utf-8",
    );
    chmodSync(shimPath, 0o755);

    const status = runAgentRuntime(["shim", "status"], {
      env: {
        HOME: homeDir,
        PATH: `${localBin}${delimiter}${process.env.PATH ?? ""}`,
      },
    });

    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /\[ok\] Managed shim/);
    assert.match(status.stdout, /\[stale\] Source root:/);
    assert.match(status.stdout, /\[stale\] Source root path missing/);
    assert.match(status.stdout, /\[detached\] Source root appears/);
  });
});

test("CLI installs missing OpenSpec scaffolding and updates configured projects", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const recordPath = join(runtimeDir, "openspec-record.jsonl");
    const env = addOpenSpecStub(runtimeDir, { recordPath });
    const contextFile = join(runtimeDir, "openspec-context.md");
    writeFileSync(
      contextFile,
      "Confirmed context: use OpenSpec for Agents Experience planning.\n",
      "utf-8",
    );

    const install = runAgentRuntime(
      [
        "openspec",
        "install",
        "--context-file",
        contextFile,
        "--config",
        configPath,
      ],
      {
        cwd: runtimeDir,
        env,
      },
    );

    assert.equal(install.status, 0, install.stderr || install.stdout);
    assert.equal(
      lstatSync(
        join(runtimeDir, ".agents", "skills", "openspec-propose"),
      ).isDirectory(),
      true,
    );
    assert.equal(
      lstatSync(
        join(runtimeDir, ".codex", "skills", "openspec-propose"),
      ).isSymbolicLink(),
      true,
    );
    assert.equal(
      readlinkSync(join(runtimeDir, ".codex", "skills", "openspec-propose")),
      "../../.agents/skills/openspec-propose",
    );
    assert.equal(
      lstatSync(
        join(runtimeDir, ".claude", "skills", "openspec-propose"),
      ).isSymbolicLink(),
      true,
    );
    assert.equal(
      lstatSync(
        join(runtimeDir, ".agents", "commands", "opsx", "propose.md"),
      ).isFile(),
      true,
    );
    assert.equal(
      readlinkSync(
        join(runtimeDir, ".claude", "commands", "opsx", "propose.md"),
      ),
      "../../../.agents/commands/opsx/propose.md",
    );
    const installedConfig = readFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "utf-8",
    );
    assert.match(installedConfig, /^schema: spec-driven/m);
    assert.match(installedConfig, /OpenSpec tools: codex, claude/);
    assert.match(installedConfig, /Confirmed context/);
    assert.match(installedConfig, /rules:/);
    writeFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "schema: spec-driven\ncontext: |-\n  sentinel config\n",
      "utf-8",
    );
    rmSync(join(runtimeDir, ".codex", "skills", "openspec-propose"), {
      force: true,
      recursive: true,
    });
    mkdirSync(join(runtimeDir, ".codex", "skills", "openspec-propose"), {
      recursive: true,
    });
    writeFileSync(
      join(runtimeDir, ".codex", "skills", "openspec-propose", "SKILL.md"),
      "sentinel codex skill\n",
      "utf-8",
    );
    rmSync(join(runtimeDir, ".claude", "commands", "opsx", "propose.md"), {
      force: true,
      recursive: true,
    });
    writeFileSync(
      join(runtimeDir, ".claude", "commands", "opsx", "propose.md"),
      "sentinel claude command\n",
      "utf-8",
    );

    writeFileSync(
      join(runtimeDir, ".agents", "skills", "openspec-propose", "SKILL.md"),
      "canonical skill before update\n",
      "utf-8",
    );
    writeFileSync(
      join(runtimeDir, ".agents", "commands", "opsx", "propose.md"),
      "canonical command before update\n",
      "utf-8",
    );
    const update = runAgentRuntime(
      ["openspec", "update", "--config", configPath],
      {
        cwd: runtimeDir,
        env,
      },
    );
    assert.equal(update.status, 0, update.stderr || update.stdout);

    const manifestsAfterUpdate = collectBackupManifests(
      join(runtimeDir, "backups"),
    );
    assert.ok(
      manifestsAfterUpdate.some((manifest) =>
        manifest.includes(`${join("openspec", "agents")}${sep}`),
      ),
    );
    assert.ok(
      manifestsAfterUpdate.some((manifest) =>
        manifest.includes(`${join("openspec", "codex")}${sep}`),
      ),
    );
    const configBackup = findBackupManifest(
      manifestsAfterUpdate,
      (manifest) =>
        manifest.assetKind === "openspec" &&
        manifest.targetName === "config" &&
        manifest.kind === "file",
    );
    assert.equal(
      readFileSync(join(dirname(configBackup), "target"), "utf-8"),
      "schema: spec-driven\ncontext: |-\n  sentinel config\n",
    );
    const codexSkillBackup = findBackupManifest(
      manifestsAfterUpdate,
      (manifest, manifestPath) =>
        manifest.assetKind === "openspec" &&
        manifest.targetName === "codex" &&
        manifest.kind === "directory" &&
        existsSync(
          join(dirname(manifestPath), "target", "openspec-propose", "SKILL.md"),
        ),
    );
    assert.equal(
      readFileSync(
        join(
          dirname(codexSkillBackup),
          "target",
          "openspec-propose",
          "SKILL.md",
        ),
        "utf-8",
      ),
      "sentinel codex skill\n",
    );
    const claudeCommandBackup = findBackupManifest(
      manifestsAfterUpdate,
      (manifest, manifestPath) =>
        manifest.assetKind === "openspec" &&
        manifest.targetName === "claude" &&
        manifest.kind === "directory" &&
        existsSync(join(dirname(manifestPath), "target", "propose.md")),
    );
    assert.equal(
      readFileSync(
        join(dirname(claudeCommandBackup), "target", "propose.md"),
        "utf-8",
      ),
      "sentinel claude command\n",
    );
    const canonicalSkillBackup = findBackupManifest(
      manifestsAfterUpdate,
      (manifest, manifestPath) =>
        manifest.assetKind === "openspec" &&
        manifest.targetName === "agents" &&
        manifest.kind === "directory" &&
        existsSync(
          join(dirname(manifestPath), "target", "openspec-propose", "SKILL.md"),
        ) &&
        readFileSync(
          join(dirname(manifestPath), "target", "openspec-propose", "SKILL.md"),
          "utf-8",
        ) === "canonical skill before update\n",
    );
    assert.ok(canonicalSkillBackup);
    const canonicalCommandBackup = findBackupManifest(
      manifestsAfterUpdate,
      (manifest, manifestPath) =>
        manifest.assetKind === "openspec" &&
        manifest.targetName === "agents" &&
        manifest.kind === "directory" &&
        existsSync(join(dirname(manifestPath), "target", "propose.md")) &&
        readFileSync(
          join(dirname(manifestPath), "target", "propose.md"),
          "utf-8",
        ) === "canonical command before update\n",
    );
    assert.ok(canonicalCommandBackup);
    assert.ok(
      manifestsAfterUpdate.some((manifest) =>
        manifest.includes(`${join("openspec", "claude")}${sep}`),
      ),
    );
    const records = readFileSync(recordPath, "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(records[0].argv, [
      "init",
      ".",
      "--tools",
      "codex,claude",
      "--profile",
      "custom",
    ]);
    assert.deepEqual(records[1].argv, ["update", "."]);
    assert.deepEqual(records[0].config, {
      profile: "custom",
      delivery: "both",
      workflows: ["propose", "explore", "apply", "archive"],
    });
    assert.equal(typeof records[0].xdgConfigHome, "string");
    assert.equal(existsSync(records[0].xdgConfigHome as string), false);

    const validate = runAgentRuntime(
      ["openspec", "validate", "--config", configPath],
      { cwd: runtimeDir, env },
    );
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);

    const status = runAgentRuntime(
      ["openspec", "status", "--config", configPath],
      {
        cwd: runtimeDir,
        env,
      },
    );
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /OpenSpec CLI:/);
    assert.match(status.stdout, /openspec-propose/);
    assert.match(status.stdout, /propose\.md/);
    assert.equal(
      collectBackupManifests(join(runtimeDir, "backups")).length,
      manifestsAfterUpdate.length,
    );
  });
});

test("CLI skips OpenSpec update when generated assets are current", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const recordPath = join(runtimeDir, "openspec-record.jsonl");
    const contextFile = join(runtimeDir, "openspec-context.md");
    writeFileSync(contextFile, "Confirmed context.\n", "utf-8");
    const env = addOpenSpecStub(runtimeDir, { recordPath });

    const install = runAgentRuntime(
      [
        "openspec",
        "install",
        "--context-file",
        contextFile,
        "--config",
        configPath,
      ],
      {
        cwd: runtimeDir,
        env,
      },
    );
    assert.equal(install.status, 0, install.stderr || install.stdout);
    const backupCountAfterInstall = collectBackupManifests(
      join(runtimeDir, "backups"),
    ).length;

    const update = runAgentRuntime(
      ["openspec", "update", "--config", configPath],
      {
        cwd: runtimeDir,
        env,
      },
    );

    assert.equal(update.status, 0, update.stderr || update.stdout);
    assert.match(update.stdout, /OpenSpec generated assets are current/);
    const records = readFileSync(recordPath, "utf-8").trim().split("\n");
    assert.equal(records.length, 1);
    assert.equal(
      collectBackupManifests(join(runtimeDir, "backups")).length,
      backupCountAfterInstall,
    );
  });
});

test("CLI reports OpenSpec config review changes without headless acceptance", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const contextFile = join(runtimeDir, "openspec-context.md");
    writeFileSync(contextFile, "Confirmed context.\n", "utf-8");
    const env = addOpenSpecStub(runtimeDir);

    const install = runAgentRuntime(
      [
        "openspec",
        "install",
        "--context-file",
        contextFile,
        "--config",
        configPath,
      ],
      { cwd: runtimeDir, env },
    );
    assert.equal(install.status, 0, install.stderr || install.stdout);
    writeFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "schema: spec-driven\ncontext: |-\n  Existing context.\n",
      "utf-8",
    );

    const update = runAgentRuntime(
      ["openspec", "update", "--review-config", "--config", configPath],
      { cwd: runtimeDir, env },
    );

    assert.equal(update.status, 0, update.stderr || update.stdout);
    assert.match(update.stdout, /Proposed OpenSpec config changes/);
    assert.match(update.stdout, /OpenSpec config review was not applied/);
    assert.equal(
      readFileSync(join(runtimeDir, "openspec", "config.yaml"), "utf-8"),
      "schema: spec-driven\ncontext: |-\n  Existing context.\n",
    );
  });
});

test("CLI applies accepted headless OpenSpec config review", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const contextFile = join(runtimeDir, "openspec-context.md");
    writeFileSync(contextFile, "Confirmed context.\n", "utf-8");
    const env = addOpenSpecStub(runtimeDir);

    const install = runAgentRuntime(
      [
        "openspec",
        "install",
        "--context-file",
        contextFile,
        "--config",
        configPath,
      ],
      { cwd: runtimeDir, env },
    );
    assert.equal(install.status, 0, install.stderr || install.stdout);
    writeFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "schema: spec-driven\ncontext: |-\n  Existing context.\nrules:\n  tasks:\n    - Existing task rule.\n",
      "utf-8",
    );
    writeFileSync(
      join(runtimeDir, "package.json"),
      JSON.stringify(
        {
          name: "review-config-fixture",
          scripts: {
            test: "node --test",
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    const update = runAgentRuntime(
      [
        "openspec",
        "update",
        "--review-config",
        "--accept-config-changes",
        "--config",
        configPath,
      ],
      { cwd: runtimeDir, env },
    );

    assert.equal(update.status, 0, update.stderr || update.stdout);
    assert.match(update.stdout, /Updated openspec\/config.yaml/);
    const updatedConfig = readFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "utf-8",
    );
    assert.match(updatedConfig, /Existing context/);
    assert.match(updatedConfig, /OpenSpec tools: codex, claude/);
    assert.match(updatedConfig, /Existing task rule/);
    assert.match(updatedConfig, /package-managed verification/);
  });
});

test("CLI preserves confirmed OpenSpec config when upstream generation fails", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const contextFile = join(runtimeDir, "openspec-context.md");
    writeFileSync(contextFile, "Confirmed failure context.\n", "utf-8");

    const result = runAgentRuntime(
      [
        "openspec",
        "install",
        "--context-file",
        contextFile,
        "--config",
        configPath,
      ],
      {
        cwd: runtimeDir,
        env: addOpenSpecStub(runtimeDir, { failCommand: "init" }),
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /repairable/);
    assert.match(result.stderr, /forced openspec failure: init/);
    assert.match(result.stderr, /No managed OpenSpec skills/);
    const config = readFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "utf-8",
    );
    assert.match(config, /Confirmed failure context/);
    assert.equal(existsSync(join(runtimeDir, ".agents", "skills")), false);
  });
});

test("CLI requires a context file for headless OpenSpec install", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const result = runAgentRuntime(
      ["openspec", "install", "--config", configPath],
      {
        cwd: runtimeDir,
        env: addOpenSpecStub(runtimeDir),
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /confirmation_required/);
    assert.match(result.stderr, /--context-file <path>/);
    assert.equal(
      existsSync(join(runtimeDir, "openspec", "config.yaml")),
      false,
    );
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI does not support accepting inferred OpenSpec config headlessly", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const result = runAgentRuntime(
      [
        "openspec",
        "install",
        "--accept-inferred-config",
        "--config",
        configPath,
      ],
      {
        cwd: runtimeDir,
        env: addOpenSpecStub(runtimeDir),
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown option '--accept-inferred-config'/);
  });
});

test("CLI refuses OpenSpec install when setup is already configured", () => {
  withFixture(({ configPath, runtimeDir }) => {
    mkdirSync(join(runtimeDir, "openspec"), { recursive: true });
    mkdirSync(join(runtimeDir, ".agents", "skills", "openspec-propose"), {
      recursive: true,
    });
    writeFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "schema: spec-driven\ncontext: |-\n  sentinel config\n",
      "utf-8",
    );

    const result = runAgentRuntime(
      ["openspec", "install", "--config", configPath],
      {
        cwd: runtimeDir,
        env: { PATH: join(runtimeDir, "missing-bin") },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already configured/);
    assert.match(result.stderr, /ax openspec update/);
    assert.doesNotMatch(result.stderr, /npm install -g/);
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
    assert.equal(
      readFileSync(join(runtimeDir, "openspec", "config.yaml"), "utf-8"),
      "schema: spec-driven\ncontext: |-\n  sentinel config\n",
    );
  });
});

test("CLI refuses OpenSpec update when setup is missing", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const result = runAgentRuntime(
      ["openspec", "update", "--config", configPath],
      {
        cwd: runtimeDir,
        env: { PATH: join(runtimeDir, "missing-bin") },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not configured/);
    assert.match(result.stderr, /ax openspec install/);
    assert.doesNotMatch(result.stderr, /npm install -g/);
    assert.equal(
      existsSync(join(runtimeDir, "openspec", "config.yaml")),
      false,
    );
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI refuses OpenSpec install or update when setup is partial", () => {
  withFixture(({ configPath, runtimeDir }) => {
    mkdirSync(join(runtimeDir, "openspec"), { recursive: true });
    writeFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "schema: spec-driven\ncontext: |-\n  sentinel config\n",
      "utf-8",
    );

    const install = runAgentRuntime(
      ["openspec", "install", "--config", configPath],
      {
        cwd: runtimeDir,
        env: addOpenSpecStub(runtimeDir),
      },
    );

    assert.notEqual(install.status, 0);
    assert.match(install.stderr, /setup is partial/);
    assert.match(install.stderr, /No managed OpenSpec skills/);
    assert.equal(existsSync(join(runtimeDir, ".agents", "skills")), false);
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });

  withFixture(({ configPath, runtimeDir }) => {
    mkdirSync(join(runtimeDir, ".agents", "skills", "openspec-propose"), {
      recursive: true,
    });

    const update = runAgentRuntime(
      ["openspec", "update", "--config", configPath],
      {
        cwd: runtimeDir,
        env: addOpenSpecStub(runtimeDir),
      },
    );

    assert.notEqual(update.status, 0);
    assert.match(update.stderr, /setup is partial/);
    assert.match(update.stderr, /Missing OpenSpec config/);
    assert.equal(
      existsSync(join(runtimeDir, "openspec", "config.yaml")),
      false,
    );
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI reports missing OpenSpec CLI", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const contextFile = join(runtimeDir, "openspec-context.md");
    writeFileSync(contextFile, "Confirmed context.\n", "utf-8");
    const result = runAgentRuntime(
      [
        "openspec",
        "install",
        "--context-file",
        contextFile,
        "--config",
        configPath,
      ],
      {
        cwd: runtimeDir,
        env: { PATH: join(runtimeDir, "missing-bin") },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /npm install -g @fission-ai\/openspec@latest/);
  });
});

test("CLI validates OpenSpec config quality and reusable scripts", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const contextFile = join(runtimeDir, "openspec-context.md");
      writeFileSync(contextFile, "Confirmed context.\n", "utf-8");
      const env = addOpenSpecStub(runtimeDir);

      const install = runAgentRuntime(
        [
          "openspec",
          "install",
          "--context-file",
          contextFile,
          "--config",
          configPath,
        ],
        { cwd: runtimeDir, env },
      );
      assert.equal(install.status, 0, install.stderr || install.stdout);
      writeFileSync(
        join(runtimeDir, "openspec", "config.yaml"),
        "schema: mystery\ncontext: |-\n  Still bounded.\nrules:\n  unknown-artifact:\n    - Invalid rule.\n",
        "utf-8",
      );

      const validate = runAgentRuntime(
        ["openspec", "validate", "--config", configPath],
        { cwd: runtimeDir, env },
      );

      assert.notEqual(validate.status, 0);
      assert.match(validate.stderr, /Unknown OpenSpec schema: mystery/);
      assert.match(
        validate.stderr,
        /rules for unknown artifact: unknown-artifact/,
      );
      assert.match(validate.stderr, /Missing reusable runtime script source/);
    },
    (config, runtimeDir) => {
      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [
        {
          sourcePath: join(runtimeDir, "missing-script.ts"),
          targetPath: "scripts/missing-script.ts",
        },
      ];
    },
  );
});

test("CLI installs and reports managed hook symlinks", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const canonicalHooks = join(runtimeDir, "agents", "hooks");
    const claudeHooks = join(runtimeDir, "claude", "hooks");
    const codexHooks = join(runtimeDir, "codex", "hooks");
    const claudeSettings = join(runtimeDir, "claude", "settings.json");
    const codexHooksJson = join(runtimeDir, "codex", "hooks.json");
    mkdirSync(canonicalHooks, { recursive: true });
    mkdirSync(claudeHooks, { recursive: true });
    mkdirSync(codexHooks, { recursive: true });
    writeFileSync(join(canonicalHooks, "sentinel.txt"), "agents\n", "utf-8");
    writeFileSync(join(claudeHooks, "sentinel.txt"), "claude\n", "utf-8");
    writeFileSync(join(codexHooks, "sentinel.txt"), "codex\n", "utf-8");
    writeFileSync(
      claudeSettings,
      JSON.stringify({ model: "fable", hooks: {} }, null, 2),
      "utf-8",
    );
    writeFileSync(
      codexHooksJson,
      JSON.stringify({ hooks: { Stop: [{ hooks: [] }] } }, null, 2),
      "utf-8",
    );

    const install = runAgentRuntime([
      "hooks",
      "install",
      "--config",
      configPath,
    ]);
    assert.equal(install.status, 0, install.stderr || install.stdout);
    assert.equal(lstatSync(canonicalHooks).isSymbolicLink(), true);
    assert.equal(readlinkSync(canonicalHooks), join(repoRoot, "hooks"));
    assert.equal(lstatSync(claudeHooks).isSymbolicLink(), true);
    assert.equal(readlinkSync(claudeHooks), canonicalHooks);
    assert.equal(lstatSync(codexHooks).isSymbolicLink(), true);
    assert.equal(readlinkSync(codexHooks), canonicalHooks);
    const claudeDocument = JSON.parse(readFileSync(claudeSettings, "utf-8"));
    const codexDocument = JSON.parse(readFileSync(codexHooksJson, "utf-8"));
    assert.equal(claudeDocument.model, "fable");
    assert.equal(claudeDocument.hooks.SessionStart.length, 1);
    assert.equal(
      matchCount(JSON.stringify(claudeDocument), /startup-git-sync\.ts/g),
      1,
    );
    assert.equal(codexDocument.hooks.Stop.length, 1);
    assert.equal(codexDocument.hooks.SessionStart.length, 1);
    assert.equal(
      matchCount(JSON.stringify(codexDocument), /startup-git-sync\.ts/g),
      1,
    );

    const manifestsAfterInstall = collectBackupManifests(
      join(runtimeDir, "backups"),
    );
    const agentsBackup = findBackupManifest(
      manifestsAfterInstall,
      (manifest, manifestPath) =>
        manifest.assetKind === "hooks" &&
        manifest.targetName === "agents" &&
        manifest.kind === "directory" &&
        readFileSync(
          join(dirname(manifestPath), "target", "sentinel.txt"),
          "utf-8",
        ) === "agents\n",
    );
    assert.ok(agentsBackup);
    const claudeBackup = findBackupManifest(
      manifestsAfterInstall,
      (manifest, manifestPath) =>
        manifest.assetKind === "hooks" &&
        manifest.targetName === "claude" &&
        manifest.kind === "directory" &&
        readFileSync(
          join(dirname(manifestPath), "target", "sentinel.txt"),
          "utf-8",
        ) === "claude\n",
    );
    assert.ok(claudeBackup);
    const codexBackup = findBackupManifest(
      manifestsAfterInstall,
      (manifest, manifestPath) =>
        manifest.assetKind === "hooks" &&
        manifest.targetName === "codex" &&
        manifest.kind === "directory" &&
        readFileSync(
          join(dirname(manifestPath), "target", "sentinel.txt"),
          "utf-8",
        ) === "codex\n",
    );
    assert.ok(codexBackup);
    const claudeConfigBackup = findBackupManifest(
      manifestsAfterInstall,
      (manifest, manifestPath) =>
        manifest.assetKind === "config" &&
        manifest.targetName === "claude" &&
        manifest.kind === "file" &&
        readFileSync(join(dirname(manifestPath), "target"), "utf-8").includes(
          '"model": "fable"',
        ),
    );
    assert.ok(claudeConfigBackup);
    const codexConfigBackup = findBackupManifest(
      manifestsAfterInstall,
      (manifest, manifestPath) =>
        manifest.assetKind === "config" &&
        manifest.targetName === "codex" &&
        manifest.kind === "file" &&
        readFileSync(join(dirname(manifestPath), "target"), "utf-8").includes(
          '"Stop"',
        ),
    );
    assert.ok(codexConfigBackup);

    const validate = runAgentRuntime([
      "hooks",
      "validate",
      "--config",
      configPath,
    ]);
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);
    assert.match(validate.stdout, /Hook source/);
    assert.match(validate.stdout, /Canonical hooks/);
    assert.match(validate.stdout, /\[ok\] claude startup hook registration/);
    assert.match(validate.stdout, /\[ok\] codex startup hook registration/);
    assert.match(validate.stdout, /\[untrusted\] codex startup hook trust/);

    const status = runAgentRuntime(["hooks", "status", "--config", configPath]);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /\[ok\] codex hooks/);
    assert.equal(
      collectBackupManifests(join(runtimeDir, "backups")).length,
      manifestsAfterInstall.length,
    );

    const update = runAgentRuntime(["hooks", "update", "--config", configPath]);
    assert.equal(update.status, 0, update.stderr || update.stdout);
    assert.equal(
      matchCount(
        readFileSync(claudeSettings, "utf-8"),
        /startup-git-sync\.ts/g,
      ),
      1,
    );
    assert.equal(
      matchCount(
        readFileSync(codexHooksJson, "utf-8"),
        /startup-git-sync\.ts/g,
      ),
      1,
    );
    assert.equal(
      collectBackupManifests(join(runtimeDir, "backups")).length,
      manifestsAfterInstall.length,
    );

    const updatedConfig = JSON.parse(
      readFileSync(configPath, "utf-8"),
    ) as FixtureConfig;
    (
      (
        (updatedConfig.runtime as Record<string, unknown>).hooks as Record<
          string,
          unknown
        >
      ).startupRemote as Record<string, unknown>
    ).name = "github";
    writeFileSync(configPath, `${JSON.stringify(updatedConfig, null, 2)}\n`);

    const remoteUpdate = runAgentRuntime([
      "hooks",
      "update",
      "--config",
      configPath,
    ]);
    assert.equal(
      remoteUpdate.status,
      0,
      remoteUpdate.stderr || remoteUpdate.stdout,
    );
    const updatedCodexDocument = readFileSync(codexHooksJson, "utf-8");
    assert.equal(matchCount(updatedCodexDocument, /startup-git-sync\.ts/g), 1);
    assert.match(updatedCodexDocument, /--remote\\" \\"github/);
    assert.doesNotMatch(updatedCodexDocument, /--remote\\" \\"origin/);

    writeFileSync(
      claudeSettings,
      JSON.stringify({ model: "fable", hooks: {} }, null, 2),
      "utf-8",
    );
    const invalid = runAgentRuntime([
      "hooks",
      "validate",
      "--config",
      configPath,
    ]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Invalid hook registrations/);
    assert.match(invalid.stderr, /claude startup hook registration missing/);
  });
});

test("CLI validates managed hook symlink state", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const validate = runAgentRuntime([
      "hooks",
      "validate",
      "--config",
      configPath,
    ]);
    assert.notEqual(validate.status, 0);
    assert.match(validate.stderr, /Invalid managed hooks/);
    assert.match(validate.stderr, /Missing canonical hooks symlink/);

    const status = runAgentRuntime(["hooks", "status", "--config", configPath]);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI preflights hook registration configs before symlink mutation", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const canonicalHooks = join(runtimeDir, "agents", "hooks");
    const claudeHooks = join(runtimeDir, "claude", "hooks");
    const codexHooks = join(runtimeDir, "codex", "hooks");
    const claudeSettings = join(runtimeDir, "claude", "settings.json");
    mkdirSync(canonicalHooks, { recursive: true });
    mkdirSync(claudeHooks, { recursive: true });
    mkdirSync(codexHooks, { recursive: true });
    writeFileSync(join(canonicalHooks, "sentinel.txt"), "agents\n", "utf-8");
    writeFileSync(join(claudeHooks, "sentinel.txt"), "claude\n", "utf-8");
    writeFileSync(join(codexHooks, "sentinel.txt"), "codex\n", "utf-8");
    writeFileSync(claudeSettings, "{not json", "utf-8");

    const result = runAgentRuntime(["hooks", "update", "--config", configPath]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected property name|JSON/);
    assert.equal(lstatSync(canonicalHooks).isSymbolicLink(), false);
    assert.equal(lstatSync(claudeHooks).isSymbolicLink(), false);
    assert.equal(lstatSync(codexHooks).isSymbolicLink(), false);
    assert.equal(
      readFileSync(join(canonicalHooks, "sentinel.txt"), "utf-8"),
      "agents\n",
    );
    assert.equal(
      readFileSync(join(claudeHooks, "sentinel.txt"), "utf-8"),
      "claude\n",
    );
    assert.equal(
      readFileSync(join(codexHooks, "sentinel.txt"), "utf-8"),
      "codex\n",
    );
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI reports selected startup Git sync remote warnings", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const status = runAgentRuntime([
        "hooks",
        "status",
        "--config",
        configPath,
      ]);

      assert.equal(status.status, 0, status.stderr || status.stdout);
      assert.match(
        status.stdout,
        /\[warning\] startup Git sync remote origin:/,
      );
      assert.match(status.stdout, /https:\/\/example.invalid\/primary.git/);
      assert.equal(
        collectBackupManifests(join(runtimeDir, "backups")).length,
        0,
      );
    },
    (config) => {
      const runtime = config.runtime as Record<string, unknown>;
      runtime.hooks = {
        ...(runtime.hooks as Record<string, unknown>),
        startupRemote: {
          name: "origin",
          expectedUrl: "https://example.invalid/primary.git",
        },
      };
    },
  );
});

test("CLI refuses unsafe managed hook targets", () => {
  withFixture(({ configPath, runtimeDir }) => {
    mkdirSync(join(runtimeDir, "codex"), { recursive: true });
    writeFileSync(join(runtimeDir, "codex", "hooks"), "not a dir\n", "utf-8");

    const result = runAgentRuntime([
      "hooks",
      "install",
      "--config",
      configPath,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Refusing to replace unsafe hook target/);
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI refuses disposable worktree hook sources by default", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const result = runAgentRuntime([
        "hooks",
        "install",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Refusing to install hooks from disposable worktree source/,
      );
      assert.equal(
        collectBackupManifests(join(runtimeDir, "backups")).length,
        0,
      );
    },
    (config, runtimeDir) => {
      const disposableSource = join(
        runtimeDir,
        ".codex",
        "worktrees",
        "temp",
        "ai",
        "hooks",
      );
      mkdirSync(disposableSource, { recursive: true });
      writeFileSync(join(disposableSource, "hook.ts"), "hook\n", "utf-8");

      const runtime = config.runtime as Record<string, unknown>;
      runtime.hooks = {
        sourceDir: disposableSource,
        canonicalDir: join(runtimeDir, "agents", "hooks"),
        targets: {
          codex: join(runtimeDir, "codex", "hooks"),
        },
      };
    },
  );
});

test("CLI wrapper install preflights hooks before skill mutations", () => {
  withFixture(({ configPath, runtimeDir }) => {
    mkdirSync(join(runtimeDir, "codex"), { recursive: true });
    writeFileSync(join(runtimeDir, "codex", "hooks"), "not a dir\n", "utf-8");

    const result = runAgentRuntime([
      "install",
      "--profile",
      "personal",
      "--config",
      configPath,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Refusing to replace unsafe hook target/);
    assert.equal(existsSync(join(runtimeDir, "lock.json")), false);
    assert.equal(collectBackupManifests(join(runtimeDir, "backups")).length, 0);
  });
});

test("CLI shows command-specific help", () => {
  const result = runAgentRuntime(["status", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: ax status/);
  assert.doesNotMatch(result.stdout, /--agent <name>/);
  assert.match(result.stdout, /--all-profiles/);
  assert.match(result.stdout, /--profile <name>/);
  assert.doesNotMatch(result.stdout, /--all-skillsets/);
  assert.doesNotMatch(result.stdout, /--harness <name>/);
});

test("CLI rejects flags outside their command scope", () => {
  const result = runAgentRuntime([
    "skills",
    "status",
    "--agent",
    "example-agent",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown option '--agent'/);
});

test("CLI rejects removed agents subcommand", () => {
  const result = runAgentRuntime(["agents", "status"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command 'agents'/);
});

test("CLI installs overlapping profile skills once", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const install = runAgentRuntime([
        "skills",
        "install",
        "--all-profiles",
        "--config",
        configPath,
      ]);
      assert.equal(install.status, 0, install.stderr || install.stdout);

      assert.equal(matchCount(install.stdout, /^Installed shared$/gm), 1);
      assert.equal(matchCount(install.stdout, /^Installed work-only$/gm), 1);
      assert.equal(
        lstatSync(join(runtimeDir, "skills", "shared")).isDirectory(),
        true,
      );
      assert.equal(
        lstatSync(
          join(runtimeDir, "claude", "skills", "shared"),
        ).isSymbolicLink(),
        true,
      );

      const lock = JSON.parse(
        readFileSync(join(runtimeDir, "lock.json"), "utf-8"),
      ) as {
        skillsets: Record<string, Record<string, unknown>>;
      };
      assert.equal("updatedAt" in lock.skillsets.personal, false);
      assert.equal("updatedAt" in lock.skillsets.work, false);
    },
    (config, runtimeDir) => {
      const localSkillsDir = join(runtimeDir, "local-skills");
      mkdirSync(join(localSkillsDir, "shared"), { recursive: true });
      mkdirSync(join(localSkillsDir, "work-only"), { recursive: true });
      writeFileSync(
        join(localSkillsDir, "shared", "SKILL.md"),
        "---\nname: shared\n---\n",
        "utf-8",
      );
      writeFileSync(
        join(localSkillsDir, "work-only", "SKILL.md"),
        "---\nname: work-only\n---\n",
        "utf-8",
      );

      config.blocks = {
        common: {
          skills: [{ localPath: localSkillsDir, names: ["shared"] }],
        },
        work: {
          skills: [{ localPath: localSkillsDir, names: ["work-only"] }],
        },
      };
      config.profiles = {
        personal: { include: ["common"], paths: ["AGENTS.md"] },
        work: { include: ["common", "work"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI backs up skill, reusable script, and lockfile mutations", () => {
  let localSkillsDir = "";
  withFixture(
    ({ configPath, runtimeDir }) => {
      const install = runAgentRuntime([
        "skills",
        "install",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);
      assert.equal(install.status, 0, install.stderr || install.stdout);

      const backupsRoot = join(runtimeDir, "backups");
      const installManifests = collectBackupManifests(backupsRoot);
      const installManifestData = installManifests.map(
        (manifestPath) =>
          JSON.parse(readFileSync(manifestPath, "utf-8")) as {
            assetKind: string;
            targetName: string;
          },
      );
      assert.ok(installManifests.length > 0);
      assert.ok(
        installManifestData.some((manifest) => manifest.assetKind === "skills"),
      );
      assert.ok(
        installManifestData.some(
          (manifest) => manifest.assetKind === "reusable-scripts",
        ),
      );
      assert.ok(
        installManifestData.some(
          (manifest) =>
            manifest.assetKind === "config" &&
            manifest.targetName === "ax-lock",
        ),
      );

      writeFileSync(
        join(localSkillsDir, "backed-up", "SKILL.md"),
        "---\nname: backed-up\n---\nupdated\n",
        "utf-8",
      );
      const update = runAgentRuntime([
        "skills",
        "update",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);
      assert.equal(update.status, 0, update.stderr || update.stdout);

      const updatedManifests = collectBackupManifests(backupsRoot);
      assert.ok(updatedManifests.length > installManifests.length);
      assert.ok(
        updatedManifests.some((manifestPath) => {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
            kind: string;
            status: string;
          };
          return manifest.kind === "directory" && manifest.status === "created";
        }),
      );
    },
    (config, runtimeDir) => {
      localSkillsDir = join(runtimeDir, "local-skills");
      mkdirSync(join(localSkillsDir, "backed-up"), { recursive: true });
      writeFileSync(
        join(localSkillsDir, "backed-up", "SKILL.md"),
        "---\nname: backed-up\n---\n",
        "utf-8",
      );

      config.blocks = {
        local: {
          skills: [{ localPath: localSkillsDir, names: ["backed-up"] }],
        },
      };
      config.profiles = {
        personal: {
          include: ["local"],
          paths: [],
        },
      };
    },
  );
});

test("CLI installs discovered local skills from wildcard sources", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const install = runAgentRuntime([
        "skills",
        "install",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);
      assert.equal(install.status, 0, install.stderr || install.stdout);

      assert.match(install.stdout, /^Installed first-local$/m);
      assert.match(install.stdout, /^Installed second-local$/m);
      assert.equal(
        lstatSync(join(runtimeDir, "skills", "first-local")).isDirectory(),
        true,
      );
      assert.equal(
        lstatSync(join(runtimeDir, "skills", "second-local")).isDirectory(),
        true,
      );
      assert.equal(
        lstatSync(
          join(runtimeDir, "claude", "skills", "first-local"),
        ).isSymbolicLink(),
        true,
      );
      assert.equal(
        lstatSync(
          join(runtimeDir, "claude", "skills", "second-local"),
        ).isSymbolicLink(),
        true,
      );
    },
    (config, runtimeDir) => {
      const localSkillsDir = join(runtimeDir, "local-skills");
      mkdirSync(join(localSkillsDir, "first-local"), { recursive: true });
      mkdirSync(join(localSkillsDir, "ignored-no-skill"), { recursive: true });
      mkdirSync(join(localSkillsDir, "second-local"), { recursive: true });
      writeFileSync(
        join(localSkillsDir, "first-local", "SKILL.md"),
        "---\nname: first-local\n---\n",
        "utf-8",
      );
      writeFileSync(
        join(localSkillsDir, "second-local", "SKILL.md"),
        "---\nname: second-local\n---\n",
        "utf-8",
      );

      config.blocks = {
        local: {
          skills: [{ localPath: localSkillsDir, names: ["*"] }],
        },
      };
      config.profiles = {
        personal: { include: ["local"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI prunes stale installed retired skill names", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      mkdirSync(join(runtimeDir, "claude", "skills"), { recursive: true });
      for (const retiredName of ["agent-runtime-cli", "plan-to-review"]) {
        const staleCanonical = join(runtimeDir, "skills", retiredName);
        const staleSymlink = join(runtimeDir, "claude", "skills", retiredName);
        mkdirSync(staleCanonical, { recursive: true });
        writeFileSync(
          join(staleCanonical, "SKILL.md"),
          `---\nname: ${retiredName}\n---\n`,
          "utf-8",
        );
        symlinkSync(staleCanonical, staleSymlink);
      }
      writeFileSync(
        join(runtimeDir, "lock.json"),
        JSON.stringify(
          {
            version: 1,
            skillsets: {
              personal: {
                skills: {
                  "agent-runtime-cli": {
                    sourceType: "local",
                    localPath: "skills",
                    skillPath: "skills/agent-runtime-cli",
                    contentHash: "stale",
                  },
                  "plan-to-review": {
                    sourceType: "local",
                    localPath: "skills",
                    skillPath: "skills/plan-to-review",
                    contentHash: "stale",
                  },
                },
              },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      const update = runAgentRuntime([
        "skills",
        "update",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);
      assert.equal(update.status, 0, update.stderr || update.stdout);

      for (const retiredName of ["agent-runtime-cli", "plan-to-review"]) {
        assert.equal(
          existsSync(join(runtimeDir, "skills", retiredName)),
          false,
        );
        assert.equal(
          existsSync(join(runtimeDir, "claude", "skills", retiredName)),
          false,
        );
      }
      assert.equal(existsSync(join(runtimeDir, "skills", "plan-review")), true);
      assert.equal(
        existsSync(join(runtimeDir, "skills", "plan-unit-sequencer")),
        true,
      );

      const lock = JSON.parse(
        readFileSync(join(runtimeDir, "lock.json"), "utf-8"),
      ) as {
        skillsets: Record<string, { skills: Record<string, unknown> }>;
      };
      assert.equal(
        "agent-runtime-cli" in lock.skillsets.personal.skills,
        false,
      );
      assert.equal("plan-to-review" in lock.skillsets.personal.skills, false);
      assert.equal("plan-review" in lock.skillsets.personal.skills, true);
      assert.equal(
        "plan-unit-sequencer" in lock.skillsets.personal.skills,
        true,
      );
    },
    (config, runtimeDir) => {
      const localSkillsDir = join(runtimeDir, "local-skills");
      for (const skillName of [
        "plan-review",
        "plan-orchestrator",
        "plan-unit-sequencer",
      ]) {
        mkdirSync(join(localSkillsDir, skillName), { recursive: true });
        writeFileSync(
          join(localSkillsDir, skillName, "SKILL.md"),
          `---\nname: ${skillName}\n---\n`,
          "utf-8",
        );
      }

      config.blocks = {
        local: {
          skills: [{ localPath: localSkillsDir, names: ["*"] }],
        },
      };
      config.profiles = {
        personal: { include: ["local"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI installs reusable scripts beside skill runtime roots", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const install = runAgentRuntime([
        "skills",
        "install",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);
      assert.equal(install.status, 0, install.stderr || install.stdout);

      const canonicalScript = join(
        runtimeDir,
        "scripts",
        "planning-contracts.ts",
      );
      const targetScript = join(
        runtimeDir,
        "claude",
        "scripts",
        "planning-contracts.ts",
      );
      assert.equal(existsSync(canonicalScript), true);
      assert.equal(lstatSync(targetScript).isSymbolicLink(), true);

      const installedEntrypoint = join(
        runtimeDir,
        "skills",
        "needs-script",
        "scripts",
        "entry.ts",
      );
      const result = spawnSync(
        process.execPath,
        ["--import", tsxLoader, installedEntrypoint],
        {
          cwd: runtimeDir,
          encoding: "utf-8",
          env: withoutGitRepositoryEnv(),
        },
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(result.stdout, "runtime-script-ok");
    },
    (config, runtimeDir) => {
      const localSkillsDir = join(runtimeDir, "local-skills");
      const sourceScriptsDir = join(runtimeDir, "source-scripts");
      mkdirSync(join(localSkillsDir, "needs-script", "scripts"), {
        recursive: true,
      });
      mkdirSync(sourceScriptsDir, { recursive: true });

      writeFileSync(
        join(localSkillsDir, "needs-script", "SKILL.md"),
        "---\nname: needs-script\n---\n",
        "utf-8",
      );
      writeFileSync(
        join(localSkillsDir, "needs-script", "scripts", "entry.ts"),
        `import { marker } from "../../../scripts/planning-contracts.ts";
process.stdout.write(marker);
`,
        "utf-8",
      );
      writeFileSync(
        join(sourceScriptsDir, "planning-contracts.ts"),
        `export const marker = "runtime-script-ok";
`,
        "utf-8",
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [
        {
          sourcePath: join(sourceScriptsDir, "planning-contracts.ts"),
          targetPath: "scripts/planning-contracts.ts",
        },
      ];
      config.blocks = {
        local: {
          skills: [{ localPath: localSkillsDir, names: ["needs-script"] }],
        },
      };
      config.profiles = {
        personal: { include: ["local"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI validates local skill reusable script imports", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Skill needs-script imports reusable runtime script scripts\/nitro-feedback-gate\.ts, but it is not listed in runtime\.reusableScripts/,
      );
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import "../../../scripts/nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [
        {
          sourcePath: join(repoRoot, "scripts/planning-contracts.ts"),
          targetPath: "scripts/planning-contracts.ts",
        },
      ];
    },
  );
});

test("CLI validates multi-line local skill reusable script imports", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Skill needs-script imports reusable runtime script scripts\/nitro-feedback-gate\.ts, but it is not listed in runtime\.reusableScripts/,
      );
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import {
  normalizeFeedback
} from "../../../scripts/nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [];
    },
  );
});

test("CLI validates local skill reusable script re-exports", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Skill needs-script imports reusable runtime script scripts\/nitro-feedback-gate\.ts, but it is not listed in runtime\.reusableScripts/,
      );
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `export { normalizeFeedback } from "../../../scripts/nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [];
    },
  );
});

test("CLI accepts declared local skill reusable script imports", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import "../../../scripts/nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [
        {
          sourcePath: join(repoRoot, "scripts/nitro-feedback-gate.ts"),
          targetPath: "./scripts/../scripts/nitro-feedback-gate.ts",
        },
      ];
    },
  );
});

test("CLI accepts normalized local skill reusable script imports", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import "../../../scripts/helpers/../nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [
        {
          sourcePath: join(repoRoot, "scripts/nitro-feedback-gate.ts"),
          targetPath: "scripts/nitro-feedback-gate.ts",
        },
      ];
    },
  );
});

test("CLI rejects local skill reusable script imports that escape scripts", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Skill needs-script imports reusable runtime script escaped\.ts, but it is not listed in runtime\.reusableScripts/,
      );
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import "../../../scripts/helpers/../../escaped.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [
        {
          sourcePath: join(repoRoot, "scripts/nitro-feedback-gate.ts"),
          targetPath: "scripts/nitro-feedback-gate.ts",
        },
      ];
    },
  );
});

test("CLI ignores reusable script references in comments and strings", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `// import "../../../scripts/missing-comment.ts";
/* export { marker } from "../../../scripts/missing-block.ts"; */
const example = 'import "../../../scripts/missing-string.ts";';
const template = \`
import "../../../scripts/missing-template.ts";
\`;
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [];
    },
  );
});

test("CLI install rejects undeclared local skill reusable script imports", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const result = runAgentRuntime([
        "skills",
        "install",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Skill needs-script imports reusable runtime script scripts\/nitro-feedback-gate\.ts, but it is not listed in runtime\.reusableScripts/,
      );
      assert.equal(
        existsSync(join(runtimeDir, "skills", "needs-script")),
        false,
      );
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import "../../../scripts/nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [];
    },
  );
});

test("CLI update rejects undeclared local skill reusable script imports", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const result = runAgentRuntime([
        "skills",
        "update",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Skill needs-script imports reusable runtime script scripts\/nitro-feedback-gate\.ts, but it is not listed in runtime\.reusableScripts/,
      );
      assert.equal(
        existsSync(join(runtimeDir, "skills", "needs-script")),
        false,
      );
    },
    (config, runtimeDir) => {
      configureLocalSkillWithScript(
        config,
        runtimeDir,
        `import "../../../scripts/nitro-feedback-gate.ts";
`,
      );

      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [];
    },
  );
});

test("CLI ignores remote skill sources for reusable script import validation", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.equal(result.status, 0, result.stderr || result.stdout);
    },
    (config) => {
      const runtime = config.runtime as Record<string, unknown>;
      runtime.reusableScripts = [];
      config.blocks = {
        remote: {
          skills: [
            {
              url: "https://example.com/skills.git",
              ref: "main",
              basePath: "skills",
              names: ["remote-needs-script"],
            },
          ],
        },
      };
      config.profiles = {
        personal: { include: ["remote"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI rejects wildcard names for remote skill sources", () => {
  withFixture(
    ({ configPath }) => {
      const result = runAgentRuntime([
        "skills",
        "validate",
        "--profile",
        "personal",
        "--config",
        configPath,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /Wildcard skill names are only supported for local skill sources/,
      );
    },
    (config) => {
      config.blocks = {
        remote: {
          skills: [
            {
              url: "https://example.com/skills.git",
              ref: "main",
              basePath: "skills",
              names: ["*"],
            },
          ],
        },
      };
      config.profiles = {
        personal: { include: ["remote"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI install fetches a locked remote commit missing from a stale cache", () => {
  withFixture(
    ({ configPath, runtimeDir }) => {
      const remoteUrl = "https://example.test/skills.git";
      const remoteDir = join(runtimeDir, "remote-skills.git");
      const sourceDir = join(runtimeDir, "source-skills");
      const gitConfigPath = join(runtimeDir, "gitconfig");
      const gitEnv = {
        GIT_CONFIG_GLOBAL: gitConfigPath,
        GIT_CONFIG_NOSYSTEM: "1",
      };

      runGit(["init", "--bare", remoteDir]);
      runGit(["init", sourceDir]);
      runGit(["config", "user.email", "ax@example.test"], {
        cwd: sourceDir,
      });
      runGit(["config", "user.name", "AX Test"], { cwd: sourceDir });
      runGit(["remote", "add", "origin", remoteUrl], { cwd: sourceDir });

      writeFileSync(
        gitConfigPath,
        `[url "${pathToFileURL(remoteDir).href}"]\n\tinsteadOf = ${remoteUrl}\n[protocol "file"]\n\tallow = always\n`,
        "utf-8",
      );

      mkdirSync(join(sourceDir, "skills", "remote-skill"), { recursive: true });
      writeFileSync(
        join(sourceDir, "skills", "remote-skill", "SKILL.md"),
        "---\nname: remote-skill\n---\nfirst\n",
        "utf-8",
      );
      runGit(["add", "skills/remote-skill/SKILL.md"], { cwd: sourceDir });
      runGit(["commit", "-m", "add remote skill"], { cwd: sourceDir });
      runGit(["branch", "-M", "main"], { cwd: sourceDir });
      runGit(["push", "origin", "main"], { cwd: sourceDir, env: gitEnv });

      const cacheDir = cachePathForUrl(runtimeDir, remoteUrl);
      mkdirSync(join(runtimeDir, ".ax", "cache"), {
        recursive: true,
      });
      runGit(["clone", "--quiet", remoteUrl, cacheDir], { env: gitEnv });

      writeFileSync(
        join(sourceDir, "skills", "remote-skill", "SKILL.md"),
        "---\nname: remote-skill\n---\nsecond\n",
        "utf-8",
      );
      runGit(["add", "skills/remote-skill/SKILL.md"], { cwd: sourceDir });
      runGit(["commit", "-m", "update remote skill"], { cwd: sourceDir });
      runGit(["push", "origin", "main"], { cwd: sourceDir, env: gitEnv });
      const lockedCommit = runGit(["rev-parse", "HEAD"], { cwd: sourceDir });

      writeFileSync(
        join(runtimeDir, "lock.json"),
        `${JSON.stringify(
          {
            version: 1,
            skillsets: {
              personal: {
                skills: {
                  "remote-skill": {
                    sourceType: "git",
                    url: remoteUrl,
                    ref: "main",
                    resolvedCommit: lockedCommit,
                    basePath: "skills",
                    skillPath: "skills/remote-skill",
                    contentHash: "stale",
                  },
                },
              },
            },
          },
          null,
          2,
        )}\n`,
        "utf-8",
      );

      const install = runAgentRuntime(
        ["skills", "install", "--profile", "personal", "--config", configPath],
        {
          cwd: runtimeDir,
          env: gitEnv,
        },
      );

      assert.equal(install.status, 0, install.stderr || install.stdout);
      assert.match(install.stdout, /^Installed remote-skill$/m);
      assert.match(
        readFileSync(
          join(runtimeDir, "skills", "remote-skill", "SKILL.md"),
          "utf-8",
        ),
        /second/,
      );
    },
    (config) => {
      config.blocks = {
        remote: {
          skills: [
            {
              url: "https://example.test/skills.git",
              ref: "main",
              basePath: "skills",
              names: ["remote-skill"],
            },
          ],
        },
      };
      config.profiles = {
        personal: { include: ["remote"], paths: ["AGENTS.md"] },
      };
    },
  );
});

test("CLI installs and reports instruction symlinks", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const install = runAgentRuntime([
      "instructions",
      "install",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const agentsLink = join(runtimeDir, "root", "AGENTS.md");
    const rulesDir = join(runtimeDir, "root", "rules");
    const ruleLink = join(rulesDir, "command-and-tools.md");
    const claudeAgentsLink = join(runtimeDir, "claude", "AGENTS.md");
    const claudeRuleLink = join(
      runtimeDir,
      "claude",
      "rules",
      "command-and-tools.md",
    );
    assert.equal(lstatSync(agentsLink).isSymbolicLink(), true);
    assert.equal(
      readlinkSync(agentsLink),
      join(repoRoot, "instructions/AGENTS.md"),
    );
    assert.equal(lstatSync(rulesDir).isDirectory(), true);
    assert.equal(lstatSync(ruleLink).isSymbolicLink(), true);
    assert.equal(lstatSync(claudeAgentsLink).isSymbolicLink(), true);
    assert.equal(
      readlinkSync(claudeAgentsLink),
      join(repoRoot, "instructions/AGENTS.md"),
    );
    assert.equal(lstatSync(claudeRuleLink).isSymbolicLink(), true);
    const manifestsAfterInstall = collectBackupManifests(
      join(runtimeDir, "backups"),
    );
    assert.ok(
      manifestsAfterInstall.some((manifest) =>
        manifest.includes(`${join("instructions", "agents")}${sep}`),
      ),
    );
    assert.ok(
      manifestsAfterInstall.some((manifest) =>
        manifest.includes(`${join("instructions", "claude")}${sep}`),
      ),
    );

    const status = runAgentRuntime([
      "instructions",
      "status",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(
      status.stdout,
      /Instruction instructions\/AGENTS\.md -> AGENTS\.md/,
    );
    assert.match(status.stdout, /\[ok\].*AGENTS\.md/);
    assert.match(status.stdout, /Instruction rules\/command-and-tools\.md/);
    assert.match(status.stdout, /\[ok\].*rules\/command-and-tools\.md/);
    assert.equal(
      collectBackupManifests(join(runtimeDir, "backups")).length,
      manifestsAfterInstall.length,
    );
  });
});

test("CLI prunes instruction symlinks outside the selected profile", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const workInstall = runAgentRuntime([
      "instructions",
      "install",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);
    assert.equal(
      workInstall.status,
      0,
      workInstall.stderr || workInstall.stdout,
    );

    const workOnlyRule = join(
      runtimeDir,
      "root",
      "rules",
      "fullscript",
      "nitro-review.md",
    );
    const sharedRule = join(runtimeDir, "root", "rules", "git-and-review.md");
    assert.equal(lstatSync(workOnlyRule).isSymbolicLink(), true);
    assert.equal(lstatSync(sharedRule).isSymbolicLink(), true);

    const personalInstall = runAgentRuntime([
      "instructions",
      "install",
      "--profile",
      "personal",
      "--config",
      configPath,
    ]);
    assert.equal(
      personalInstall.status,
      0,
      personalInstall.stderr || personalInstall.stdout,
    );

    assert.equal(existsSync(workOnlyRule), false);
    assert.equal(lstatSync(sharedRule).isSymbolicLink(), true);
  });
});

test("CLI refuses to replace real instruction target files", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const agentsPath = join(runtimeDir, "root", "AGENTS.md");
    mkdirSync(join(runtimeDir, "root"), { recursive: true });
    writeFileSync(agentsPath, "local instructions\n", "utf-8");

    const install = runAgentRuntime([
      "instructions",
      "install",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);

    assert.notEqual(install.status, 0);
    assert.match(install.stderr, /Refusing to replace non-symlink target/);
    assert.equal(existsSync(agentsPath), true);
    assert.equal(lstatSync(agentsPath).isSymbolicLink(), false);
  });
});

test("CLI requires explicit profile selection for skills without a TTY", () => {
  withFixture(({ configPath }) => {
    const result = runAgentRuntime([
      "skills",
      "status",
      "--config",
      configPath,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Choose profiles with --all-profiles or --profile <name>/,
    );
  });
});

test("CLI requires explicit profile selection for instructions without a TTY", () => {
  withFixture(({ configPath }) => {
    const result = runAgentRuntime([
      "instructions",
      "status",
      "--config",
      configPath,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Choose profiles with --all-profiles or --profile <name>/,
    );
  });
});
