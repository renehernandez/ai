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

test("tracks two POC units in one draft artifact with latest-head checkpoints", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1", "1.2", "1.3"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1", "2.2", "2.3"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "complete",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "complete",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
        status: "complete",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
        status: "complete",
      },
    ],
  });

  assert.equal(state.pocLoop?.singleDraftArtifact, true);
  assert.equal(
    state.pocLoop?.taskState.authority,
    "contextual_non_authoritative",
  );
  assert.deepEqual(state.pocLoop?.taskState.markedWorkItemIds, [
    "2.1",
    "2.2",
    "2.3",
  ]);
  assert.deepEqual(state.pocLoop?.taskState.nonContextualWorkItemIds, [
    "1.1",
    "1.2",
    "1.3",
  ]);
  assert.deepEqual(state.pocLoop?.feedback.requiredAfter, [
    "material_poc_push",
    "feedback_fix_push",
  ]);
  assert.equal(state.pocLoop?.feedback.pushedHeads.length, 4);
  assert.equal(state.pocLoop?.feedback.checkpoints.length, 4);
  assert.ok(
    state.pocLoop?.feedback.checkpoints.every(
      (checkpoint) =>
        checkpoint.reviewScope === "latest_head" &&
        checkpoint.requestedAfterPush === true,
    ),
  );
  assert.match(state.body, /Latest-head routed feedback/);
  assert.match(state.body, /contextual and non-authoritative/);
  assert.deepEqual(validatePlanPocArtifactState(state), []);
});

test("rejects POC loop task-state and feedback checkpoint drift", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  const drifted = {
    ...state,
    pocLoop: {
      ...state.pocLoop,
      taskState: {
        ...state.pocLoop?.taskState,
        authority: "authoritative",
        markedWorkItemIds: ["1.1", "2.1"],
      },
      feedback: {
        ...state.pocLoop?.feedback,
        checkpoints: [
          {
            unitId: "",
            reason: "material_poc_push",
            headSha: "",
            status: "required",
            reviewScope: "previous_head",
            requestedAfterPush: false,
          },
        ],
      },
    },
  };

  assert.deepEqual(validatePlanPocArtifactState(drifted as typeof state), [
    "POC loop task state must be contextual and non-authoritative",
    "POC loop must mark only contextual work items for the current POC unit",
    "POC loop must not mark non-contextual work items",
    "POC feedback checkpoints require a unitId",
    "POC feedback checkpoints must reference a listed unit",
    "POC feedback checkpoints require a headSha",
    "POC feedback checkpoints must route to latest head",
    "POC feedback checkpoints must be requested after each push",
    "POC feedback checkpoints must match a recorded pushed head",
    "POC loop unit 1 requires one feedback checkpoint for material_poc_push at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "POC loop unit 1 requires one feedback checkpoint for feedback_fix_push at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "POC loop unit 2 requires one feedback checkpoint for material_poc_push at 1111111111111111111111111111111111111111",
    "POC loop unit 2 requires one feedback checkpoint for feedback_fix_push at 2222222222222222222222222222222222222222",
  ]);
});

test("rejects duplicate marked work items and mismatched current unit status", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1", "2.2"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  const drifted = {
    ...state,
    pocLoop: {
      ...state.pocLoop,
      units: [
        {
          id: "1",
          title: "Skill Contract And POC Artifact Rules",
          workItemIds: ["1.1"],
          status: "current",
        },
        {
          id: "2",
          title: "POC Implementation Loop",
          workItemIds: ["2.1", "2.2"],
          status: "completed",
        },
      ],
      taskState: {
        ...state.pocLoop?.taskState,
        markedWorkItemIds: ["2.1", "2.1"],
      },
      feedback: {
        ...state.pocLoop?.feedback,
        checkpoints: state.pocLoop?.feedback.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          status: "complete",
        })),
      },
    },
  };

  assert.deepEqual(validatePlanPocArtifactState(drifted as typeof state), [
    "POC loop must have exactly one current unit matching currentUnitId",
    "POC loop must mark only contextual work items for the current POC unit",
  ]);
});

test("rejects duplicate POC unit ids in drifted loop state", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  const drifted = {
    ...state,
    pocLoop: {
      ...state.pocLoop,
      units: [
        {
          id: "2",
          title: "POC Implementation Loop A",
          workItemIds: ["2.1"],
          status: "current",
        },
        {
          id: "2",
          title: "POC Implementation Loop B",
          workItemIds: ["2.2"],
          status: "completed",
        },
      ],
      feedback: {
        ...state.pocLoop?.feedback,
        pushedHeads: state.pocLoop?.feedback.pushedHeads.map((push) => ({
          ...push,
          unitId: "2",
        })),
        checkpoints: state.pocLoop?.feedback.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          unitId: "2",
        })),
      },
    },
  };

  assert.deepEqual(validatePlanPocArtifactState(drifted as typeof state), [
    "POC loop unit ids must be unique",
  ]);
});

