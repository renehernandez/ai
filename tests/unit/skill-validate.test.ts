import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { validateSkillFolder } from "../../scripts/skill-validate.ts";

function withTempSkill(
  name: string,
  skillMarkdown: string,
  testBody: (skillPath: string) => void,
  openAiMetadata?: string,
): void {
  const root = mkdtempSync(join(tmpdir(), "skill-validate-"));
  const skillPath = join(root, name);

  try {
    mkdirSync(skillPath, { recursive: true });
    writeFileSync(join(skillPath, "SKILL.md"), skillMarkdown);

    if (openAiMetadata) {
      mkdirSync(join(skillPath, "agents"), { recursive: true });
      writeFileSync(join(skillPath, "agents", "openai.yaml"), openAiMetadata);
    }

    testBody(skillPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertValid(skillPath: string): void {
  assert.deepEqual(validateSkillFolder(skillPath).errors, []);
}

function assertInvalid(skillPath: string, message: RegExp): void {
  const result = validateSkillFolder(skillPath);

  assert.match(result.errors.join("\n"), message);
}

test("validates a dependency-free skill metadata subset", () => {
  withTempSkill(
    "example-skill",
    `---
name: example-skill
description: Use when validating a generated skill.
allowed-tools: Read, Grep
---

# Example Skill
`,
    assertValid,
    `interface:
  display_name: "Example Skill"
  short_description: "Validate an example skill"
  default_prompt: "Use $example-skill to validate this skill."
`,
  );
});

test("accepts folded descriptions used by shared skills", () => {
  withTempSkill(
    "folded-skill",
    `---
name: folded-skill
description: >
  Use when a skill needs a long description that wraps across
  multiple frontmatter lines.
---

# Folded Skill
`,
    assertValid,
  );
});

test("rejects unsupported frontmatter keys", () => {
  withTempSkill(
    "metadata-skill",
    `---
name: metadata-skill
description: Use when testing unsupported metadata.
metadata:
---

# Metadata Skill
`,
    (skillPath) => assertInvalid(skillPath, /Unsupported frontmatter key/),
  );
});

test("rejects folder and frontmatter name mismatches", () => {
  withTempSkill(
    "folder-name",
    `---
name: other-name
description: Use when testing name mismatches.
---

# Folder Name
`,
    (skillPath) => assertInvalid(skillPath, /must match folder name/),
  );
});

test("rejects descriptions that do not start with Use when", () => {
  withTempSkill(
    "description-skill",
    `---
name: description-skill
description: Validate a generated skill.
---

# Description Skill
`,
    (skillPath) => assertInvalid(skillPath, /description must start/),
  );
});

test("rejects template TODO placeholders", () => {
  withTempSkill(
    "todo-skill",
    `---
name: todo-skill
description: Use when testing TODO placeholders.
---

# TODO Skill

[TODO: replace this]
`,
    (skillPath) => assertInvalid(skillPath, /TODO placeholders/),
  );
});

test("reports missing skill folders", () => {
  const result = validateSkillFolder(join(tmpdir(), basename(import.meta.url)));

  assert.match(result.errors.join("\n"), /does not exist/);
});
