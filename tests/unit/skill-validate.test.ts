import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { main, validateSkillFolder } from "../../scripts/skill-validate.ts";

function withTempSkill(
  name: string,
  skillMarkdown: string,
  testBody: (skillPath: string) => void,
  openAiMetadata?: string,
  files: Record<string, string> = {},
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

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(skillPath, filePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);
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

test("rejects AX command examples in non-ax-cli skill text", () => {
  for (const command of [
    "pnpm ax plans artifact record",
    "pnpm ax shim install",
    "pnpm ax install --all-profiles",
    "pnpm ax update --all-profiles",
    "pnpm ax instructions status",
  ]) {
    withTempSkill(
      "portable-skill",
      `---
name: portable-skill
description: Use when testing portable boundaries.
---

# Portable Skill

Run \`${command}\` before delivery.
`,
      (skillPath) =>
        assertInvalid(skillPath, /portable-boundary: .*AX command syntax/),
    );
  }
});

test("rejects runtime reusable scripts guidance in non-ax-cli skill text", () => {
  withTempSkill(
    "reusable-script-skill",
    `---
name: reusable-script-skill
description: Use when testing reusable script guidance.
---

# Reusable Script Skill

Put shared helpers in runtime.reusableScripts.
`,
    (skillPath) =>
      assertInvalid(skillPath, /portable-boundary: .*runtime\.reusableScripts/),
  );
});

test("rejects installed runtime and machine-specific paths in non-ax-cli skill text", () => {
  withTempSkill(
    "runtime-path-skill",
    `---
name: runtime-path-skill
description: Use when testing portable path boundaries.
---

# Runtime Path Skill

Read ~/.codex/skills/example and /Users/rene.hernandez/work/projects/ai.
`,
    (skillPath) => {
      const errors = validateSkillFolder(skillPath).errors.join("\n");

      assert.match(errors, /portable-boundary: .*installed runtime roots/);
      assert.match(
        errors,
        /portable-boundary: .*machine-specific absolute paths/,
      );
    },
  );
});

test("allows portable .agents/plans repo artifact guidance", () => {
  withTempSkill(
    "plan-artifact-skill",
    `---
name: plan-artifact-skill
description: Use when testing portable plan artifact guidance.
---

# Plan Artifact Skill

Store primary plan artifacts in .agents/plans so they live with the repo.
`,
    assertValid,
  );
});

test("rejects repo-root skill script command examples in non-ax-cli skill text", () => {
  withTempSkill(
    "command-skill",
    `---
name: command-skill
description: Use when testing command examples.
---

# Command Skill

Run \`pnpm exec tsx skills/command-skill/scripts/command.ts\`.
`,
    (skillPath) =>
      assertInvalid(skillPath, /portable-boundary: .*skill folder/),
  );
});

test("rejects repo-level scripts paths but allows internal script prose", () => {
  withTempSkill(
    "script-path-skill",
    `---
name: script-path-skill
description: Use when testing script path prose.
---

# Script Path Skill

Run helpers from ../../scripts/shared.ts.
`,
    (skillPath) =>
      assertInvalid(skillPath, /portable-boundary: .*repo-level scripts paths/),
  );

  withTempSkill(
    "internal-script-path-skill",
    `---
name: internal-script-path-skill
description: Use when testing internal script path prose.
---

# Internal Script Path Skill

The internal helper is described as ../scripts/lib from a nested folder.
`,
    assertValid,
  );
});

test("rejects AX mechanics in non-ax-cli adapter prompts", () => {
  withTempSkill(
    "adapter-skill",
    `---
name: adapter-skill
description: Use when testing adapter prompts.
---

# Adapter Skill
`,
    (skillPath) =>
      assertInvalid(
        skillPath,
        /agents\/openai.yaml:\d+ portable-boundary: .*profile-specific runtime commands/,
      ),
    `interface:
  display_name: "Adapter Skill"
  short_description: "Validate adapter prompt boundary"
  default_prompt: "Use this skill, then run ax skills update --profile personal."
`,
  );
});

test("allows non-AX --profile flags in portable skills", () => {
  withTempSkill(
    "profile-flag-skill",
    `---
name: profile-flag-skill
description: Use when testing non-AX profile flags.
---

# Profile Flag Skill

Run \`aws sso login --profile production\` before checking cloud resources.
`,
    assertValid,
  );
});

test("ax-cli owns AX command guidance", () => {
  withTempSkill(
    "ax-cli",
    `---
name: ax-cli
description: Use when testing AX-owned command guidance.
---

# AX CLI

Run \`pnpm ax skills update --profile personal\`.
`,
    assertValid,
  );
});

test("rejects skill scripts that import outside the skill folder", () => {
  withTempSkill(
    "script-boundary-skill",
    `---
name: script-boundary-skill
description: Use when testing script import boundaries.
---

# Script Boundary Skill
`,
    (skillPath) =>
      assertInvalid(
        skillPath,
        /scripts\/run.ts:1 portable-boundary: skill scripts must not import files outside the skill folder/,
      ),
    undefined,
    {
      "scripts/run.ts": `import { helper } from "../../../scripts/helper.ts";

helper();
`,
    },
  );
});

test("rejects skill scripts that re-export outside the skill folder", () => {
  withTempSkill(
    "script-export-boundary-skill",
    `---
name: script-export-boundary-skill
description: Use when testing script export boundaries.
---

# Script Export Boundary Skill
`,
    (skillPath) =>
      assertInvalid(
        skillPath,
        /scripts\/run.ts:1 portable-boundary: skill scripts must not import files outside the skill folder/,
      ),
    undefined,
    {
      "scripts/run.ts": `export { helper } from "../../../scripts/helper.ts";
`,
    },
  );
});

test("rejects dynamic and require imports outside the skill folder", () => {
  withTempSkill(
    "script-call-boundary-skill",
    `---
name: script-call-boundary-skill
description: Use when testing dynamic import boundaries.
---

# Script Call Boundary Skill
`,
    (skillPath) => {
      const errors = validateSkillFolder(skillPath).errors.join("\n");

      assert.match(errors, /scripts\/dynamic.ts:1 portable-boundary/);
      assert.match(errors, /scripts\/require.cjs:1 portable-boundary/);
    },
    undefined,
    {
      "scripts/dynamic.ts": `await import("../../../scripts/helper.ts");
`,
      "scripts/require.cjs": `require("../../../scripts/helper.cjs");
`,
    },
  );
});

test("rejects absolute and file URL imports outside the skill folder", () => {
  const outsidePath = join(realpathSync(tmpdir()), "external-helper.ts");
  const outsideUrl = pathToFileURL(outsidePath).href;

  withTempSkill(
    "script-local-boundary-skill",
    `---
name: script-local-boundary-skill
description: Use when testing local import boundaries.
---

# Script Local Boundary Skill
`,
    (skillPath) => {
      const errors = validateSkillFolder(skillPath).errors.join("\n");

      assert.match(errors, /scripts\/absolute.ts:1 portable-boundary/);
      assert.match(errors, /scripts\/file-url.ts:1 portable-boundary/);
    },
    undefined,
    {
      "scripts/absolute.ts": `import "${outsidePath}";
`,
      "scripts/file-url.ts": `import "${outsideUrl}";
`,
    },
  );
});

test("ignores import-looking text in skill script comments and strings", () => {
  withTempSkill(
    "script-comment-skill",
    `---
name: script-comment-skill
description: Use when testing import-looking comments.
---

# Script Comment Skill
`,
    assertValid,
    undefined,
    {
      "scripts/run.ts": `// import "../../../scripts/commented.ts";
const text = 'import "../../../scripts/string.ts"';
const template = \`require("../../../scripts/template.ts")\`;
`,
    },
  );
});

test("allows skill scripts that import packaged helpers", () => {
  withTempSkill(
    "packaged-helper-skill",
    `---
name: packaged-helper-skill
description: Use when testing packaged helper imports.
---

# Packaged Helper Skill
`,
    assertValid,
    undefined,
    {
      "scripts/lib/helper.ts":
        "export function helper(): string { return 'ok'; }\n",
      "scripts/run.ts": `import { helper } from "./lib/helper.ts";

helper();
`,
    },
  );
});

test("default skill validation contains rollback to skill folders only", () => {
  const rules = readFileSync("rules/command-and-tools.md", "utf8");
  const originalLog = console.log;

  assert.match(rules, /\b(?:pnpm\s+)?ax\s+(?:skills|hooks|openspec)\b/);

  try {
    console.log = () => {};
    assert.equal(main([]), 0);
  } finally {
    console.log = originalLog;
  }
});