test("rejects work item ids claimed by multiple POC units", () => {
  assert.throws(
    () =>
      buildPlanPocArtifactState({
        changeId: "add-plan-poc-review-rehearsal",
        changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
        host: "gitlab_mr",
        currentPocUnitId: "2",
        pocUnits: [
          {
            id: "1",
            title: "Skill Contract And POC Artifact Rules",
            workItemIds: ["shared-work-item"],
            status: "completed",
          },
          {
            id: "2",
            title: "POC Implementation Loop",
            workItemIds: ["2.1"],
            status: "current",
          },
          {
            id: "3",
            title: "POC Closure",
            workItemIds: ["shared-work-item"],
            status: "pending",
          },
        ],
        feedbackPushedHeads: [
          {
            unitId: "1",
            reason: "material_poc_push",
            headSha: "1111111111111111111111111111111111111111",
          },
          {
            unitId: "2",
            reason: "material_poc_push",
            headSha: "2222222222222222222222222222222222222222",
          },
        ],
        feedbackCheckpoints: [
          {
            unitId: "1",
            reason: "material_poc_push",
            headSha: "1111111111111111111111111111111111111111",
            status: "complete",
          },
          {
            unitId: "2",
            reason: "material_poc_push",
            headSha: "2222222222222222222222222222222222222222",
          },
        ],
      }),
    /POC loop work item ids must be unique/,
  );

  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
      {
        id: "3",
        title: "POC Closure",
        workItemIds: ["3.1"],
        status: "pending",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
        status: "complete",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  const drifted = {
    ...state,
    pocLoop: {
      ...state.pocLoop,
      units: state.pocLoop?.units.map((unit) =>
        unit.id === "3" ? { ...unit, workItemIds: ["1.1"] } : unit,
      ),
    },
  };

  assert.deepEqual(validatePlanPocArtifactState(drifted as typeof state), [
    "POC loop work item ids must belong to exactly one unit",
  ]);
});

test("rejects completed POC unit push evidence without matching checkpoints", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        unitId: "1",
        reason: "feedback_fix_push",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), [
    "POC loop unit 1 requires one feedback checkpoint for material_poc_push at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "POC loop unit 1 requires one feedback checkpoint for feedback_fix_push at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ]);
});

test("rejects feedback checkpoints for unrecorded pushed heads", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "9999999999999999999999999999999999999999",
      },
      {
        unitId: "2",
        reason: "feedback_fix_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), [
    "POC feedback checkpoints must match a recorded pushed head",
    "POC loop unit 2 requires one feedback checkpoint for material_poc_push at 1111111111111111111111111111111111111111",
  ]);
});

test("allows material-only POC units when no feedback-fix push occurred", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), []);
});

test("rejects any pushed head that lacks a matching checkpoint", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "3333333333333333333333333333333333333333",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), [
    "POC loop unit 2 requires one feedback checkpoint for material_poc_push at 3333333333333333333333333333333333333333",
  ]);
});

test("rejects duplicate feedback checkpoints for the same pushed head", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), [
    "POC feedback checkpoints must be unique",
    "POC loop unit 2 requires one feedback checkpoint for material_poc_push at 1111111111111111111111111111111111111111",
  ]);
});

test("rejects pushed-head and checkpoint evidence for pending POC units", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "1",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "current",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "pending",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), [
    "POC feedback pushed heads must not reference pending units",
    "POC feedback checkpoints must not reference pending units",
  ]);
});

test("rejects completed POC units with incomplete feedback checkpoints", () => {
  const state = buildPlanPocArtifactState({
    changeId: "add-plan-poc-review-rehearsal",
    changeRef: "openspec/changes/add-plan-poc-review-rehearsal",
    host: "gitlab_mr",
    currentPocUnitId: "2",
    pocUnits: [
      {
        id: "1",
        title: "Skill Contract And POC Artifact Rules",
        workItemIds: ["1.1"],
        status: "completed",
      },
      {
        id: "2",
        title: "POC Implementation Loop",
        workItemIds: ["2.1"],
        status: "current",
      },
    ],
    feedbackPushedHeads: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
    feedbackCheckpoints: [
      {
        unitId: "1",
        reason: "material_poc_push",
        headSha: "1111111111111111111111111111111111111111",
      },
      {
        unitId: "2",
        reason: "material_poc_push",
        headSha: "2222222222222222222222222222222222222222",
      },
    ],
  });

  assert.deepEqual(validatePlanPocArtifactState(state), [
    "POC loop completed unit 1 requires complete feedback checkpoint for material_poc_push at 1111111111111111111111111111111111111111",
  ]);
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
