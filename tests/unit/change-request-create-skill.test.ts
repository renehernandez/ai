// charter-contracts: change-request-owner
import assert from "node:assert/strict";
import test from "node:test";
import { read } from "../../scripts/charter-validator-reader.ts";

const skill = read("skills/change-request-create/SKILL.md");
const policy = read(
  "skills/change-request-create/references/description-policy.md",
);
const github = read(
  "skills/change-request-create/references/github-provider.md",
);
const gitlab = read(
  "skills/change-request-create/references/gitlab-provider.md",
);

test("RED change-request-owner: retired provider adapters are not selectable", () => {
  const config = JSON.parse(read("ax.config.json")) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
  };
  const names = config.blocks["personal-skills"].skills[0].names;
  assert.ok(!names.includes("github-pr-create"));
  assert.ok(!names.includes("glab-mr-create"));
});

test("GREEN change-request-owner: one host-neutral owner routes both providers", () => {
  assert.match(
    read("skills/change-request-create/SKILL.md"),
    /^name: change-request-create$/m,
  );
  assert.match(
    skill,
    /only selectable PR\/MR creation,\s+description, and update owner/i,
  );
  for (const behavior of [
    /existing artifact URL/i,
    /explicit user host choice/i,
    /project or workflow-policy profile/i,
    /target push remote/i,
    /blocking routing question/i,
  ]) {
    assert.match(skill, behavior);
  }
  assert.match(skill, /Do not infer the host from the first remote/i);
  assert.match(
    skill,
    /Reuse an open artifact[\s\S]*never create a\s+duplicate/i,
  );
  assert.match(
    skill,
    /PR\/MR titles and descriptions.*do not require.*destination-bound confirmation/is,
  );
  assert.match(skill, /create\s+or update the artifact/is);
  assert.match(
    skill,
    /without previewing the title or body.*new permission\s+prompt/is,
  );
  assert.match(skill, /finalized policy-compliant title and body/);
  for (const adapter of [github, gitlab]) {
    assert.match(adapter, /not a selectable skill/);
    assert.match(adapter, /finalized policy-compliant title and body/);
    assert.doesNotMatch(
      adapter,
      /approved (?:title|body)|title and body approved/i,
    );
  }
});

test("RED change-request-owner: generic urgency cannot create Ready", () => {
  assert.match(skill, /Standard creates Draft/i);
  assert.match(skill, /explicit eligible Fast creates or updates\s+Ready/is);
  assert.doesNotMatch(skill, /urgency.*creates or updates\s+Ready/is);
});

test("GREEN change-request-owner: Finish supplies the delivery profile and Fast Ready scope", () => {
  assert.match(skill, /authorized mutation scope, and delivery profile/i);
  assert.match(skill, /Under explicit eligible Fast delivery/i);
  assert.match(skill, /return its verified live state/i);
  assert.match(skill, /Neither state transition authorizes merge/i);
});

test("description policy is progressively loaded and reviewer-facing", () => {
  assert.match(skill, /Load \[description policy\]/);
  assert.match(skill, /what changed, why, reviewer focus/i);
  assert.match(
    skill,
    /Keep private workflow state[\s\S]*routine green checks/i,
  );
  assert.match(policy, /targeted regression fixtures/i);
  assert.match(
    policy,
    /failed, pending,\s+missing, unavailable, or stale hosted checks/i,
  );
  assert.match(policy, /routine formatter\/linter\/typecheck/i);
  assert.match(policy, /Verification is reviewer-risk evidence/i);
});

test("templates and existing bodies preserve human ownership", () => {
  const template = read("tests/fixtures/change-request/nitro-poc-template.md");
  assert.match(template, /must be filled in by the MR owner/);
  assert.match(
    policy,
    /AI-generated descriptions\s+cannot replace manual verification/i,
  );
  assert.match(policy, /\.github\/pull_request_template\.md/);
  assert.match(policy, /\.github\/PULL_REQUEST_TEMPLATE\/\*\.md/);
  assert.match(policy, /managed markers/i);
  assert.match(policy, /change-request-create:start/);
  assert.match(policy, /read the hosted\s+body back/i);
  assert.match(skill, /Command success without safe\s+readback does not pass/i);
});

test("OpenSpec POC descriptions do not acquire disposal authority", () => {
  assert.match(policy, /Prefix the title with `POC:`/);
  assert.match(policy, /review-only and must close unmerged/i);
  assert.match(policy, /description never\s+authorizes closure/i);
  assert.match(policy, /exact POC-disposal authority/i);
});

test("GitLab Linear relationships are decided before provider mutation", () => {
  const fixture = read(
    "tests/fixtures/change-request/linear-relationship-handoff.md",
  );
  assert.match(policy, /closing[\s\S]*`Closes PAD-123`/i);
  assert.match(policy, /contributing[\s\S]*`Related to PAD-123`/i);
  assert.match(policy, /under `## Tracking`/);
  assert.match(policy, /relationship is unclear, block\s+publication/i);
  assert.match(skill, /explicit no-issue result/i);
  assert.match(gitlab, /task-local Linear relationship expectations/);
  assert.match(gitlab, /Reject Markdown-linked issue keys/);
  assert.match(fixture, /reject before provider mutation/);
  assert.match(fixture, /preserve the section unchanged/);
});
