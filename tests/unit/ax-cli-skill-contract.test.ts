import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const skill = readFileSync(join(root, "skills/ax-cli/SKILL.md"), "utf8");
const metadata = readFileSync(
  join(root, "skills/ax-cli/agents/openai.yaml"),
  "utf8",
);

test("ax-cli skill removes retired mutation and workflow commands", () => {
  const retiredGuidance = [
    /top-level `install\|update/,
    /\b(?:pnpm )?ax (?:skills|instructions|hooks) (?:install|update)\b/,
    /\b(?:pnpm )?ax openspec (?:install|update)\b/,
    /\bax commit\b/,
    /\bax review-gate\b/,
    /\bax plans artifact\b/,
  ];

  for (const pattern of retiredGuidance) {
    assert.doesNotMatch(skill, pattern);
  }
  assert.doesNotMatch(metadata, /\bax commit\b|review-gate|plans artifact/);
});

test("ax-cli skill retrieves the single-sync runtime contract", () => {
  assert.match(skill, /sync[^\n]+only runtime[^\n]+mutation/i);
  assert.match(skill, /`pnpm ax sync`/);
  assert.match(skill, /`ax sync`/);
  assert.match(skill, /`pnpm ax skills sync`/);
  assert.match(skill, /`pnpm ax instructions sync`/);
  assert.match(skill, /`pnpm ax hooks sync`/);
  assert.match(skill, /`ax openspec sync`/);

  assert.match(skill, /`ax\.config\.json`[^\n]+desired state/i);
  assert.match(skill, /installedProfiles/);
  assert.match(skill, /policyProfile/);
  assert.match(skill, /authoritative/i);
  assert.match(skill, /replace|overwrite/i);
  assert.match(skill, /retiredSkills/);
  assert.match(skill, /unrelated[^\n]+untouched/i);
  assert.doesNotMatch(skill, /managed-runtime\.json/);
  assert.doesNotMatch(skill, /--profile-selection-file/);
  assert.doesNotMatch(skill, /--adoption-file/);
  assert.doesNotMatch(skill, /--recovery-file/);
  assert.doesNotMatch(skill, /sha256-tree-v1/);
  assert.match(skill, /status[^\n]+validate[^\n]+offline[^\n]+read-only/i);
});

test("ax-cli skill retrieves source, isolation, shim, and activation rules", () => {
  assert.match(skill, /latest[^\n]+remote[^\n]+ref/i);
  assert.match(skill, /isolated[\s\S]{0,80}runtime roots/i);
  assert.match(skill, /HOME=<isolated-home>/);
  assert.match(skill, /--runtime-root <isolated-runtime-root>/);
  assert.match(skill, /post-merge[\s\S]{0,80}`ax sync`/i);
  assert.match(skill, /shim `install`, `status`, and `uninstall`/i);

  assert.match(metadata, /default_prompt:/);
  assert.match(metadata, /ax sync/i);
  assert.doesNotMatch(metadata, /install and update|install\|update/i);
});

test("ax-cli skill retrieves managed tool config ownership and isolation", () => {
  assert.match(skill, /`pnpm ax configs sync`/);
  assert.match(skill, /`pnpm ax configs status`/);
  assert.match(skill, /`pnpm ax configs validate`/);
  assert.match(skill, /exact.*TOML.*leaf|TOML.*leaf.*exact/is);
  assert.match(skill, /unowned.*preserv/is);
  assert.match(skill, /Codex.*config-loader|config-loader.*Codex/is);
  assert.match(skill, /isolated HOME.*runtime root/is);
  assert.match(
    skill,
    /runtime root.*does not.*config|does not.*redirect.*config/is,
  );
  assert.match(skill, /Do not.*hand-edit.*managed.*config/is);
});
