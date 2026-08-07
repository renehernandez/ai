import assert from "node:assert/strict";
import test from "node:test";
import { read } from "../../scripts/charter-validator-reader.ts";

const focusedReviewers = [
  "code-quality-review",
  "code-simplifier",
  "deslop",
  "diff-review",
  "scrutinize",
] as const;

test("focused reviewers keep bounded read-only output contracts", () => {
  for (const name of focusedReviewers) {
    const skill = read(`skills/${name}/SKILL.md`);
    assert.match(skill, /^description: Use when /m, name);
    assert.match(skill, /findings-only/i, name);
    assert.match(skill, /Never edit/i, name);
    assert.match(
      skill,
      /result: passed \| finding \| blocked|Scrutinize verdict:/i,
      name,
    );
    assert.match(skill, /Location:/, name);
    assert.match(skill, /Residual (?:risk|convention risk):/i, name);
    assert.doesNotMatch(
      skill,
      /^## (?:Common Mistakes|Validation Scenarios|Test Evidence)$/m,
    );
  }
});

test("diff review rejects ambiguous provider freshness wording", () => {
  const skill = read("skills/diff-review/SKILL.md");
  assert.doesNotMatch(skill, /Never trust.*claim provider freshness.*or mix/is);
});
