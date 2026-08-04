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
  mergeArtifactScopesAfterEffectiveDiffChange,
  resolveProvider,
  terminalAuthority,
} from "../../skills/finish/scripts/finish-contract.ts";
import {
  type PlanContract,
  routeWorkDisposition,
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

  assert.match(
    skill,
    /^allowed-tools: Read, Glob, Grep, Task, AskUserQuestion$/m,
  );
  assert.doesNotMatch(skill, /^allowed-tools:.*(?:Write|Edit|Bash)/m);
  assert.match(skill, /investigation-and-implementation\.md/);
  assert.match(skill, /propose `Plan`/i);
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
  assert.match(rules, /infer later work authority from the proposal/);
  assert.match(rules, /not from prescribed confirmation words/);
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
    /Continue\s+across required Plan, Execute, Review, and Finish handoffs to the accepted\s+checkpoint without renewed permission/,
  );
  assert.match(
    rules,
    /Contract-preserving wording, formatting, validation, test, CI, review, and\s+schema repairs return automatically/,
  );
  assert.match(
    rules,
    /response clearly accepts a recommendation bundle, accept the bundle\s+it refers to/,
  );
  assert.match(
    rules,
    /Existing\s+authenticated commands need no renewed approval, while credential entry or\s+a new credential grant remains a human action/,
  );
  assert.match(explore, /`brainstorming`[^.]*by default/i);
});

test("abandoned or superseded work returns to Plan without silent completion", () => {
  assert.equal(routeWorkDisposition("abandoned"), "plan_disposition");
  assert.equal(routeWorkDisposition("superseded"), "plan_disposition");
  assert.equal(routeWorkDisposition("completed"), "complete");
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
  assert.deepEqual(
    terminalAuthority(
      narrow.request,
      {},
      {
        mergeArtifacts: {
          candidateArtifactScopes: ["MR !219"],
          currentArtifactScope: "MR !219",
        },
      },
    ),
    { ...narrow.expected, mergeArtifactScopes: ["MR !219"] },
  );
});

test("Plan keeps atomic delivery in one change set and rehearses OpenSpec", () => {
  const skill = read("skills/plan/SKILL.md");

  assert.match(
    skill,
    /Every OpenSpec requires one production-complete disposable POC/,
  );
  assert.match(skill, /one plan-plus-implementation change set/);
  assert.match(skill, /one top-level heading maps to one final MR/i);
  assert.match(skill, /safe merged intermediate state/);
  assert.match(skill, /authoritative final-topology gate/);
  assert.match(skill, /accepted POC head/);
  assert.match(skill, /reconciled OpenSpec fingerprint/);
  assert.match(skill, /planning checkpoint/);
  assert.match(skill, /reuse and deviation contract/i);
  assert.match(skill, /canonical delivery budgets/);
  assert.match(skill, /implementation mechanics task-local/);
});

