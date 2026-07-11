import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/agent-workspace/SKILL.md", "utf-8");
const metadata = readFileSync(
  "skills/agent-workspace/agents/openai.yaml",
  "utf-8",
);

test("agent-workspace exposes the full workspace lifecycle", () => {
  assert.match(
    skill,
    /activate.*resume.*delegate.*message.*open.*deactivate/is,
  );
  assert.match(skill, /Root Agent Record/);
  assert.match(skill, /Current Memory Epoch/);
  assert.match(skill, /Agent Run.*before.*spawn/is);
  assert.match(skill, /activation writer/i);
  assert.match(skill, /workspace generation/i);
  assert.match(skill, /immutable creation tuple/i);
  assert.match(skill, /Current Memory Epoch and initial Workstream/i);
  assert.match(skill, /post-create `ASSIGN`/i);
  assert.match(skill, /scripts\/runtime-context-cli\.mjs/i);
  assert.match(skill, /length-prefixed untrusted-data framing/i);
  assert.match(skill, /pinned roles require a prompt bundle/i);
  assert.match(skill, /current coordinator registration/i);
  assert.match(skill, /registered saved-project ID/i);
  assert.match(skill, /control-policy hash/i);
  assert.match(skill, /rene:delivery-portfolio/);
  assert.match(skill, /rene:executive-operations/);
  assert.match(skill, /control_project_registration_unavailable/);
  assert.match(skill, /source fingerprint, permission profile/i);
  assert.match(skill, /control-plane:activation-writer/);
  assert.match(skill, /starts no concurrent bootstrap attempt/i);
  assert.match(skill, /exact control-project path/i);
  assert.match(skill, /deactivation and archival of that exact orphan/i);
});

test("agent-workspace preserves authority and privacy boundaries", () => {
  assert.match(skill, /Max and Ultra.*manual-only.*never automatic/is);
  assert.match(skill, /read\/draft-only/i);
  assert.match(skill, /merge.*Rene/is);
  assert.match(skill, /BLOCKED.*URGENT/is);
  assert.match(skill, /exactly one writable Run to a worktree/i);
  assert.match(skill, /calendar.*provider mutation.*draft/is);
  assert.doesNotMatch(skill, /~\/(?:\.agents|\.codex)/);
  assert.doesNotMatch(skill, /ax agents/);
});

test("agent-workspace metadata is discoverable and narrow", () => {
  assert.match(metadata, /display_name: "Agent Workspace"/);
  assert.match(metadata, /default_prompt: "Use \$agent-workspace/);
});
