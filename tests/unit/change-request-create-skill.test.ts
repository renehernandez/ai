import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("change-request-create exposes host-neutral routing pressure scenarios", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const rules = read("rules/git-and-review.md");
  const github = read("skills/github-pr-create/SKILL.md");
  const gitlab = read("skills/glab-mr-create/SKILL.md");

  assert.match(skill, /^name: change-request-create$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(
    skill,
    /Existing artifact URL named by the user or current context/,
  );
  assert.match(skill, /Explicit user host choice/);
  assert.match(skill, /`review-feedback-routing` artifact route/);
  assert.match(skill, /Target push remote for the branch/);
  assert.match(skill, /Do not guess from the first remote by position/);

  assert.match(
    rules,
    /For host-neutral requests .* use `change-request-create` first/,
  );
  assert.match(
    github,
    /For host-neutral PR\/MR\/change request wording, use `change-request-create`/,
  );
  assert.match(
    gitlab,
    /For host-neutral PR\/MR\/change request wording, use `change-request-create`/,
  );
});

test("change-request-create rejects GitLab description leaks while keeping reviewer evidence", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const gitlab = read("skills/glab-mr-create/SKILL.md");

  assert.match(
    skill,
    /Omit unnecessary internal process and tooling references anywhere in the body/,
  );
  assert.match(skill, /local skill paths/);
  assert.match(skill, /subagent gates/);
  assert.match(
    skill,
    /routine\s+local commands already represented by CI or standard repo hooks/,
  );
  assert.match(skill, /targeted regression commands or fixtures/);
  assert.match(
    skill,
    /failed, pending, missing, unavailable, or stale hosted checks/,
  );
  assert.match(
    gitlab,
    /Omit unnecessary author-workflow references and routine validation already represented by CI or repository hooks/,
  );
});

test("change-request-create preserves GitHub templates and asks on multi-template ambiguity", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const github = read("skills/github-pr-create/SKILL.md");

  assert.match(skill, /\.github\/pull_request_template\.md/);
  assert.match(skill, /\.github\/PULL_REQUEST_TEMPLATE\.md/);
  assert.match(skill, /\.github\/PULL_REQUEST_TEMPLATE\/\*\.md/);
  assert.match(
    skill,
    /If multiple templates match .* ask which template to use/s,
  );
  assert.match(
    github,
    /Preserve the selected template shape and fill placeholders concisely/,
  );
});

test("change-request-create preserves existing artifact bodies through managed sections", () => {
  const skill = read("skills/change-request-create/SKILL.md");

  assert.match(
    skill,
    /Preserve reviewer notes, links, resolved checklist state, and\s+manual sections/,
  );
  assert.match(skill, /<!-- change-request-create:start -->/);
  assert.match(skill, /<!-- change-request-create:end -->/);
  assert.match(
    skill,
    /Ask before replacing any section whose ownership is ambiguous/,
  );
  assert.match(skill, /Return or update it instead of creating a duplicate/);
  assert.match(
    skill,
    /Do not bypass this policy with a direct provider CLI body update/,
  );
  assert.match(
    skill,
    /Raw provider updates are mutation mechanics, not description-policy review/,
  );
});

test("change-request-create includes hosted failures without restating routine green checks", () => {
  const skill = read("skills/change-request-create/SKILL.md");

  assert.match(
    skill,
    /failed, pending, missing, unavailable, or stale hosted checks/,
  );
  assert.match(skill, /required reviewer, approval, or merge status/);
  assert.match(
    skill,
    /Do not restate routine green hosted checks or routine local typecheck, lint,\nformat, pre-commit, pre-push, or diff-hygiene commands/,
  );
});

test("change-request-create keeps targeted evidence out of automatic verification noise", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const gitlab = read("skills/glab-mr-create/SKILL.md");
  const github = read("skills/github-pr-create/SKILL.md");

  assert.match(skill, /Verification sections are for reviewer-risk evidence/);
  assert.match(skill, /Do not list commands just because they were run/);
  assert.match(skill, /`bash scripts\/cleanup-nitro-resources\.test\.sh`/);
  assert.match(skill, /`bunx prettier --check`/);
  assert.match(skill, /`git diff --check`/);
  assert.match(skill, /`shellcheck`/);
  assert.match(skill, /automatic local gate or CI job/);
  assert.match(
    gitlab,
    /targeted reviewer evidence, verification gaps, and hosted state/,
  );
  assert.match(
    github,
    /targeted reviewer evidence, verification gaps, and hosted state/,
  );
});
