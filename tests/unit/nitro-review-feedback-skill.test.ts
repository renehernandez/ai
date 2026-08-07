import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/nitro-review-feedback/SKILL.md", "utf8");

test("Nitro feedback runtime stays focused on read-only collection", () => {
  assert.ok(skill.trim().split(/\s+/u).length <= 650);
  assert.doesNotMatch(
    skill,
    /^## (?:Common Mistakes|Validation Scenarios|Test Evidence)$/m,
  );
  assert.match(skill, /bounded Review specialist/i);
  assert.match(skill, /read-only/i);
  assert.match(skill, /never request Nitro[\s\S]*mutate\s+the MR/i);
  assert.match(skill, /Missing access returns `unavailable`/i);
});

test("Nitro collection delegates deterministic gates to scripts", () => {
  assert.match(skill, /gitlab-evidence-collect\.ts/);
  assert.match(skill, /validate-gitlab-evidence/);
  assert.match(
    skill,
    /validator owns request command selection[\s\S]*pagination/i,
  );
  assert.match(skill, /normalize-feedback/);
  assert.match(skill, /Only raw-provider validation may satisfy/i);
});

test("Nitro output preserves current-head feedback routing", () => {
  assert.match(
    skill,
    /complete response and unresolved discussions to Finish/i,
  );
  assert.match(skill, /hostedFeedbackSemanticReview/);
  assert.match(skill, /Old-head\s+feedback never satisfies current Review/i);
  assert.match(skill, /Any repair push needs a new Finish\s+request/i);
  assert.match(
    skill,
    /normalized actionable, non-actionable, and stale feedback/i,
  );
});
