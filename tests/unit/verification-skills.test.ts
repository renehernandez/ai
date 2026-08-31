import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import axConfig from "../../ax.config.json" with { type: "json" };

const read = (path: string): string => readFileSync(path, "utf8");
const personalSkills = (
  axConfig.blocks["personal-skills"] as {
    skills: Array<{ names: string[] }>;
  }
).skills.flatMap(({ names }) => names);

test("verification skill pair is registered with complete portable metadata", () => {
  for (const name of [
    "create-verification-skill",
    "maintain-verification-skill",
  ]) {
    assert.ok(personalSkills.includes(name), `${name} must be AX-managed`);
    assert.ok(existsSync(`skills/${name}/SKILL.md`));
    const metadata = read(`skills/${name}/agents/openai.yaml`);
    assert.match(metadata, new RegExp(`default_prompt:.*\\$${name}`));
  }
});

test("create verification skill preserves baseline and layout boundaries", () => {
  const skill = read("skills/create-verification-skill/SKILL.md");
  const layout = read(
    "skills/create-verification-skill/references/project-layout.md",
  );
  const driving = read(
    "skills/create-verification-skill/references/driving-mechanics.md",
  );

  for (const mechanic of ["Launch", "Doctor", "Drive", "Evidence", "Cleanup"])
    assert.match(skill, new RegExp(`\\b${mechanic}\\b`));
  assert.match(skill, /broken or unverified baseline/i);
  assert.match(skill, /prove one mapped feature/i);
  assert.match(layout, /\.agents\/skills\/verify-<app>/);
  assert.match(layout, /do not create or repair.*discovery links/is);
  for (const harness of ["Playwright", "CLI", "PTY", "HTTP"])
    assert.match(driving, new RegExp(harness, "i"));
});

test("maintain verification skill keeps complete coverage and product truth", () => {
  const skill = read("skills/maintain-verification-skill/SKILL.md");
  const pass = read(
    "skills/maintain-verification-skill/references/maintenance-pass.md",
  );

  assert.match(skill, /every\s+mapped feature both source and live coverage/i);
  assert.match(skill, /edit only the selected verification skill directory/i);
  assert.match(skill, /product regression.*blocked/is);
  assert.match(skill, /clean.*changed.*blocked/is);
  assert.match(pass, /clean.*no branch.*no (?:PR|MR)/is);
  assert.match(pass, /blocked.*no branch.*no (?:PR|MR)/is);
  assert.match(pass, /representative user path/i);
});
