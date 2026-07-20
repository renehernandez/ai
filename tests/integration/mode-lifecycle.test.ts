import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assertPocExpansionAllowed,
  assertWriterOwnership,
  finalDeliveryOrder,
  type PocArchitectureCheckpoint,
  type WorktreeIdentity,
} from "../../skills/execute/scripts/execution-contract.ts";
import {
  resolveProvider,
  terminalAuthority,
} from "../../skills/finish/scripts/finish-contract.ts";
import {
  type PlanContract,
  selectPlanningArtifact,
} from "../../skills/plan/scripts/plan-contract.ts";
import {
  normalizeHostedFinding,
  requiredReviewTypesFor,
  reviewerContractFor,
  validateReviewerCatalog,
  validateTechnicalReadinessCheckpoint,
} from "../../skills/review/scripts/review-contract.ts";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function fixture<T>(name: string): T {
  return JSON.parse(read(`tests/fixtures/modes/${name}.json`)) as T;
}

test("RED fixtures preserve the three observed lifecycle failures", () => {
  const scenarios =
    fixture<Array<{ id: string; baselineFailure: string; expected: object }>>(
      "red",
    );

  assert.deepEqual(
    scenarios.map(({ id }) => id),
    [
      "explore-does-not-escalate",
      "openspec-poc-is-mandatory",
      "finish-is-not-merge-authority",
    ],
  );
  assert.match(
    scenarios[0].baselineFailure,
    /wrote planning files during Explore/,
  );
  assert.match(scenarios[1].baselineFailure, /POC as optional/);
  assert.match(scenarios[2].baselineFailure, /finish granted merge authority/);
});

test("Explore is read-only and creates no planning artifact", () => {
  const skill = read("skills/explore/SKILL.md");

  assert.match(skill, /Explore is read-only/);
  assert.match(
    skill,
    /Do not create or edit repository files, planning artifacts/,
  );
  assert.match(skill, /propose `Plan` and wait/);
  assert.match(skill, /Linear-ready means copyable text/);
});

test("new tasks explore before later mutation authority", () => {
  const scenarios = fixture<
    Array<{
      id: string;
      prompt: string;
      taskState: string;
      expectedMode: "Explore" | "Plan" | "Execute";
      expectedSpecialist: "brainstorming" | null;
      mutationAllowed: boolean;
    }>
  >("first-prompt-explore");
  const agents = read("instructions/AGENTS.md").replace(/\s+/g, " ");
  const rules = read("rules/investigation-and-implementation.md").replace(
    /\s+/g,
    " ",
  );
  const explore = read("skills/explore/SKILL.md").replace(/\s+/g, " ");

  assert.deepEqual(
    scenarios.map(({ id, expectedMode, mutationAllowed }) => ({
      id,
      expectedMode,
      mutationAllowed,
    })),
    [
      {
        id: "opening-fix",
        expectedMode: "Explore",
        mutationAllowed: false,
      },
      {
        id: "later-proceed-ready",
        expectedMode: "Execute",
        mutationAllowed: true,
      },
      {
        id: "later-proceed-unresolved",
        expectedMode: "Plan",
        mutationAllowed: true,
      },
      {
        id: "mid-execute-new-outcome",
        expectedMode: "Explore",
        mutationAllowed: false,
      },
      {
        id: "same-task-ci-failure",
        expectedMode: "Execute",
        mutationAllowed: true,
      },
    ],
  );
  assert.match(agents, /Every new substantive task begins in Explore/);
  assert.match(agents, /opening request to fix, implement, change, or build/);
  assert.match(rules, /later explicit instruction such as "proceed"/);
  assert.match(
    rules,
    /materially different requested outcome creates a new task boundary/,
  );
  assert.match(
    rules,
    /review feedback, and CI failures.*do not reset the task/,
  );
  assert.match(
    rules,
    /continue\s+within that granted scope without asking for renewed permission/,
  );
  assert.match(
    rules,
    /Contract-preserving wording, formatting, validation, test, CI, review, and\s+schema repairs return automatically/,
  );
  assert.match(
    rules,
    /explicit recommendation bundle.*every recommendation in that bundle as accepted/,
  );
  assert.match(
    rules,
    /Existing\s+authenticated commands do not require renewed approval; credential entry or\s+a new credential grant remains a human action/,
  );
  assert.match(explore, /invoke `brainstorming` by default/);
});

