import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { behaviorScenarios } from "../../evals/skills-rules/scenarios.ts";

const skill = readFileSync("skills/brainstorming/SKILL.md", "utf8");

test("brainstorming keeps a visible Orientation Map output contract", () => {
  const template = /## Orientation Map[\s\S]*?```markdown\n([\s\S]*?)```/.exec(
    skill,
  )?.[1];
  assert.ok(template);
  for (const field of [
    "**Orientation Map**",
    "Objective",
    "Problem framing",
    "Domain terms",
    "Existing precedent",
    "Approach",
    "**Discussion Queue**",
    "**Working Hypotheses**",
    "**Next step**",
  ]) {
    assert.ok(template.includes(field), field);
  }
});

test("brainstorming preserves read-only divergence and explicit convergence", () => {
  const tools = /^allowed-tools:\s*(.+)$/m.exec(skill)?.[1] ?? "";
  assert.doesNotMatch(tools, /Write|Edit|Bash/);
  const opening = behaviorScenarios.find(
    ({ id }) => id === "brainstorming-orientation",
  );
  const convergence = behaviorScenarios.find(
    ({ id }) => id === "brainstorming-convergence",
  );
  assert.deepEqual(opening?.required, [
    "orientation-map",
    "discussion-queue",
    "convergence-boundary",
  ]);
  assert.equal(opening?.allowRepositoryWrite, false);
  assert.ok(convergence?.required.includes("selected-feature"));
  assert.ok(convergence?.forbidden.includes("repository-write"));
});

test("brainstorming progressively loads convergence mechanics", () => {
  assert.ok(skill.trim().split(/\s+/).length < 1000);
  assert.match(skill, /references\/convergence\.md/);
  assert.doesNotMatch(skill, /^## Test Evidence$/m);
  assert.match(skill, /investigation-and-implementation\.md/);
});
