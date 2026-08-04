import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name: string) => readFileSync(`skills/${name}/SKILL.md`, "utf8");

test("AI readiness keeps judgment in prose and deterministic verdicts in its script", () => {
  const skill = read("ai-readiness-upkeep");
  assert.match(skill, /scripts\/ai-readiness-upkeep\.ts/);
  assert.match(skill, /report-template/);
  assert.match(skill, /validate-report --file/);
  assert.doesNotMatch(skill, /```yaml|## (?:Mistakes|Test Evidence)/);
});

test("handoff brief preserves continuation identity and evidence", () => {
  const skill = read("handoff-brief");
  for (const field of [
    "Objective:",
    "Branch / artifact / exact head:",
    "Verified:",
    "Local-only / repo-visible:",
    "Blocked:",
    "Next:",
  ]) {
    assert.match(skill, new RegExp(`^${field.replaceAll("/", "\\/")}$`, "m"));
  }
  assert.doesNotMatch(
    skill,
    /^## (?:Mistakes|Validation Scenarios|Test Evidence)$/m,
  );
});

test("project health keeps its actionability taxonomy read-only", () => {
  const skill = read("project-health-brief");
  for (const field of [
    "Scope / exact state verified:",
    "Top next action:",
    "Ready:",
    "Blocked:",
    "Watching:",
    "Stale / cleanup:",
    "Verification gaps:",
  ]) {
    assert.match(skill, new RegExp(`^${field.replaceAll("/", "\\/")}$`, "m"));
  }
  assert.doesNotMatch(
    skill,
    /^## (?:Mistakes|Validation Scenarios|Test Evidence)$/m,
  );
});