test("GREEN Plan fixtures select one artifact semantically", () => {
  const scenarios =
    fixture<Array<{ contract: PlanContract; expectedArtifact: string }>>(
      "green",
    );

  for (const scenario of scenarios) {
    const selection = selectPlanningArtifact(scenario.contract);
    assert.equal(selection.artifact, scenario.expectedArtifact);
  }

  const openSpec = selectPlanningArtifact(scenarios[1].contract);
  assert.equal(openSpec.status, "ready");
  if (openSpec.status === "ready") {
    assert.equal(openSpec.requiresFullPoc, true);
    assert.equal(openSpec.planningMr, false);
  }
});

test("REFACTOR route closes atomic-plan and implicit-merge loopholes", () => {
  const scenarios =
    fixture<
      Array<{
        id: string;
        contract?: PlanContract;
        request?: string;
        expectedArtifact?: string;
        expected?: ReturnType<typeof terminalAuthority>;
      }>
    >("refactor");

  const route = scenarios.find(
    ({ id }) => id === "explicit-atomic-cannot-hide-migration",
  );
  assert.ok(route?.contract);
  assert.equal(selectPlanningArtifact(route.contract).artifact, "openspec");

  const finish = scenarios.find(
    ({ id }) => id === "finish-word-alone-never-merges",
  );
  assert.ok(finish?.request);
  assert.deepEqual(terminalAuthority(finish.request), finish.expected);

  const narrow = scenarios.find(
    ({ id }) => id === "explicit-terminal-authority-is-narrow",
  );
  assert.ok(narrow?.request);
  assert.deepEqual(terminalAuthority(narrow.request), narrow.expected);
});

