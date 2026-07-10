import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  assertWriterOwnership,
  finalDeliveryOrder,
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
  validatePublicationCheckpoint,
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

test("Plan owns mandatory full POC and one final MR per top-level unit", () => {
  const skill = read("skills/plan/SKILL.md");

  assert.match(skill, /Every OpenSpec, without exception/);
  assert.match(skill, /production-complete POC/);
  assert.match(skill, /There is no planning MR/);
  assert.match(skill, /one final MR per top-level delivery unit/);
  assert.match(skill, /Do not start another POC automatically/);
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

test("Review uses target-specific four-lane baselines", () => {
  assert.deepEqual(baselineFor("planning"), [
    "implementation-readiness",
    "edge-cases-and-risk",
    "simplification-and-scope",
    "refactoring-opportunities",
  ]);
  assert.deepEqual(baselineFor("poc"), [
    "correctness",
    "regression-risk",
    "maintainability",
    "verification-quality",
  ]);
  assert.deepEqual(baselineFor("final_implementation"), baselineFor("poc"));
});

test("Review rejects stale checkpoints and hosted feedback", () => {
  assert.throws(
    () =>
      validatePublicationCheckpoint(
        {
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "old",
          diffInspected: true,
          hooksPassed: true,
          reviewersPassed: [...baselineFor("final_implementation")],
          provider: "gitlab",
          blockers: [],
        },
        {
          targetBase: "main",
          targetBaseSha: "base-a",
          head: "new",
          requiredReviewers: baselineFor("final_implementation"),
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
    reviewersPassed: ["correctness"],
    provider: "gitlab",
    blockers: [] as string[],
  };
  assert.throws(
    () =>
      validatePublicationCheckpoint(currentCheckpoint, {
        targetBase: "main",
        targetBaseSha: "base-a",
        head: "new",
        requiredReviewers: baselineFor("final_implementation"),
      }),
    /publication_checkpoint_reviewers_missing:regression-risk,maintainability,verification-quality/,
  );
  validatePublicationCheckpoint(
    {
      ...currentCheckpoint,
      reviewersPassed: [...baselineFor("final_implementation")],
    },
    {
      targetBase: "main",
      targetBaseSha: "base-a",
      head: "new",
      requiredReviewers: baselineFor("final_implementation"),
    },
  );

  assert.throws(
    () =>
      validatePublicationCheckpoint(
        {
          ...currentCheckpoint,
          reviewersPassed: [...baselineFor("final_implementation")],
        },
        {
          targetBase: "main",
          targetBaseSha: "base-b",
          head: "new",
          requiredReviewers: baselineFor("final_implementation"),
        },
      ),
    /publication_checkpoint_stale/,
  );

  assert.deepEqual(
    normalizeHostedFinding(
      { head: "old", status: "passed", findings: [] },
      "new",
    ),
    {
      head: "old",
      status: "blocked",
      findings: ["hosted feedback belongs to a stale head"],
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
