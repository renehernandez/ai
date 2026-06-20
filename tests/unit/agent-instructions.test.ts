import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const instructionFiles = [
  "AGENTS.md",
  "instructions/AGENTS.md",
  "rules/docs-and-specs.md",
  "rules/handoff-and-resume.md",
] as const;

for (const file of instructionFiles) {
  test(`${file} requires readable summaries for structured thread contracts`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Readable Summary/);
    assert.match(text, /YAML or JSON|YAML\/JSON/);
  });
}

for (const file of ["AGENTS.md", "instructions/AGENTS.md"] as const) {
  test(`${file} requires writing-skills review for agent behavior changes`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /writing-skills/);
    assert.match(text, /shared skill, agent, instruction, or rule sources/);
  });
}