test("Plan keeps atomic delivery in one change set and rehearses OpenSpec", () => {
  const skill = read("skills/plan/SKILL.md");

  assert.match(skill, /Every OpenSpec, without exception/);
  assert.match(skill, /production-complete POC/);
  assert.match(
    skill,
    /atomic plan and its implementation are one change set in one final MR/,
  );
  assert.match(skill, /no planning-only MR, POC phase, or POC MR/);
  assert.match(skill, /If rehearsal is required, select\s+OpenSpec/);
  assert.match(skill, /one final MR per top-level delivery unit/);
  assert.match(skill, /Do not start another POC\s+automatically/);
  assert.match(skill, /existing top-level headings as hypotheses/);
  assert.match(skill, /safe merged intermediate state/);
  assert.match(
    skill,
    /Split a candidate unit when it combines materially different/,
  );
  assert.match(
    skill,
    /Combine\s+candidate units when a split would create unused plumbing/,
  );
  assert.match(
    skill,
    /rerun the delivery decomposition against the actual POC\s+footprint/,
  );
  assert.match(skill, /pre-POC topology as provisional/);
  assert.match(skill, /authoritative final-topology gate/);
  assert.match(skill, /assess every final unit/);
  assert.match(skill, /one owning unit or a\s+declared integration hotspot/);
  assert.match(skill, /explicit `post_poc` lifecycle discriminator/);
  assert.match(skill, /Only atomic and\s+pre-POC planning.*fast path/);
  assert.match(skill, /invoke Review's runnable\s+planning-checkpoint gate/);
  assert.match(skill, /Reuse And Deviation Contract/);
  assert.match(skill, /inspected precedents and their canonical owners/);
  assert.match(skill, /never a\s+prerequisite for it/);
  assert.match(skill, /Durable Planning Boundary/);
  assert.match(
    skill,
    /Implementation readiness means no unresolved material decision/,
  );
  assert.match(
    skill,
    /earliest real entrypoint\s+with visible success or failure evidence/,
  );
  assert.match(skill, /step-by-step instructions/);
  assert.match(skill, /exhaustive test or edge-case\s+matrices/);
  assert.match(
    skill,
    /Pass\s+implementation considerations\s+to Execute task-locally/,
  );
});

test("OpenSpec Tasks stays a high-level delivery queue", () => {
  const skill = read("skills/openspec-tasks/SKILL.md");
  const plan = read("skills/plan/SKILL.md");

  assert.match(skill, /high-level delivery queue/);
  assert.match(skill, /not an implementation recipe or test\s+log/);
  assert.match(skill, /delivery-boundary justification/);
  assert.match(
    skill,
    /exact\s+files, symbols, commands, exhaustive\s+edge cases/,
  );
  assert.match(skill, /task-local implementation considerations/);
  assert.match(
    skill,
    /real\s+entrypoint and visible success or failure evidence/,
  );
  assert.match(skill, /return the\s+structured blocker to Plan/);
  assert.match(skill, /Do not rewrite `tasks\.md` automatically/);
  assert.match(
    plan,
    /contract-preserving wording,\s+formatting, schema, and validator-conformance repairs automatically/,
  );
  assert.match(
    plan,
    /repairs and reruns\s+the audit without renewed permission/,
  );
  assert.match(
    plan,
    /leaves the requested behavior, work, outputs, acceptance, ownership,\s+and delivery boundaries unchanged/,
  );
  assert.match(
    plan,
    /changing what an action or deliverable\s+means is a material repair/,
  );
});

test("Execute enforces one writer and preserves total Git order", () => {
  const identity: WorktreeIdentity = {
    branch: "feature/modes",
    worktree: "/tmp/modes",
    head: "abc123",
    writer: "writer-1",
    diffFingerprint: "sha256:one",
  };

  assert.doesNotThrow(() => assertWriterOwnership(identity, { ...identity }));
  assert.throws(
    () => assertWriterOwnership(identity, { ...identity, writer: "writer-2" }),
    /worktree_ownership_stale:writer/,
  );
  assert.deepEqual(finalDeliveryOrder(["contract", "runtime"]), [
    "contract",
    "runtime",
  ]);
  assert.throws(
    () => finalDeliveryOrder(["contract", "contract"]),
    /invalid_delivery_unit/,
  );
});

test("Execute blocks POC expansion until the exact architecture checkpoint passes", () => {
  const scenarios =
    fixture<
      Array<{
        id: string;
        checkpoint: PocArchitectureCheckpoint;
        expected: "pass" | string;
      }>
    >("reuse-first");

  for (const scenario of scenarios) {
    const run = () =>
      assertPocExpansionAllowed(scenario.checkpoint, {
        targetBaseSha: "base-a",
        diffFingerprint: "sha256:first-objective-proof",
      });

    if (scenario.expected === "pass") {
      assert.doesNotThrow(run, scenario.id);
    } else {
      assert.throws(run, new RegExp(scenario.expected), scenario.id);
    }
  }

  const execute = read("skills/execute/SKILL.md");
  assert.match(
    execute,
    /Direct Execute without a planning artifact performs the same read-only\s+precedent scan/,
  );
  assert.match(execute, /feature-specific branch inside shared infrastructure/);
  assert.match(execute, /pause when the first stack objective proof exists/);
  assert.match(
    execute,
    /unit\s+1, 2, or 3 after at most two reviewed groundwork units/,
  );
  assert.match(execute, /architecture-affecting change\s+invalidates/);
});

test("mode skills coordinate parallel draft stacks through hosted readiness", () => {
  const plan = read("skills/plan/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const review = read("skills/review/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  assert.match(
    plan,
    /independent, contract-dependent, or implementation-dependent/,
  );
  assert.match(plan, /expected branch\/worktree ownership/);
  assert.match(execute, /one singly owned branch\/worktree per\s+unit/);
  assert.match(
    execute,
    /Eligible owners may implement and fix\s+feedback concurrently/,
  );
  assert.match(execute, /Restack propagation stays ordered/);
  assert.match(review, /complete available feedback surface/);
  assert.match(
    review,
    /read the\s+entire response and all unresolved Nitro-authored discussions/,
  );
  assert.match(finish, /Create every final MR as draft/);
  assert.match(
    finish,
    /technical\s+readiness never authorize changing it from draft to ready/,
  );
  assert.match(finish, /Do not stop at publication/);
  assert.match(finish, /green parent pipeline/);
  assert.match(finish, /repeat without another user prompt/);
  assert.match(
    finish,
    /Report `draft_stack_ready` while every MR\s+remains draft/,
  );
});

test("Review exposes distinct planning, POC, and final reviewer catalogs", () => {
  assert.deepEqual(requiredReviewTypesFor("planning"), [
    "implementation-readiness",
    "edge-cases-and-risk",
    "code-simplifier",
    "refactoring-opportunities",
    "delivery-shape",
  ]);
  assert.deepEqual(requiredReviewTypesFor("poc"), [
    "code-simplifier",
    "code-quality-review",
    "deslop",
    "diff-review",
    "scrutinize",
  ]);
  assert.deepEqual(requiredReviewTypesFor("final_implementation"), [
    "code-simplifier",
    "code-quality-review",
    "deslop",
    "diff-review",
    "scrutinize",
  ]);

  const readiness = reviewerContractFor("implementation-readiness");
  assert.match(readiness.passedWhen, /material contract decision/);
  assert.match(readiness.passedWhen, /rediscovered from the repository/);
  assert.match(readiness.findingWhen, /externally observable behavior/);

  const edgeCases = reviewerContractFor("edge-cases-and-risk");
  assert.match(edgeCases.findingWhen, /durable artifact repair/);
  assert.match(
    edgeCases.findingWhen,
    /task-local implementation consideration/,
  );

  const simplifier = reviewerContractFor("code-simplifier");
  assert.deepEqual(simplifier.targets, [
    "planning",
    "poc",
    "final_implementation",
  ]);
  assert.match(simplifier.evidenceQuestions.join(" "), /planning artifacts/);

  const reviewedPlanSpec = read(
    "openspec/specs/reviewed-plan-artifacts/spec.md",
  );
  assert.match(reviewedPlanSpec, /`code-simplifier`/);
  assert.match(reviewedPlanSpec, /one artifact fingerprint/);
  assert.doesNotMatch(reviewedPlanSpec, /simplification\/scope/);

  for (const activeSpec of [
    "openspec/changes/enforce-explicit-plan-workflow-reviewers/specs/review-first-plan-orchestration/spec.md",
    "openspec/changes/integrate-review-gate-plan-workflows/specs/review-first-plan-orchestration/spec.md",
  ]) {
    const text = read(activeSpec);
    assert.match(text, /`code-simplifier`/);
    assert.match(text, /delivery-shape/);
    assert.match(text, /fallback/);
    assert.doesNotMatch(text, /simplification-and-scope-control/);
  }

  const reviewSkill = read("skills/review/SKILL.md");
  assert.match(reviewSkill, /Planning Artifact Boundary/);
  assert.match(reviewSkill, /task-local implementation consideration/);
  assert.match(reviewSkill, /does not require a prose recipe/);
});

test("every Review catalog entry resolves to a complete reviewer contract", () => {
  assert.doesNotThrow(() => validateReviewerCatalog());

  for (const target of ["planning", "poc", "final_implementation"] as const) {
    for (const id of requiredReviewTypesFor(target)) {
      const contract = reviewerContractFor(id);
      assert.ok(contract.objective.length > 0, id);
      assert.ok(contract.targets.includes(target), `${id}:${target}`);
      assert.ok(contract.evidenceQuestions.length > 0, id);
      assert.match(contract.output, /passed \| finding \| blocked/);
    }
  }
});

test("modes route to bounded specialists without restoring Codex PR feedback", () => {
  const explore = read("skills/explore/SKILL.md");
  const plan = read("skills/plan/SKILL.md");
  const review = read("skills/review/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  assert.match(explore, /Invoke `brainstorming`/);
  assert.match(explore, /Invoke `start-project`/);
  assert.match(plan, /invoke `openspec-tasks` before implementation handoff/);
  assert.match(review, /Use `github-adapter-review`/);
  assert.match(review, /`gitlab-adapter-review`/);
  assert.match(review, /`nitro-review-feedback`/);
  assert.match(review, /`codex-review-feedback` remains retired/);
  assert.match(finish, /invoke\s+`change-request-create`/);
  assert.match(finish, /`github-pr-create` or `glab-mr-create`/);
});

test("Review rejects stale readiness checkpoints and hosted feedback", () => {
  const reviewResults = requiredReviewTypesFor("final_implementation").map(
    (reviewType) => ({
      reviewType,
      execution: "inline" as const,
      executionId: "main-agent-review",
      targetBaseSha: "base-a",
      head: "new",
      status: "passed" as const,
      findings: [],
    }),
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          artifact: "MR !199",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "old",
          diffInspected: true,
          hooksPassed: true,
          requiredSpecialists: [],
          reviewResults,
          provider: "gitlab",
          blockers: [],
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "new",
        },
      ),
    /technical_readiness_stale/,
  );

  const currentCheckpoint = {
    artifact: "MR !199",
    targetBase: "main",
    targetBaseSha: "base-a",
    head: "new",
    diffInspected: true,
    hooksPassed: true,
    requiredSpecialists: [] as string[],
    reviewResults: reviewResults.slice(0, 1),
    provider: "gitlab",
    blockers: [] as string[],
  };
  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(currentCheckpoint, {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "new",
      }),
    /technical_readiness_review_types_missing:code-quality-review,deslop,diff-review,scrutinize/,
  );
  validateTechnicalReadinessCheckpoint(
    {
      ...currentCheckpoint,
      reviewResults,
    },
    {
      target: "final_implementation",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "new",
    },
  );

  const pocCheckpoint = { ...currentCheckpoint, reviewResults };
  validateTechnicalReadinessCheckpoint(pocCheckpoint, {
    target: "poc",
    targetBase: "main",
    targetBaseSha: "base-a",
    head: "new",
  });

  const pocWithSpecialist = {
    ...pocCheckpoint,
    requiredSpecialists: ["security-review"],
  };
  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(pocWithSpecialist, {
        target: "poc",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "new",
      }),
    /technical_readiness_review_types_missing:security-review/,
  );
  validateTechnicalReadinessCheckpoint(
    {
      ...pocWithSpecialist,
      reviewResults: [
        ...reviewResults,
        {
          reviewType: "security-review",
          execution: "subagent" as const,
          executionId: "security-agent",
          targetBaseSha: "base-a",
          head: "new",
          status: "passed",
          findings: [],
        },
      ],
    },
    {
      target: "poc",
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "new",
    },
  );

  assert.throws(
    () =>
      validateTechnicalReadinessCheckpoint(
        {
          ...currentCheckpoint,
          reviewResults,
        },
        {
          target: "final_implementation",
          targetBase: "main",
          targetBaseSha: "base-b",
          head: "new",
        },
      ),
    /technical_readiness_stale/,
  );

  assert.deepEqual(
    normalizeHostedFinding(
      {
        head: "old",
        targetBaseSha: "base-a",
        status: "passed",
        findings: [],
      },
      { head: "new", targetBaseSha: "base-a" },
    ),
    {
      head: "old",
      targetBaseSha: "base-a",
      status: "blocked",
      findings: ["hosted feedback belongs to a stale effective diff"],
    },
  );
  assert.deepEqual(
    normalizeHostedFinding(
      {
        head: "new",
        targetBaseSha: "base-a",
        status: "passed",
        findings: [],
      },
      { head: "new", targetBaseSha: "base-b" },
    ),
    {
      head: "new",
      targetBaseSha: "base-a",
      status: "blocked",
      findings: ["hosted feedback belongs to a stale effective diff"],
    },
  );
});

