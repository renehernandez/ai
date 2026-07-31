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
  assert.match(skill, /present the recommended work path/);
  assert.match(
    skill,
    /name the recommended work path and its next mandatory human\s+checkpoint/,
  );
});

test("brainstorming keeps mixed implementation prompts read-only", () => {
  assert.match(
    skill,
    /The read-only boundary applies to the whole brainstorming turn/,
  );
  assert.match(
    skill,
    /complete the opening exploration before any later authorized Plan or Execute turn/,
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
    /After the opening pass, later intent to narrow, choose v1, plan, implement, prepare delivery, or accept an explicitly presented work path activates convergence/,
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
  assert.match(skill, /It accepts the referenced recommendation bundle/);
  assert.match(skill, /never supplies unstated scope/);
  assert.match(
    skill,
    /Do not ask for a second synonym after the intent is clear/,
  );
  assert.match(skill, /State low-risk defaults together/);
  assert.match(
    skill,
    /Treating an opening "fix" or "implement" request as mutation authority/,
  );
  assert.match(skill, /later contextual intent may authorize/);
  assert.match(
    skill,
    /Plan owns creation of an atomic plan or OpenSpec\s+artifact.*without another transition prompt/s,
  );
  assert.match(
    skill,
    /Agreement that only confirms a design is\s+not permission to edit files/,
  );
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
