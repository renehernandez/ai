import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const skill = readFileSync(
  join(process.cwd(), "skills/brainstorming/SKILL.md"),
  "utf8",
).replace(/\s+/g, " ");

test("brainstorming opens with a visible orientation map", () => {
  assert.match(skill, /\*\*Orientation Map\*\*/);
  assert.match(skill, /\*\*Discussion Queue\*\*/);
  assert.match(skill, /\*\*Recommended Defaults\*\*/);
  assert.match(skill, /\*\*First question\*\*/);
  assert.match(skill, /Always include a lightweight domain-terms pass/);
});

test("brainstorming keeps mixed implementation prompts read-only", () => {
  assert.match(skill, /The read-only boundary applies to the whole turn/);
  assert.match(
    skill,
    /queue the requested mutation for a later Plan or Execute turn after the brainstorming outcome is accepted/,
  );
  assert.match(
    skill,
    /Plan owns creation of an atomic plan or OpenSpec artifact/,
  );
});

test("brainstorming scans for reuse without prompt trigger phrases", () => {
  assert.match(
    skill,
    /For every non-trivial design, find the closest existing implementations/,
  );
  assert.match(skill, /only narrow this required scan; they do not trigger it/);
  assert.match(skill, /Existing precedent/);
  assert.match(skill, /No applicable precedent found/);
  assert.match(skill, /reuse the canonical implementation directly/);
  assert.match(skill, /extend its canonical owner/);
  assert.match(skill, /extract a shared boundary/);
});
