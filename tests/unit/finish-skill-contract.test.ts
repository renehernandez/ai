import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const finish = readFileSync("skills/finish/SKILL.md", "utf8");
const words = finish.trim().split(/\s+/u).length;

test("Finish keeps runtime guidance bounded and delegates shared mechanics", () => {
  assert.ok(words <= 1_100, `Finish runtime is ${words} words`);
  assert.doesNotMatch(finish, /^## (?:Common Mistakes|Test Evidence)$/m);
  assert.match(finish, /rules\/investigation-and-implementation\.md/);
  assert.match(finish, /scripts\/finish-contract\.ts/);
  assert.match(finish, /rules\/handoff-and-resume\.md/);
  assert.match(finish, /rules\/fullscript\/nitro-review\.md/);
});

test("Finish preserves provider ownership and terminal denials", () => {
  assert.match(finish, /Finish owns provider writes/i);
  assert.match(
    finish,
    /draft publication[\s\S]*never merge, deployment, cleanup/i,
  );
  assert.match(finish, /exact POC-disposal action and artifact/i);
  assert.match(finish, /user-authored aggregate or\s+sequential merge scope/i);
  assert.match(finish, /Single-MR merge authority is consumed/i);
  assert.match(finish, /change-request-create.*only selectable/s);
});

test("delegated Finish lanes cannot acquire repository or terminal authority", () => {
  assert.match(finish, /provider-only delegated lane/i);
  assert.match(
    finish,
    /Before each mutation[\s\S]*source SHA[\s\S]*provider-ownership generation/i,
  );
  assert.match(finish, /may not edit files[\s\S]*merge, deploy, clean up/is);
  assert.match(finish, /never accept repository-write ownership/i);
  assert.match(finish, /revoked generation becomes\s+read-only/i);
});

test("Finish preserves exact-head semantic review and draft readiness", () => {
  assert.match(finish, /complete\s+Nitro response/i);
  assert.match(finish, /hostedFeedbackSemanticReview/);
  assert.match(finish, /technical_readiness_checkpoint/);
  assert.match(
    finish,
    /changed target\s+identity requires a fresh checkpoint/i,
  );
  assert.match(finish, /Report `draft_stack_ready`/);
  assert.match(finish, /Every MR remains draft/i);
});
