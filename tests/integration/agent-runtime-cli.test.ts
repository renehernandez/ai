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
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
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
const runtimeScript = join(repoRoot, "scripts/agent-runtime.ts");
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
  const runtimeDir = mkdtempSync(join(tmpdir(), "agent-runtime-cli-"));
  const configPath = join(runtimeDir, "config.json");
  const config = JSON.parse(
    readFileSync(join(repoRoot, "agent-runtime.config.json"), "utf-8"),
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

function assertSafeRuntimeArgs(args: string[]): void {
  if (!args.some((arg) => arg === "--config")) {
    assert.equal(
      args.some((arg) => arg === "install" || arg === "update"),
      false,
      "mutating agent-runtime integration tests must pass an explicit fixture --config",
    );
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
  return join(directory, ".agent-runtime", "cache", `skills-${hash}`);
}

function addOpenSpecStub(runtimeDir: string): Record<string, string> {
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

if (process.argv.includes("--version")) {
  process.stdout.write("1.4.1\\n");
  process.exit(0);
}

const command = process.argv[2];
if (command === "init" || command === "update") {
  fs.mkdirSync("openspec", { recursive: true });
  write("openspec/config.yaml", "defaultSchema: spec-driven\\n");
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

test("CLI shows global help", () => {
  const result = runAgentRuntime(["--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: agent-runtime/);
  assert.match(result.stdout, /Commands:/);
  assert.doesNotMatch(result.stdout, /\bagents\b/);
  assert.match(result.stdout, /hooks/);
  assert.match(result.stdout, /instructions/);
  assert.match(result.stdout, /openspec/);
  assert.match(result.stdout, /skills/);
});

test("CLI shows OpenSpec scope help", () => {
  const result = runAgentRuntime(["openspec", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: agent-runtime openspec/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /update/);
  assert.match(result.stdout, /validate/);
});

test("CLI shows hooks scope help", () => {
  const result = runAgentRuntime(["hooks", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: agent-runtime hooks/);
  assert.match(result.stdout, /install/);
  assert.match(result.stdout, /status/);
  assert.match(result.stdout, /update/);
  assert.match(result.stdout, /validate/);
});

test("CLI installs and normalizes repo-local OpenSpec scaffolding", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const env = addOpenSpecStub(runtimeDir);
    mkdirSync(join(runtimeDir, "openspec"), { recursive: true });
    mkdirSync(join(runtimeDir, ".codex", "skills", "openspec-propose"), {
      recursive: true,
    });
    mkdirSync(join(runtimeDir, ".claude", "commands", "opsx"), {
      recursive: true,
    });
    writeFileSync(
      join(runtimeDir, "openspec", "config.yaml"),
      "sentinel config\n",
      "utf-8",
    );
    writeFileSync(
      join(runtimeDir, ".codex", "skills", "openspec-propose", "SKILL.md"),
      "sentinel codex skill\n",
      "utf-8",
    );
    writeFileSync(
      join(runtimeDir, ".claude", "commands", "opsx", "propose.md"),
      "sentinel claude command\n",
      "utf-8",
    );

    const install = runAgentRuntime(
      ["openspec", "install", "--config", configPath],
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
    const manifestsAfterInstall = collectBackupManifests(
      join(runtimeDir, "backups"),
    );
    assert.ok(
      manifestsAfterInstall.some((manifest) =>
        manifest.includes(`${join("openspec", "agents")}${sep}`),
      ),
    );
    assert.ok(
      manifestsAfterInstall.some((manifest) =>
        manifest.includes(`${join("openspec", "codex")}${sep}`),
      ),
    );
    const configBackup = findBackupManifest(
      manifestsAfterInstall,
      (manifest) =>
        manifest.assetKind === "openspec" &&
        manifest.targetName === "config" &&
        manifest.kind === "file",
    );
    assert.equal(
      readFileSync(join(dirname(configBackup), "target"), "utf-8"),
      "sentinel config\n",
    );
    const codexSkillBackup = findBackupManifest(
      manifestsAfterInstall,
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
      manifestsAfterInstall,
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

test("CLI reports missing OpenSpec CLI", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const result = runAgentRuntime(
      ["openspec", "install", "--config", configPath],
      {
        cwd: runtimeDir,
        env: { PATH: join(runtimeDir, "missing-bin") },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /npm install -g @fission-ai\/openspec@latest/);
  });
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
  assert.match(result.stdout, /Usage: agent-runtime status/);
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
            manifest.targetName === "agent-runtime-lock",
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
      const staleCanonical = join(runtimeDir, "skills", "plan-to-review");
      const staleSymlink = join(
        runtimeDir,
        "claude",
        "skills",
        "plan-to-review",
      );
      mkdirSync(staleCanonical, { recursive: true });
      mkdirSync(join(runtimeDir, "claude", "skills"), { recursive: true });
      writeFileSync(
        join(staleCanonical, "SKILL.md"),
        "---\nname: plan-to-review\n---\n",
        "utf-8",
      );
      symlinkSync(staleCanonical, staleSymlink);
      writeFileSync(
        join(runtimeDir, "lock.json"),
        JSON.stringify(
          {
            version: 1,
            skillsets: {
              personal: {
                skills: {
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

      assert.equal(existsSync(staleCanonical), false);
      assert.equal(existsSync(staleSymlink), false);
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
      runGit(["config", "user.email", "agent-runtime@example.test"], {
        cwd: sourceDir,
      });
      runGit(["config", "user.name", "Agent Runtime Test"], { cwd: sourceDir });
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
      mkdirSync(join(runtimeDir, ".agent-runtime", "cache"), {
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
