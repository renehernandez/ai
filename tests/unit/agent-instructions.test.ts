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

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} routes agent commits through ax commit`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /ax commit/);
    assert.match(text, /local review gate/);
    assert.match(text, /instead of raw `git commit`/);
    assert.match(text, /user's manual terminal/);
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

test("ai repo delivery uses GitLab MRs with Nitro review by default", () => {
  const agentsText = readFileSync("AGENTS.md", "utf-8");
  const portableAgentsText = readFileSync("instructions/AGENTS.md", "utf-8");
  const gitRulesText = readFileSync("rules/git-and-review.md", "utf-8");

  for (const text of [agentsText, portableAgentsText, gitRulesText]) {
    assert.match(text, /GitLab `origin`/);
    assert.match(
      text,
      /merge request.*targeting `main`|merge requests against `main`/,
    );
    assert.match(text, /\/request_review @nitro/);
    assert.match(text, /latest-head Nitro feedback/);
    assert.doesNotMatch(text, /commit directly on `main` after completing/);
    assert.doesNotMatch(text, /GitHub is the primary `main` publishing remote/);
    assert.doesNotMatch(text, /ordinary direct-publish guidance/);
  }
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

for (const file of [
  "skills/plan-review/SKILL.md",
  "skills/plan-unit-delivery/SKILL.md",
  "skills/plan-unit-sequencer/SKILL.md",
] as const) {
  test(`${file} separates local commit gates from hosted advancement gates`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /local review gate/i);
    assert.match(text, /commit(?:-boundary| boundary|s?\b)/i);
    assert.match(text, /hosted/i);
    assert.match(text, /Nitro/i);
    assert.match(text, /stack advancement|implementation sequencing|advance/i);
    assert.match(text, /actionable feedback|actionable-feedback/i);
  });
}
