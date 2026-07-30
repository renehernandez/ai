// charter-contracts: change-request-owner
import assert from "node:assert/strict";
import test from "node:test";
import { read } from "../../scripts/charter-validator-reader.ts";

test("RED change-request-owner: retired provider adapters are not selectable", () => {
  const config = JSON.parse(read("ax.config.json")) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
  };
  const names = config.blocks["personal-skills"].skills[0].names;

  assert.ok(!names.includes("github-pr-create"));
  assert.ok(!names.includes("glab-mr-create"));
});

test("GREEN change-request-owner: change-request-create owns every provider route", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const rules = read("rules/git-and-review.md");
  const github = read(
    "skills/change-request-create/references/github-provider.md",
  );
  const gitlab = read(
    "skills/change-request-create/references/gitlab-provider.md",
  );

  assert.match(skill, /^name: change-request-create$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(skill, /including provider-explicit requests/);
  assert.match(
    skill,
    /Existing artifact URL named by the user or current context/,
  );
  assert.match(skill, /Explicit user host choice/);
  assert.match(skill, /Project or workflow-policy profile/);
  assert.match(skill, /Target push remote for the branch/);
  assert.match(skill, /Do not guess from the first remote by position/);

  assert.match(
    rules,
    /For every PR\/MR creation or description update.*`change-request-create`/s,
  );
  assert.match(github, /not a selectable skill/);
  assert.match(gitlab, /not a selectable skill/);
  assert.match(skill, /only\s+selectable creation owner/);
  assert.match(github, /Consume the exact title and body approved/);
  assert.match(gitlab, /Consume the exact title and body approved/);
  assert.doesNotMatch(github, /Fallback body|--fill --draft/);
  assert.doesNotMatch(gitlab, /Fallback body|use it only/);
});

test("change-request-create protects human-owned sections and POC descriptions", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const finish = read("skills/finish/SKILL.md");
  const template = read("tests/fixtures/change-request/nitro-poc-template.md");
  const noisyBody = read(
    "tests/fixtures/change-request/nitro-poc-noisy-body.md",
  );

  assert.match(template, /must be filled in by the MR owner/);
  assert.match(template, /AI-generated descriptions cannot replace/);
  assert.match(noisyBody, /Local Review passed/);
  assert.match(noisyBody, /pipelines passed/);
  assert.match(noisyBody, /Nitro reported no findings/);
  assert.match(
    skill,
    /section that says it must be completed by the author, MR owner, or a human/,
  );
  assert.match(
    skill,
    /AI-generated descriptions cannot replace manual verification/,
  );
  assert.match(skill, /After creation or update, read the hosted body back/);
  assert.match(
    skill,
    /For OpenSpec POCs, keep the normal reviewer-facing structure/,
  );
  assert.match(
    skill,
    /pipeline IDs, local Review state, and clean Nitro state/,
  );
  assert.match(
    finish,
    /Before every PR\/MR creation or description update.*invoke `change-request-create`/s,
  );
});

test("change-request-create rejects GitLab description leaks while keeping reviewer evidence", () => {
  const skill = read("skills/change-request-create/SKILL.md");

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
});

test("change-request-create preserves GitHub templates and asks on multi-template ambiguity", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const github = read(
    "skills/change-request-create/references/github-provider.md",
  );

  assert.match(skill, /\.github\/pull_request_template\.md/);
  assert.match(skill, /\.github\/PULL_REQUEST_TEMPLATE\.md/);
  assert.match(skill, /\.github\/PULL_REQUEST_TEMPLATE\/\*\.md/);
  assert.match(
    skill,
    /If multiple templates match .* ask which template to use/s,
  );
  assert.match(github, /Do not rebuild, fill, template-expand/);
  assert.match(github, /gh pr edit "<number-or-url>"/);
  assert.match(
    github,
    /gh pr view "<number-or-url>" --json number,title,body,isDraft,baseRefName,headRefName,url/,
  );
  assert.match(
    github,
    /Read the hosted title and body back after every creation or update/,
  );
  assert.match(github, /command success alone does not pass/);
});

