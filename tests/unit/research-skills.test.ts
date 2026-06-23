import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function extractFrontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "expected frontmatter");
  return match[1];
}

function assertSkillFrontmatter(path: string, name: string): void {
  const frontmatter = extractFrontmatter(read(path));

  assert.match(frontmatter, new RegExp(`^name: ${name}$`, "m"));
  assert.match(frontmatter, /^description: Use when /m);
  assert.doesNotMatch(frontmatter, /^metadata:/m);
}

function assertOpenAiMetadata(path: string, displayName: string): void {
  const content = read(path);

  assert.match(content, /^interface:\n/m);
  assert.match(content, new RegExp(`display_name: "${displayName}"`));
  assert.match(content, /short_description: ".+"/);
  assert.match(content, /default_prompt: ".+"/);
}

test("research skills expose supported frontmatter and OpenAI metadata", () => {
  assertSkillFrontmatter("skills/research/SKILL.md", "research");
  assertSkillFrontmatter(
    "skills/research-technical/SKILL.md",
    "research-technical",
  );
  assertSkillFrontmatter(
    "skills/research-content/SKILL.md",
    "research-content",
  );

  assertOpenAiMetadata("skills/research/agents/openai.yaml", "Research");
  assertOpenAiMetadata(
    "skills/research-technical/agents/openai.yaml",
    "Research Technical",
  );
  assertOpenAiMetadata(
    "skills/research-content/agents/openai.yaml",
    "Research Content",
  );
});

test("research skill carries technical, content, and mixed-intent routing contracts", () => {
  const skill = read("skills/research/SKILL.md");
  const metadata = read("skills/research/agents/openai.yaml");

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
  assert.match(skill, /standards, protocols,/);
  assert.match(skill, /talks, presentations,/);
  assert.match(skill, /mixed technical-plus-content requests/);
  assert.match(skill, /Ask one question and stop/);
  assert.match(metadata, /research_routing decision/);
});

test("technical research skill pins source-backed brief and technical fields", () => {
  const skill = read("skills/research-technical/SKILL.md");
  const metadata = read("skills/research-technical/agents/openai.yaml");

  assert.match(skill, /Aim for 5-10 sources/);
  assert.match(skill, /Standards and specs/);
  assert.match(skill, /research_brief:/);
  assert.match(skill, /sources:\n {4}- id: S1/);
  assert.match(skill, /source_count:/);
  assert.match(skill, /evidence_map:/);
  assert.match(skill, /supported_by:/);
  assert.match(skill, /decision_readiness:/);
  assert.match(skill, /confidence: low \| medium \| high/);
  assert.match(skill, /version_context:/);
  assert.match(skill, /technical_findings:/);
  assert.match(skill, /source_conflicts:/);
  assert.match(skill, /repo_applicability:/);
  assert.match(
    skill,
    /Do not inspect the repository deeply unless the user asks/,
  );
  assert.match(metadata, /source-backed technical research_brief/);
  assert.match(metadata, /stop before planning or coding/);
});

test("content research skill pins audience, framing, claims, and content fields", () => {
  const skill = read("skills/research-content/SKILL.md");
  const metadata = read("skills/research-content/agents/openai.yaml");

  assert.match(skill, /Aim for 5-10 sources/);
  assert.match(skill, /Primary or canonical sources/);
  assert.match(skill, /research_brief:/);
  assert.match(skill, /sources:\n {4}- id: S1/);
  assert.match(skill, /source_count:/);
  assert.match(skill, /evidence_map:/);
  assert.match(skill, /supported_by:/);
  assert.match(skill, /decision_readiness:/);
  assert.match(skill, /audience_context:/);
  assert.match(skill, /tired_framing:/);
  assert.match(skill, /possible_angles:/);
  assert.match(
    skill,
    /claims:\n {2}strong: \[\]\n {2}plausible: \[\]\n {2}speculative: \[\]/,
  );
  assert.match(
    skill,
    /do not write the artifact, outline, script, deck, or message/,
  );
  assert.match(metadata, /source-backed content research_brief/);
  assert.match(metadata, /stop before drafting or outlining/);
});

test("area skills include blocked-state rules for under-evidenced current research", () => {
  const technical = read("skills/research-technical/SKILL.md");
  const content = read("skills/research-content/SKILL.md");

  assert.match(technical, /return\n`status: blocked`/);
  assert.match(technical, /missing source class and concrete next lookup/);
  assert.match(content, /return `status: blocked`/);
  assert.match(content, /missing source class and concrete next lookup/);
});