test("Finish resolves provider precedence and never infers merge from finish", () => {
  assert.equal(
    resolveProvider(
      {},
      { value: "gitlab" },
      { value: "github" },
      { value: "remote" },
    ),
    "gitlab",
  );
  assert.throws(
    () => resolveProvider({ ambiguous: true }, {}, {}, {}),
    /provider_route_ambiguous/,
  );

  assert.deepEqual(terminalAuthority("finish the MR"), {
    publish: true,
    merge: false,
    deploy: false,
    cleanup: false,
  });
  assert.deepEqual(
    terminalAuthority("finish this before the deploy window closes"),
    {
      publish: true,
      merge: false,
      deploy: false,
      cleanup: false,
    },
  );
  assert.equal(terminalAuthority("please deploy this release").deploy, true);
  assert.equal(terminalAuthority("merge when green").merge, true);
  assert.deepEqual(terminalAuthority("proceed to merge"), {
    publish: true,
    merge: true,
    deploy: false,
    cleanup: false,
  });
  assert.deepEqual(terminalAuthority("proceed"), {
    publish: true,
    merge: false,
    deploy: false,
    cleanup: false,
  });
  assert.equal(terminalAuthority("mark the MRs ready").merge, false);
  assert.equal(terminalAuthority("request all reviews").merge, false);
  assert.equal(
    terminalAuthority("we are not ready to proceed to merge").merge,
    false,
  );
  assert.equal(terminalAuthority("should we proceed to merge?").merge, false);
  assert.equal(
    terminalAuthority("what happens if we proceed to merge?").merge,
    false,
  );
  assert.equal(
    terminalAuthority("before we proceed to merge, run the tests").merge,
    false,
  );
  assert.equal(
    terminalAuthority("proceed to merge request review").merge,
    false,
  );
  assert.deepEqual(
    terminalAuthority("do not merge, deploy, publish, or clean up", {
      publish: true,
      merge: true,
      deploy: true,
      cleanup: true,
    }),
    { publish: false, merge: false, deploy: false, cleanup: false },
  );
  assert.equal(
    terminalAuthority("do not open an MR", { publish: true }).publish,
    false,
  );
  assert.equal(
    terminalAuthority("do not push", { publish: true }).publish,
    false,
  );
  assert.equal(
    terminalAuthority("finish without merging", { merge: true }).merge,
    false,
  );
  assert.equal(
    terminalAuthority("do not remove the worktree", { cleanup: true }).cleanup,
    false,
  );
});

