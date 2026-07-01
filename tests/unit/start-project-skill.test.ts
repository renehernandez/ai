import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function normalized(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function extractSection(content: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = content.indexOf(marker);

  assert.notEqual(start, -1, `expected section ${heading}`);

  const bodyStart = start + marker.length;
  const nextHeading = content.indexOf("\n## ", bodyStart);
  const bodyEnd = nextHeading === -1 ? content.length : nextHeading;

  return content.slice(bodyStart, bodyEnd);
}

function listBullets(section: string): string[] {
  return section
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

test("start-project exposes supported frontmatter and OpenAI metadata", () => {
  const skill = read("skills/start-project/SKILL.md");
  const metadata = read("skills/start-project/agents/openai.yaml");

  assert.match(skill, /^name: start-project$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(
    skill,
    /^allowed-tools: Read, Glob, Grep, Task, AskUserQuestion$/m,
  );

  assert.match(metadata, /^interface:\n/m);
  assert.match(metadata, /display_name: "Start Project"/);
  assert.match(
    metadata,
    /short_description: "Map new effort context before planning"/,
  );
  assert.match(
    metadata,
    /default_prompt: "Use \$start-project to map local context for a new effort and return a Project Context Pack before planning\."/,
  );
});

test("start-project returns a Project Context Pack before planning", () => {
  const skill = read("skills/start-project/SKILL.md");

  assert.match(skill, /# <Effort Name> - Project Context Pack/);
  assert.match(skill, /## Goal/);
  assert.match(skill, /## Scope/);
  assert.match(skill, /## Repos \/ Systems/);
  assert.match(skill, /## Current State/);
  assert.match(skill, /## Key Interfaces/);
  assert.match(skill, /## Constraints/);
  assert.match(skill, /## Open Questions/);
  assert.match(skill, /## Load-Bearing Assumptions/);
  assert.match(skill, /## Observed Risks/);
  assert.match(skill, /## Recommended Follow-Up/);
  assert.match(skill, /## Tracker-Ready Summary/);
  assert.match(skill, /portable Markdown so it can be pasted into a tracker/);
});

test("start-project inspects local context before asking broad questions", () => {
  const workflow = normalized(
    extractSection(read("skills/start-project/SKILL.md"), "Workflow"),
  );

  assert.match(
    workflow,
    /Inspect local context read-only before asking broad questions/,
  );
  assert.match(
    workflow,
    /Ask only for missing scope that cannot be discovered safely/,
  );
  assert.match(workflow, /Ask each explorer for a short context report/);
});

test("start-project preserves no-external-write boundary", () => {
  const skill = normalized(read("skills/start-project/SKILL.md"));

  assert.match(
    skill,
    /A single `\$start-project` invocation never writes external state/,
  );
  assert.match(
    skill,
    /does not create or update Linear projects, Linear issues, GitLab issues, GitHub issues, Asana tasks, OpenSpec files, local plan files, branches, commits, PRs, or MRs/,
  );
  assert.match(
    skill,
    /Phrases such as "if possible", "Linear-ready", "put it in Linear", "create tickets", or "so the team can start tomorrow" are not storage permission/,
  );
  assert.match(
    skill,
    /"Make this Linear-ready" returns a copyable tracker summary and names Linear storage as a separate follow-up workflow/,
  );
});

test("start-project blocks same-turn tracker mutation rationalizations", () => {
  const skill = normalized(read("skills/start-project/SKILL.md"));

  assert.match(skill, /The no-write boundary applies to the whole turn/);
  assert.match(
    skill,
    /Do not use `start-project` as a context boundary and then call Linear, GitLab, GitHub, Asana, filesystem, or planning tools to store, update, or create downstream artifacts in the same response/,
  );
  assert.match(
    skill,
    /If the user asks for both intake and a tracker update in one prompt, return the Project Context Pack and say that tracker mutation requires a separate follow-up after the intake result is accepted/,
  );
  assert.match(
    skill,
    /"I used start-project for the context boundary, then Linear for the mutation" violates this skill/,
  );
});

test("start-project forbids downstream breakdown artifacts", () => {
  const skill = read("skills/start-project/SKILL.md");
  const hardStops = extractSection(skill, "Hard Stops");
  const normalizedHardStops = normalized(hardStops);

  assert.match(
    hardStops,
    /Never include downstream breakdown or preview artifacts/,
  );
  assert.deepEqual(listBullets(hardStops), [
    "Issues",
    "Tasks",
    "Milestones",
    "Workstreams",
    "Deliverables",
    "Backlog",
    "Delivery Arc",
    "Proposed First Milestone",
    "Implementation Plan",
    "Delivery Sequence",
    "Acceptance Criteria",
    "Issue Titles",
    "Estimates",
    "Assignees",
  ]);
  assert.match(
    normalizedHardStops,
    /Do not produce `linear_breakdown_preview`/,
  );
  assert.match(normalizedHardStops, /issue-title lists/);
  assert.match(normalizedHardStops, /milestone previews/);
  assert.match(normalizedHardStops, /OpenSpec task drafts/);
  assert.match(normalizedHardStops, /implementation slice previews/);
  assert.match(normalizedHardStops, /Do not add mitigation plans/);
});

test("start-project recommends one concrete follow-up route and stops", () => {
  const skill = read("skills/start-project/SKILL.md");

  assert.match(skill, /Recommend exactly one follow-up route and stop/);
  assert.match(
    skill,
    /\| Requirements or tradeoffs need discussion \| `brainstorming` \|/,
  );
  assert.match(
    skill,
    /\| The effort needs specs or acceptance criteria before implementation planning \| `openspec-propose` \|/,
  );
  assert.match(
    skill,
    /\| The effort has a reviewed plan or accepted planning artifact \| `plan-orchestrator` \|/,
  );
  assert.match(
    skill,
    /\| The user wants Linear issues from the pack \| `linear-breakdown` \|/,
  );
  assert.match(
    skill,
    /Recommendation only means "next step\." Do not invoke the route from this skill/,
  );
});
