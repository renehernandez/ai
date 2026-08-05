// charter-contracts: lifecycle-authority, stack-delivery
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { read } from "../../scripts/charter-validator-reader.ts";

const root = process.cwd();

test("RED authority: Linear provider routing does not force the CLI or block an available integration", () => {
  const commands = read("rules/command-and-tools.md");
  const linearis = read("skills/linearis/SKILL.md");
  const overview = read("skills/linear-project-overview/SKILL.md");
  const breakdown = read("skills/linear-breakdown/SKILL.md");
  const surfaceRouting = read("rules/agent-surface-routing.md");
  const gitRule = read("rules/git-and-review.md");

  for (const providerSurface of [
    commands,
    linearis,
    overview,
    breakdown,
    surfaceRouting,
    gitRule,
  ]) {
    assert.doesNotMatch(providerSurface, /CLI-only routing/i);
    assert.doesNotMatch(
      providerSurface,
      /Do not use (?:a )?Linear MCP, app, or plugin fallback/i,
    );
  }
});

test("GREEN authority: Linear uses the connected integration before the Linearis fallback", () => {
  const commands = read("rules/command-and-tools.md");
  const linearis = read("skills/linearis/SKILL.md");
  const overview = read("skills/linear-project-overview/SKILL.md");
  const breakdown = read("skills/linear-breakdown/SKILL.md");
  const surfaceRouting = read("rules/agent-surface-routing.md");
  const gitRule = read("rules/git-and-review.md");
  const linearisMetadata = read("skills/linearis/agents/openai.yaml");

  assert.match(commands, /Linear MCP or app integration first/i);
  assert.match(commands, /Fall back to `linearis`/i);
  assert.match(commands, /Do not require integration\s+reauthentication/i);
  assert.match(linearis, /fallback adapter for Linear/i);
  assert.match(
    linearis,
    /^description: .*unavailable, unauthenticated, or lacks a required operation.*authenticated linearis CLI\.$/m,
  );
  for (const semanticOwner of [overview, breakdown]) {
    assert.match(semanticOwner, /Linear MCP or app integration first/i);
    assert.match(semanticOwner, /Fall back\s+to `linearis`/i);
    assert.match(semanticOwner, /^allowed-tools: .*mcp__linear__\*/m);
    assert.match(
      semanticOwner,
      /^allowed-tools: .*mcp__codex_apps__linear_\*/m,
    );
  }
  assert.match(surfaceRouting, /selection follows.*command-and-tools\.md/is);
  assert.match(surfaceRouting, /`linearis` supplies fallback CLI mechanics/i);
  assert.match(gitRule, /through the selected Linear provider route/i);
  assert.match(linearisMetadata, /fallback CLI adapter/i);
});

