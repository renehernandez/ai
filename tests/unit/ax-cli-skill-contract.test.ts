import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/ax-cli/SKILL.md", "utf8");
const commands = readFileSync(
  "skills/ax-cli/references/command-routing.md",
  "utf8",
);
const metadata = readFileSync("skills/ax-cli/agents/openai.yaml", "utf8");

test("AX runtime routing keeps one authoritative mutation boundary", () => {
  assert.match(skill, /^name: ax-cli$/m);
  assert.match(skill, /^## Authority and Safety$/m);
  assert.match(skill, /^## Feature-Branch Boundary$/m);
  assert.match(skill, /references\/command-routing\.md/);
  assert.doesNotMatch(
    skill,
    /managed-runtime\.json|--all-profiles|--adoption-file/,
  );
});

test("AX progressively loads exact command and config mechanics", () => {
  assert.match(skill, /references\/command-routing\.md/);
  assert.match(commands, /pnpm ax sync --profile <name>/);
  assert.match(commands, /pnpm ax skills sync/);
  assert.match(commands, /pnpm ax instructions sync/);
  assert.match(commands, /pnpm ax hooks sync/);
  assert.match(commands, /pnpm ax configs sync/);
  assert.match(commands, /pnpm ax openspec sync/);
  assert.match(commands, /^## Managed configs$/m);
  assert.match(commands, /^## OpenSpec$/m);
});

test("AX feature proof isolates both runtime and tool configuration", () => {
  assert.match(commands, /HOME=<isolated-home>/);
  assert.match(commands, /--runtime-root <isolated-runtime-root>/);
  assert.match(metadata, /default_prompt:/);
  assert.match(metadata, /ax sync/i);
});

test("AX excludes retired workflow and mutation surfaces", () => {
  const corpus = `${skill}\n${commands}\n${metadata}`;
  for (const pattern of [
    /top-level `install\|update/,
    /\bax commit\b/,
    /\bax review-gate\b/,
    /\bax plans artifact\b/,
    /--policy-profile|--profile-selection-file|--recovery-file/,
  ]) {
    assert.doesNotMatch(corpus, pattern);
  }
});
