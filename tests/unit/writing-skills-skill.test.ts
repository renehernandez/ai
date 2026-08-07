import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/writing-skills/SKILL.md", "utf8");
const testing = readFileSync(
  "skills/writing-skills/testing-skills-with-subagents.md",
  "utf8",
);

test("writing-skills follows its own runtime budget", () => {
  assert.ok(skill.trim().split(/\s+/).length < 500);
  assert.doesNotMatch(
    skill,
    /Common Rationalizations|Red Flags|Iron Law|No exceptions|The Bottom Line/i,
  );
  assert.equal(
    existsSync("skills/writing-skills/persuasion-principles.md"),
    false,
  );
});

test("writing-skills owns an evaluation-first behavior contract", () => {
  const allowedTools = /^allowed-tools:\s*(.+)$/m.exec(skill)?.[1] ?? "";
  for (const tool of ["Task", "Read", "Write", "Edit"]) {
    assert.match(allowedTools, new RegExp(`\\b${tool}\\b`));
  }
  assert.match(skill, /observable behavior/i);
  assert.match(skill, /baseline|RED/i);
  assert.match(skill, /GREEN/i);
  assert.match(skill, /deterministic/i);
  assert.match(skill, /live.*eval|model eval/i);
  assert.match(skill, /canonical owner/i);
  assert.match(skill, /progressive disclosure/i);
  assert.match(skill, /blocked|escalat/i);
});

test("testing methods and examples are progressively loaded once", () => {
  assert.match(skill, /testing-skills-with-subagents\.md/);
  assert.match(skill, /anthropic-best-practices\.md/);
  assert.match(testing, /Discipline.*pressure/i);
  assert.match(testing, /Technique.*application/i);
  assert.match(testing, /Pattern.*recognition/i);
  assert.match(testing, /Reference.*retrieval/i);
  assert.match(testing, /RED/i);
  assert.match(testing, /GREEN/i);
  assert.match(testing, /REFACTOR/i);
  assert.doesNotMatch(testing, /2025-10-03|100% compliance|6 RED-GREEN/i);
});