test("change-request-create preserves existing artifact bodies through managed sections", () => {
  const skill = read("skills/change-request-create/SKILL.md");

  assert.match(
    skill,
    /Preserve reviewer notes, links, resolved\s+checklist state, and manual sections/,
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
    /Do not restate routine green hosted checks, clean Nitro review state, operational\s+verification state, or routine local typecheck, lint, format, pre-commit,\s+pre-push, or diff-hygiene commands/,
  );
});

test("change-request-create keeps targeted evidence out of automatic verification noise", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const gitlab = read(
    "skills/change-request-create/references/gitlab-provider.md",
  );
  const github = read(
    "skills/change-request-create/references/github-provider.md",
  );

  assert.match(skill, /Verification sections are for reviewer-risk evidence/);
  assert.match(skill, /Do not list commands just because they were run/);
  assert.match(skill, /`bash scripts\/cleanup-nitro-resources\.test\.sh`/);
  assert.match(skill, /`bunx prettier --check`/);
  assert.match(skill, /`git diff --check`/);
  assert.match(skill, /`shellcheck`/);
  assert.match(skill, /automatic local gate or CI job/);
  assert.match(skill, /explicit gap/);
  assert.match(gitlab, /Consume the exact title and body approved/);
  assert.match(github, /Consume the exact title and body approved/);
});

test("change-request-create encodes thread 019edf9e verification-drift regression", () => {
  const skill = read("skills/change-request-create/SKILL.md");

  assert.match(
    skill,
    /Description evidence includes local skill paths, planning gates, routine\s+formatter output, targeted regression proof, a clean Nitro review, a passing\s+hosted pipeline, an operational-verification run, and a pending hosted check:/,
  );
  assert.match(
    skill,
    /pass only if internal\/routine references, clean Nitro state, passing pipeline\s+state, and operational-verification state are omitted while targeted proof and\s+the pending check gap are retained/,
  );
});

test("change-request-create classifies Linear relationships before GitLab mutation", () => {
  const skill = read("skills/change-request-create/SKILL.md");
  const gitlab = read(
    "skills/change-request-create/references/gitlab-provider.md",
  );
  const fixture = read(
    "tests/fixtures/change-request/linear-relationship-handoff.md",
  );

  assert.match(skill, /## Tracking/);
  assert.match(skill, /`Closes PAD-123`/);
  assert.match(skill, /`Related to PAD-123`/);
  assert.match(skill, /one issue completed by one MR/);
  assert.match(skill, /partial delivery, POCs,\s+or stack units/);
  assert.match(skill, /pause publication and ask for clarification/);
  assert.match(skill, /explicit no-issue\s+result/);
  assert.match(skill, /Preserve an existing template-owned or manual Tracking/);
  assert.match(skill, /task-local\s+relationship expectation/);
  assert.match(skill, /does not establish completion intent/);

  assert.match(gitlab, /task-local Linear relationship expectations/);
  assert.match(gitlab, /closing: `Closes PAD-123`/);
  assert.match(gitlab, /contributing: `Related to PAD-123`/);
  assert.match(gitlab, /Reject Markdown-linked issue keys/);
  assert.match(gitlab, /Read the hosted title and body back/);
  assert.match(gitlab, /does not pass/);
  assert.match(gitlab, /explicit no-issue result/);
  assert.match(gitlab, /preserves an existing template-owned or manual/);

  assert.match(fixture, /Expectation: PAD-1909 is closing/);
  assert.match(fixture, /Closes PAD-1909/);
  assert.match(fixture, /Expectation: PAD-1909 is contributing/);
  assert.match(fixture, /Related to PAD-1909/);
  assert.match(fixture, /reject before provider mutation/);
  assert.match(fixture, /Closes \[PAD-1909\]/);
  assert.match(fixture, /explicit no-issue result/);
  assert.match(fixture, /Release coordination: owned by the MR author/);
  assert.match(fixture, /preserve the section unchanged/);
});
