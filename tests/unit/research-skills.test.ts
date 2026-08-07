import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("research routes one primary evidence lane and stops before downstream work", () => {
  const skill = read("skills/research/SKILL.md");
  assert.match(skill, /exactly one evidence lane/i);
  assert.match(skill, /`research-technical`.*standards, protocols, APIs/is);
  assert.match(skill, /`research-content`.*discourse, audience assumptions/is);
  assert.match(skill, /Do not run both lanes/i);
  assert.match(
    skill,
    /Normal requests return the selected lane's `research_brief`/i,
  );
  assert.match(skill, /Stop before brainstorming,\s+planning, drafting/is);
  assert.doesNotMatch(skill, /`presentations`/);
});

test("research route-only output preserves ambiguity and unnecessary outcomes", () => {
  const skill = read("skills/research/SKILL.md");
  assert.match(skill, /research_routing:/);
  assert.match(skill, /status: routed \| ask_user \| unnecessary/);
  assert.match(
    skill,
    /selected_skill: research-technical \| research-content \| none/,
  );
  assert.match(
    skill,
    /secondary_skill: research-technical \| research-content \| none/,
  );
  assert.match(skill, /Ask one material question/i);
});

test("technical research owns current implementation evidence and local assumptions", () => {
  const skill = read("skills/research-technical/SKILL.md");
  assert.match(
    skill,
    /standards\/specifications.*official.*source repositories/is,
  );
  assert.match(skill, /5–10 is a useful default,\s+not a quota/is);
  assert.match(skill, /technical_findings:/);
  assert.match(skill, /source_conflicts:/);
  assert.match(skill, /repo_applicability:/);
  assert.match(skill, /assumptions to verify, never confirmed facts/i);
  assert.match(skill, /supported_by: \[S1\]/);
});

test("content research owns audience framing and claim strength", () => {
  const skill = read("skills/research-content/SKILL.md");
  assert.match(
    skill,
    /primary\/canonical sources.*current credible discourse/is,
  );
  assert.match(skill, /audience_context:/);
  assert.match(skill, /discourse_map:/);
  assert.match(skill, /tired_framing:/);
  assert.match(skill, /possible_angles:/);
  assert.match(
    skill,
    /claims: \{ strong: \[\], plausible: \[\], speculative: \[\] \}/,
  );
  assert.match(skill, /supported_by: \[S1\]/);
  assert.doesNotMatch(skill, /`presentations`/);
});

test("current research blocks when its required evidence class is unavailable", () => {
  for (const name of ["research-technical", "research-content"]) {
    const skill = read(`skills/${name}/SKILL.md`);
    assert.match(skill, /return `blocked`/i, name);
    assert.match(skill, /missing source class.*next lookup/is, name);
    assert.doesNotMatch(skill, /^## (?:Common Mistakes|Test Evidence)$/m, name);
  }
});
