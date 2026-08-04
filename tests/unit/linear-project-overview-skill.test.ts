import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/linear-project-overview/SKILL.md", "utf8");
const contract = readFileSync(
  "skills/linear-project-overview/references/content-contract.md",
  "utf8",
);

test("Linear project overview keeps focused metadata and runtime", () => {
  const metadata = readFileSync(
    "skills/linear-project-overview/agents/openai.yaml",
    "utf8",
  );
  assert.match(skill, /^name: linear-project-overview$/m);
  assert.match(skill, /^description: Use when /m);
  assert.ok(skill.trim().split(/\s+/u).length <= 500);
  assert.match(metadata, /display_name: "Linear Project Overview"/);
});

test("overview field mapping and content contract stay stable", () => {
  assert.match(skill, /workflow `summary` to Linearis `description`/i);
  assert.match(
    skill,
    /workflow Markdown\s+`description` to Linearis `content`/i,
  );
  assert.match(skill, /255 characters/);
  for (const heading of ["Why", "Outcome", "Scope", "Non-goals", "Success"]) {
    assert.match(contract, new RegExp(`## ${heading}`));
  }
  assert.match(contract, /omitting `Non-goals`/i);
  assert.match(contract, /Do not add a `Resources` heading/i);
  assert.match(contract, /Exclude milestone\/issue inventories/i);
});

test("overview preview is read-only and drift-bound", () => {
  assert.match(skill, /drafts and reviews in Explore/i);
  assert.match(skill, /Finish owns a later\s+explicitly approved update/i);
  assert.match(skill, /Return an exact preview/i);
  assert.match(skill, /immutable project ID\/link/i);
  assert.match(
    skill,
    /alignment, drift, feedback, and intentional\s+exclusion/i,
  );
  assert.match(skill, /Stop read-only/i);
  assert.match(
    skill,
    /mapped-field mismatch[\s\S]*blocks with a refreshed preview/i,
  );
  assert.match(skill, /materially changed feedback blocks/i);
});

test("overview apply is field-limited and capability-safe", () => {
  assert.match(skill, /preferred integration.*approved rich Markdown/is);
  assert.match(
    skill,
    /routing falls back to `linearis`[\s\S]*file-backed-input capability blocker/i,
  );
  assert.match(skill, /update only `description` and `content`/i);
  assert.match(skill, /require\s+exact readback/i);
  assert.match(skill, /Never change team[\s\S]*resources/i);
});

test("overview routes adjacent semantics to canonical specialists", () => {
  assert.match(skill, /purpose\/scope to `brainstorming`/i);
  assert.match(skill, /intake to `start-project`/i);
  assert.match(skill, /milestones\/issues to `linear-breakdown`/i);
  assert.match(skill, /native project document owns design content/i);
  assert.match(skill, /`doc-smith` assists/i);
  assert.match(skill, /progress\/health to a project\s+update/i);
});
