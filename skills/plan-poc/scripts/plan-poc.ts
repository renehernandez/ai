#!/usr/bin/env tsx

export type PlanPocArtifactHost = "gitlab_mr" | "github_pr";

export type PlanPocArtifactInput = {
  changeId: string;
  changeRef: string;
  host: PlanPocArtifactHost;
  title?: string;
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
  finalDelivery: {
    deliverySource: "revised_openspec";
    pocCommitsReused: false;
  };
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
  const body = [
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
    "",
    "## Final Delivery Boundary",
    "",
    "Final delivery must come from a revised OpenSpec.",
    "POC commits must not be reused as final implementation commits.",
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
    finalDelivery: {
      deliverySource: "revised_openspec",
      pocCommitsReused: false,
    },
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

  if (state.finalDelivery.deliverySource !== "revised_openspec") {
    errors.push("final delivery source must be revised_openspec");
  }

  if (state.finalDelivery.pocCommitsReused !== false) {
    errors.push("POC commits must not be reused for final delivery");
  }

  if (!includes(state.body, "POC commits must not be reused")) {
    errors.push("POC artifact body must reject POC commit reuse");
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
