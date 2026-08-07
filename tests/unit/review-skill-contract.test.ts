import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const skill = readFileSync(
  join(process.cwd(), "skills/review/SKILL.md"),
  "utf8",
);
const words = skill.trim().split(/\s+/).length;

test("RED: Review stays within lifecycle-owner runtime scope", () => {
  assert.ok(words <= 1_000, "Review should remain a complex lifecycle owner");
  assert.doesNotMatch(skill, /^## (?:Common Mistakes|Test Evidence)$/m);
});

test("GREEN: Review preserves exact-target coverage and findings closure", () => {
  assert.match(skill, /read-only/i);
  assert.match(skill, /exact artifact fingerprint/i);
  assert.match(skill, /scripts\/review-contract\.ts/);
  assert.match(skill, /code-simplifier/);
  assert.match(skill, /phase barrier/i);
  assert.match(skill, /one\s+deduplicated findings batch/i);
  assert.match(skill, /resolutionEvidence/);
  assert.match(skill, /recheckedSurfaces/);
});

test("GREEN: Review preserves planning, POC, hosted, and readiness gates", () => {
  assert.match(skill, /task-local implementation consideration/i);
  assert.match(skill, /first objective proof/i);
  assert.match(skill, /post_poc/);
  assert.match(skill, /github-adapter-review/);
  assert.match(skill, /gitlab-adapter-review/);
  assert.match(skill, /nitro-review-feedback/);
  assert.match(skill, /technical_readiness_checkpoint/);
  assert.match(skill, /pre-commit hook owns the full local suite/i);
});
