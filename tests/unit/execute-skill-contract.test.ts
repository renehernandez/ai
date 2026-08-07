import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const skill = readFileSync(
  join(process.cwd(), "skills/execute/SKILL.md"),
  "utf8",
);
const words = skill.trim().split(/\s+/).length;

test("RED: Execute stays within lifecycle-owner runtime scope", () => {
  assert.ok(words <= 1_000, "Execute should remain a complex lifecycle owner");
  assert.doesNotMatch(skill, /^## (?:Common Mistakes|Test Evidence)$/m);
});

test("GREEN: Execute preserves repository and worktree authority", () => {
  assert.match(skill, /repository implementation writes/i);
  assert.match(skill, /exactly one writer/i);
  assert.match(skill, /provider mutation/i);
  assert.match(skill, /return.*to Plan/is);
  assert.match(skill, /reuse and deviation/i);
  assert.match(skill, /diff fingerprint/i);
});

test("GREEN: Execute preserves POC, stack, review, and archival boundaries", () => {
  assert.match(skill, /POC ancestry/i);
  assert.match(skill, /first objective proof/i);
  assert.match(skill, /code-simplifier/);
  assert.match(skill, /immediate child/i);
  assert.match(skill, /Immutable Publication Packet/);
  assert.match(skill, /canonical specs/i);
  assert.match(skill, /dated archive/i);
  assert.match(skill, /technical-readiness\s+checkpoint/i);
});
