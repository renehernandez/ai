import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const activeRuntimeDocs = [
  "AGENTS.md",
  "instructions/AGENTS.md",
  "docs/ax.md",
  "hooks/README.md",
  "rules/command-and-tools.md",
] as const;

test("active AX docs use selected-profile authoritative sync", () => {
  for (const relativePath of activeRuntimeDocs) {
    const content = readFileSync(relativePath, "utf-8");

    assert.match(content, /\bax sync\b|\bax .* sync\b/);
    assert.match(content, /ax\.config\.json/);
    assert.match(content, /authoritative/i);
    assert.doesNotMatch(content, /managed-runtime\.json/);
    assert.doesNotMatch(content, /adoption-file|profile-selection-file/);
  }
});

test("active AX docs contain no retired runtime or workflow commands", () => {
  const forbidden = [
    /ax\.lock\.json/,
    /\.ax\/cache/,
    /\bax commit\b/,
    /\bax review-gate\b/,
    /\bax plans artifact\b/,
    /\bax (?:skills |instructions |hooks )?install\b/,
    /\bax (?:skills |instructions |hooks )?update\b/,
    /\bax openspec (?:install|update)\b/,
    /runtime\.reusableScripts/,
  ];

  for (const relativePath of activeRuntimeDocs) {
    const content = readFileSync(relativePath, "utf-8");
    for (const term of forbidden) {
      assert.doesNotMatch(
        content,
        term,
        `${relativePath} contains retired guidance ${term}`,
      );
    }
  }
});

test("AX reference describes authoritative targets and structural validation", () => {
  const content = readFileSync("docs/ax.md", "utf-8");

  assert.match(content, /tracked `ax\.config\.json`.*authoritative/is);
  assert.match(content, /selected-profile\.json/);
  assert.match(content, /sync --profile/);
  assert.match(content, /runtime\.retiredSkills/);
  assert.match(content, /unrelated filesystem\s+paths untouched/is);
  assert.match(content, /~\/\.agents\/runtime\/cache/);
  assert.match(content, /~\/\.agents\/runtime\/transactions/);
  assert.match(content, /~\/\.agents\/runtime\/backups/);
  assert.doesNotMatch(content, /sha256-tree-v1/);
});

test("status and validate documentation is offline and read-only", () => {
  for (const relativePath of activeRuntimeDocs) {
    const content = readFileSync(relativePath, "utf-8");

    assert.match(content, /status/);
    assert.match(content, /validate/);
    assert.match(content, /offline|no network/i);
    assert.match(content, /read-only|no mutation/i);
  }
});

test("OpenSpec synchronization remains explicit and repository scoped", () => {
  for (const relativePath of [
    "AGENTS.md",
    "docs/ax.md",
    "rules/command-and-tools.md",
  ] as const) {
    const content = readFileSync(relativePath, "utf-8");

    assert.match(content, /ax openspec sync/);
    assert.match(
      content,
      /current working directory|invocation repository|repo-local/i,
    );
    assert.match(content, /--context-file/);
  }
});

test("hook source is repository-relative and snapshot-backed", () => {
  const config = JSON.parse(readFileSync("ax.config.json", "utf-8"));
  const readme = readFileSync("hooks/README.md", "utf-8");

  assert.equal(config.runtime.hooks.sourceDir, "hooks");
  assert.match(readme, /repository-relative `hooks`/i);
  assert.match(readme, /immutable source snapshot/i);
  assert.doesNotMatch(readme, /\/Users\//);
});

test("pre-merge AX proof is isolated and live sync waits for merged source", () => {
  for (const relativePath of [
    "AGENTS.md",
    "docs/ax.md",
    "hooks/README.md",
    "rules/command-and-tools.md",
  ] as const) {
    const content = readFileSync(relativePath, "utf-8");

    assert.match(content, /isolated (?:HOME|runtime|roots?)/i);
    assert.match(content, /merged.*default branch|default-branch.*merged/is);
    assert.match(content, /live.*ax sync|ax sync.*live/is);
  }
});

test("shim lifecycle remains distinct from runtime synchronization", () => {
  const content = readFileSync("docs/ax.md", "utf-8");

  assert.match(content, /ax shim install/);
  assert.match(content, /ax shim status/);
  assert.match(content, /ax shim uninstall/);
  assert.match(content, /distinct from runtime/i);
});

test("AX reference documents the organizational agent surface", () => {
  const content = readFileSync("docs/ax.md", "utf-8");
  const workspace = readFileSync("docs/agent-workspaces.md", "utf-8");

  assert.match(content, /pnpm ax agents sync/);
  assert.match(content, /~\/\.agents\/agents/);
  assert.match(content, /~\/\.codex\/agents/);
  assert.match(content, /unmanaged file, directory, or wrong symlink/i);
  assert.match(workspace, /Delivery Executive Assistant/);
  assert.match(workspace, /Executive Operations Assistant/);
  assert.match(workspace, /Agent Run.*before.*spawn/is);
  assert.match(workspace, /Max and Ultra are manual-only/);
  assert.match(workspace, /Rene must merge|merge authority/i);
});

test("AX reference documents exact managed config leaves", () => {
  const content = readFileSync("docs/ax.md", "utf-8");
  const config = JSON.parse(readFileSync("ax.config.json", "utf-8"));

  assert.match(content, /pnpm ax configs sync/);
  assert.match(content, /exact.*TOML.*leaf|TOML.*leaf.*exact/is);
  assert.match(content, /unowned.*preserv/is);
  assert.match(content, /isolated HOME.*runtime root/is);
  assert.match(content, /Codex.*config loader|codex features list/is);
  assert.deepEqual(config.runtime.configs.codex.managed, {
    features: {
      memories: true,
      multi_agent_v2: {
        enabled: true,
        max_concurrent_threads_per_session: 10,
      },
    },
    agents: { max_depth: 1 },
    memories: { generate_memories: true, use_memories: true },
  });
});
