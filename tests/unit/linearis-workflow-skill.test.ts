import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function normalized(path: string): string {
  return read(path).replace(/\s+/g, " ").trim();
}

test("internal linearis skill exposes portable repository-owned metadata", () => {
  const skill = read("skills/linearis/SKILL.md");
  const metadata = read("skills/linearis/agents/openai.yaml");

  assert.match(skill, /^name: linearis$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(skill, /^allowed-tools: Bash\(linearis:\*\), Bash\(jq:\*\)$/m);
  assert.match(metadata, /display_name: "Linearis"/);
  assert.match(metadata, /Use \$linearis/);
  assert.equal(existsSync(join(root, "skills/linearis/LICENSE.md")), false);
});

test("linearis owns CLI mechanics without granting provider authority", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /provider adapter/);
  assert.match(skill, /does not grant.*mutation authority/i);
  assert.match(skill, /only Finish performs.*provider write/i);
  assert.match(skill, /`linearis usage`/);
  assert.match(skill, /`linearis <domain> usage`/);
  assert.match(skill, /`linearis auth login`/);
  assert.match(skill, /do not install.*silently/i);
  assert.doesNotMatch(skill, /Bash\(linear:\*\)/);
});

test("linearis requires cursor-complete reads and exact mutation readback", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /`pageInfo\.hasNextPage`/);
  assert.match(skill, /`nodes` and `pageInfo`/);
  assert.match(skill, /immutable UUIDs/);
  assert.match(skill, /re-read.*immediately before/i);
  assert.match(skill, /apply only.*approved fields/i);
  assert.match(skill, /exact equality.*changed field/i);
  assert.match(skill, /team-specific status/i);
});

test("linearis blocks unsafe rich Markdown writes and plugin fallback", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /project `content`/);
  assert.match(skill, /issue `description`/);
  assert.match(skill, /discussion `body`/);
  assert.match(skill, /file-backed input/);
  assert.match(skill, /capability blocker/);
  assert.match(skill, /command substitution/);
  assert.match(skill, /MCP, app, or plugin fallback/);
});

test("Linear semantic skills route provider work through linearis", () => {
  const overview = normalized("skills/linear-project-overview/SKILL.md");
  const breakdown = normalized("skills/linear-breakdown/SKILL.md");

  for (const skill of [overview, breakdown]) {
    assert.match(skill, /`linearis`/);
    assert.match(skill, /MCP, app, or plugin fallback/);
  }

  assert.match(overview, /workflow summary.*`description`/i);
  assert.match(overview, /workflow description.*`content`/i);
  assert.match(overview, /file-backed-input capability blocker/i);
  assert.match(breakdown, /read-only discovery and deduplication/i);
  assert.match(breakdown, /required rich issue description.*blocks the write/i);
  assert.match(
    breakdown,
    /Only description-free writes with bounded non-Markdown fields can proceed/i,
  );
});

test("shared policy selects the internal linearis skill and CLI", () => {
  const config = JSON.parse(read("ax.config.json")) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
  };
  const instructions = normalized("instructions/AGENTS.md");
  const commands = normalized("rules/command-and-tools.md");

  assert.equal(
    config.blocks["personal-skills"].skills[0].names.includes("linearis"),
    true,
  );
  assert.match(instructions, /`linearis`/);
  assert.match(commands, /Use `linearis` for supported Linear/i);
  assert.match(commands, /Do not use Linear MCP, app, or plugin tools/i);
});
