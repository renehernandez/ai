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

test("linear-project-overview exposes focused metadata", () => {
  const skill = read("skills/linear-project-overview/SKILL.md");
  const metadata = read("skills/linear-project-overview/agents/openai.yaml");

  assert.match(skill, /^name: linear-project-overview$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(metadata, /display_name: "Linear Project Overview"/);
  assert.match(
    metadata,
    /short_description: "Draft and maintain stable Linear overviews"/,
  );
  assert.match(metadata, /Use \$linear-project-overview/);
});

test("linear-project-overview defines the stable content boundary", () => {
  const skill = normalized(read("skills/linear-project-overview/SKILL.md"));

  assert.match(skill, /255-character/);
  assert.match(skill, /## Why/);
  assert.match(skill, /## Outcome/);
  assert.match(skill, /## Scope/);
  assert.match(skill, /## Non-goals/);
  assert.match(skill, /## Success/);
  assert.match(skill, /Include `Non-goals` only when/);
  assert.match(skill, /Never invent a non-goal to complete the template/);
  assert.match(skill, /Do not add a `Resources` heading/);
  assert.match(
    skill,
    /milestone and issue inventories.*delivery order.*current status.*blockers.*next steps/,
  );
  assert.match(skill, /future-adjacent work/);
});

test("linear-project-overview preserves lifecycle and mutation authority", () => {
  const skill = normalized(read("skills/linear-project-overview/SKILL.md"));
  const routing = normalized(read("rules/agent-surface-routing.md"));

  assert.match(skill, /bounded specialist/);
  assert.match(skill, /Explore owns drafting and review/);
  assert.match(skill, /Finish owns a later explicitly approved update/);
  assert.match(skill, /first turn.*read-only.*exact preview/);
  assert.match(skill, /immutable Linear project ID and link/);
  assert.match(
    skill,
    /observed `summary`, `description`.*feedback item's identifier, resolution state, body, update timestamp, and anchored quoted text/,
  );
  assert.match(
    skill,
    /alignment, drift, feedback, and intentional-exclusion findings/,
  );
  assert.match(skill, /never creates a Linear project/);
  assert.match(skill, /only `summary` and `description`/);
  assert.match(
    routing,
    /Explore owns.*read-only `linear-project-overview` drafting and review/,
  );
  assert.match(
    routing,
    /Finish owns later explicitly approved `linear-project-overview` updates/,
  );
});

test("linear-project-overview revalidates feedback and drift before apply", () => {
  const skill = normalized(read("skills/linear-project-overview/SKILL.md"));

  assert.match(skill, /re-fetch the exact project/i);
  assert.match(
    skill,
    /traverse every project-comment page until no next-page cursor remains, then select the relevant unresolved feedback/i,
  );
  assert.match(
    skill,
    /re-fetch the exact project, traverse every project-comment page until no next-page cursor remains, and only then select the relevant unresolved feedback/i,
  );
  assert.match(skill, /Any mismatch stops the update.*refreshed preview/);
  assert.match(
    skill,
    /feedback item's identifier, resolution state, body, update timestamp, and anchored quoted text exactly.*New or changed material feedback stops/,
  );
  assert.match(skill, /minor wording drift is reported without blocking/);
  assert.match(skill, /Materially contradictory unresolved feedback blocks/);
  assert.match(skill, /Minor wording feedback/);
  assert.match(skill, /read both fields back/i);
  assert.match(skill, /require exact equality with the approved values/);
  assert.match(skill, /mismatch as failed verification/);
  assert.match(skill, /return the project link/);
});

test("linear-project-overview routes adjacent work to canonical owners", () => {
  const skill = normalized(read("skills/linear-project-overview/SKILL.md"));

  assert.match(skill, /unresolved purpose.*`brainstorming`/i);
  assert.match(skill, /new-effort intake.*`start-project`/i);
  assert.match(skill, /milestones or issues.*`linear-breakdown`/i);
  assert.match(skill, /design document.*native project document/i);
  assert.match(
    skill,
    /progress, health, blockers, or next steps.*project update/i,
  );
});
