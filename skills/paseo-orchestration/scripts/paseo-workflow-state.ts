import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export type Phase = "planning" | "implementation";
export type Role =
  | "planner"
  | "implementer"
  | "review-correctness"
  | "review-architecture"
  | "review-contract";
export type Lens = { id: string; objective: string; [key: string]: unknown };
export type Route = { provider: string; model: string; thinking: string };
export type Outcome = {
  status: "passed" | "finding" | "blocked";
  evidence: string;
  findings: { id: string; evidence: string }[];
};
// An implementer's parsed final envelope; branch and head equal the worktree when the tick recorded it.
export type ImplementerReport = {
  branch: string;
  head: string;
  commits: string[];
  verification: string[];
  deviations: string[];
  risks: string[];
  uncommitted: string[];
};
export type LaunchInspection = {
  cwd: string;
  provider: string;
  model: string;
  thinking: string;
  status: string;
};
export type Review = {
  status: "reserved" | "running" | "complete" | "degraded" | "failed";
  agentId?: string;
  launchStatus?: "identity-recorded" | "verified" | "released" | "blocked";
  inspection?: LaunchInspection;
  assignment?: Snapshot;
  startupReplySha256?: string;
  releasedAt?: string;
  outcomes?: Record<string, Outcome>;
  report?: ImplementerReport;
  error?: string;
};
export type StandingOrderChange = {
  id: string;
  op: "add" | "amend" | "retire";
  constraint?: string;
  authorizationSource: string;
};
export type Heartbeat = {
  id: string;
  agentId: string;
  expiresAt: string;
  promptSha256: string;
};
export type Step =
  | { result: "unchanged"; inFlight: string[] }
  | { result: "changed"; next: { action: string; detail: string } }
  | { result: "awaiting-user"; gate: string }
  | { result: "finished" };
export type Snapshot = { path: string; sha256: string };
export type WorkspaceBinding = { id: string; cwd: string };
export type Decision = {
  id: string;
  action: "fix" | "dismiss" | "question";
  reason: string;
};
export type FallbackAssessment = {
  role: Extract<Role, `review-${string}`>;
  outcomes: Record<string, Outcome>;
};
export type Waiver = {
  phase: Phase | "hosted";
  target: string;
  requestedAction: string;
  failedGates: string[];
  reason: string;
};
export type GatePolicy = "required" | "not-required" | "unknown";
export type DeliveryPolicy = {
  provider: "github" | "gitlab";
  repository: string;
  ci: GatePolicy;
  reviewer: GatePolicy;
  reviewerKind?: "genie" | "nitro";
  source: string;
  sourceFingerprint: string;
};
export type Receipt = {
  artifactUrl: string;
  head: string;
  targetBase?: string;
  reviewer?: "genie" | "nitro";
  ready: true;
  evidence: string;
};
export type Hosted = Omit<Receipt, "ready"> & {
  ready: boolean | null;
  status: "waiting" | "completed" | "awaiting-user" | "failed" | "timed-out";
  findings: { id: string; evidence: string }[];
};
export type Input = Partial<Receipt> &
  Partial<Waiver> & {
    phase?: Phase | "hosted";
    decisions?: Decision[];
    assessments?: FallbackAssessment[];
    stage?: "start" | "complete";
    verification?: string;
    deliveryPolicy?: DeliveryPolicy;
    batchId?: string;
    authorizationSource?: string;
    purpose?: string;
    allowedPhases?: (Phase | "hosted")[];
    expectedHead?: string;
    policySourceFingerprint?: string;
    probeCommand?: string[];
    deadlineMs?: number;
    op?: StandingOrderChange["op"];
    id?: string;
    constraint?: string;
  };