test("completed OpenSpec archival is owned by the final lifecycle head", () => {
  const agents = read("instructions/AGENTS.md").replace(/\s+/g, " ");
  const execute = read("skills/execute/SKILL.md").replace(/\s+/g, " ");
  const review = read("skills/review/SKILL.md").replace(/\s+/g, " ");
  const finish = read("skills/finish/SKILL.md").replace(/\s+/g, " ");
  const modes = read("openspec/specs/agent-workflow-modes/spec.md").replace(
    /\s+/g,
    " ",
  );

  assert.match(
    execute,
    /Execute owns the repository transformation that removes the completed change from active discovery/,
  );
  assert.match(
    execute,
    /before the final hook-clean commit and draft publication/,
  );
  assert.match(
    execute,
    /If any reconciled task or requirement is incomplete or unverified, leave the change active/,
  );
  assert.match(
    execute,
    /without inferring the explicit-only `openspec-archive-change` adapter/,
  );
  assert.match(
    review,
    /canonical spec synchronization, absence of the completed change from the active namespace, and its dated archived record on one exact HEAD/,
  );
  assert.match(
    finish,
    /Missing or inconsistent archive state returns to the same Execute owner; Finish does not create it/,
  );
  assert.match(
    agents,
    /Finish requires it for readiness rather than performing archival as cleanup/,
  );
  assert.match(modes, /Completed OpenSpec archival stays in the lifecycle/);
  assert.match(
    modes,
    /prior exact-head review and hosted evidence become stale/,
  );
});
