// charter-contracts: lifecycle-authority, stack-delivery
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { read } from "../../scripts/charter-validator-reader.ts";

const root = process.cwd();

test("RED authority: accepted work paths do not require magic transition words or stop at mode handoffs", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const brainstorming = read("skills/brainstorming/SKILL.md");

  assert.doesNotMatch(
    implementation,
    /Agreement on a design confirms the decision; it does not authorize artifact or implementation writes/,
  );
  assert.doesNotMatch(
    implementation,
    /continue\s+within that granted scope without asking for renewed permission/,
  );
  assert.doesNotMatch(
    brainstorming,
    /Agreement may recommend Plan; it does not authorize a write by itself/,
  );
});

test("GREEN authority: semantic intent authorizes the presented task path to its human checkpoint", () => {
  const charter = read("rules/agent-development-workflow-charter.md");
  const implementation = read("rules/investigation-and-implementation.md");
  const brainstorming = read("skills/brainstorming/SKILL.md");
  const plan = read("skills/plan/SKILL.md");

  assert.match(charter, /clear conversational intent/);
  assert.match(charter, /mode\s+handoff is not another permission boundary/);
  assert.match(implementation, /No exact\s+word is required/);
  assert.match(implementation, /mutation path and stopping boundary/);
  assert.match(implementation, /Work authority is task-scoped/);
  assert.match(
    implementation,
    /pre-POC OpenSpec path[\s\S]*personal acceptance/,
  );
  assert.match(brainstorming, /Do not ask for a second synonym/);
  assert.match(plan, /ownership boundary is not a permission boundary/);
  assert.match(
    plan,
    /perform that handoff without requesting another transition phrase/,
  );
});

test("RED authority: technical readiness cannot replace explicit POC disposal authority", () => {
  const finish = read("skills/finish/SKILL.md");
  const implementation = read("rules/investigation-and-implementation.md");

  for (const text of [finish, implementation]) {
    assert.doesNotMatch(text, /automatically close(?:s|d)? .*POC/i);
    assert.match(text, /explicitly requests closure|explicit closure/i);
  }
});

test("RED authority: a passing Nitro receipt cannot bypass Finish semantic review", () => {
  const finish = read("skills/finish/SKILL.md");

  assert.doesNotMatch(
    finish,
    /a passing deterministic raw receipt is sufficient/i,
  );
  assert.match(finish, /necessary\s+but\s+insufficient/i);
});

test("RED semantic-delivery: obsolete automatic stack propagation paths remain absent", () => {
  const stacked = read("skills/glab-stacked-diffs/SKILL.md");
  const commandReference = read(
    "skills/glab-stacked-diffs/references/command-reference.md",
  );
  const troubleshooting = read(
    "skills/glab-stacked-diffs/references/troubleshooting.md",
  );

  for (const text of [stacked, commandReference, troubleshooting]) {
    assert.doesNotMatch(
      text,
      /new-stack publication (?:is |remains )?blocked/i,
    );
    assert.doesNotMatch(
      text,
      /(?:atomic|atomically).{0,80}(?:affected chain|descendant)/is,
    );
  }
});

test("GREEN semantic-delivery: budgets exempt removal-only work and preserve semantic exceptions", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const git = read("rules/git-and-review.md");
  const review = read("skills/review/SKILL.md");

  for (const text of [implementation, git, review]) {
    assert.match(text, /removal-only/i);
    assert.match(text, /10 (?:changed\s+)?files/);
    assert.match(text, /500\s+(?:changed\s+lines|additions)/);
    assert.match(text, /15 files/);
    assert.match(text, /1,000 changed\s+lines/);
  }
  assert.match(implementation, /accepted outcome/i);
  assert.match(implementation, /unsafe-to-split/i);
  assert.match(
    implementation,
    /Contract-preserving rebases.*preserve an accepted semantic exception/is,
  );
  assert.match(git, /non-removal.*more than 50.*files is prohibited/is);
});

