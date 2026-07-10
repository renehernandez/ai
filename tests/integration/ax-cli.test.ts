import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const runtimeScript = join(repoRoot, "scripts", "ax.ts");
const tsxLoader = pathToFileURL(
  join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ax-cli-integration-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function runAx(
  args: string[],
  input: { cwd: string; sourceRoot: string; env?: NodeJS.ProcessEnv },
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, runtimeScript, ...args],
    {
      cwd: input.cwd,
      encoding: "utf-8",
      env: {
        ...process.env,
        AX_SOURCE_ROOT: input.sourceRoot,
        AX_ISOLATED_RUNTIME: "1",
        ...input.env,
      },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function createRuntimeSource(root: string): {
  sourceRoot: string;
  configPath: string;
  runtimeRoot: string;
  installRoot: string;
} {
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const installRoot = join(root, "installed");
  for (const name of ["explore", "plan", "execute", "review", "finish"]) {
    const skill = join(sourceRoot, "skills", name);
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      join(skill, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name}\n---\n# ${name}\n`,
      "utf-8",
    );
  }
  mkdirSync(join(sourceRoot, "instructions"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "instructions", "AGENTS.md"),
    "# Agents\n",
    "utf-8",
  );
  mkdirSync(join(sourceRoot, "rules"), { recursive: true });
  writeFileSync(join(sourceRoot, "rules", "base.md"), "# Rule\n", "utf-8");
  mkdirSync(join(sourceRoot, "hooks"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "hooks", "startup.ts"),
    "export {};\n",
    "utf-8",
  );
  const configPath = join(sourceRoot, "ax.config.json");
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        version: 1,
        runtime: {
          installedProfiles: ["personal"],
          policyProfile: "personal",
          retiredSkills: [],
          canonicalSkillsDir: join(installRoot, "agents", "skills"),
          skillSymlinkTargets: [
            join(installRoot, "codex", "skills"),
            join(installRoot, "claude", "skills"),
          ],
          instructionSymlinkTargets: {
            agents: join(installRoot, "agents"),
            codex: join(installRoot, "codex"),
            claude: join(installRoot, "claude"),
          },
          hooks: {
            sourceDir: "hooks",
            canonicalDir: join(installRoot, "agents", "hooks"),
            targets: {
              codex: join(installRoot, "codex", "hooks"),
              claude: join(installRoot, "claude", "hooks"),
            },
          },
          openspec: {
            canonicalSkillsDir: ".agents/skills",
            canonicalCommandsDir: ".agents/commands",
            skillTargets: {
              codex: ".codex/skills",
              claude: ".claude/skills",
            },
            commandTargets: { claude: ".claude/commands" },
          },
        },
        profiles: {
          personal: {
            include: ["modes"],
            paths: [
              { sourcePath: "instructions/AGENTS.md", targetPath: "AGENTS.md" },
              "rules/base.md",
            ],
          },
        },
        blocks: {
          modes: {
            skills: [
              {
                localPath: "skills",
                names: ["explore", "plan", "execute", "review", "finish"],
              },
            ],
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return { sourceRoot, configPath, runtimeRoot, installRoot };
}

function gitInit(root: string): void {
  mkdirSync(root, { recursive: true });
  const result = spawnSync("git", ["init"], {
    cwd: root,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("CLI synchronizes an isolated runtime and reports offline local state", () => {
  withTempDir((root) => {
    const fixture = createRuntimeSource(root);
    const target = join(root, "target");
    gitInit(target);
    const first = runAx(
      [
        "--config",
        fixture.configPath,
        "--runtime-root",
        fixture.runtimeRoot,
        "sync",
        "--json",
      ],
      { cwd: target, sourceRoot: fixture.sourceRoot },
    );
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const result = JSON.parse(first.stdout) as { status: string };
    assert.equal(result.status, "synchronized");
    assert.equal(
      existsSync(join(fixture.runtimeRoot, "managed-runtime.json")),
      false,
    );
    assert.equal(existsSync(join(fixture.sourceRoot, "ax.lock.json")), false);
    assert.equal(existsSync(join(fixture.sourceRoot, ".ax", "cache")), false);
    assert.equal(
      lstatSync(
        join(fixture.installRoot, "codex", "skills", "explore"),
      ).isSymbolicLink(),
      true,
    );

    const status = runAx(
      [
        "--config",
        fixture.configPath,
        "--runtime-root",
        fixture.runtimeRoot,
        "status",
        "--json",
      ],
      {
        cwd: target,
        sourceRoot: fixture.sourceRoot,
        env: { PATH: "/usr/bin:/bin" },
      },
    );
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.equal((JSON.parse(status.stdout) as { ok: boolean }).ok, true);
  });
});

test("legacy mutation commands fail without creating runtime state", () => {
  withTempDir((root) => {
    const fixture = createRuntimeSource(root);
    const result = runAx(["--config", fixture.configPath, "install"], {
      cwd: root,
      sourceRoot: fixture.sourceRoot,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Use ax sync/);
    assert.equal(existsSync(fixture.runtimeRoot), false);
  });
});

test("OpenSpec sync diagnoses PATH CLI and converges missing setup transactionally", () => {
  withTempDir((root) => {
    const fixture = createRuntimeSource(root);
    const target = join(root, "project");
    gitInit(target);
    const fakeBin = join(root, "bin");
    mkdirSync(fakeBin);
    const fakeOpenSpec = join(fakeBin, "openspec");
    writeFileSync(
      fakeOpenSpec,
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "openspec-test 1.0"; exit 0; fi
write_skill() {
  mkdir -p ".codex/skills/$1"
  cat > ".codex/skills/$1/SKILL.md" <<EOF
---
name: $1
description: Use when implementing a change
---
# $1
EOF
}
write_skill openspec-apply-change
write_skill openspec-archive-change
write_skill openspec-explore
write_skill openspec-propose
mkdir -p .claude/commands/opsx
for command in apply archive explore propose; do
  printf '# %s command\n' "$command" > ".claude/commands/opsx/$command.md"
done
exit 0
`,
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const contextFile = join(root, "context.md");
    writeFileSync(contextFile, "Test project context\n", "utf-8");
    const result = runAx(
      [
        "--config",
        fixture.configPath,
        "openspec",
        "sync",
        "--context-file",
        contextFile,
        "--json",
      ],
      {
        cwd: target,
        sourceRoot: fixture.sourceRoot,
        env: { PATH: `${fakeBin}:/usr/bin:/bin` },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout) as {
      state: string;
      cliPath: string;
      cliVersion: string;
    };
    assert.equal(output.state, "configured");
    assert.equal(output.cliPath, fakeOpenSpec);
    assert.equal(output.cliVersion, "openspec-test 1.0");
    const canonicalSkill = join(
      target,
      ".agents",
      "skills",
      "openspec-apply-change",
      "SKILL.md",
    );
    assert.match(
      readFileSync(canonicalSkill, "utf-8"),
      /Explicit-only developer command/,
    );
    const codexLink = join(target, ".codex", "skills", "openspec-apply-change");
    assert.equal(lstatSync(codexLink).isSymbolicLink(), true);
    assert.equal(
      readlinkSync(codexLink),
      relative(dirname(codexLink), dirname(canonicalSkill)),
    );
    assert.equal(
      lstatSync(join(target, ".claude", "commands", "opsx")).isSymbolicLink(),
      true,
    );

    const validate = runAx(
      ["--config", fixture.configPath, "openspec", "validate", "--json"],
      {
        cwd: target,
        sourceRoot: fixture.sourceRoot,
        env: { PATH: `${fakeBin}:/usr/bin:/bin` },
      },
    );
    assert.equal(validate.status, 0, validate.stderr || validate.stdout);
  });
});

test("OpenSpec sync fails before mutation when the PATH CLI is unavailable", () => {
  withTempDir((root) => {
    const fixture = createRuntimeSource(root);
    const target = join(root, "project");
    gitInit(target);
    const contextFile = join(root, "context.md");
    writeFileSync(contextFile, "Context\n", "utf-8");
    const result = runAx(
      [
        "--config",
        fixture.configPath,
        "openspec",
        "sync",
        "--context-file",
        contextFile,
      ],
      {
        cwd: target,
        sourceRoot: fixture.sourceRoot,
        env: { PATH: "/usr/bin:/bin" },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /openspec_cli_unavailable/);
    assert.equal(existsSync(join(target, "openspec")), false);
  });
});

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}
