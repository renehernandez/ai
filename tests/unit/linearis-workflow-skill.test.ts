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

test("linearis owns fallback CLI mechanics without granting provider authority", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /fallback adapter for Linear CLI/);
  assert.match(skill, /Only Finish may write/i);
  assert.match(skill, /`linearis usage`/);
  assert.match(skill, /domain `usage`/);
  assert.match(skill, /AUTHENTICATION_REQUIRED/);
  assert.match(skill, /Do not install or update/i);
  assert.doesNotMatch(skill, /Bash\(linear:\*\)/);
});

test("linearis requires cursor-complete reads and exact mutation readback", () => {
  const skill = normalized("skills/linearis/SKILL.md");
  const discussions = normalized(
    "skills/linearis/references/discussion-retrieval.md",
  );

  assert.match(skill, /`hasNextPage`/);
  assert.match(skill, /`nodes` and `pageInfo`/);
  assert.match(skill, /immutable UUIDs/);
  assert.match(skill, /Before an authorized write, re-read/i);
  assert.match(skill, /apply only.*approved fields/i);
  assert.match(skill, /exact equality for each.*changed field/i);
  assert.match(skill, /Resolve statuses through the target team/i);
  assert.match(skill, /references\/discussion-retrieval\.md/);
  assert.match(discussions, /top-level `comments` commands are deprecated/i);
  assert.match(discussions, /domain-owned discussion commands/i);
  assert.match(discussions, /every root discussion page/i);
  assert.match(discussions, /every reply page/i);
  assert.match(discussions, /reply-complete/i);
});

test("linearis blocks unsafe rich Markdown on the CLI fallback path", () => {
  const skill = normalized("skills/linearis/SKILL.md");

  assert.match(skill, /project `content`/);
  assert.match(skill, /issue `description`/);
  assert.match(skill, /discussion `body`/);
  assert.match(skill, /file-backed input/);
  assert.match(skill, /No Linear write was attempted/);
  assert.match(skill, /command substitution/);
  assert.match(skill, /integration.*fallback/i);
  assert.doesNotMatch(skill, /Never use Linear MCP, app, plugin/i);
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
    assert.match(skill, /`linearis`/);
    assert.match(skill, /integration first/i);
    assert.match(skill, /fall back to `linearis`/i);
    const source = read(path);
    assert.match(source, /^allowed-tools: .*mcp__linear__\*/m);
    assert.match(source, /^allowed-tools: .*mcp__codex_apps__linear_\*/m);
  }

  assert.match(overview, /workflow `summary` to Linearis `description`/i);
  assert.match(
    overview,
    /workflow Markdown `description` to Linearis `content`/i,
  );
  assert.match(overview, /file-backed-input capability blocker/i);
  assert.match(breakdown, /Discovery and deduplication are read-only/i);
  assert.match(
    breakdown,
    /Rich issue descriptions.*file-backed-input blocker/i,
  );
  assert.match(
    breakdown,
    /only description-free bounded scalar mutations may\s+proceed/i,
  );
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
  }
  assert.match(commands, /Do not require integration.*login/i);
});