export type ManagedConfig = {
  agents?: {
    providers?: Record<
      string,
      { extends?: string; command?: string[]; models?: { id: string }[] }
    >;
  };
};
export type Round = {
  fingerprint: string;
  artifact: Snapshot;
  lenses: Snapshot;
  lensAssignments: Record<string, { lensIds: string[]; snapshot: Snapshot }>;
  head?: string;
  // Uncommitted worktree files observed at dispatch; evidence only, never reviewed.
  uncommitted?: string[];
  // 0 before publication; n for the local rounds of hosted feedback batch n.
  cycle?: number;
  reviews: Record<string, Review>;
};
export type Repair = {
  status: "started" | "complete";
  head?: string;
  verification?: string;
  // A hosted repair that reconciles a moved target base records the new base.
  targetBase?: string;
  session?: Review & { brief: Snapshot };
};
// A superseded round keeps its triage and repair; a new head or plan needs its own round.
export type ArchivedRound = {
  round: Round;
  decisions?: Decision[];
  assessments?: FallbackAssessment[];
  repair?: Repair;
};
export type ArchivedHostedBatch = {
  publication: Receipt;
  hosted?: Hosted;
  decisions?: Decision[];
  repair?: Repair;
};
export type Workflow = {
  version: 1;
  reviewMode?: "sol-focused-v1";
  orchestration?: "planner-v1" | "planner-v2";
  standingOrders?: StandingOrderChange[];
  heartbeat?: Heartbeat;
  hostedMonitor?: { probeCommand: string[]; deadline: string };
  cwd: string;
  workspace?: WorkspaceBinding;
  workspaceRegistration?: {
    status: "reserved" | "uncertain";
    cwd: string;
    error?: string;
  };
  routes: Record<Role, Route>;
  lenses: Record<Phase, Lens[]>;
  timeoutSeconds: number;
  rounds: Partial<Record<Phase, Round>>;
  priorRounds?: {
    planning?: ArchivedRound[];
    implementation?: ArchivedRound[];
    hosted?: ArchivedHostedBatch[];
  };
  decisions: Partial<Record<Phase | "hosted", Decision[]>>;
  assessments: Partial<Record<Phase, FallbackAssessment[]>>;
  waivers: Waiver[];
  handoff?: Review & { brief: Snapshot; planResolution: Snapshot };
  repairs: Partial<Record<"implementation" | "hosted", Repair>>;
  deliveryPolicy?: DeliveryPolicy;
  publication?: Receipt;
  hosted?: Hosted;
  finished?: string;
  batchId?: string;
  currentAuthorization?: {
    authorizationSource: string;
    purpose: string;
    allowedPhases: (Phase | "hosted")[];
    expectedHead: string;
    artifactUrl?: string;
  };
  handoffRecovery?: {
    status: "reserved" | "complete";
    previousAgentId: string;
    authorizationSource: string;
    evidence?: string;
  };
  history?: {
    batchId: string;
    authorization?: Workflow["currentAuthorization"];
    artifactUrl?: string;
    rounds: Workflow["rounds"];
    priorRounds?: Workflow["priorRounds"];
    handoff?: Workflow["handoff"];
    decisions: Workflow["decisions"];
    assessments: Workflow["assessments"];
    waivers: Waiver[];
    repairs: Workflow["repairs"];
    publication?: Receipt;
    hosted?: Hosted;
    finished?: string;
    failedHandoff?: {
      previousAgentId: string;
      error: string;
      inspection: LaunchInspection;
      authorizationSource: string;
      target: {
        cwd: string;
        branch: string;
        head: string;
        dirtyStatus: string[];
      };
      noWritesEvidence: string;
    };
  }[];
};
export type Transport = (
  args: string[],
  timeoutMs: number,
  env?: Record<string, string>,
) => Promise<string>;
export const roles: Role[] = [
  "planner",
  "implementer",
  "review-correctness",
  "review-architecture",
  "review-contract",
];
export const reviewRoles: Record<Phase, Role[]> = {
  planning: ["review-correctness", "review-architecture", "review-contract"],
  implementation: [
    "review-correctness",
    "review-architecture",
    "review-contract",
  ],
};
const lensOwners: Record<Phase, Partial<Record<string, Role>>> = {
  planning: {
    "implementation-readiness": "review-correctness",
    "edge-cases-and-risk": "review-correctness",
    "code-simplifier": "review-architecture",
    "refactoring-opportunities": "review-architecture",
    "delivery-shape": "review-contract",
  },
  implementation: {
    "diff-review": "review-correctness",
    "code-simplifier": "review-architecture",
    "code-quality-review": "review-architecture",
    deslop: "review-architecture",
    scrutinize: "review-contract",
  },
};
export function assignReviewLenses(phase: Phase, lenses: Lens[]) {
  const groups = Object.fromEntries(
    reviewRoles[phase].map((role) => [role, [] as Lens[]]),
  ) as Record<string, Lens[]>;
  for (const lens of lenses) {
    const owner =
      lensOwners[phase][lens.id] ??
      (/security|production/u.test(lens.id)
        ? "review-correctness"
        : /migration|data/u.test(lens.id)
          ? "review-architecture"
          : "review-contract");
    groups[owner].push(lens);
  }
  const assigned = Object.values(groups).flat();
  requireThat(
    reviewRoles[phase].every((role) => groups[role].length > 0) &&
      assigned.length === lenses.length &&
      new Set(assigned.map((lens) => lens.id)).size === lenses.length,
    "Focused review assignments must cover every lens exactly once",
  );
  return groups;
}
export function requireCurrentReviewMode(state: Workflow) {
  requireThat(
    state.reviewMode === "sol-focused-v1",
    "Legacy workflow state is read-only and cannot continue under the focused Sol review roster",
  );
}
export function requireOrchestration(state: Workflow) {
  requireCurrentReviewMode(state);
  requireThat(
    state.orchestration === "planner-v2",
    "Workflow state predates planner orchestration with head-keyed review; it stays readable through status, but tick and orchestrator dispatch refuse it",
  );
}
// Each phase, and each hosted feedback batch's local loop, allows this many review rounds.
export const maxReviewRounds = 3;
// Hosted feedback batch n follows the nth publication of a head.
export function hostedBatch(state: Workflow) {
  return (state.priorRounds?.hosted?.length ?? 0) + 1;
}
export function implementationCycle(state: Workflow) {
  return state.publication ? hostedBatch(state) : 0;
}
// Rounds already dispatched in the current planning phase or implementation cycle.
export function roundCount(state: Workflow, phase: Phase) {
  const all = [
    ...(state.priorRounds?.[phase] ?? []).map((item) => item.round),
    ...(state.rounds[phase] ? [state.rounds[phase]] : []),
  ];
  if (phase === "planning") return all.length;
  const cycle = implementationCycle(state);
  return all.filter((round) => (round.cycle ?? 0) === cycle).length;
}
// Local rounds after publication gate republication of a hosted repair head.
export function implementationAction(state: Workflow) {
  return state.publication ? "republication" : "publication";
}
// Moves the current round, its triage, and its repair aside so the next round starts clean.
export function archiveRound(state: Workflow, phase: Phase) {
  const round = state.rounds[phase];
  requireThat(round, "No round to archive");
  const repair =
    phase === "implementation" ? state.repairs.implementation : undefined;
  state.priorRounds ??= {};
  state.priorRounds[phase] ??= [];
  state.priorRounds[phase].push({
    round,
    ...(state.decisions[phase] ? { decisions: state.decisions[phase] } : {}),
    ...(state.assessments[phase]
      ? { assessments: state.assessments[phase] }
      : {}),
    ...(repair ? { repair } : {}),
  });
  delete state.rounds[phase];
  delete state.decisions[phase];
  delete state.assessments[phase];
  if (phase === "implementation") delete state.repairs.implementation;
}
// The newest head a runner-launched implementer produced, reviewed or not.
export function latestHead(state: Workflow) {
  const round = state.rounds.implementation;
  if (state.repairs.implementation?.head)
    return state.repairs.implementation.head;
  if (
    state.repairs.hosted?.head &&
    (round?.cycle ?? 0) !== implementationCycle(state)
  )
    return state.repairs.hosted.head;
  return round?.head ?? state.publication?.head;
}
// Binds a caller-supplied head to the worktree-verified head in the implementer's structured report.
export function reportsHead(worker: Review | undefined, head: unknown) {
  return nonempty(head) && worker?.report?.head === head;
}
export function effectiveOrders(state: Workflow) {
  const orders = new Map<string, string>();
  for (const change of state.standingOrders ?? []) {
    if (change.op === "retire") orders.delete(change.id);
    else orders.set(change.id, change.constraint ?? "");
  }
  return [...orders].map(([id, constraint]) => ({ id, constraint }));
}
export function ordersBlock(state: Workflow) {
  const orders = effectiveOrders(state);
  return orders.length
    ? `Standing orders (effective set; follow each verbatim):\n${orders.map((order) => `- ${order.id}: ${order.constraint}`).join("\n")}`
    : "Standing orders: none recorded.";
}
export type Worker = {
  name: string;
  role: Role;
  phase?: Phase;
  worker: Review;
};
export function workers(state: Workflow): Worker[] {
  const entries: Worker[] = [];
  if (state.handoff)
    entries.push({
      name: "handoff",
      role: "implementer",
      worker: state.handoff,
    });
  for (const phase of ["planning", "implementation"] as Phase[])
    for (const role of reviewRoles[phase]) {
      const review = state.rounds[phase]?.reviews[role];
      if (review)
        entries.push({ name: `${phase}:${role}`, role, phase, worker: review });
    }
  for (const phase of ["implementation", "hosted"] as const) {
    const session = state.repairs[phase]?.session;
    if (session)
      entries.push({
        name: `${phase}-repair`,
        role: "implementer",
        worker: session,
      });
  }
  return entries;
}
export function inFlight(state: Workflow) {
  return [
    ...workers(state)
      .filter(
        ({ worker }) =>
          worker.status === "reserved" || worker.status === "running",
      )
      .map(({ name }) => name),
    ...(state.hostedMonitor && state.hosted?.status === "waiting"
      ? ["hosted"]
      : []),
  ];
}
function openQuestions(
  state: Workflow,
  phase: Phase | "hosted",
  requestedAction: string,
) {
  return (state.decisions[phase] ?? []).filter(
    (decision) =>
      decision.action === "question" &&
      !waiverFor(state, phase, requestedAction, decision.id),
  );
}
export function pendingFixes(
  state: Workflow,
  phase: Phase | "hosted",
  requestedAction: string,
) {
  return (state.decisions[phase] ?? []).some(
    (decision) =>
      decision.action === "fix" &&
      !waiverFor(state, phase, requestedAction, decision.id),
  );
}
export function nextStep(state: Workflow): Step {
  if (state.finished) return { result: "finished" };
  const pending = inFlight(state);
  if (pending.length) return { result: "unchanged", inFlight: pending };
  const changed = (action: string, detail: string): Step => ({
    result: "changed",
    next: { action, detail },
  });
  const awaiting = (gate: string): Step => ({ result: "awaiting-user", gate });
  const reviewed = (phase: Phase, requestedAction: string) => {
    if (!state.decisions[phase])
      return changed("triage", `Triage the ${phase} review round`);
    if (openQuestions(state, phase, requestedAction).length)
      return awaiting(
        `${phase} findings need user input or an exact scoped waiver`,
      );
  };
  const bounded = (phase: Phase | "hosted") =>
    awaiting(
      `${phase} review bound of ${maxReviewRounds} reached with open fixes; report the findings, reviewed heads, and repairs for user direction`,
    );
  const repair = (
    phase: "implementation" | "hosted",
    requestedAction: string,
  ) => {
    const current = state.repairs[phase];
    if (!current && pendingFixes(state, phase, requestedAction))
      return (
        phase === "implementation"
          ? roundCount(state, phase) >= maxReviewRounds
          : hostedBatch(state) > maxReviewRounds
      )
        ? bounded(phase)
        : changed(
            "repair",
            `Dispatch one fresh ${phase} repair with an orchestrator-written brief`,
          );
    if (current?.session?.status === "failed")
      return awaiting(
        `${phase} repair session failed; inspect Paseo state before human-directed recovery`,
      );
    if (current?.status === "started")
      return changed(
        "repair",
        `Record ${phase} repair completion with the reported head and verification`,
      );
  };
  // Reviews every new implementation head until one round is clean; returns undefined once it is.
  const implementationLoop = (requestedAction: string) => {
    const loop =
      reviewed("implementation", requestedAction) ??
      repair("implementation", requestedAction);
    if (loop) return loop;
    if (state.repairs.implementation?.status === "complete")
      return changed(
        "review",
        "Dispatch a fresh implementation round on the repaired head",
      );
  };
  if (!state.rounds.planning)
    return changed("review", "Dispatch the planning review round");
  const planning = reviewed("planning", "handoff");
  if (planning) return planning;
  if (pendingFixes(state, "planning", "handoff"))
    return roundCount(state, "planning") >= maxReviewRounds
      ? bounded("planning")
      : changed(
          "review",
          "Revise the plan from the triaged findings and dispatch a fresh planning round on the changed plan",
        );
  if (!state.handoff)
    return awaiting(
      "Plan acceptance is required before implementation handoff",
    );
  if (state.handoff.status === "failed")
    return awaiting(
      "Implementation handoff failed; inspect Paseo state and the saved error before human-directed recovery",
    );
  if (!state.rounds.implementation)
    return changed(
      "review",
      "Dispatch the implementation review round on the worktree head",
    );
  if (!state.publication) {
    const implementation = implementationLoop("publication");
    if (implementation) return implementation;
  }
  if (!state.publication)
    return changed(
      "publication",
      "Publish Ready through Finish and record the observed publication",
    );
  if (state.hosted?.status === "awaiting-user")
    return awaiting("The hosted gate requires user input");
  if (!state.decisions.hosted && reviewGates(state, "hosted").length)
    return changed("triage", "Triage the hosted feedback batch");
  if (openQuestions(state, "hosted", "finish").length)
    return awaiting(
      "hosted findings need user input or an exact scoped waiver",
    );
  const hosted = repair("hosted", "finish");
  if (hosted) return hosted;
  if (state.repairs.hosted?.status === "complete") {
    if (
      (state.rounds.implementation?.cycle ?? 0) !== implementationCycle(state)
    )
      return changed(
        "review",
        "Dispatch a fresh local implementation round on the hosted repair head",
      );
    return (
      implementationLoop("republication") ??
      changed(
        "publication",
        "Push the reviewed head through Finish and record the republication to re-arm hosted gates",
      )
    );
  }
  return changed(
    "finish",
    "Record the observed final Ready state through Finish; merge needs separate user authority",
  );
}
function assignedLenses(state: Workflow, phase: Phase, role: string) {
  const ids = roundOf(state, phase).lensAssignments[role]?.lensIds;
  requireThat(ids, `Missing focused lens assignment for ${role}`);
  return state.lenses[phase].filter((lens) => ids.includes(lens.id));
}
export function requireThat(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function phaseOf(value: unknown): Phase {
  requireThat(
    value === "planning" || value === "implementation",
    "Expected planning or implementation phase",
  );
  return value;
}
export async function createSnapshots(
  statePath: string,
  contents: Record<string, string>,
) {
  const directory = await mkdtemp(
    resolve(dirname(statePath), ".paseo-snapshot-"),
  );
  const snapshots: Record<string, Snapshot> = {};
  for (const [name, content] of Object.entries(contents)) {
    requireThat(/^[a-z-]+\.(md|json)$/.test(name), "Invalid snapshot filename");
    const path = resolve(directory, name);
    await writeFile(path, content, { flag: "wx", mode: 0o400 });
    snapshots[name] = {
      path,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  }
  return snapshots;
}

async function save(path: string, state: Workflow) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, path);
}
export async function locked<T>(
  path: string,
  update: (state: Workflow) => Promise<T> | T,
): Promise<T> {
  const lock = `${path}.lock`;
  for (let attempt = 0; ; attempt++) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt >= 100)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  } // An uncertain/stale lock requires inspection, never automatic takeover.
  try {
    const state: Workflow = JSON.parse(await readFile(path, "utf8"));
    requireThat(state.version === 1, "Unsupported workflow state");
    const result = await update(state);
    await save(path, state);
    return result;
  } finally {
    await rm(lock, { recursive: true });
  }
}

