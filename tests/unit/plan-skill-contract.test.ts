import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string): string =>
  readFileSync(join(process.cwd(), path), "utf8");
const words = (value: string): number => value.trim().split(/\s+/).length;

test("RED: Plan runtime guidance stays within lifecycle-owner scope", () => {
  const plan = read("skills/plan/SKILL.md");
  assert.ok(
    words(plan) <= 1_000,
    "Plan should remain a complex lifecycle owner",
  );
  assert.doesNotMatch(plan, /^## (?:Common Mistakes|Test Evidence)$/m);
});

test("GREEN: Plan retains its unique artifact and rehearsal decisions", () => {
  const plan = read("skills/plan/SKILL.md");
  assert.match(plan, /one planning artifact/i);
  assert.match(plan, /atomic plan/i);
  assert.match(plan, /OpenSpec/);
  assert.match(plan, /reuse and deviation/i);
  assert.match(plan, /full disposable POC/i);
  assert.match(plan, /post-POC/i);
  assert.match(plan, /planning checkpoint/i);
  assert.match(plan, /investigation-and-implementation\.md/);
  assert.match(plan, /may\s+not write implementation code/i);
});

test("RED: OpenSpec task audit delegates evidence and mechanics", () => {
  const audit = read("skills/openspec-tasks/SKILL.md");
  assert.ok(words(audit) <= 700, "task audit should be a bounded specialist");
  assert.doesNotMatch(audit, /^## (?:Mistakes|Test Evidence)$/m);
  assert.doesNotMatch(audit, /```json/);
});

test("GREEN: OpenSpec task audit preserves delivery-unit blockers", () => {
  const audit = read("skills/openspec-tasks/SKILL.md");
  assert.match(audit, /bounded Plan specialist/i);
  assert.match(audit, /does not rewrite `tasks\.md`/i);
  assert.match(audit, /one delivery unit/i);
  assert.match(audit, /nested work item/i);
  assert.match(audit, /needs_spec_redesign/);
  assert.match(audit, /needs_human_action/);
  assert.match(audit, /objective proof/i);
  assert.match(audit, /scripts\/openspec-tasks\.ts/);
});
