import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const activeRuntimeDocs = [
  "AGENTS.md",
  "docs/ax.md",
  "hooks/README.md",
  "rules/command-and-tools.md",
  "skills/ax-cli/SKILL.md",
  "openspec/specs/ax-cli/spec.md",
  "openspec/specs/ax-status/spec.md",
  "openspec/specs/ax-openspec/spec.md",
] as const;

test("active AX runtime docs describe the managed shim and AX defaults", () => {
  const forbidden = [
    "agent-runtime.config.json",
    "agent-runtime.lock.json",
    ".agent-runtime",
    "AGENT_RUNTIME",
    "globally linked",
  ];

  for (const relativePath of activeRuntimeDocs) {
    const content = readFileSync(join(repoRoot, relativePath), "utf-8");
    for (const term of forbidden) {
      assert.equal(
        content.includes(term),
        false,
        `${relativePath} contains unsupported legacy runtime term ${term}`,
      );
    }
    assert.match(
      content,
      /(~\/\.local\/bin\/ax|managed shim|ax\.config\.json|\.ax\/cache|AX_EXECUTABLE_PATH|pnpm ax)/,
      `${relativePath} should mention an AX runtime default or managed shim surface`,
    );
  }
});

test("active AX runtime docs mention pnpm link only as an unsupported path", () => {
  for (const relativePath of activeRuntimeDocs) {
    const lines = readFileSync(join(repoRoot, relativePath), "utf-8").split(
      "\n",
    );
    for (const [index, line] of lines.entries()) {
      if (!line.includes("pnpm link")) {
        continue;
      }
      assert.match(
        line,
        /(do not use|Recommending)/i,
        `${relativePath}:${index + 1} should classify pnpm link as unsupported`,
      );
    }
  }
});