test("OpenSpec Tasks stays a high-level delivery queue", () => {
  const skill = read("skills/openspec-tasks/SKILL.md");
  const plan = read("skills/plan/SKILL.md");

  assert.match(skill, /audits the delivery queue/i);
  assert.match(skill, /does not create a parallel slice plan/i);
  assert.match(skill, /files, symbols, commands/);
  assert.match(skill, /task-local/);
  assert.match(skill, /visible success or failure evidence/);
  assert.match(skill, /structured disposition/);
  assert.match(skill, /does not rewrite `tasks\.md`/i);
  assert.match(plan, /contract-preserving failure and rerun the audit/);
  assert.match(plan, /material correction returns\s+to conversation/);
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

test("Execute gates POC expansion without turning the architecture checkpoint into renewed permission", () => {
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
  assert.match(execute, /reuse and deviation contract/);
  assert.match(execute, /branches\s+inside shared infrastructure/);
  assert.match(execute, /pause at first objective proof/);
  assert.match(
    execute,
    /unit 1, 2, or 3 after no\s+more than two groundwork units/,
  );
  assert.match(execute, /architecture-affecting\s+change blocks expansion/);
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
  assert.match(reviewSkill, /Planning and POC Boundaries/);
  assert.match(reviewSkill, /task-local implementation consideration/);
  assert.match(reviewSkill, /Files, symbols, commands/);
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

  assert.match(explore, /`brainstorming`/);
  assert.match(explore, /`start-project`/);
  assert.match(plan, /invoke `openspec-tasks`/);
  assert.match(review, /`github-adapter-review`/);
  assert.match(review, /`gitlab-adapter-review`/);
  assert.match(review, /`nitro-review-feedback`/);
  assert.match(review, /Codex-authored PR feedback remains retired/);
  assert.match(finish, /invoke\s+`change-request-create`/);
  assert.match(finish, /only selectable\s+description and publication owner/);
  assert.match(finish, /internal GitHub or GitLab mechanics/);
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
    deliveryBudget: {
      artifact: "MR !199",
      sourceHead: "new",
      targetBaseSha: "base-a",
      fileCount: 8,
      additions: 300,
      deletions: 100,
    },
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
  const singleMr = {
    mergeArtifacts: {
      candidateArtifactScopes: ["MR !219"],
      currentArtifactScope: "MR !219",
    },
  };
  assert.deepEqual(terminalAuthority("merge when green", {}, singleMr), {
    publish: false,
    merge: true,
    deploy: false,
    cleanup: false,
    mergeArtifactScopes: ["MR !219"],
  });
  assert.deepEqual(terminalAuthority("proceed to merge", {}, singleMr), {
    publish: true,
    merge: true,
    deploy: false,
    cleanup: false,
    mergeArtifactScopes: ["MR !219"],
  });
  assert.equal(terminalAuthority("merge when green").merge, false);
  assert.deepEqual(terminalAuthority("proceed"), {
    publish: true,
    merge: false,
    deploy: false,
    cleanup: false,
  });
  for (const assent of ["yes", "agreed", "proceed"]) {
    assert.deepEqual(
      terminalAuthority(
        assent,
        {},
        {
          pendingMerge: {
            artifactScopes: ["MR !219"],
            candidateArtifactScopes: ["MR !219"],
            contextuallyAccepted: true,
            immediatelyPreceding: true,
            solePendingAction: true,
            awaitingApproval: true,
          },
        },
      ),
      {
        publish: assent === "proceed",
        merge: true,
        deploy: false,
        cleanup: false,
        mergeArtifactScopes: ["MR !219"],
      },
    );
  }
  for (const pendingMerge of [
    {
      artifactScopes: ["MR !219"],
      candidateArtifactScopes: ["MR !219"],
      contextuallyAccepted: true,
      immediatelyPreceding: false,
      solePendingAction: true,
      awaitingApproval: true,
    },
    {
      artifactScopes: ["MR !219"],
      candidateArtifactScopes: ["MR !219"],
      contextuallyAccepted: true,
      immediatelyPreceding: true,
      solePendingAction: false,
      awaitingApproval: true,
    },
    {
      artifactScopes: [],
      candidateArtifactScopes: ["MR !219"],
      contextuallyAccepted: true,
      immediatelyPreceding: true,
      solePendingAction: true,
      awaitingApproval: true,
    },
    {
      artifactScopes: ["MR !219"],
      candidateArtifactScopes: ["MR !219"],
      contextuallyAccepted: true,
      immediatelyPreceding: true,
      solePendingAction: true,
      awaitingApproval: false,
    },
    {
      artifactScopes: ["MR !219"],
      candidateArtifactScopes: ["MR !219"],
      contextuallyAccepted: false,
      immediatelyPreceding: true,
      solePendingAction: true,
      awaitingApproval: true,
    },
    {
      artifactScopes: ["MR !219", "MR !220"],
      candidateArtifactScopes: ["MR !219", "MR !220"],
      contextuallyAccepted: true,
      immediatelyPreceding: true,
      solePendingAction: true,
      awaitingApproval: true,
    },
    {
      artifactScopes: ["MR !219"],
      candidateArtifactScopes: ["MR !220"],
      contextuallyAccepted: true,
      immediatelyPreceding: true,
      solePendingAction: true,
      awaitingApproval: true,
    },
  ]) {
    assert.equal(
      terminalAuthority("proceed", {}, { pendingMerge }).merge,
      false,
    );
  }
  assert.deepEqual(
    terminalAuthority(
      "proceed but do not merge",
      {},
      {
        pendingMerge: {
          artifactScopes: ["MR !219"],
          candidateArtifactScopes: ["MR !219"],
          contextuallyAccepted: true,
          immediatelyPreceding: true,
          solePendingAction: true,
          awaitingApproval: true,
        },
      },
    ),
    { publish: true, merge: false, deploy: false, cleanup: false },
  );
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
  assert.equal(terminalAuthority("finish", { merge: true }).merge, false);
  assert.deepEqual(
    terminalAuthority("finish", {
      merge: true,
      mergeArtifactScopes: ["MR !219"],
    }).mergeArtifactScopes,
    ["MR !219"],
  );
  const stackCandidates = ["MR !219", "MR !220"];
  assert.deepEqual(
    terminalAuthority(
      "merge the selected MRs",
      {},
      {
        mergeArtifacts: {
          candidateArtifactScopes: stackCandidates,
          selectedArtifactScopes: stackCandidates,
          userAuthoredAggregateScope: true,
        },
      },
    ).mergeArtifactScopes,
    stackCandidates,
  );
  assert.equal(
    terminalAuthority(
      "merge the selected MRs",
      {},
      {
        mergeArtifacts: {
          candidateArtifactScopes: stackCandidates,
          selectedArtifactScopes: stackCandidates,
        },
      },
    ).merge,
    false,
  );
  assert.equal(
    terminalAuthority(
      "merge MR !999",
      {},
      {
        mergeArtifacts: {
          candidateArtifactScopes: stackCandidates,
          selectedArtifactScopes: ["MR !999"],
        },
      },
    ).merge,
    false,
  );
  assert.deepEqual(
    mergeArtifactScopesAfterEffectiveDiffChange(
      stackCandidates,
      stackCandidates,
      { classification: "patch-equivalent" },
    ),
    stackCandidates,
  );
  assert.deepEqual(
    mergeArtifactScopesAfterEffectiveDiffChange(
      stackCandidates,
      stackCandidates,
      { classification: "material" },
    ),
    [],
  );
  assert.throws(
    () =>
      mergeArtifactScopesAfterEffectiveDiffChange(
        ["MR !999"],
        stackCandidates,
        { classification: "patch-equivalent" },
      ),
    /merge_authority_scope_unknown/,
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

  assert.match(execute, /last final unit/);
  assert.match(execute, /canonical specs/);
  assert.match(execute, /dated archive/);
  assert.match(execute, /before the final hook-clean commit/);
  assert.match(execute, /incomplete or unverified work active/);
  assert.match(execute, /explicit-only `openspec-archive-change` adapter/);
  assert.match(
    review,
    /canonical specs, removal from active discovery, and the dated archive on the same exact HEAD/,
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
