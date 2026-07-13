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
  baselineFor,
  normalizeHostedFinding,
  reviewerContractFor,
  validatePublicationCheckpoint,
  validateReviewerCatalog,
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
  assert.match(skill, /Reuse And Deviation Contract/);
  assert.match(skill, /inspected precedents and their canonical owners/);
  assert.match(skill, /never a\s+prerequisite for it/);
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
  assert.match(execute, /pause when the first objective proof exists/);
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

test("Review uses distinct planning, POC, and final implementation baselines", () => {
  assert.deepEqual(baselineFor("planning"), [
    "implementation-readiness",
    "edge-cases-and-risk",
    "simplification-and-scope",
    "refactoring-opportunities",
    "delivery-shape",
  ]);
  assert.deepEqual(baselineFor("poc"), [
    "code-simplifier",
    "code-quality-review",
    "deslop",
    "diff-review",
    "scrutinize",
  ]);
  assert.deepEqual(baselineFor("final_implementation"), [
    "code-simplifier",
    "code-quality-review",
    "deslop",
    "diff-review",
    "scrutinize",
  ]);
});

test("every baseline Review lane resolves to a complete reviewer contract", () => {
  assert.doesNotThrow(() => validateReviewerCatalog());

  for (const target of ["planning", "poc", "final_implementation"] as const) {
    for (const id of baselineFor(target)) {
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

test("Review rejects stale checkpoints and hosted feedback", () => {
  const reviewResults = baselineFor("final_implementation").map(
    (reviewer, index) => ({
      reviewer,
      reviewerRunId: `reviewer-${index + 1}`,
      targetBaseSha: "base-a",
      head: "new",
      status: "passed" as const,
      findings: [],
    }),
  );

  assert.throws(
    () =>
      validatePublicationCheckpoint(
        {
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "old",
          diffInspected: true,
          hooksPassed: true,
          requiredSpecialists: [],
          excludedReviewerRunIds: ["writer", "coordinator"],
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
    /publication_checkpoint_stale/,
  );

  const currentCheckpoint = {
    targetBase: "main",
    targetBaseSha: "base-a",
    head: "new",
    diffInspected: true,
    hooksPassed: true,
    requiredSpecialists: [] as string[],
    excludedReviewerRunIds: ["writer", "coordinator"],
    reviewResults: reviewResults.slice(0, 1),
    provider: "gitlab",
    blockers: [] as string[],
  };
  assert.throws(
    () =>
      validatePublicationCheckpoint(currentCheckpoint, {
        target: "final_implementation",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "new",
      }),
    /publication_checkpoint_reviewers_missing:code-quality-review,deslop,diff-review,scrutinize/,
  );
  validatePublicationCheckpoint(
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
  validatePublicationCheckpoint(pocCheckpoint, {
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
      validatePublicationCheckpoint(pocWithSpecialist, {
        target: "poc",
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "new",
      }),
    /publication_checkpoint_reviewers_missing:security-review/,
  );
  validatePublicationCheckpoint(
    {
      ...pocWithSpecialist,
      reviewResults: [
        ...reviewResults,
        {
          reviewer: "security-review",
          reviewerRunId: "security-agent",
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
      validatePublicationCheckpoint(
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
    /publication_checkpoint_stale/,
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
