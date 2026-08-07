import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Doc Smith owns evidence-backed reader outcomes without document ceremony", () => {
  const skill = read("skills/doc-smith/SKILL.md");

  assert.match(skill, /Compact note.*Full document.*Review/is);
  assert.match(skill, /audience,\s+outcome, source, and location are known/is);
  assert.match(skill, /inspect the relevant implementation, tests/is);
  assert.match(skill, /Do not require frontmatter.*See Also/is);
  assert.match(skill, /Reader tests have one trigger/i);
  assert.match(skill, /material comprehension risk/i);
  assert.match(skill, /Doc Smith never\s+commits/i);
  assert.match(skill, /absolute path.*reader outcome.*evidence inspected/is);
  assert.match(skill, /references\/retrospective-solution-note\.md/);
  assert.match(skill, /never trigger documentation or system mutation/is);
  assert.doesNotMatch(skill, /## (?:Test Evidence|Common [Mm]istakes)/);
});

test("Docs Alignment reports exact-diff documentation coverage only", () => {
  const skill = read("skills/docs-alignment-review/SKILL.md");

  assert.match(skill, /exact target base and head/i);
  assert.match(skill, /README\/docs, plans\/specs, AGENTS\/rules/is);
  assert.match(skill, /findings-only Review technique/i);
  assert.match(
    skill,
    /Docs Alignment Verdict: clean \| updates needed \| not applicable/,
  );
  assert.match(skill, /Route prose quality to `doc-smith`/);
  assert.match(skill, /mechanically enforced to `ai-readiness-upkeep`/);
  assert.doesNotMatch(skill, /## (?:Test Evidence|Mistakes)/);
});

test("Explain Diff routes content through its portable renderer bundle", () => {
  const skill = read("skills/explain-diff-html/SKILL.md");
  const authoring = read(
    "skills/explain-diff-html/references/authoring-contract.md",
  );

  assert.match(skill, /exact commit, base-to-head diff, branch, PR\/MR head/i);
  assert.match(skill, /references\/authoring-contract\.md/);
  assert.match(skill, /render-explanation\.ts example-spec/);
  assert.match(skill, /render-explanation\.ts validate/);
  assert.match(skill, /render-explanation\.ts render/);
  assert.match(skill, /absolute `index\.html` path/is);
  assert.match(skill, /including renderer-owned `quiz\.js`/is);
  assert.match(authoring, /five medium-difficulty questions/i);
  assert.match(authoring, /passive-data boundary/i);
  assert.match(authoring, /renderer balances answer\s+positions/i);
});
