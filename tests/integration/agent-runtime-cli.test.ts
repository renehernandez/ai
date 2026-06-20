import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

type Fixture = {
  configPath: string;
  runtimeDir: string;
};
type FixtureConfig = Record<string, unknown>;

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
  runtime.reusableScripts = [
    {
      sourcePath: join(repoRoot, "scripts/planning-contracts.ts"),
      targetPath: "scripts/planning-contracts.ts",
    },
  ];
  runtime.canonicalAgentsDir = join(runtimeDir, "agents");
  runtime.lockFile = join(runtimeDir, "lock.json");
  runtime.agentSymlinkTargets = {
    codex: join(runtimeDir, "codex", "agents"),
    claude: join(runtimeDir, "claude", "agents"),
    opencode: join(runtimeDir, "opencode", "agents"),
  };
  runtime.instructionSymlinkTargets = {
    agents: join(runtimeDir, "root"),
    claude: join(runtimeDir, "claude"),
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
  withFixture(({ configPath }) => {
    const result = runAgentRuntime([
      "validate",
      "--profile",
      "work",
      "--config",
      configPath,
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Validated 1 profile/);
    assert.match(result.stdout, /Validated agent configuration/);
    assert.match(result.stdout, /Validated instruction configuration/);
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
  assert.match(result.stdout, /agents/);
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

test("CLI installs and normalizes repo-local OpenSpec scaffolding", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const env = addOpenSpecStub(runtimeDir);
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

test("CLI shows command-specific help", () => {
  const result = runAgentRuntime(["status", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: agent-runtime status/);
  assert.match(result.stdout, /--agent <name>/);
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
    "implementation-review-agent",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown option '--agent'/);
});

test("CLI installs and reports agent generation", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const install = runAgentRuntime([
      "agents",
      "install",
      "--agent",
      "implementer-agent",
      "--config",
      configPath,
    ]);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const generatedPath = join(
      runtimeDir,
      "agents",
      "claude",
      "implementer-agent.md",
    );
    const linkPath = join(
      runtimeDir,
      "claude",
      "agents",
      "implementer-agent.md",
    );
    const codexGeneratedPath = join(
      runtimeDir,
      "agents",
      "codex",
      "implementer-agent.md",
    );
    const codexLinkPath = join(
      runtimeDir,
      "codex",
      "agents",
      "implementer-agent.md",
    );
    const opencodeGeneratedPath = join(
      runtimeDir,
      "agents",
      "opencode",
      "implementer-agent.md",
    );
    const opencodeLinkPath = join(
      runtimeDir,
      "opencode",
      "agents",
      "implementer-agent.md",
    );
    const generated = readFileSync(generatedPath, "utf-8");
    const codexGenerated = readFileSync(codexGeneratedPath, "utf-8");
    const opencodeGenerated = readFileSync(opencodeGeneratedPath, "utf-8");

    assert.match(generated, /^model: sonnet$/m);
    assert.doesNotMatch(generated, /^reasoning:/m);
    assert.match(codexGenerated, /^model: gpt-5\.4$/m);
    assert.match(codexGenerated, /^reasoning: high$/m);
    assert.match(opencodeGenerated, /^model: anthropic\/claude-sonnet$/m);
    assert.doesNotMatch(opencodeGenerated, /^reasoning:/m);
    assert.equal(lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(lstatSync(codexLinkPath).isSymbolicLink(), true);
    assert.equal(lstatSync(opencodeLinkPath).isSymbolicLink(), true);

    const status = runAgentRuntime([
      "agents",
      "status",
      "--agent",
      "implementer-agent",
      "--config",
      configPath,
    ]);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /\[ok\].*generated/);
    assert.match(status.stdout, /\[ok\].*implementer-agent\.md/);
  });
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