test("GREEN semantic-delivery: stack publication stays sequential and restacks only the merged predecessor child", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const git = read("rules/git-and-review.md");
  const stacked = read("skills/glab-stacked-diffs/SKILL.md");
  const workflows = read("skills/glab-stacked-diffs/references/workflows.md");

  assert.match(implementation, /one after another|sequential/i);
  assert.match(git, /one after another|sequential/i);
  assert.match(stacked, /Sequential initial publication/i);
  assert.match(workflows, /Publish real diffs sequentially/i);
  for (const text of [implementation, git, stacked, workflows]) {
    assert.match(text, /immediate\s+child/i);
    assert.match(text, /predecessor.*merge|merge.*predecessor/is);
  }
  assert.match(workflows, /Do not accept an automatic descendant rewrite/i);
  assert.match(workflows, /Never create an empty placeholder MR/i);
});

test("GREEN semantic-delivery: Nitro requests follow every source-head push through the canonical rule", () => {
  const nitroRule = read("rules/fullscript/nitro-review.md");
  const nitroPolicy = read(
    "skills/nitro-review-feedback/scripts/nitro-request-policy.ts",
  );
  const feedback = read("skills/nitro-review-feedback/SKILL.md");
  const feedbackGate = read(
    "skills/nitro-review-feedback/scripts/nitro-feedback-gate.ts",
  );
  const finish = read("skills/finish/SKILL.md");

  assert.match(nitroRule, /\/request_review @nitro/);
  assert.match(nitroRule, /@nitro review/);
  assert.match(nitroRule, /source-head push/i);
  assert.match(nitroRule, /50 files/i);
  assert.match(nitroPolicy, /expectedNitroRequest/);
  assert.match(feedbackGate, /nitro-request-policy/);
  assert.match(feedbackGate, /requestObservedHeadSha !== gate\.headSha/);
  for (const text of [feedback, finish]) {
    assert.match(text, /canonical.*Nitro rule|Nitro rule.*canonical/is);
  }
  assert.match(nitroRule, /Target-only movement/i);
});

test("GREEN authority: POCs capture learnings and remain open until explicit user authority", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const docs = read("rules/docs-and-specs.md");
  const execute = read("skills/execute/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  for (const text of [implementation, docs, execute, finish]) {
    assert.match(text, /POC/i);
    assert.match(text, /remain.*open|leave.*open/is);
    assert.match(text, /read(?:y|iness) to proceed\s+to stack breakdown/i);
  }
  assert.match(implementation, /reconcile.*OpenSpec/is);
  assert.match(execute, /capture.*learning/is);
});

test("GREEN authority: Nitro readiness carries Finish semantic evidence", () => {
  const finish = read("skills/finish/SKILL.md");
  const review = read("skills/review/SKILL.md");
  const contract = read("skills/review/scripts/review-contract.ts");

  assert.match(finish, /hostedFeedbackSemanticReview/);
  assert.match(finish, /complete Nitro response/i);
  assert.match(review, /Finish's exact-head semantic review evidence/i);
  assert.match(contract, /technical_readiness_nitro_semantic_review_missing/);
  assert.match(contract, /technical_readiness_nitro_semantic_review_blocked/);
});

test("GREEN canonical-ownership: change-request-create is the only selectable creation owner", () => {
  const config = JSON.parse(read("ax.config.json")) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
    runtime: { retiredSkills: string[] };
  };
  const names = config.blocks["personal-skills"].skills[0].names;

  assert.ok(names.includes("change-request-create"));
  assert.ok(!names.includes("github-pr-create"));
  assert.ok(!names.includes("glab-mr-create"));
  assert.ok(config.runtime.retiredSkills.includes("github-pr-create"));
  assert.ok(config.runtime.retiredSkills.includes("glab-mr-create"));
  assert.equal(
    existsSync(join(root, "skills/github-pr-create/SKILL.md")),
    false,
  );
  assert.equal(existsSync(join(root, "skills/glab-mr-create/SKILL.md")), false);
  assert.ok(
    existsSync(
      join(root, "skills/change-request-create/references/github-provider.md"),
    ),
  );
  assert.ok(
    existsSync(
      join(root, "skills/change-request-create/references/gitlab-provider.md"),
    ),
  );
});
