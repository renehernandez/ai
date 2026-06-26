#!/usr/bin/env tsx

export type PlanPocArtifactHost = "gitlab_mr" | "github_pr";

export type PlanPocArtifactInput = {
  changeId: string;
  changeRef: string;
  host: PlanPocArtifactHost;
  title?: string;
  pocUnits?: PlanPocUnitInput[];
  currentPocUnitId?: string;
  feedbackPushedHeads?: PlanPocFeedbackPushedHeadInput[];
  feedbackCheckpoints?: PlanPocFeedbackCheckpointInput[];
  learningSummary?: PlanPocLearningSummaryInput;
};

export type PlanPocUnitStatus = "pending" | "current" | "completed";

export type PlanPocUnitInput = {
  id: string;
  title: string;
  workItemIds: string[];
  status: PlanPocUnitStatus;
};

export type PlanPocFeedbackReason = "material_poc_push" | "feedback_fix_push";

export type PlanPocFeedbackPushedHeadInput = {
  unitId: string;
  reason: PlanPocFeedbackReason;
  headSha: string;
};

export type PlanPocFeedbackCheckpointInput = {
  unitId: string;
  reason: PlanPocFeedbackReason;
  headSha: string;
  status?: "required" | "complete";
};

export type PlanPocClosureDecision = "good_enough" | "abandoned";

export type PlanPocLearningSummaryInput = {
  decision: PlanPocClosureDecision;
  deliverySource: "revised_openspec";
  pocCommitsReused: false;
  specCorrections: string[];
  implementationNotes: string[];
  reviewerDispositions: string[];
  unresolvedLearnings: string[];
  followUpDecisions: string[];
};

export type PlanPocLearningSummary = PlanPocLearningSummaryInput & {
  kind: "poc_learning_summary";
  artifactClosedUnmerged: true;
  private: true;
  committedToRepo: false;
};

export type PlanPocLoopState = {
  singleDraftArtifact: true;
  units: PlanPocUnitInput[];
  taskState: {
    currentUnitId: string;
    authority: "contextual_non_authoritative";
    contextualWorkItemIds: string[];
    markedWorkItemIds: string[];
    nonContextualWorkItemIds: string[];
  };
  feedback: {
    requiredAfter: PlanPocFeedbackReason[];
    pushedHeads: PlanPocFeedbackPushedHeadInput[];
    checkpoints: Array<
      Required<PlanPocFeedbackCheckpointInput> & {
        reviewScope: "latest_head";
        requestedAfterPush: true;
      }
    >;
  };
};

export type PlanPocArtifactState = {
  kind: "plan_poc_artifact";
  changeId: string;
  changeRef: string;
  host: PlanPocArtifactHost;
  validation: {
    openSpecChangeRequired: true;
    taskShapeAuditRequired: true;
    performedBy: "plan-poc workflow before implementation";
  };
  draft: true;
  title: string;
  reviewOnly: true;
  intendedToMerge: false;
  includesOpenSpecFiles: true;
  includesImplementationDiff: true;
  runtimeRoute: {
    lane: "poc_rehearsal";
    optInOnly: true;
    mergeableDelivery: false;
    stackReadyEligible: false;
    finalImplementationEntry: "revised_openspec_plan_orchestrator";
  };
  finalDelivery: {
    deliverySource: "revised_openspec";
    pocCommitsReused: false;
  };
  pocLoop?: PlanPocLoopState;
  pocLearningSummary?: PlanPocLearningSummary;
  body: string;
};