test("RED authority: consumers do not redefine the accepted-proposal contract or magic confirmation words", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const entrypoint = read("AGENTS.md");
  const portableEntrypoint = read("instructions/AGENTS.md");
  const brainstorming = read("skills/brainstorming/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const finish = read("skills/finish/SKILL.md");
  const finishContract = read("skills/finish/scripts/finish-contract.ts");
  const gitRule = read("rules/git-and-review.md");

  for (const consumer of [
    entrypoint,
    portableEntrypoint,
    brainstorming,
    execute,
    finish,
    gitRule,
  ]) {
    assert.doesNotMatch(
      consumer,
      /^## Resolve authority from accepted proposals$/m,
    );
    assert.doesNotMatch(consumer, /An accepted proposal is the outcome/);
  }
  for (const text of [
    implementation,
    entrypoint,
    portableEntrypoint,
    execute,
    finish,
    gitRule,
  ]) {
    assert.doesNotMatch(text, /immediate `proceed`.*merge authority/is);
    assert.doesNotMatch(text, /standalone or ambiguous `proceed`/i);
  }
  assert.doesNotMatch(
    implementation,
    /Merge,\s+deployment, and cleanup require explicit language/i,
  );
  assert.doesNotMatch(finish, /\| `(?:implement|merge|deploy|clean up)/);
  assert.doesNotMatch(finishContract, /merge:\s*!mergeDenied\s*&&\s*merge/);
});

test("GREEN authority: one canonical accepted-proposal owner supplies checkpoints and terminal boundaries", () => {
  const charter = read("rules/agent-development-workflow-charter.md");
  const implementation = read("rules/investigation-and-implementation.md");
  const entrypoint = read("AGENTS.md");
  const portableEntrypoint = read("instructions/AGENTS.md");
  const brainstorming = read("skills/brainstorming/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const finish = read("skills/finish/SKILL.md");
  const finishContract = read("skills/finish/scripts/finish-contract.ts");
  const gitRule = read("rules/git-and-review.md");

  assert.match(
    implementation,
    /^## Resolve authority from accepted proposals$/m,
  );
  assert.match(
    implementation,
    /An\s+accepted proposal is the outcome and bounded action path/,
  );
  assert.match(
    implementation,
    /selected delivery shape\s+supplies its normal checkpoint/,
  );
  assert.match(implementation, /Use the narrowest coherent interpretation/);
  assert.match(implementation, /Reclassify each new user message/);
  assert.match(
    implementation,
    /observation, correction, question, or diagnostic fact.*does not authorize a broader inferred action/is,
  );
  assert.match(implementation, /restacking or rebasing several MRs/);
  assert.match(
    implementation,
    /closing, canceling, superseding, or abandoning an existing PR\/MR/,
  );
  assert.match(
    implementation,
    /Narrow investigation.*contract-preserving fixes remain authorized/is,
  );
  assert.match(implementation, /no confirmation word has\s+special authority/);
  assert.match(charter, /Authority follows the outcome and action path/);

  for (const consumer of [
    entrypoint,
    portableEntrypoint,
    brainstorming,
    execute,
    finish,
  ]) {
    assert.match(consumer, /investigation-and-implementation\.md/);
  }
  assert.match(execute, /handoff is not another permission boundary/);
  assert.match(finish, /Any unambiguous contextual acceptance/);
  assert.match(
    finishContract,
    /change\.classification === "patch-equivalent"[\s\S]*return authorized;[\s\S]*return \[\];/,
  );
  assert.match(
    finishContract,
    /const merge =[\s\S]*&&\s*!mergeDenied;[\s\S]*\n\s*merge,/,
  );
  assert.match(
    finish,
    /Replacement or consolidation authority does not dispose of existing review/,
  );
  assert.match(implementation, /one unambiguous.*MR and is\s+consumed/is);
  assert.match(
    implementation,
    /multi-MR sequence\s+requires the user's own aggregate or sequential scope/is,
  );
  assert.match(
    implementation,
    /material.*change invalidates authority.*effective diff changed/is,
  );
  assert.match(gitRule, /one exact action and target/);
  assert.match(gitRule, /No confirmation word has\s+special authority/);
  assert.doesNotMatch(gitRule, /immediate `proceed`.*merge/is);
});

test("GREEN authority: live mutation execution is executor-bound instead of inferred from planning", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const infrastructure = read("rules/ci-infra-and-cloudflare.md");

  assert.match(
    implementation,
    /Planning, documenting, recommending, or accepting a plan that contains a live\s+mutation does not authorize executing it/is,
  );
  assert.match(
    implementation,
    /first-person user ownership.*reserves that action to the user and\s+excludes the agent/is,
  );
  assert.match(
    implementation,
    /exact\s+live mutation, its target environment or workspace, and the agent as\s+executor/is,
  );
  assert.match(
    implementation,
    /exact\s+assignment names the agent as executor, whether in the same message or later/is,
  );

  assert.match(
    infrastructure,
    /`terraform apply`.*`terraform destroy`.*`terraform import`.*mutating\s+`terraform state` operations.*Terraform tests that create real resources\s+are live infrastructure mutations/is,
  );
  assert.match(
    infrastructure,
    /Apply the executor-bound live-mutation\s+contract in `investigation-and-implementation\.md`/is,
  );
  assert.doesNotMatch(
    infrastructure,
    /Before running one of those commands.*separately presented exact/is,
  );
  assert.match(
    infrastructure,
    /`terraform fmt`, `terraform validate`, and `terraform plan` do not authorize\s+a live mutation/is,
  );
  assert.doesNotMatch(
    infrastructure,
    /explicit user confirmation before running `terraform apply`/i,
  );
});

test("RED authority: technical readiness cannot replace explicit POC disposal authority", () => {
  const finish = read("skills/finish/SKILL.md");
  const implementation = read("rules/investigation-and-implementation.md");

  for (const text of [finish, implementation]) {
    assert.doesNotMatch(text, /automatically close(?:s|d)? .*POC/i);
  }
  assert.match(
    implementation,
    /POC disposal require.*exact action and target/is,
  );
  assert.match(finish, /exact POC-disposal action and artifact/i);
  assert.match(
    finish,
    /exact closure proposal.*stack-breakdown proposal.*first action is closing that named POC/is,
  );
});

test("RED authority: an accepted POC does not stop for renewed permission at review barriers", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const execute = read("skills/execute/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  for (const text of [implementation, execute]) {
    assert.doesNotMatch(
      text,
      /first-objective[^\n]*checkpoint[^\n]*(?:await|requires?) user (?:acceptance|approval)/i,
    );
  }
  assert.doesNotMatch(
    finish,
    /completed-POC Review checkpoint.*before.*publication/is,
  );
});

test("GREEN authority: accepted POC review barriers resume through draft publication", () => {
  const implementation = read("rules/investigation-and-implementation.md");
  const execute = read("skills/execute/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  for (const text of [implementation, execute]) {
    assert.match(
      text,
      /first-objective.*phase barrier.*not a user approval checkpoint/is,
    );
    assert.match(
      text,
      /passing checkpoint.*resume.*accepted POC.*without renewed permission/is,
    );
    assert.match(
      text,
      /contract-preserving findings.*Execute.*material.*Plan/is,
    );
  }
  assert.match(
    finish,
    /completed hook-clean POC.*publish.*draft.*request.*hosted review.*completed-code Review/is,
  );
  assert.match(
    finish,
    /completed-POC Review.*technical readiness.*not.*initial draft publication/is,
  );
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

  for (const text of [implementation, docs, execute]) {
    assert.match(text, /POC/i);
    assert.match(text, /remain.*open|leave.*open/is);
    assert.match(text, /read(?:y|iness) to proceed\s+to stack breakdown/i);
  }
  assert.match(
    finish,
    /Technical readiness and personal acceptance leave it open/,
  );
  assert.match(
    finish,
    /stack-breakdown proposal.*first action is closing that named POC/is,
  );
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
