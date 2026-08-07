import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const words = (content: string): number =>
  content.trim().split(/\s+/).filter(Boolean).length;

function projectBriefTemplate(content: string): string {
  const match = /## Project Brief[\s\S]*?```markdown\n([\s\S]*?)```/.exec(
    content,
  );
  assert.ok(match, "expected portable Project Brief template");
  return match[1];
}

test("RED: Explore and Start Project stay compact and defer shared policy", () => {
  const explore = read("skills/explore/SKILL.md");
  const intake = read("skills/start-project/SKILL.md");

  assert.ok(words(explore) <= 450, "Explore should remain a focused router");
  assert.ok(
    words(intake) <= 800,
    "Start Project should fit its intake contract",
  );
  for (const skill of [explore, intake]) {
    assert.doesNotMatch(
      skill,
      /^## (?:Common Mistakes|Verification Scenarios)$/m,
    );
  }
});

test("GREEN: Explore routes divergent work and intake without gaining writes", () => {
  const explore = read("skills/explore/SKILL.md");

  assert.match(
    explore,
    /^allowed-tools: Read, Glob, Grep, Task, AskUserQuestion$/m,
  );
  assert.match(explore, /`brainstorming`/);
  assert.match(explore, /`start-project`/);
  assert.match(explore, /bounded read-only specialist/i);
  assert.match(explore, /propose `Plan`/i);
  assert.doesNotMatch(explore, /^allowed-tools:.*(?:Write|Edit|Bash)/m);
});

test("GREEN: Start Project owns complete read-only intake, not breakdown", () => {
  const intake = read("skills/start-project/SKILL.md");
  const brief = projectBriefTemplate(intake);

  assert.match(
    intake,
    /^allowed-tools: Read, Glob, Grep, Task, AskUserQuestion$/m,
  );
  for (const heading of [
    "Goal",
    "Scope",
    "Repos / Systems",
    "Current State",
    "Key Interfaces",
    "Constraints",
    "Open Questions",
    "Load-Bearing Assumptions",
    "Observed Risks",
    "Recommended Follow-Up",
    "Tracker-Ready Summary",
  ]) {
    assert.match(brief, new RegExp(`^## ${heading.replace("/", "\\/")}$`, "m"));
  }
  assert.match(intake, /exactly one follow-up route/i);
  assert.match(
    intake,
    /does not create\s+tasks, issues, or tracker\s+records/i,
  );
  assert.doesNotMatch(intake, /^allowed-tools:.*(?:Write|Edit|Bash)/m);
});

test("start-project metadata advertises intake rather than implementation", () => {
  const metadata = read("skills/start-project/agents/openai.yaml");

  assert.match(metadata, /display_name: "Start Project"/);
  assert.match(metadata, /short_description:.*(?:map|intake|context)/i);
  assert.match(metadata, /default_prompt:.*\$start-project/);
  assert.match(metadata, /default_prompt:.*Project Brief/i);
  assert.doesNotMatch(metadata, /(?:implement|publish|provider-write)/i);
});
