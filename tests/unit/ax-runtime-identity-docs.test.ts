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

test("active AX docs use sync and local managed runtime state", () => {
  for (const relativePath of activeRuntimeDocs) {
    const content = readFileSync(relativePath, "utf-8");

    assert.match(content, /\bax sync\b|\bax .* sync\b/);
    assert.match(content, /managed-runtime\.json/);
    assert.match(content, /ax\.config\.json/);
    assert.match(content, /desired state/i);
    assert.match(content, /managed|ownership/i);
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

test("AX reference separates desired, managed, observed, and cache state", () => {
  const content = readFileSync("docs/ax.md", "utf-8");

  assert.match(content, /tracked `ax\.config\.json`.*desired state/is);
  assert.match(
    content,
    /`~\/\.agents\/runtime\/managed-runtime\.json`.*ownership state/is,
  );
  assert.match(content, /filesystem.*observed state/is);
  assert.match(content, /~\/\.agents\/runtime\/cache/);
  assert.match(content, /~\/\.agents\/runtime\/transactions/);
  assert.match(content, /~\/\.agents\/runtime\/backups/);
  assert.match(content, /sha256-tree-v1/);
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