const HOSTS = new Set<PlanPocArtifactHost>(["gitlab_mr", "github_pr"]);
const CHANGE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function buildPlanPocArtifactState(
  input: PlanPocArtifactInput,
): PlanPocArtifactState {
  const changeId = input.changeId.trim();
  const changeRef = input.changeRef.trim();
  const host = input.host;

  if (!changeId) {
    throw new Error("changeId is required");
  }

  if (!CHANGE_ID_PATTERN.test(changeId)) {
    throw new Error("changeId must be kebab-case");
  }

  if (!changeRef) {
    throw new Error("changeRef is required");
  }

  const expectedChangeRef = `openspec/changes/${changeId}`;
  if (changeRef !== expectedChangeRef) {
    throw new Error(`changeRef must be ${expectedChangeRef}`);
  }

  if (!HOSTS.has(host)) {
    throw new Error(`unsupported POC artifact host: ${host}`);
  }

  const title = normalizePocTitle(input.title, changeId);
  const pocLoop = buildPocLoopState(input);
  const pocLearningSummary = buildLearningSummary(input.learningSummary);
  const bodyParts = [
    "## POC Review",
    "",
    "This draft artifact is a review-only implementation rehearsal.",
    "It is not intended to merge.",
    "",
    "## OpenSpec Context",
    "",
    `OpenSpec change: ${changeRef}`,
    "Strict OpenSpec validation and task-shape audit are required before POC implementation.",
    "The OpenSpec files are included as comparison context for reviewers.",
    "",
    "## Implementation",
    "",
    "This artifact includes the implementation diff for the rehearsal.",
  ];

  if (pocLoop) {
    bodyParts.push(
      "",
      "## POC Implementation Loop",
      "",
      "Task-state updates mark only contextual work items for the current POC unit.",
      "POC task state is contextual and non-authoritative.",
      "Latest-head routed feedback is required after material POC pushes and feedback-fix pushes.",
      "Multiple POC units may complete in the same draft artifact while reviewer checkpoints remain tied to each pushed head.",
    );
  }

  if (pocLearningSummary) {
    bodyParts.push(
      "",
      "## POC Closure",
      "",
      "Close the draft artifact unmerged before final delivery.",
      "Emit a private poc_learning_summary for later OpenSpec revision.",
      "Do not commit the learning summary to the repo by default.",
    );
  }

  const body = [
    ...bodyParts,
    "",
    "## Final Delivery Boundary",
    "",
    "Final delivery must come from a revised OpenSpec.",
    "POC commits must not be reused as final implementation commits.",
    "Final implementation must re-enter plan-orchestrator from that revised OpenSpec.",
  ].join("\n");

  return {
    kind: "plan_poc_artifact",
    changeId,
    changeRef,
    host,
    validation: {
      openSpecChangeRequired: true,
      taskShapeAuditRequired: true,
      performedBy: "plan-poc workflow before implementation",
    },
    draft: true,
    title,
    reviewOnly: true,
    intendedToMerge: false,
    includesOpenSpecFiles: true,
    includesImplementationDiff: true,
    runtimeRoute: {
      lane: "poc_rehearsal",
      optInOnly: true,
      mergeableDelivery: false,
      stackReadyEligible: false,
      finalImplementationEntry: "revised_openspec_plan_orchestrator",
    },
    finalDelivery: {
      deliverySource: "revised_openspec",
      pocCommitsReused: false,
    },
    ...(pocLoop ? { pocLoop } : {}),
    ...(pocLearningSummary ? { pocLearningSummary } : {}),
    body,
  };
}

export function validatePlanPocArtifactState(
  state: PlanPocArtifactState,
): string[] {
  const errors: string[] = [];

  if (state.draft !== true) {
    errors.push("POC artifact must be draft");
  }

  if (!state.title.startsWith("POC:")) {
    errors.push("POC artifact title must start with POC:");
  }

  if (state.title.trim() === "POC:") {
    errors.push("POC artifact title must include a title after POC:");
  }

  if (
    state.validation.openSpecChangeRequired !== true ||
    state.validation.taskShapeAuditRequired !== true
  ) {
    errors.push("POC artifact must require OpenSpec validation and task audit");
  }

  if (state.reviewOnly !== true || !includes(state.body, "review-only")) {
    errors.push("POC artifact must be marked as review-only");
  }

  if (
    state.intendedToMerge !== false ||
    !includes(state.body, "not intended to merge")
  ) {
    errors.push("POC artifact must state that it is not intended to merge");
  }

  if (state.includesOpenSpecFiles !== true) {
    errors.push("POC artifact must include OpenSpec files");
  }

  if (
    !includes(state.body, "OpenSpec files are included as comparison context")
  ) {
    errors.push("POC artifact body must describe OpenSpec comparison context");
  }

  if (state.includesImplementationDiff !== true) {
    errors.push("POC artifact must include the implementation diff");
  }

  if (
    state.runtimeRoute?.lane !== "poc_rehearsal" ||
    state.runtimeRoute?.optInOnly !== true
  ) {
    errors.push("POC runtime route must stay opt-in poc_rehearsal");
  }

  if (
    state.runtimeRoute?.mergeableDelivery !== false ||
    state.runtimeRoute?.stackReadyEligible !== false
  ) {
    errors.push(
      "POC runtime route must not be normal mergeable stack delivery",
    );
  }

  if (
    state.runtimeRoute?.finalImplementationEntry !==
    "revised_openspec_plan_orchestrator"
  ) {
    errors.push(
      "POC final implementation must re-enter plan-orchestrator from revised OpenSpec",
    );
  }

  if (!includes(state.body, "re-enter plan-orchestrator")) {
    errors.push(
      "POC artifact body must route final implementation through plan-orchestrator",
    );
  }

  if (state.finalDelivery.deliverySource !== "revised_openspec") {
    errors.push("final delivery source must be revised_openspec");
  }

  if (state.finalDelivery.pocCommitsReused !== false) {
    errors.push("POC commits must not be reused for final delivery");
  }

  if (!includes(state.body, "POC commits must not be reused")) {
    errors.push("POC artifact body must reject POC commit reuse");
  }

  if (state.pocLoop) {
    errors.push(...validatePocLoopState(state.pocLoop, state.body));
  }

  if (state.pocLearningSummary) {
    errors.push(
      ...validateLearningSummary(state.pocLearningSummary, state.body),
    );
  }

  return errors;
}

