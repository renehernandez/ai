import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("merge-followthrough frontmatter routes finish and check-only prompts", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /^name: merge-followthrough$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(skill, /finish a PR or MR/);
  assert.match(skill, /invoke merge-followthrough/);
  assert.match(skill, /inspect status without merging/);
});

test("merge-followthrough defines finish mode for one active PR or MR", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /## Mode Contract/);
  assert.match(
    skill,
    /Default to finish mode for one active PR or MR when the user invokes\n`\$merge-followthrough`/,
  );
  assert.match(
    skill,
    /Finish mode is permission to merge\nor queue after required gates are acceptable/,
  );
});

test("merge-followthrough keeps finish mode after metadata work", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(
    skill,
    /Metadata or review-administration work keeps finish mode/,
  );
  assert.match(skill, /update a PR or MR description, labels, reviewers/);
  assert.match(
    skill,
    /complete the metadata work, then continue\ntoward merge or queue/,
  );
  assert.match(
    skill,
    /Treating metadata plus `\$merge-followthrough` as check-only/,
  );
});

test("merge-followthrough preserves check-only and deployment boundaries", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /Use check-only mode when the user asks to watch/);
  assert.match(
    skill,
    /update\nstatus only, update without merging, see where this is/,
  );
  assert.doesNotMatch(skill, /update\nonly, see where this is/);
  assert.match(
    skill,
    /Check-only wording overrides metadata work if both are present/,
  );
  assert.match(skill, /In\ncheck-only mode, do not merge or queue/);
  assert.match(skill, /Deployment verification is explicit/);
  assert.match(
    skill,
    /Do not require deployment verification as\na default finish gate/,
  );
});

test("merge-followthrough OpenAI prompt names finish mode and explicit stack scope", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(skill, /Stack scope must be explicit/);
  assert.match(
    skill,
    /Ask for clarification before merging or queuing\nmultiple PRs or MRs/,
  );
  assert.match(metadata, /finish mode for one active PR\/MR/);
  assert.match(
    metadata,
    /update requested metadata, watch gates, and merge or queue/,
  );
  assert.match(metadata, /Use check-only mode only when/);
  assert.match(metadata, /check-only wording overrides metadata work/);
  assert.match(
    metadata,
    /Ask for explicit stack scope before merging multiple PRs\/MRs/,
  );
});
