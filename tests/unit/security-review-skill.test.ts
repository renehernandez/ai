import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const skill = readFileSync("skills/security-review/SKILL.md", "utf8");

test("security review is a read-only evidence specialist", () => {
  const allowedTools = /^allowed-tools:\s*(.+)$/m.exec(skill)?.[1] ?? "";
  assert.doesNotMatch(allowedTools, /Write|Edit|glab|gh/);
  assert.doesNotMatch(allowedTools, /Bash\(git:\*\)/);
  for (const command of ["diff", "log", "show", "status"]) {
    assert.match(allowedTools, new RegExp(`Bash\\(git ${command}:\\*\\)`));
  }
  assert.match(skill, /read-only/i);
  assert.match(skill, /asset/i);
  assert.match(skill, /trust boundar/i);
  assert.match(skill, /attack path/i);
  assert.match(skill, /source evidence|file.*line/i);
  assert.match(skill, /mitigation/i);
  assert.match(skill, /uncertainty/i);
});

test("security review rejects unsupported ceremony and speculation", () => {
  assert.doesNotMatch(skill, /Minimum Threat Count|15-25|10\+ \(MR mode\)/i);
  assert.doesNotMatch(
    skill,
    /=== PHASE|Complete phases sequentially|Output each phase/i,
  );
  assert.doesNotMatch(
    skill,
    /Financial Impact|Cost\/Record|Total Potential Loss|ROI/i,
  );
  assert.doesNotMatch(
    skill,
    /Compliance & Privacy Assessment|Compliance Tracker/i,
  );
  assert.doesNotMatch(
    skill,
    /@nitro|add label|request changes|provider submission/i,
  );
});

test("security review returns normalized evidence-backed findings", () => {
  for (const field of [
    "Severity",
    "Confidence",
    "Asset",
    "Actor",
    "Attack path",
    "Evidence",
    "Existing controls",
    "Impact",
    "Mitigation",
    "Uncertainty",
  ]) {
    assert.match(skill, new RegExp(`\\*\\*${field}:\\*\\*`, "i"));
  }
  assert.match(skill, /no evidenced finding/i);
  assert.match(skill, /do not invent|do not speculate/i);
});
