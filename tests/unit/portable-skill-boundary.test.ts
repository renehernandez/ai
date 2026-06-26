import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const packagedSkillScriptDirs = [
  "skills/openspec-tasks/scripts",
  "skills/plan-ready/scripts",
  "skills/plan-review/scripts",
  "skills/plan-orchestrator/scripts",
  "skills/plan-unit-sequencer/scripts",
  "skills/plan-unit-delivery/scripts",
  "skills/plan-poc/scripts",
  "skills/nitro-review-feedback/scripts",
];

function collectTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectTypeScriptFiles(path);
    }

    return entry.isFile() && path.endsWith(".ts") ? [path] : [];
  });
}

test("planning workflow skill scripts keep helper imports inside the skill folder", () => {
  const forbiddenImportPatterns = [
    /\.\.\/\.\.\/\.\.\/scripts\//,
    /\.\.\/\.\.\/[^/]+\/scripts\//,
  ];

  for (const scriptDir of packagedSkillScriptDirs) {
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

test("plan-review validates OpenSpec tasks from its skill folder", () => {
  const commandVariants = [
    [
      "exec",
      "tsx",
      "scripts/plan-review.ts",
      "validate-openspec-tasks",
      "--tasks",
      "../../openspec/changes/enforce-portable-skill-boundary/tasks.md",
    ],
    [
      "exec",
      "tsx",
      "scripts/plan-review.ts",
      "validate-openspec-tasks",
      "--artifact-ref",
      "openspec/changes/enforce-portable-skill-boundary",
    ],
  ];

  for (const args of commandVariants) {
    const result = spawnSync("pnpm", args, {
      cwd: join(repoRoot, "skills/plan-review"),
      encoding: "utf8",
    });

    assert.equal(
      result.status,
      0,
      [result.stdout, result.stderr].filter(Boolean).join("\n"),
    );
    assert.match(result.stdout, /"status": "pass"/);
  }
});

test("nitro-review-feedback validates Nitro gates from its skill folder", () => {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/nitro-feedback-gate.ts", "template"],
    {
      cwd: "skills/nitro-review-feedback",
      encoding: "utf8",
    },
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n"),
  );
  assert.match(result.stdout, /nitro_feedback_gate:/);
});

test("review-feedback-routing does not teach repo-root Nitro gate commands", () => {
  const text = readFileSync("skills/review-feedback-routing/SKILL.md", "utf8");

  assert.doesNotMatch(text, /scripts\/nitro-feedback-gate\.ts/);
  assert.match(text, /nitro-review-feedback/);
});
