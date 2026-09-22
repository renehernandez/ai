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
  | "review-glm"
  | "review-deepseek"
  | "review-astra";
export type Lens = { id: string; objective: string; [key: string]: unknown };
export type Route = { provider: string; model: string; thinking: string };
export type Outcome = {
  status: "passed" | "finding" | "blocked";
  evidence: string;
  findings: { id: string; evidence: string }[];
};
export type Review = {
  status: "reserved" | "running" | "complete" | "degraded" | "failed";
  agentId?: string;
  outcomes?: Record<string, Outcome>;
  error?: string;
};
export type Snapshot = { path: string; sha256: string };
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
  };
export type ManagedConfig = {
  agents?: {
    providers?: Record<
      string,
      { extends?: string; command?: string[]; models?: { id: string }[] }
    >;
  };
};
export type Workflow = {
  version: 1;
  cwd: string;
  routes: Record<Role, Route>;
  lenses: Record<Phase, Lens[]>;
  timeoutSeconds: number;
  rounds: Partial<
    Record<
      Phase,
      {
        fingerprint: string;
        artifact: Snapshot;
        lenses: Snapshot;
        head?: string;
        reviews: Record<string, Review>;
      }
    >
  >;
  decisions: Partial<Record<Phase | "hosted", Decision[]>>;
  assessments: Partial<Record<Phase, FallbackAssessment[]>>;
  waivers: Waiver[];
  handoff?: Review & { brief: Snapshot; planResolution: Snapshot };
  repairs: Partial<
    Record<
      "implementation" | "hosted",
      { status: "started" | "complete"; head?: string; verification?: string }
    >
  >;
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
  history?: {
    batchId: string;
    authorization?: Workflow["currentAuthorization"];
    artifactUrl?: string;
    rounds: Workflow["rounds"];
    handoff?: Workflow["handoff"];
    decisions: Workflow["decisions"];
    assessments: Workflow["assessments"];
    waivers: Waiver[];
    repairs: Workflow["repairs"];
    publication?: Receipt;
    hosted?: Hosted;
    finished?: string;
  }[];
};
export type Transport = (args: string[], timeoutMs: number) => Promise<string>;
export const roles: Role[] = [
  "planner",
  "implementer",
  "review-glm",
  "review-deepseek",
  "review-astra",
];
export const reviewRoles: Record<Phase, Role[]> = {
  planning: ["review-glm", "review-deepseek"],
  implementation: ["review-glm", "review-deepseek", "review-astra"],
};
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
  return state.repairs.implementation?.head ?? round.head;
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
            validOutcomes(item.outcomes, state.lenses[phase]),
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
function repaired(
  state: Workflow,
  phase: "implementation" | "hosted",
  requestedAction: string,
) {
  const decisions = settled(state, phase, requestedAction);
  requireThat(
    !decisions.some(
      (decision) =>
        decision.action === "fix" &&
        !waiverFor(state, phase, requestedAction, decision.id),
    ) || state.repairs[phase]?.status === "complete",
    `${phase} repairs require completed verification or an exact scoped waiver`,
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
  if (phase === "planning") settled(state, phase, requestedAction);
  else repaired(state, phase, requestedAction);
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
        state.repairs.hosted?.head ??
        state.repairs.implementation?.head ??
        state.publication?.head ??
        state.rounds.implementation?.head;
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
        delete state.handoff;
      } else if (input.allowedPhases.includes("implementation"))
        delete state.rounds.implementation;
      state.decisions = {};
      state.assessments = {};
      state.waivers = [];
      state.repairs = {};
      if (
        input.allowedPhases.includes("planning") ||
        input.allowedPhases.includes("implementation")
      )
        delete state.publication;
      delete state.hosted;
      delete state.finished;
    } else if (action === "triage") {
      const phase = input.phase === "hosted" ? "hosted" : phaseOf(input.phase);
      requireThat(
        !(phase === "planning"
          ? state.handoff
          : phase === "implementation"
            ? state.publication
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
                validOutcomes(item.outcomes, state.lenses[phase]),
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
        phase === "implementation" ? "publication" : "finish",
      );
      if (input.stage === "start") {
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
            nonempty(input.head) &&
            nonempty(input.verification),
          "Repair completion requires a started batch, exact head and named verification",
        );
        state.repairs[phase] = {
          status: "complete",
          head: input.head,
          verification: input.verification,
        };
      }
    } else if (action === "publication") {
      repaired(state, "implementation", "publication");
      requireThat(!state.publication, "Publication already recorded");
      requireThat(
        nonempty(input.targetBase) &&
          /^[a-f0-9]{40,64}$/.test(input.targetBase),
        "Publication requires the exact target-base SHA",
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
          (state.repairs.implementation?.head ??
            state.rounds.implementation?.head),
        "Publication head differs from reviewed or repaired implementation",
      );
      state.publication = observed;
      if (policy.ci === "not-required" && policy.reviewer === "not-required") {
        state.hosted = {
          ...observed,
          status: "completed",
          findings: [],
          evidence: `${observed.evidence} Hosted CI and automated review are not required by ${policy.source}.`,
        };
      }
    } else if (action === "finish") {
      repaired(state, "hosted", "finish");
      const final = receipt(input, validatedPolicy(state.deliveryPolicy));
      requireThat(
        final.artifactUrl === state.publication?.artifactUrl &&
          final.reviewer === state.publication.reviewer,
        "Final artifact differs from publication",
      );
      const expectedHead = state.repairs.hosted?.head ?? state.publication.head;
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
