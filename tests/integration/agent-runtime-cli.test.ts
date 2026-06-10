import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

type Fixture = {
  configPath: string;
  runtimeDir: string;
};

const repoRoot = process.cwd();

function withFixture(callback: (fixture: Fixture) => void): void {
  const runtimeDir = mkdtempSync(join(tmpdir(), "agent-runtime-cli-"));
  const configPath = join(runtimeDir, "config.json");
  const config = JSON.parse(readFileSync(join(repoRoot, "agent-runtime.config.json"), "utf-8"));
  config.runtime.canonicalSkillsDir = join(runtimeDir, "skills");
  config.runtime.skillSymlinkTargets = [join(runtimeDir, "codex", "skills"), join(runtimeDir, "claude", "skills")];
  config.runtime.canonicalAgentsDir = join(runtimeDir, "agents");
  config.runtime.agentSymlinkTargets = {
    codex: join(runtimeDir, "codex", "agents"),
    claude: join(runtimeDir, "claude", "agents"),
    opencode: join(runtimeDir, "opencode", "agents"),
  };
  config.runtime.instructionSymlinkTargets = {
    agents: join(runtimeDir, "root"),
    codex: join(runtimeDir, "codex"),
    claude: join(runtimeDir, "claude"),
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

  try {
    callback({ configPath, runtimeDir });
  } finally {
    rmSync(runtimeDir, { force: true, recursive: true });
  }
}

function runAgentRuntime(args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/agent-runtime.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf-8",
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

test("CLI validates all runtime scopes", () => {
  withFixture(({ configPath }) => {
    const result = runAgentRuntime(["validate", "--config", configPath]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Validated 2 skillsets/);
    assert.match(result.stdout, /Validated agent configuration/);
    assert.match(result.stdout, /Validated instruction configuration/);
  });
});

test("CLI accepts global config before the command", () => {
  withFixture(({ configPath }) => {
    const result = runAgentRuntime(["--config", configPath, "validate"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Validated 2 skillsets/);
  });
});

test("CLI shows global help", () => {
  const result = runAgentRuntime(["--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: agent-runtime/);
  assert.match(result.stdout, /Commands:/);
  assert.match(result.stdout, /agents/);
  assert.match(result.stdout, /instructions/);
  assert.match(result.stdout, /skills/);
});

test("CLI shows command-specific help", () => {
  const result = runAgentRuntime(["agents", "status", "--help"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Usage: agent-runtime agents status/);
  assert.match(result.stdout, /--agent <name>/);
  assert.match(result.stdout, /--harness <name>/);
  assert.doesNotMatch(result.stdout, /--skillset <name>/);
});

test("CLI rejects flags outside their command scope", () => {
  const result = runAgentRuntime(["skills", "status", "--agent", "local-review"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown option '--agent'/);
});

test("CLI installs and reports agent generation", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const install = runAgentRuntime(["agents", "install", "--agent", "implementer", "--harness", "codex", "--config", configPath]);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const generatedPath = join(runtimeDir, "agents", "codex", "implementer.md");
    const linkPath = join(runtimeDir, "codex", "agents", "implementer.md");
    const generated = readFileSync(generatedPath, "utf-8");

    assert.match(generated, /^model: gpt-5\.4$/m);
    assert.match(generated, /^reasoning: high$/m);
    assert.equal(lstatSync(linkPath).isSymbolicLink(), true);

    const status = runAgentRuntime(["agents", "status", "--agent", "implementer", "--harness", "codex", "--config", configPath]);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /\[ok\].*generated/);
    assert.match(status.stdout, /\[ok\].*implementer\.md/);
  });
});

test("CLI installs and reports instruction symlinks", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const install = runAgentRuntime(["instructions", "install", "--harness", "agents", "--config", configPath]);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const agentsLink = join(runtimeDir, "root", "AGENTS.md");
    const rulesLink = join(runtimeDir, "root", "rules");
    assert.equal(lstatSync(agentsLink).isSymbolicLink(), true);
    assert.equal(lstatSync(rulesLink).isSymbolicLink(), true);

    const status = runAgentRuntime(["instructions", "status", "--harness", "agents", "--config", configPath]);
    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.match(status.stdout, /Instruction AGENTS\.md/);
    assert.match(status.stdout, /\[ok\].*AGENTS\.md/);
    assert.match(status.stdout, /\[ok\].*rules/);
  });
});

test("CLI refuses to replace real instruction target files", () => {
  withFixture(({ configPath, runtimeDir }) => {
    const agentsPath = join(runtimeDir, "root", "AGENTS.md");
    mkdirSync(join(runtimeDir, "root"), { recursive: true });
    writeFileSync(agentsPath, "local instructions\n", "utf-8");

    const install = runAgentRuntime(["instructions", "install", "--harness", "agents", "--config", configPath]);

    assert.notEqual(install.status, 0);
    assert.match(install.stderr, /Refusing to replace non-symlink target/);
    assert.equal(existsSync(agentsPath), true);
    assert.equal(lstatSync(agentsPath).isSymbolicLink(), false);
  });
});
