import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/linear-breakdown/SKILL.md", "utf8");
const shape = readFileSync(
  "skills/linear-breakdown/references/issue-shape.md",
  "utf8",
);

test("Linear breakdown preserves preview-before-write authority", () => {
  assert.ok(skill.trim().split(/\s+/u).length <= 550);
  assert.match(skill, /Discovery and deduplication are read-only/i);
  assert.match(skill, /only Finish writes after the user reviews/i);
  assert.match(skill, /Linear MCP or app integration first/i);
  assert.match(skill, /fall back to\s+`linearis`/i);
  assert.match(
    skill,
    /skipping the breakdown\s+preview and writing Linear now/i,
  );
  assert.match(skill, /Speed, trust, or “create the tickets” alone/i);
  assert.match(skill, /linear_breakdown_preview/);
});

test("breakdown remains outcome-first and dependency-aware", () => {
  assert.match(skill, /earliest real end-to-end proof/i);
  assert.match(skill, /prove the real path once/i);
  assert.match(skill, /Foundation belongs in the first issue only/i);
  assert.match(
    skill,
    /Separate advisory order\s+from true blocking dependencies/i,
  );
  assert.match(skill, /milestone only for a coherent arc/i);
  assert.match(
    skill,
    /first one or two issues do not produce an observable outcome/i,
  );
});

test("issue templates and proof mechanics are progressively loaded", () => {
  assert.match(skill, /Load \[issue shape and proof\]/i);
  for (const heading of [
    "Goal",
    "Outcome Slice",
    "Acceptance Criteria",
    "Verification",
    "Dependencies",
  ]) {
    assert.match(shape, new RegExp(`## ${heading}`));
  }
  assert.match(shape, /Proof Required Before MR Ready/);
  assert.match(shape, /Disabled, skipped, absent, or code-only paths/i);
  assert.match(shape, /canonical identifier representation/i);
});

test("approved writes remain drift-checked and readback-verified", () => {
  assert.match(skill, /re-read every immutable target/i);
  assert.match(skill, /stop on material drift/i);
  assert.match(skill, /Apply only approved fields/i);
  assert.match(skill, /require\s+exact readback/i);
  assert.match(skill, /file-backed-input\s+blocker/i);
});