function buildLearningSummary(
  input: PlanPocLearningSummaryInput | undefined,
): PlanPocLearningSummary | undefined {
  if (!input) {
    return undefined;
  }

  return {
    kind: "poc_learning_summary",
    decision: input.decision,
    artifactClosedUnmerged: true,
    private: true,
    committedToRepo: false,
    deliverySource: input.deliverySource,
    pocCommitsReused: input.pocCommitsReused,
    specCorrections: [...input.specCorrections],
    implementationNotes: [...input.implementationNotes],
    reviewerDispositions: [...input.reviewerDispositions],
    unresolvedLearnings: [...input.unresolvedLearnings],
    followUpDecisions: [...input.followUpDecisions],
  };
}

function validateLearningSummary(
  summary: PlanPocLearningSummary,
  body: string,
): string[] {
  const errors: string[] = [];

  if (summary.kind !== "poc_learning_summary") {
    errors.push("POC learning summary kind must be poc_learning_summary");
  }

  if (!["good_enough", "abandoned"].includes(summary.decision)) {
    errors.push(
      "POC learning summary decision must be good_enough or abandoned",
    );
  }

  if (summary.artifactClosedUnmerged !== true) {
    errors.push("POC learning summary must close the draft artifact unmerged");
  }

  if (summary.private !== true || summary.committedToRepo !== false) {
    errors.push("POC learning summary must remain private by default");
  }

  if (summary.deliverySource !== "revised_openspec") {
    errors.push(
      "POC learning summary delivery_source must be revised_openspec",
    );
  }

  if (summary.pocCommitsReused !== false) {
    errors.push("POC learning summary poc_commits_reused must be false");
  }

  for (const field of [
    "specCorrections",
    "implementationNotes",
    "reviewerDispositions",
    "unresolvedLearnings",
    "followUpDecisions",
  ] satisfies Array<keyof PlanPocLearningSummary>) {
    if (!Array.isArray(summary[field])) {
      errors.push(`POC learning summary ${field} must be an array`);
    }
  }

  if (!includes(body, "Close the draft artifact unmerged")) {
    errors.push("POC artifact body must describe unmerged POC closure");
  }

  if (!includes(body, "private poc_learning_summary")) {
    errors.push("POC artifact body must describe private learning summary");
  }

  return errors;
}

