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
  assert.match(
    skill,
    /^description: .*unavailable, unauthenticated, or lacks a required operation.*authenticated linearis CLI\.$/m,
  );
  assert.match(skill, /^allowed-tools: Bash\(linearis:\*\), Bash\(jq:\*\)$/m);
  assert.match(metadata, /display_name: "Linearis"/);
  assert.match(metadata, /Use \$linearis/);
  assert.match(metadata, /fallback CLI adapter/);
  assert.equal(existsSync(join(root, "skills/linearis/LICENSE.md")), false);
});

test("linearis owns fallback CLI mechanics without granting provider authority", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /fallback adapter/);
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

test("linearis blocks unsafe rich Markdown only on the CLI fallback path", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /project `content`/);
  assert.match(skill, /issue `description`/);
  assert.match(skill, /discussion `body`/);
  assert.match(skill, /file-backed input/);
  assert.match(skill, /capability blocker/);
  assert.match(skill, /command substitution/);
  assert.match(skill, /integration.*unavailable|unavailable.*integration/i);
  assert.doesNotMatch(
    skill,
    /Do not use a Linear MCP, app, or plugin fallback/,
  );
});

test("Linear semantic skills prefer the integration and fall back to linearis", () => {
  const overviewPath = "skills/linear-project-overview/SKILL.md";
  const breakdownPath = "skills/linear-breakdown/SKILL.md";
  const overview = normalized(overviewPath);
  const breakdown = normalized(breakdownPath);

  for (const [path, skill] of [
    [overviewPath, overview],
    [breakdownPath, breakdown],
  ]) {
    assert.match(skill, /Linear.*integration/i);
    assert.match(skill, /`linearis`/);
    assert.match(skill, /fall back/i);
    assert.doesNotMatch(skill, /Never use a Linear MCP, app, or plugin/);
    const source = read(path);
    assert.match(source, /^allowed-tools: .*mcp__linear__\*/m);
    assert.match(source, /^allowed-tools: .*mcp__codex_apps__linear_\*/m);
    assert.doesNotMatch(
      source,
      /^allowed-tools: .*(?:\bWrite\b|\bEdit\b|(?:^|, )Bash(?:,|$))/m,
    );
  }

  assert.match(overview, /workflow summary.*`description`/i);
  assert.match(overview, /workflow description.*`content`/i);
  assert.match(overview, /rich Markdown.*integration/i);
  assert.match(breakdown, /read-only discovery and deduplication/i);
  assert.match(breakdown, /rich issue description.*integration/i);
  assert.match(breakdown, /neither adapter can safely complete/i);
});

test("shared policy selects the Linear integration before the linearis fallback", () => {
  const config = JSON.parse(read("ax.config.json")) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
  };
  const instructions = normalized("instructions/AGENTS.md");
  const commands = normalized("rules/command-and-tools.md");

  assert.equal(
    config.blocks["personal-skills"].skills[0].names.includes("linearis"),
    true,
  );
  for (const policy of [instructions, commands]) {
    assert.match(policy, /Linear.*integration/i);
    assert.match(policy, /fall back to `linearis`/i);
    assert.match(policy, /unavailable.*unauthenticated.*required operation/i);
  }
  assert.match(commands, /Do not require.*reauthentication.*`linearis`/i);
});