export function routesFromConfig(config: ManagedConfig): Record<Role, Route> {
  return Object.fromEntries(
    roles.map((role) => {
      const id = `ax-${role}`;
      const provider = config.agents?.providers?.[id];
      const command = provider?.command;
      requireThat(
        provider?.extends === "pi" &&
          Array.isArray(command) &&
          command.length === 6 &&
          command.every(nonempty),
        `Missing managed provider ${id}`,
      );
      requireThat(
        command[2] === role && command[1].endsWith("/pi/launch.ts"),
        `Invalid role command for ${id}`,
      );
      const model = `${command[3]}/${command[4]}`;
      requireThat(
        provider.models?.[0]?.id === model,
        `Model metadata differs from command for ${id}`,
      );
      return [role, { provider: id, model, thinking: command[5] }];
    }),
  ) as Record<Role, Route>;
}

export async function loadReviewCatalog() {
  const catalogCli = fileURLToPath(
    new URL("../../review/scripts/review-catalog.ts", import.meta.url),
  );
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [catalogCli],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    const catalog: Record<Phase, Lens[]> = JSON.parse(stdout);
    requireThat(
      Array.isArray(catalog.planning) && Array.isArray(catalog.implementation),
      "Invalid review catalog CLI response",
    );
    return catalog;
  } catch (error) {
    throw new Error(
      `Required Review skill catalog CLI is unavailable or failed (${catalogCli}): ${String(error)}`,
    );
  }
}