function buildPocLoopState(
  input: PlanPocArtifactInput,
): PlanPocLoopState | undefined {
  if (
    !input.pocUnits?.length &&
    !input.currentPocUnitId &&
    !input.feedbackPushedHeads?.length &&
    !input.feedbackCheckpoints?.length
  ) {
    return undefined;
  }

  const units = (input.pocUnits ?? []).map((unit) => ({
    id: unit.id.trim(),
    title: unit.title.trim(),
    workItemIds: unit.workItemIds.map((id) => id.trim()).filter(Boolean),
    status: unit.status,
  }));
  const currentUnitId = input.currentPocUnitId?.trim() ?? "";
  const currentUnit = units.find((unit) => unit.id === currentUnitId);
  const currentUnits = units.filter((unit) => unit.status === "current");

  if (units.length === 0) {
    throw new Error("pocUnits are required when POC loop state is provided");
  }

  if (!currentUnitId) {
    throw new Error("currentPocUnitId is required for POC loop state");
  }

  if (!currentUnit) {
    throw new Error(
      `currentPocUnitId must reference a POC unit: ${currentUnitId}`,
    );
  }

  assertUnique(
    units.map((unit) => unit.id),
    "POC unit ids",
  );
  for (const unit of units) {
    if (!unit.id || !unit.title || unit.workItemIds.length === 0) {
      throw new Error("POC units require id, title, and workItemIds");
    }
    assertUnique(unit.workItemIds, `POC unit ${unit.id} work item ids`);
  }
  assertUnique(
    units.flatMap((unit) => unit.workItemIds),
    "POC loop work item ids",
  );

  if (
    currentUnits.length !== 1 ||
    currentUnits.some((unit) => unit.id !== currentUnitId)
  ) {
    throw new Error("exactly one current POC unit must match currentPocUnitId");
  }

  const contextualWorkItemIds = [...currentUnit.workItemIds];
  const markedWorkItemIds = [...contextualWorkItemIds];
  const nonContextualWorkItemIds = units
    .filter((unit) => unit.id !== currentUnitId)
    .flatMap((unit) => unit.workItemIds);
  const pushedHeads = (input.feedbackPushedHeads ?? []).map((push) => ({
    unitId: push.unitId.trim(),
    reason: push.reason,
    headSha: push.headSha.trim(),
  }));
  const checkpoints = (input.feedbackCheckpoints ?? []).map((checkpoint) => ({
    unitId: checkpoint.unitId.trim(),
    reason: checkpoint.reason,
    headSha: checkpoint.headSha.trim(),
    status: checkpoint.status ?? "required",
    reviewScope: "latest_head" as const,
    requestedAfterPush: true as const,
  }));

  return {
    singleDraftArtifact: true,
    units,
    taskState: {
      currentUnitId,
      authority: "contextual_non_authoritative",
      contextualWorkItemIds,
      markedWorkItemIds,
      nonContextualWorkItemIds,
    },
    feedback: {
      requiredAfter: ["material_poc_push", "feedback_fix_push"],
      pushedHeads,
      checkpoints,
    },
  };
}

function validatePocLoopState(loop: PlanPocLoopState, body: string): string[] {
  const errors: string[] = [];

  if (loop.singleDraftArtifact !== true) {
    errors.push("POC loop must use one draft artifact");
  }

  const currentUnit = loop.units.find(
    (unit) => unit.id === loop.taskState.currentUnitId,
  );
  if (!currentUnit) {
    errors.push("POC loop current unit must reference a listed unit");
  }

  if (hasDuplicates(loop.units.map((unit) => unit.id))) {
    errors.push("POC loop unit ids must be unique");
  }

  for (const unit of loop.units) {
    if (hasDuplicates(unit.workItemIds)) {
      errors.push(`POC loop unit ${unit.id} work item ids must be unique`);
    }
  }

  if (hasDuplicates(loop.units.flatMap((unit) => unit.workItemIds))) {
    errors.push("POC loop work item ids must belong to exactly one unit");
  }

  if (loop.taskState.authority !== "contextual_non_authoritative") {
    errors.push("POC loop task state must be contextual and non-authoritative");
  }

  const currentUnits = loop.units.filter((unit) => unit.status === "current");
  if (
    currentUnits.length !== 1 ||
    currentUnits.some((unit) => unit.id !== loop.taskState.currentUnitId)
  ) {
    errors.push(
      "POC loop must have exactly one current unit matching currentUnitId",
    );
  }

  if (
    !sameItems(
      loop.taskState.contextualWorkItemIds,
      currentUnit?.workItemIds ?? [],
    ) ||
    !sameItems(loop.taskState.markedWorkItemIds, currentUnit?.workItemIds ?? [])
  ) {
    errors.push(
      "POC loop must mark only contextual work items for the current POC unit",
    );
  }

  if (
    loop.taskState.markedWorkItemIds.some((id) =>
      loop.taskState.nonContextualWorkItemIds.includes(id),
    )
  ) {
    errors.push("POC loop must not mark non-contextual work items");
  }

  for (const reason of [
    "material_poc_push",
    "feedback_fix_push",
  ] satisfies PlanPocFeedbackReason[]) {
    if (!loop.feedback.requiredAfter.includes(reason)) {
      errors.push(`POC loop must require feedback after ${reason}`);
    }
  }

  const activeUnits = loop.units.filter((unit) =>
    ["completed", "current"].includes(unit.status),
  );

  for (const push of loop.feedback.pushedHeads) {
    if (!push.unitId) {
      errors.push("POC feedback pushed heads require a unitId");
    }
    const unit = loop.units.find((unit) => unit.id === push.unitId);
    if (!unit) {
      errors.push("POC feedback pushed heads must reference a listed unit");
    } else if (unit.status === "pending") {
      errors.push("POC feedback pushed heads must not reference pending units");
    }
    if (!push.headSha) {
      errors.push("POC feedback pushed heads require a headSha");
    }
  }

  if (hasDuplicates(loop.feedback.pushedHeads.map(pushKey))) {
    errors.push("POC feedback pushed heads must be unique");
  }

  if (hasDuplicates(loop.feedback.checkpoints.map(pushKey))) {
    errors.push("POC feedback checkpoints must be unique");
  }

  for (const checkpoint of loop.feedback.checkpoints) {
    if (!checkpoint.unitId) {
      errors.push("POC feedback checkpoints require a unitId");
    }
    const unit = loop.units.find((unit) => unit.id === checkpoint.unitId);
    if (!unit) {
      errors.push("POC feedback checkpoints must reference a listed unit");
    } else if (unit.status === "pending") {
      errors.push("POC feedback checkpoints must not reference pending units");
    }
    if (!checkpoint.headSha) {
      errors.push("POC feedback checkpoints require a headSha");
    }
    if (checkpoint.reviewScope !== "latest_head") {
      errors.push("POC feedback checkpoints must route to latest head");
    }
    if (checkpoint.requestedAfterPush !== true) {
      errors.push("POC feedback checkpoints must be requested after each push");
    }
    if (
      !loop.feedback.pushedHeads.some(
        (push) => pushKey(push) === pushKey(checkpoint),
      )
    ) {
      errors.push("POC feedback checkpoints must match a recorded pushed head");
    }
  }

  for (const unit of activeUnits) {
    const hasMaterialPush = loop.feedback.pushedHeads.some(
      (push) => push.unitId === unit.id && push.reason === "material_poc_push",
    );
    if (!hasMaterialPush) {
      errors.push(
        `POC loop unit ${unit.id} requires a recorded pushed head for material_poc_push`,
      );
    }
  }

  for (const push of loop.feedback.pushedHeads) {
    const activeUnit = activeUnits.find((unit) => unit.id === push.unitId);
    const matchingCheckpoints = loop.feedback.checkpoints.filter(
      (checkpoint) => pushKey(checkpoint) === pushKey(push),
    );
    if (activeUnit && matchingCheckpoints.length !== 1) {
      errors.push(
        `POC loop unit ${push.unitId} requires one feedback checkpoint for ${push.reason} at ${push.headSha}`,
      );
    }
    if (
      activeUnit?.status === "completed" &&
      matchingCheckpoints.some((checkpoint) => checkpoint.status !== "complete")
    ) {
      errors.push(
        `POC loop completed unit ${push.unitId} requires complete feedback checkpoint for ${push.reason} at ${push.headSha}`,
      );
    }
  }

  if (!includes(body, "Latest-head routed feedback")) {
    errors.push("POC artifact body must describe latest-head feedback routing");
  }

  if (!includes(body, "contextual and non-authoritative")) {
    errors.push(
      "POC artifact body must state that task state is contextual and non-authoritative",
    );
  }

  return errors;
}

