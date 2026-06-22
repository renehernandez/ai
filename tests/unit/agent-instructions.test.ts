import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const instructionFiles = [
  "AGENTS.md",
  "instructions/AGENTS.md",
  "rules/docs-and-specs.md",
  "rules/handoff-and-resume.md",
] as const;

for (const file of instructionFiles) {
  test(`${file} requires readable summaries for structured thread contracts`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Readable Summary/);
    assert.match(text, /YAML or JSON|YAML\/JSON/);
  });
}

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} requires writing-skills review for agent behavior changes`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /writing-skills/);
    assert.match(text, /shared skill, agent, instruction, or rule sources/);
  });
}

for (const file of [
  "AGENTS.md",
  "instructions/AGENTS.md",
  "skills/plan-orchestrator/SKILL.md",
] as const) {
  test(`${file} pins plan-orchestrator terminal states`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /plan-orchestrator/);
    assert.match(text, /stack_ready/);
    assert.match(text, /delivery_blocked/);
    assert.match(text, /not terminal success/);
  });
}

test("git rules require stacked MRs to land bottom-to-top", () => {
  const text = readFileSync("rules/git-and-review.md", "utf-8");

  assert.match(text, /merge MRs in a stack/);
  assert.match(text, /bottom of the\s+stack to the top/);
  assert.match(text, /first\/base MR to `main` first/);
  assert.match(text, /last\/top MR is merged last/);
  assert.match(text, /retarget the next stacked MR to `main`/);
  assert.match(text, /resolve the conflict on that MR's source branch/);
});

for (const file of [
  "skills/plan-ready/SKILL.md",
  "skills/plan-ready/agents/openai.yaml",
] as const) {
  test(`${file} keeps readiness separate from orchestrator completion`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /readiness is not terminal completion/i);
    assert.match(text, /stack_ready/);
    assert.match(text, /delivery_blocked/);
  });
}

for (const file of [
  "skills/plan-review/SKILL.md",
  "skills/plan-review/agents/openai.yaml",
] as const) {
  test(`${file} keeps planning review separate from orchestrator completion`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /planning_review/);
    assert.match(text, /not terminal success/i);
    assert.match(text, /stack_ready/);
    assert.match(text, /delivery_blocked/);
  });
}
