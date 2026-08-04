// charter-contracts: simplification-review
import assert from "node:assert/strict";
import test from "node:test";

import { read } from "../../scripts/charter-validator-reader.ts";

test("RED simplification-review: runtime excludes historical enforcement sections", () => {
  const contract = read("skills/code-simplifier/SKILL.md");
  assert.doesNotMatch(
    contract,
    /^## (?:Common Mistakes|Validation Scenarios|Test Evidence)$/m,
  );
});

test("GREEN simplification-review: preserves a structural independent output", () => {
  const contract = read("skills/code-simplifier/SKILL.md");
  assert.match(contract, /^## Output$/m);
  assert.doesNotMatch(contract, /allowed-tools:[^\n]*(?:Edit|Write)/);
});

test("code simplifier keeps separate planning, implementation, and output structures", () => {
  const contract = read("skills/code-simplifier/SKILL.md");
  const headings = [...contract.matchAll(/^## (.+)$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(headings, [
    "Bind the Target",
    "Planning Lens",
    "Implementation Lens",
    "Output",
  ]);
  const output = /## Output\n\n```text\n([\s\S]*?)```/.exec(contract)?.[1];
  assert.ok(output);
  for (const field of [
    "Simplification result: passed | finding | blocked",
    "Target:",
    "Finding:",
    "Location:",
    "Surviving source of truth:",
    "Behavior-preserving recommendation:",
    "Residual risk:",
  ]) {
    assert.ok(output.includes(field), field);
  }
});
