import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildPlanPocArtifactState,
  validatePlanPocArtifactState,
} from "../../skills/plan-poc/scripts/plan-poc.ts";

test("builds a draft-only POC artifact with OpenSpec comparison context", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
  });

  assert.equal(state.draft, true);
  assert.equal(state.title, "POC: add-plan-poc-review-rehearsal");
  assert.equal(state.validation.openSpecChangeRequired, true);
  assert.equal(state.validation.taskShapeAuditRequired, true);
  assert.equal(state.reviewOnly, true);
  assert.equal(state.intendedToMerge, false);
  assert.equal(state.includesOpenSpecFiles, true);
  assert.equal(state.includesImplementationDiff, true);
  assert.equal(state.finalDelivery.deliverySource, "revised_openspec");
  assert.equal(state.finalDelivery.pocCommitsReused, false);
  assert.deepEqual(validatePlanPocArtifactState(state), []);
  assert.match(state.body, /review-only implementation rehearsal/);
  assert.match(state.body, /not intended to merge/);
  assert.match(state.body, /Strict OpenSpec validation and task-shape audit/);
  assert.match(state.body, /OpenSpec files are included as comparison context/);
  assert.match(state.body, /POC commits must not be reused/);
});

test("rejects mergeable or final-delivery POC artifact drift", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "github_pr",
  });

  const drifted = {
    ...state,
    draft: false,
    title: "Add plan-poc",
    validation: {
      openSpecChangeRequired: false,
      taskShapeAuditRequired: false,
      performedBy: "nobody",
    },
    intendedToMerge: true,
    finalDelivery: {
      deliverySource: "poc_commits",
      pocCommitsReused: true,
    },
    body: "Ready to merge.",
  };

  assert.deepEqual(validatePlanPocArtifactState(drifted as typeof state), [
    "POC artifact must be draft",
    "POC artifact title must start with POC:",
    "POC artifact must require OpenSpec validation and task audit",
    "POC artifact must be marked as review-only",
    "POC artifact must state that it is not intended to merge",
    "POC artifact body must describe OpenSpec comparison context",
    "final delivery source must be revised_openspec",
    "POC commits must not be reused for final delivery",
    "POC artifact body must reject POC commit reuse",
  ]);
});

test("rejects invalid OpenSpec reference shape before rendering POC output", () => {
  assert.throws(
    () =>
      buildPlanPocArtifactState({
        changeId: "add-plan-poc-review-rehearsal",
        changeRef: "docs/not-openspec",
        host: "gitlab_mr",
      }),
    /changeRef must be openspec\/changes\/add-plan-poc-review-rehearsal/,
  );

  assert.throws(
    () =>
      buildPlanPocArtifactState({
        changeId: "Add Plan Poc",
        changeRef: "openspec/changes/Add Plan Poc",
        host: "gitlab_mr",
      }),
    /changeId must be kebab-case/,
  );
});

test("blank custom titles fall back to the OpenSpec change id", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    title: "   ",
  });

  assert.equal(state.title, "POC: add-plan-poc-review-rehearsal");
  assert.deepEqual(validatePlanPocArtifactState(state), []);
});

test("plan-poc helper CLI reports draft-only POC output for a sample OpenSpec change", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-poc/scripts/plan-poc.ts",
      "--change-id",
      "add-plan-poc-review-rehearsal",
      "--change-ref",
      "openspec/changes/add-plan-poc-review-rehearsal",
      "--host",
      "gitlab_mr",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.draft, true);
  assert.equal(output.title, "POC: add-plan-poc-review-rehearsal");
  assert.equal(output.includesOpenSpecFiles, true);
  assert.equal(output.intendedToMerge, false);
  assert.equal(output.finalDelivery.pocCommitsReused, false);
});
