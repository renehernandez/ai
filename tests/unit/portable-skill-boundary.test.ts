import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modeNames = ["explore", "plan", "execute", "review", "finish"];
const modeScriptDirs = ["plan", "execute", "review", "finish"].map(
  (mode) => `skills/${mode}/scripts`,
);

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectTypeScriptFiles(path);
    }
    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

test("mode-owned helper scripts stay inside their portable skill folder", () => {
  const forbiddenImportPatterns = [
    /\.\.\/\.\.\/\.\.\/scripts\//,
    /\.\.\/\.\.\/[^/]+\/scripts\//,
    /from\s+["']\/[^"']+/, // absolute local imports
  ];

  for (const scriptDir of modeScriptDirs) {
    const absoluteScriptDir = join(repoRoot, scriptDir);
    assert.equal(statSync(absoluteScriptDir).isDirectory(), true);
    for (const file of collectTypeScriptFiles(absoluteScriptDir)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbiddenImportPatterns) {
        assert.doesNotMatch(content, pattern, file);
      }
    }
  }
});

test("each mode package is self-contained and exposes OpenAI metadata", () => {
  for (const mode of modeNames) {
    const skillRoot = join(repoRoot, "skills", mode);
    assert.equal(existsSync(join(skillRoot, "SKILL.md")), true, mode);
    assert.equal(
      existsSync(join(skillRoot, "agents", "openai.yaml")),
      true,
      `${mode} metadata`,
    );
  }
});

test("mode guidance does not invoke deleted repo-root workflow helpers", () => {
  const deletedHelpers = [
    "nitro-feedback-gate.ts",
    "objective-proof.ts",
    "plan-artifacts.ts",
    "planning-contracts.ts",
    "review-gate.ts",
    "stack-state.ts",
  ];
  const text = modeNames
    .map((mode) =>
      readFileSync(join(repoRoot, "skills", mode, "SKILL.md"), "utf8"),
    )
    .join("\n");

  for (const helper of deletedHelpers) {
    assert.doesNotMatch(
      text,
      new RegExp(`scripts/${helper.replace(".", "\\.")}`),
    );
  }
});
