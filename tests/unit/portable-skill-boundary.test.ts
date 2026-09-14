import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateSkillFolder } from "../../scripts/skill-validate.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const modeNames = ["explore", "plan", "execute", "review", "finish"];
const modeScriptDirs = ["plan", "execute", "review", "finish"].map(
  (mode) => `skills/${mode}/scripts`,
);

test("mode-owned helper scripts stay inside their portable skill folder", () => {
  for (const scriptDir of modeScriptDirs) {
    const absoluteScriptDir = join(repoRoot, scriptDir);
    assert.equal(statSync(absoluteScriptDir).isDirectory(), true);
    // The canonical validator rejects static and dynamic cross-package imports,
    // while allowing an explicitly invoked CLI owned by another installed skill.
    const result = validateSkillFolder(dirname(absoluteScriptDir));
    assert.deepEqual(
      result.errors.filter((error) => error.includes("portable-boundary:")),
      [],
      scriptDir,
    );
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
