import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const skillRoot = join(root, "skills", "glab-stacked-diffs");

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function packageText(): string {
  const paths = [
    join(skillRoot, "SKILL.md"),
    ...readdirSync(join(skillRoot, "references")).map((name) =>
      join(skillRoot, "references", name),
    ),
  ];
  return paths.map((path) => readFileSync(path, "utf8")).join("\n");
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

  assert.deepEqual(candidates, [
    {
      block: "personal-skills",
      localPath: "skills",
      names: config.blocks["personal-skills"].skills[0].names,
    },
  ]);
  assert.equal(candidates[0]?.url, undefined);
});

test("the fork records an immutable one-time upstream baseline", () => {
  const provenance = read("skills/glab-stacked-diffs/references/upstream.md");
  assert.match(provenance, /https:\/\/git\.fullscript\.io\/ai\/skills\.git/);
  assert.match(provenance, /3ee8243228090acc928afe07b02050e99fa45088/);
  assert.match(provenance, /AI repository is now the authoritative source/);
  assert.match(provenance, /no automatic upstream synchronization/i);
});

test("published stack corrections produce progressive visible checkpoints", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");

  assert.match(
    skill,
    /finish one\n {2}substantive MR, publish its affected chain/,
  );
  assert.match(
    skill,
    /Never use .*amend every local branch, then sync once at the end/s,
  );
  assert.match(skill, /publish each affected branch immediately/);
  assert.match(skill, /let\n {3}independent gates run concurrently/);
  assert.match(workflows, /Only after this checkpoint is visible/);
  assert.match(workflows, /Do not wait for hosted review/);
  assert.match(workflows, /Substantive MR/);
  assert.match(workflows, /Propagation-only descendant/);
});

test("managed stack preflight prevents accidental reconstruction and expansion", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const troubleshooting = read(
    "skills/glab-stacked-diffs/references/troubleshooting.md",
  );

  assert.match(skill, /Managed-Stack Preflight/);
  assert.match(skill, /do not use `glab stack sync` to propagate/);
  assert.match(skill, /closed or merged MR/);
  assert.match(skill, /direct commit/);
  assert.match(skill, /exact lease naming its captured SHA/);
  assert.match(skill, /Do not synthesize replacement history/);
  assert.match(troubleshooting, /Preserve each\nvaluable tip/);
  assert.match(troubleshooting, /freeze writes and return to\n {2}Plan/);
});

test("stack publication is draft by construction and exact leased", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const commandReference = read(
    "skills/glab-stacked-diffs/references/command-reference.md",
  );
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");
  const content = packageText();

  assert.match(skill, /glab stack save -m "Draft: <imperative description>"/);
  assert.match(workflows, /initial sync creates\ndrafts by construction/);
  assert.match(workflows, /A non-draft MR blocks the workflow/);
  assert.match(
    commandReference,
    /--force-with-lease=refs\/heads\/<branch>:<expected-remote-sha>/,
  );
  assert.match(commandReference, /Run one command per branch/);
  assert.match(workflows, /earliest to\nlatest with one exact-leased push/);
  assert.doesNotMatch(content, /glab stack sync --skip-mr-creation/);
});

test("stack mechanics stay inside lifecycle and provider authority", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");

  assert.match(skill, /bounded specialist inside the active lifecycle mode/);
  assert.match(skill, /`stack sync`.*\| Finish \|/);
  assert.match(skill, /technical readiness does not mark an MR ready/);
  assert.match(skill, /Explicit\n {2}merge authority/);
  assert.match(skill, /Apply .* through `change-request-create`/s);
  assert.match(workflows, /Use the selected GitLab adapter/);
});

test("the fork excludes unsafe and policy-bypassing examples", () => {
  const content = packageText();

  assert.doesNotMatch(content, /--no-verify/);
  assert.doesNotMatch(content, /&&/);
  assert.doesNotMatch(content, /git reset --hard/);
  assert.doesNotMatch(content, /glab mr update[^\n]*--description/);
  assert.doesNotMatch(content, /glab mr update[^\n]*--ready/);
  assert.doesNotMatch(content, /glab mr merge/);
});
