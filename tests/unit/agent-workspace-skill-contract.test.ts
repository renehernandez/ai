import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/agent-workspace/SKILL.md", "utf-8");
const metadata = readFileSync(
  "skills/agent-workspace/agents/openai.yaml",
  "utf-8",
);

test("agent-workspace retrieves the Cloudflare control-plane contract", () => {
  assert.match(skill, /Cloudflare.*authoritative operational state/is);
  assert.match(skill, /Linear.*projection|projection.*Linear/is);
  assert.match(skill, /Codex.*user interface/is);
  assert.match(skill, /local.*Flue|Flue.*local/is);
  assert.match(skill, /one-shot/i);
  assert.match(skill, /Root.*Memory.*Workstream.*Run.*Decision.*Escalation/is);
  assert.match(skill, /workspace generation/i);
  assert.match(skill, /does not read or\s+copy Linear state/is);
  assert.doesNotMatch(skill, /legacy_runtime_provenance/);
});

test("agent-workspace retrieves the usable operation path", () => {
  assert.match(skill, /`ax-cli` skill for exact command syntax/);
  for (const operation of [
    "Configure",
    "Bootstrap",
    "Status",
    "Send",
    "Run once",
    "Records",
    "Linear export",
    "Linear acknowledge",
  ]) {
    assert.match(skill, new RegExp(`\\| ${operation} \\|`));
  }
  assert.match(skill, /Delivery Executive Assistant.*default/is);
  assert.match(skill, /AX_WORKSPACE_ACCESS_CLIENT_ID/);
  assert.match(skill, /AX_WORKSPACE_ACCESS_CLIENT_SECRET/);
  assert.match(skill, /AX_FLUE_MODEL/);
});

test("agent-workspace keeps first-cut authority and execution boundaries", () => {
  assert.match(skill, /work.*local machine/is);
  assert.match(skill, /remote sandbox.*out of scope/is);
  assert.match(skill, /Rene.*merge/is);
  assert.match(skill, /Executive Operations Assistant.*read.*draft/is);
  assert.match(skill, /workspace-write.*explicit/is);
  assert.match(skill, /Cloudflare Access/i);
  assert.doesNotMatch(skill, /~\/(?:\.agents|\.codex)/);
  assert.doesNotMatch(skill, /MCP server/i);
});

test("agent-workspace metadata is discoverable and narrow", () => {
  assert.match(metadata, /display_name: "Agent Workspace"/);
  assert.match(metadata, /default_prompt: "Use \$agent-workspace/);
});
