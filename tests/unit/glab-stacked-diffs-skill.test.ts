import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const skillRoot = join(root, "skills", "glab-stacked-diffs");
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const skill = read("skills/glab-stacked-diffs/SKILL.md");
const workflows = read("skills/glab-stacked-diffs/references/workflows.md");
const commands = read(
  "skills/glab-stacked-diffs/references/command-reference.md",
);
const troubleshooting = read(
  "skills/glab-stacked-diffs/references/troubleshooting.md",
);

function markdownSection(content: string, heading: string): string {
  const marker = `## ${heading}\n`;
  const start = content.indexOf(marker);
  assert.notEqual(start, -1, `expected ${heading} section`);
  const remainder = content.slice(start + marker.length);
  const nextHeading = remainder.indexOf("\n## ");
  return nextHeading === -1 ? remainder : remainder.slice(0, nextHeading);
}

function packageText(): string {
  return [
    join(skillRoot, "SKILL.md"),
    ...readdirSync(join(skillRoot, "references")).map((name) =>
      join(skillRoot, "references", name),
    ),
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

test("AX installs the local glab-stacked-diffs fork from one owner", () => {
  const config = JSON.parse(read("ax.config.json")) as {
    blocks: Record<
      string,
      { skills: Array<{ localPath?: string; url?: string; names: string[] }> }
    >;
  };
  const candidates = Object.entries(config.blocks).flatMap(([block, value]) =>
    value.skills.flatMap((source) =>
      source.names
        .filter((name) => name === "glab-stacked-diffs")
        .map(() => ({ block, ...source })),
    ),
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.block, "personal-skills");
  assert.equal(candidates[0]?.localPath, "skills");
  assert.equal(candidates[0]?.url, undefined);
});

test("the fork keeps immutable upstream provenance", () => {
  const provenance = read("skills/glab-stacked-diffs/references/upstream.md");
  assert.match(provenance, /3ee8243228090acc928afe07b02050e99fa45088/);
  assert.match(provenance, /AI repository is now the authoritative source/);
  assert.match(provenance, /no automatic upstream synchronization/i);
});

test("runtime routes authority without duplicating long procedures", () => {
  assert.ok(skill.trim().split(/\s+/u).length <= 650);
  assert.match(skill, /Explore\/Review may inspect/i);
  assert.match(skill, /Execute may edit, validate, save, or amend/i);
  assert.match(
    skill,
    /Finish alone may publish, sync,\s+retarget, or restack/i,
  );
  assert.match(skill, /change-request-create.*reviewer-facing/is);
  assert.match(skill, /Load only the needed procedure/i);
  assert.doesNotMatch(skill, /^## (?:Common Mistakes|Quick Reference)$/m);
});

test("published corrections preserve descendants until predecessor promotion", () => {
  assert.match(skill, /Change only the substantive MR/i);
  assert.match(skill, /Do not restack\s+descendants/i);
  assert.match(skill, /restack only its immediate child/i);
  assert.match(skill, /exact expected remote-head lease/i);
  assert.match(workflows, /Preserve the\s+descendants' existing source heads/);
  assert.match(workflows, /Do not accept an automatic descendant rewrite/);
});

test("new stacks publish real diffs sequentially and stay draft", () => {
  assert.match(skill, /Publish coherent real-diff draft MRs sequentially/i);
  assert.match(skill, /Never create empty\s+placeholders/i);
  assert.match(skill, /Technical readiness leaves every MR draft/i);
  assert.match(
    commands,
    /--force-with-lease=refs\/heads\/<branch>:<expected-sha>/,
  );
  assert.match(workflows, /Invoke `change-request-create`/);
});

test("unsupported or divergent topology fails closed", () => {
  assert.match(skill, /direct commit[\s\S]*freezes mutation/i);
  assert.match(skill, /`glab stack sync` is not the default/i);
  assert.match(skill, /mid-stack insertion[\s\S]*returns to Plan/i);

  const directCommit = markdownSection(
    troubleshooting,
    "Direct Git Commit in a Managed Stack",
  );
  const recoveryRoutes = directCommit
    .split("\n")
    .filter((line) => line.startsWith("- "));
  assert.ok(recoveryRoutes.length >= 4, "expected explicit recovery routes");
  for (const observation of [
    "git status --short",
    "git reflog -n 20",
    "glab stack list",
  ]) {
    assert.match(directCommit, new RegExp(observation.replace(" ", "\\s+")));
  }
  assert.doesNotMatch(directCommit, /git push .*--force/);
});

test("the package excludes destructive and policy-bypassing examples", () => {
  const content = packageText();
  assert.doesNotMatch(content, /&&/);
  assert.doesNotMatch(content, /--no-verify/);
  assert.doesNotMatch(content, /git reset --hard/);
  assert.doesNotMatch(content, /glab mr update[^\n]*--description/);
  assert.doesNotMatch(content, /glab mr update[^\n]*--ready/);
  assert.doesNotMatch(content, /glab mr merge/);
});
