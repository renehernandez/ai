import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const skill = readFileSync(
  join(process.cwd(), "skills/brainstorming/SKILL.md"),
  "utf8",
).replace(/\s+/g, " ");

test("brainstorming opens the problem space with working hypotheses", () => {
  assert.match(skill, /\*\*Orientation Map\*\*/);
  assert.match(skill, /\*\*Discussion Queue\*\*/);
  assert.match(skill, /\*\*Working Hypotheses\*\*/);
  assert.match(skill, /\*\*Next step\*\*/);
  assert.match(skill, /quick or narrow request/);
  assert.match(skill, /Do not use the orientation map for this route/);
  assert.match(skill, /domain-terms pass only when terminology is fuzzy/);
  assert.match(skill, /objective, problem framing, material domain terms/);
  assert.match(skill, /approach, working hypotheses/);
  assert.match(skill, /omit the question, recommend readiness/);
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

test("brainstorming separates opening exploration from convergence", () => {
  assert.match(skill, /Converge only when invited later/);
  assert.match(
    skill,
    /After the opening pass, a later request to narrow, choose v1, plan, implement, or prepare delivery activates convergence/,
  );
  assert.match(
    skill,
    /Do not choose v1, implementation slices, proof location, or capture artifact during this opening phase/,
  );
  assert.match(
    skill,
    /Apply this section only after the user invites convergence/,
  );
  assert.match(
    skill,
    /Apply this section only after the user invites an implementation shape/,
  );
});

test("brainstorming accepts explicit bundles without expanding authority", () => {
  assert.match(
    skill,
    /accepting the explicit recommendation or recommendation bundle/,
  );
  assert.match(skill, /without treating unstated scope/);
  assert.match(
    skill,
    /Do not ask again about accepted items or low-risk defaults/,
  );
  assert.match(skill, /State low-risk defaults together/);
  assert.match(
    skill,
    /Treating an opening "fix" or "implement" request as mutation authority/,
  );
  assert.match(skill, /wait for a later explicit transition/);
  assert.match(skill, /After convergence is invited, use a hard stop/);
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