function normalizePocTitle(
  title: string | undefined,
  fallback: string,
): string {
  const trimmed = title?.trim() || fallback;
  return trimmed.startsWith("POC:") ? trimmed : `POC: ${trimmed}`;
}

function includes(value: string, pattern: string): boolean {
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function assertUnique(values: string[], label: string): void {
  if (hasDuplicates(values)) {
    throw new Error(`${label} must be unique`);
  }
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function sameItems(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => right.includes(item))
  );
}

function pushKey(input: {
  unitId: string;
  reason: PlanPocFeedbackReason;
  headSha: string;
}): string {
  return `${input.unitId}\0${input.reason}\0${input.headSha}`;
}

function parseArgs(argv: string[]): PlanPocArtifactInput {
  const input: Partial<PlanPocArtifactInput> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--change-id" && next) {
      input.changeId = next;
      index += 1;
      continue;
    }

    if (arg === "--change-ref" && next) {
      input.changeRef = next;
      index += 1;
      continue;
    }

    if (arg === "--host" && next) {
      input.host = next as PlanPocArtifactHost;
      index += 1;
      continue;
    }

    if (arg === "--title" && next) {
      input.title = next;
      index += 1;
      continue;
    }

    throw new Error(`unknown or incomplete argument: ${arg}`);
  }

  if (!input.changeId || !input.changeRef || !input.host) {
    throw new Error("--change-id, --change-ref, and --host are required");
  }

  return input as PlanPocArtifactInput;
}

export function main(argv = process.argv.slice(2)): number {
  try {
    const state = buildPlanPocArtifactState(parseArgs(argv));
    const errors = validatePlanPocArtifactState(state);

    if (errors.length > 0) {
      console.error(errors.join("\n"));
      return 1;
    }

    console.log(JSON.stringify(state, null, 2));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