export async function initialize(
  path: string,
  input: {
    cwd: string;
    configPath?: string;
    timeoutSeconds?: number;
    additionalLenses?: Partial<Record<Phase, Lens[]>>;
  },
) {
  requireThat(nonempty(input.cwd), "cwd is required");
  const lensesByPhase = await loadReviewCatalog();
  for (const phase of ["planning", "implementation"] as Phase[]) {
    const lenses = [
      ...lensesByPhase[phase],
      ...(input.additionalLenses?.[phase] ?? []),
    ];
    requireThat(
      Array.isArray(lenses) &&
        lenses.length > 0 &&
        lenses.every(
          (lens: Lens) => nonempty(lens.id) && nonempty(lens.objective),
        ),
      `Missing canonical ${phase} lens snapshot`,
    );
    requireThat(
      new Set(lenses.map((lens: Lens) => lens.id)).size === lenses.length &&
        lenses.some((lens: Lens) => lens.id === "code-simplifier"),
      "Review lenses must be unique and include code-simplifier",
    );
    lensesByPhase[phase] = lenses;
  }
  const timeoutSeconds = input.timeoutSeconds ?? 600;
  requireThat(
    Number.isInteger(timeoutSeconds) &&
      timeoutSeconds > 0 &&
      timeoutSeconds <= 3600,
    "Review timeout must be 1..3600 seconds",
  );
  const config = JSON.parse(
    await readFile(
      input.configPath ?? resolve(homedir(), ".paseo/config.json"),
      "utf8",
    ),
  );
  const state: Workflow = {
    version: 1,
    reviewMode: "sol-focused-v1",
    orchestration: "planner-v2",
    standingOrders: [],
    cwd: resolve(input.cwd),
    routes: routesFromConfig(config),
    lenses: lensesByPhase,
    timeoutSeconds,
    rounds: {},
    decisions: {},
    assessments: {},
    waivers: [],
    repairs: {},
    batchId: "initial",
    history: [],
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
}

export function roundOf(state: Workflow, phase: Phase) {
  const round = state.rounds[phase];
  requireThat(round, "Review has not run");
  return round;
}
function currentTarget(state: Workflow, phase: Phase | "hosted") {
  if (phase === "hosted") {
    requireThat(state.publication, "Hosted target requires publication");
    return state.repairs.hosted?.head ?? state.publication.head;
  }
  const round = state.rounds[phase];
  requireThat(round, "Review has not run");
  if (phase === "planning") return round.fingerprint;
  requireThat(round.head, "Implementation round has no head");
  return round.head;
}
function outcomeGates(role: string, outcomes: Record<string, Outcome>) {
  return Object.entries(outcomes).flatMap(([id, outcome]) => {
    if (outcome.status === "blocked") return [`${role}:${id}:blocked`];
    return outcome.status === "finding"
      ? outcome.findings.map((finding) => `${role}:${id}:${finding.id}`)
      : [];
  });
}
function validOutcomes(
  outcomes: Record<string, Outcome> | undefined,
  lenses: Lens[],
) {
  if (!outcomes || Object.keys(outcomes).length !== lenses.length) return false;
  return lenses.every((lens) => {
    const outcome = outcomes[lens.id];
    return (
      outcome &&
      ["passed", "finding", "blocked"].includes(outcome.status) &&
      nonempty(outcome.evidence) &&
      Array.isArray(outcome.findings) &&
      outcome.findings.every(
        (finding) =>
          nonempty(finding.id) &&
          !finding.id.includes(":") &&
          nonempty(finding.evidence),
      ) &&
      new Set(outcome.findings.map((finding) => finding.id)).size ===
        outcome.findings.length &&
      (outcome.status !== "finding" || outcome.findings.length > 0) &&
      (outcome.status !== "passed" || outcome.findings.length === 0)
    );
  });
}
function reviewGates(
  state: Workflow,
  phase: Phase | "hosted",
  candidateAssessments = state.assessments[phase as Phase] ?? [],
) {
  if (phase === "hosted") {
    const hosted = state.hosted;
    if (!hosted) return ["hosted:missing"];
    const statusGate =
      hosted.status === "completed" ? [] : [`hosted:${hosted.status}`];
    return [...statusGate, ...hosted.findings.map((item) => item.id)];
  }
  const round = state.rounds[phase];
  requireThat(round, "Review has not run");
  return reviewRoles[phase].flatMap((role) => {
    const review = round.reviews[role];
    if (review.status === "degraded" || review.status === "failed") {
      const assessment = candidateAssessments.find(
        (item) => item.role === role,
      );
      requireThat(
        !assessment ||
          validOutcomes(
            assessment.outcomes,
            assignedLenses(state, phase, role),
          ),
        `${role} fallback assessment differs from its focused lens assignment`,
      );
      return [
        `${role}:review-evidence`,
        ...(assessment ? outcomeGates(role, assessment.outcomes) : []),
      ];
    }
    requireThat(
      review.status === "complete" && review.outcomes,
      `${role} review is incomplete`,
    );
    return outcomeGates(role, review.outcomes);
  });
}
type WaiverMatch = {
  phase: Phase | "hosted";
  target: string;
  requestedAction?: string;
  gate?: string;
};
function matchesWaiver(waiver: Waiver, match: WaiverMatch) {
  return (
    waiver.phase === match.phase &&
    waiver.target === match.target &&
    (match.requestedAction === undefined ||
      waiver.requestedAction === match.requestedAction) &&
    (match.gate === undefined || waiver.failedGates.includes(match.gate))
  );
}
function waiverFor(
  state: Workflow,
  phase: Phase | "hosted",
  requestedAction: string | undefined,
  gate: string,
) {
  return state.waivers?.some((waiver) =>
    matchesWaiver(waiver, {
      phase,
      target: currentTarget(state, phase),
      requestedAction,
      gate,
    }),
  );
}
export function settled(
  state: Workflow,
  phase: Phase | "hosted",
  requestedAction: string,
) {
  const gates = reviewGates(state, phase);
  if (phase !== "hosted") {
    const assessments = state.assessments?.[phase] ?? [];
    for (const role of reviewRoles[phase]) {
      const review = roundOf(state, phase).reviews[role];
      if (review.status !== "degraded" && review.status !== "failed") continue;
      const gate = `${role}:review-evidence`;
      requireThat(
        assessments.some(
          (item) =>
            item.role === role &&
            validOutcomes(item.outcomes, assignedLenses(state, phase, role)),
        ) || waiverFor(state, phase, requestedAction, gate),
        `${role} degraded evidence needs a complete per-lens owner fallback assessment or exact scoped waiver`,
      );
    }
  }
  const decisions = state.decisions[phase] ?? [];
  const actionable = gates.filter((gate) => !gate.endsWith(":review-evidence"));
  requireThat(
    decisions.length === actionable.length &&
      actionable.every((gate) => decisions.some((item) => item.id === gate)),
    `${phase} findings need explicit triage`,
  );
  requireThat(
    !decisions.some(
      (decision) =>
        decision.action === "question" &&
        !waiverFor(state, phase, requestedAction, decision.id),
    ),
    `${phase} findings need user input or an exact scoped waiver`,
  );
  return decisions;
}
// Before head-keyed orchestration, one completed repair batch stood in for re-review.
function verdict(
  state: Workflow,
  phase: "implementation" | "hosted",
  requestedAction: string,
) {
  if (state.orchestration === "planner-v2")
    return clean(state, phase, requestedAction);
  settled(state, phase, requestedAction);
  requireThat(
    !pendingFixes(state, phase, requestedAction) ||
      state.repairs[phase]?.status === "complete",
    `${phase} repairs require completed verification or an exact scoped waiver`,
  );
}
// A clean verdict: triaged, no open questions, and no unwaived fix left for a later round.
export function clean(
  state: Workflow,
  phase: Phase | "hosted",
  requestedAction: string,
) {
  settled(state, phase, requestedAction);
  requireThat(
    !pendingFixes(state, phase, requestedAction),
    `${phase} fixes need a repair and a fresh review round on the new head, or an exact scoped waiver`,
  );
}
export function assertActionGateDisposition(
  state: Workflow,
  phase: Phase | "hosted",
  requestedAction: string,
  target: string,
  liveArtifact?: { artifactUrl: string; targetBase?: string },
) {
  requireThat(nonempty(requestedAction), "Exact requested action is required");
  requireThat(
    target === currentTarget(state, phase),
    "Action target differs from the current exact artifact or head",
  );
  if (phase === "hosted" && liveArtifact)
    requireThat(
      liveArtifact.artifactUrl === state.publication?.artifactUrl &&
        liveArtifact.targetBase === state.publication?.targetBase,
      "Bookkeeping mismatch: live artifact or target base differs from publication",
    );
  if (phase !== "planning") verdict(state, phase, requestedAction);
  else if (state.orchestration === "planner-v2")
    clean(state, phase, requestedAction);
  else settled(state, phase, requestedAction);
}
function validatedPolicy(policy: DeliveryPolicy | undefined) {
  requireThat(policy, "Resolved delivery policy is required");
  requireThat(
    ["github", "gitlab"].includes(policy.provider) &&
      nonempty(policy.repository) &&
      ["required", "not-required", "unknown"].includes(policy.ci) &&
      ["required", "not-required", "unknown"].includes(policy.reviewer) &&
      nonempty(policy.source) &&
      /^[a-f0-9]{64}$/.test(policy.sourceFingerprint) &&
      (policy.reviewer !== "required" ||
        policy.reviewerKind === "genie" ||
        policy.reviewerKind === "nitro") &&
      (policy.reviewer === "required" || policy.reviewerKind === undefined) &&
      (policy.reviewerKind === undefined ||
        (policy.provider === "github" && policy.reviewerKind === "genie") ||
        (policy.provider === "gitlab" && policy.reviewerKind === "nitro")),
    "Invalid delivery policy",
  );
  return policy;
}

export function receipt(
  input: Partial<Receipt>,
  policy?: DeliveryPolicy,
): Receipt {
  const reviewerRequired = policy?.reviewer === "required";
  let policyUrlValid = true;
  if (policy && input.artifactUrl) {
    const url = new URL(input.artifactUrl);
    const repositoryPath = `/${policy.repository}/`;
    policyUrlValid =
      (policy.provider === "github" && url.hostname === "github.com") ||
      (policy.provider === "gitlab" && url.hostname === "git.fullscript.io");
    policyUrlValid &&= url.pathname.startsWith(repositoryPath);
  }
  requireThat(
    nonempty(input.artifactUrl) &&
      /^https:\/\//.test(input.artifactUrl) &&
      nonempty(input.head) &&
      input.ready === true &&
      nonempty(input.evidence) &&
      policyUrlValid &&
      (!policy ||
        (reviewerRequired
          ? input.reviewer === policy.reviewerKind
          : input.reviewer === undefined)),
    "Finish must supply observed Ready artifact, head, policy-aligned reviewer and source evidence",
  );
  return {
    artifactUrl: input.artifactUrl,
    head: input.head,
    ...(input.targetBase ? { targetBase: input.targetBase } : {}),
    ...(input.reviewer ? { reviewer: input.reviewer } : {}),
    ready: true,
    evidence: input.evidence,
  };
}
export async function transition(path: string, action: string, input: Input) {
  return locked(path, (state) => {
    requireCurrentReviewMode(state);
    if (action !== "continuation")
      requireThat(!state.finished, "Workflow already finished");
    if (action === "policy") {
      requireThat(
        !state.publication,
        "Delivery policy must be resolved before publication",
      );
      const policy = validatedPolicy(input.deliveryPolicy);
      requireThat(
        !state.deliveryPolicy || state.currentAuthorization,
        "Delivery policy is already recorded",
      );
      state.deliveryPolicy = policy;
    } else if (action === "continuation") {
      if (
        input.batchId === state.batchId &&
        input.authorizationSource ===
          state.currentAuthorization?.authorizationSource &&
        input.purpose === state.currentAuthorization?.purpose &&
        input.expectedHead === state.currentAuthorization?.expectedHead &&
        input.artifactUrl === state.currentAuthorization?.artifactUrl &&
        JSON.stringify(input.allowedPhases) ===
          JSON.stringify(state.currentAuthorization?.allowedPhases)
      )
        return state;
      requireThat(
        nonempty(input.batchId) &&
          input.batchId !== state.batchId &&
          nonempty(input.authorizationSource) &&
          nonempty(input.purpose) &&
          Array.isArray(input.allowedPhases) &&
          input.allowedPhases.length > 0 &&
          new Set(input.allowedPhases).size === input.allowedPhases.length &&
          input.allowedPhases.every((phase) =>
            ["planning", "implementation", "hosted"].includes(phase),
          ) &&
          nonempty(input.expectedHead),
        "Continuation requires explicit bounded authorization and expected head",
      );
      const currentHead =
        state.orchestration === "planner-v2"
          ? latestHead(state)
          : (state.repairs.hosted?.head ??
            state.repairs.implementation?.head ??
            state.publication?.head ??
            state.rounds.implementation?.head);
      requireThat(
        input.expectedHead === currentHead &&
          (!state.publication ||
            input.artifactUrl === state.publication.artifactUrl),
        "Bookkeeping mismatch: continuation head or artifact identity differs from recorded state",
      );
      state.history ??= [];
      requireThat(
        !state.history.some((batch) => batch.batchId === input.batchId),
        "Continuation batch identity is already historical",
      );
      state.history.push({
        batchId: state.batchId ?? "legacy-initial",
        authorization:
          state.currentAuthorization &&
          structuredClone(state.currentAuthorization),
        artifactUrl: state.publication?.artifactUrl,
        rounds: structuredClone(state.rounds),
        ...(state.priorRounds
          ? { priorRounds: structuredClone(state.priorRounds) }
          : {}),
        handoff: state.handoff && structuredClone(state.handoff),
        decisions: structuredClone(state.decisions),
        assessments: structuredClone(state.assessments),
        waivers: structuredClone(state.waivers),
        repairs: structuredClone(state.repairs),
        publication: state.publication && structuredClone(state.publication),
        hosted: state.hosted && structuredClone(state.hosted),
        finished: state.finished,
      });
      state.batchId = input.batchId;
      state.currentAuthorization = {
        authorizationSource: input.authorizationSource,
        purpose: input.purpose,
        allowedPhases: input.allowedPhases,
        expectedHead: input.expectedHead,
        ...(input.artifactUrl ? { artifactUrl: input.artifactUrl } : {}),
      };
      if (input.allowedPhases.includes("planning")) {
        state.rounds = {};
        delete state.priorRounds;
        delete state.handoff;
      } else if (input.allowedPhases.includes("implementation")) {
        delete state.rounds.implementation;
        delete state.priorRounds?.implementation;
        delete state.priorRounds?.hosted;
      } else delete state.priorRounds?.hosted;
      // A batch that does not reopen planning keeps the settled planning verdict.
      const reopened = (phase: Phase | "hosted") =>
        input.allowedPhases?.includes("planning") || phase !== "planning";
      state.decisions = Object.fromEntries(
        Object.entries(state.decisions).filter(
          ([phase]) => !reopened(phase as Phase),
        ),
      );
      state.assessments = Object.fromEntries(
        Object.entries(state.assessments).filter(
          ([phase]) => !reopened(phase as Phase),
        ),
      );
      state.waivers = state.waivers.filter((waiver) => !reopened(waiver.phase));
      state.repairs = {};
      if (
        input.allowedPhases.includes("planning") ||
        input.allowedPhases.includes("implementation")
      )
        delete state.publication;
      delete state.hosted;
      delete state.hostedMonitor;
      delete state.finished;
    } else if (action === "order") {
      requireOrchestration(state);
      const { id, op, constraint, authorizationSource } = input;
      const known = (state.standingOrders ?? []).some(
        (change) => change.id === id,
      );
      const active = effectiveOrders(state).some((order) => order.id === id);
      requireThat(
        nonempty(id) &&
          nonempty(authorizationSource) &&
          (op === "add" || op === "amend" || op === "retire") &&
          (op === "retire" ? constraint === undefined : nonempty(constraint)) &&
          (op === "add" ? !known : active),
        "Standing order changes need op add (unused id), amend or retire (active id), a constraint except on retire, and an authorization source",
      );
      state.standingOrders ??= [];
      state.standingOrders.push({
        id,
        op,
        ...(constraint ? { constraint } : {}),
        authorizationSource,
      });
    } else if (action === "triage") {
      const phase = input.phase === "hosted" ? "hosted" : phaseOf(input.phase);
      // A published round's triage is final; a local round on a hosted repair head is not yet published.
      const publishedRound =
        state.orchestration === "planner-v2"
          ? state.publication !== undefined &&
            (state.rounds.implementation?.cycle ?? 0) !==
              implementationCycle(state)
          : state.publication !== undefined;
      requireThat(
        !(phase === "planning"
          ? state.handoff
          : phase === "implementation"
            ? publishedRound
            : state.repairs.hosted),
        "Triage is already consumed by the next phase",
      );
      let assessments: FallbackAssessment[] = [];
      if (phase !== "hosted") {
        const degradedRoles = reviewRoles[phase].filter((role) => {
          const status = roundOf(state, phase).reviews[role].status;
          return status === "degraded" || status === "failed";
        });
        assessments = input.assessments ?? [];
        requireThat(
          new Set(assessments.map((item) => item.role)).size ===
            assessments.length &&
            assessments.every(
              (item) =>
                degradedRoles.includes(item.role) &&
                validOutcomes(
                  item.outcomes,
                  assignedLenses(state, phase, item.role),
                ),
            ) &&
            degradedRoles.every(
              (role) =>
                assessments.some((item) => item.role === role) ||
                waiverFor(state, phase, undefined, `${role}:review-evidence`),
            ),
          "Every degraded reviewer needs one complete per-lens owner fallback assessment or exact scoped waiver",
        );
      }
      const ids = reviewGates(state, phase, assessments).filter(
        (id) => !id.endsWith(":review-evidence"),
      );
      requireThat(
        Array.isArray(input.decisions) &&
          input.decisions.length === ids.length &&
          new Set(input.decisions.map((decision: Decision) => decision.id))
            .size === ids.length &&
          input.decisions.every(
            (decision: Decision) =>
              ids.includes(decision.id) &&
              ["fix", "dismiss", "question"].includes(decision.action) &&
              nonempty(decision.reason),
          ),
        "Every finding needs one explicit decision and reason",
      );
      state.decisions[phase] = input.decisions;
      if (phase !== "hosted") {
        state.assessments ??= {};
        state.assessments[phase] = assessments;
      }
    } else if (action === "waiver") {
      const phase = input.phase === "hosted" ? "hosted" : phaseOf(input.phase);
      const target = currentTarget(state, phase);
      const gates = reviewGates(state, phase);
      requireThat(
        nonempty(input.target) && input.target === target,
        "Waiver target differs from the current exact artifact or head",
      );
      requireThat(
        nonempty(input.requestedAction) &&
          nonempty(input.reason) &&
          Array.isArray(input.failedGates) &&
          input.failedGates.length > 0 &&
          new Set(input.failedGates).size === input.failedGates.length &&
          input.failedGates.every((gate) => gates.includes(gate)),
        "Waiver requires an exact action, reason, and current failed gates",
      );
      state.waivers ??= [];
      requireThat(
        !state.waivers.some((waiver) =>
          matchesWaiver(waiver, {
            phase,
            target,
            requestedAction: input.requestedAction,
          }),
        ),
        "A waiver for this phase, target, and action is already recorded",
      );
      state.waivers.push({
        phase,
        target,
        requestedAction: input.requestedAction,
        failedGates: input.failedGates,
        reason: input.reason,
      });
    } else if (action === "repair") {
      requireThat(
        input.phase === "implementation" || input.phase === "hosted",
        "Invalid repair phase",
      );
      requireThat(
        !state.currentAuthorization ||
          state.currentAuthorization.allowedPhases.includes(input.phase),
        `Active continuation does not authorize ${input.phase} repair`,
      );
      const phase = input.phase as "implementation" | "hosted";
      const decisions = settled(
        state,
        phase,
        phase === "implementation" ? implementationAction(state) : "finish",
      );
      if (input.stage === "start") {
        requireThat(
          !state.orchestration,
          "Orchestrated repairs start through the runner's fresh implementer dispatch",
        );
        requireThat(
          !state.repairs[phase] &&
            decisions.some((decision) => decision.action === "fix"),
          "Only one applicable repair batch is allowed",
        );
        state.repairs[phase] = { status: "started" };
      } else {
        requireThat(
          input.stage === "complete" &&
            state.repairs[phase]?.status === "started" &&
            (!state.orchestration ||
              (state.repairs[phase]?.session?.status === "complete" &&
                reportsHead(state.repairs[phase]?.session, input.head))) &&
            nonempty(input.head) &&
            nonempty(input.verification),
          "Repair completion requires a started batch, the exact verified head from the repair report, and named verification",
        );
        Object.assign(state.repairs[phase], {
          status: "complete",
          head: input.head,
          verification: input.verification,
        });
      }
    } else if (action === "publication") {
      const republication =
        state.orchestration === "planner-v2" && state.publication !== undefined;
      verdict(
        state,
        "implementation",
        republication ? "republication" : "publication",
      );
      if (republication)
        requireThat(
          state.repairs.hosted?.status === "complete" &&
            (state.rounds.implementation?.cycle ?? 0) ===
              implementationCycle(state),
          "Republication requires a completed hosted repair and a clean local round on the resulting head",
        );
      else requireThat(!state.publication, "Publication already recorded");
      requireThat(
        nonempty(input.targetBase) &&
          /^[a-f0-9]{40,64}$/.test(input.targetBase),
        "Publication requires the exact target-base SHA",
      );
      requireThat(
        !state.repairs.hosted?.targetBase ||
          input.targetBase === state.repairs.hosted.targetBase,
        "Republication target base differs from the reconciled base",
      );
      const policy = validatedPolicy(state.deliveryPolicy);
      requireThat(
        policy.ci !== "unknown" && policy.reviewer !== "unknown",
        "Unknown delivery policy blocks publication",
      );
      requireThat(
        input.policySourceFingerprint === policy.sourceFingerprint,
        "Delivery policy source changed since handoff; re-resolve policy before publication",
      );
      const observed = receipt(input, policy);
      requireThat(
        observed.head ===
          (state.orchestration === "planner-v2"
            ? state.rounds.implementation?.head
            : (state.repairs.implementation?.head ??
              state.rounds.implementation?.head)),
        "Publication head differs from the head with a clean review verdict",
      );
      if (republication && state.publication) {
        requireThat(
          observed.artifactUrl === state.publication.artifactUrl &&
            observed.reviewer === state.publication.reviewer,
          "Republication artifact differs from publication",
        );
        state.priorRounds ??= {};
        state.priorRounds.hosted ??= [];
        state.priorRounds.hosted.push({
          publication: state.publication,
          ...(state.hosted ? { hosted: state.hosted } : {}),
          ...(state.decisions.hosted
            ? { decisions: state.decisions.hosted }
            : {}),
          ...(state.repairs.hosted ? { repair: state.repairs.hosted } : {}),
        });
        delete state.decisions.hosted;
        delete state.repairs.hosted;
        delete state.hosted;
        delete state.hostedMonitor;
      }
      const unmonitored =
        policy.ci === "not-required" && policy.reviewer === "not-required";
      if (state.orchestration && !unmonitored) {
        const deadlineMs = input.deadlineMs ?? 30 * 60_000;
        requireThat(
          Array.isArray(input.probeCommand) &&
            input.probeCommand.length > 0 &&
            input.probeCommand.every(nonempty) &&
            Number.isInteger(deadlineMs) &&
            deadlineMs > 0 &&
            deadlineMs <= 3_600_000,
          "Orchestrated publication needs the Finish-owned read-only probe argv and a deadline of at most 1h",
        );
        state.hostedMonitor = {
          probeCommand: input.probeCommand,
          deadline: new Date(Date.now() + deadlineMs).toISOString(),
        };
        state.hosted = { ...observed, status: "waiting", findings: [] };
      }
      state.publication = observed;
      if (unmonitored) {
        state.hosted = {
          ...observed,
          status: "completed",
          findings: [],
          evidence: `${observed.evidence} Hosted CI and automated review are not required by ${policy.source}.`,
        };
      }
    } else if (action === "finish") {
      verdict(state, "hosted", "finish");
      const current = state.orchestration === "planner-v2";
      requireThat(
        !current || !state.repairs.hosted,
        "A hosted repair head needs a clean local round and republication before finish",
      );
      const final = receipt(input, validatedPolicy(state.deliveryPolicy));
      requireThat(
        final.artifactUrl === state.publication?.artifactUrl &&
          final.reviewer === state.publication.reviewer,
        "Final artifact differs from publication",
      );
      const expectedHead = current
        ? state.publication.head
        : (state.repairs.hosted?.head ?? state.publication.head);
      requireThat(
        final.head === expectedHead,
        "Final observed head differs from reviewed or repaired head",
      );
      state.finished = final.evidence;
      state.publication = final;
    } else throw new Error(`Unknown transition ${action}`);
    return state;
  });
}
