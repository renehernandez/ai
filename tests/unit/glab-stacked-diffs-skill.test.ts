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

test("published stack corrections preserve descendant heads until promotion", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");

  assert.match(skill, /Amend and publish only the substantive MR/);
  assert.match(skill, /Do not restack its descendants/);
  assert.match(workflows, /Preserve the\s+descendants' existing source heads/);
  assert.match(workflows, /Do not accept an automatic descendant rewrite/);
  assert.match(workflows, /promoted after predecessor merge/);
});

test("managed stack preflight prevents accidental reconstruction and expansion", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");
  const troubleshooting = read(
    "skills/glab-stacked-diffs/references/troubleshooting.md",
  );

  assert.match(skill, /Managed-Stack Preflight/);
  assert.match(skill, /do not use `glab stack sync` to propagate/);
  assert.match(skill, /closed or merged MR/);
  assert.match(skill, /direct commit/);
  assert.match(workflows, /exact lease/);
  assert.match(skill, /Do not synthesize replacement history/);
  assert.match(troubleshooting, /Preserve each\nvaluable tip/);
  assert.match(troubleshooting, /freeze writes and return to\n {2}Plan/);
});

test("stack publication creates real-diff drafts sequentially and leases only the amended MR", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const commandReference = read(
    "skills/glab-stacked-diffs/references/command-reference.md",
  );
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");
  const content = packageText();

  assert.match(skill, /glab stack save -m "<semantic imperative description>"/);
  assert.match(
    skill,
    /Publish a new stack.*Create each coherent real-diff draft sequentially through `change-request-create`/,
  );
  assert.match(workflows, /Never create an empty placeholder MR/);
  assert.match(
    commandReference,
    /--force-with-lease=refs\/heads\/<branch>:<expected-sha>/,
  );
  assert.match(
    commandReference,
    /Leave every descendant source head untouched/,
  );
  assert.match(workflows, /publishes only this branch with an exact lease/);
  assert.doesNotMatch(
    content,
    /new-stack publication (?:is |remains )?blocked/i,
  );
  assert.doesNotMatch(
    content,
    /(?:atomic|atomically).{0,80}(?:affected chain|descendant)/is,
  );
  assert.doesNotMatch(content, /glab stack sync --skip-mr-creation/);
  assert.doesNotMatch(content, /glab stack save -m "Draft:/);
});

test("append and reorder behavior stays inside supported authority", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const commandReference = read(
    "skills/glab-stacked-diffs/references/command-reference.md",
  );
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");
  const troubleshooting = read(
    "skills/glab-stacked-diffs/references/troubleshooting.md",
  );

  assert.match(commandReference, /save is append-only/);
  assert.match(
    commandReference,
    /retargets hosted MRs; it does not repair Git ancestry/,
  );
  assert.match(workflows, /A mid-stack insertion or reorder returns to Plan/);
  assert.match(workflows, /Finish alone may run `stack reorder`/);
  assert.match(
    workflows,
    /Do not present `stack save` plus `stack reorder` as an insertion/,
  );
  assert.match(
    skill,
    /Use `glab stack save` only when\n {3}the current entry is the last stack entry/,
  );
  assert.match(
    troubleshooting,
    /middle entry: preserve it and return\n {2}to Plan/,
  );
  assert.match(
    troubleshooting,
    /current entry is\nlast and the patch belongs in a new tip diff/,
  );
});

test("stack mechanics stay inside lifecycle and provider authority", () => {
  const skill = read("skills/glab-stacked-diffs/SKILL.md");
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");

  assert.match(skill, /bounded specialist inside the active lifecycle mode/);
  assert.match(skill, /`stack sync`.*\| Finish \|/);
  assert.match(skill, /technical readiness does not mark an MR ready/);
  assert.match(skill, /one unambiguous MR and is consumed/);
  assert.match(skill, /user-authored aggregate stack/);
  assert.match(
    skill,
    /Generic assent to an\n {2}agent-proposed sequence never/,
  );
  assert.match(skill, /materially changed effective diff requires/);
  assert.match(skill, /leave it draft/);
  assert.match(workflows, /`yes`, `agreed`, or `proceed`/);
  assert.match(workflows, /Invoke `change-request-create`/);
  assert.match(workflows, /internal GitLab mechanics/);
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
