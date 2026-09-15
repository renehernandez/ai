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
  status: "reserved" | "running" | "complete" | "failed";
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
export type Receipt = {
  artifactUrl: string;
  head: string;
  reviewer: "genie" | "nitro";
  ready: true;
  evidence: string;
};
export type Hosted = Omit<Receipt, "ready"> & {
  ready: boolean | null;
  status: "waiting" | "completed" | "awaiting-user" | "failed" | "timed-out";
  findings: { id: string; evidence: string }[];
};
export type Input = Partial<Receipt> & {
  phase?: Phase | "hosted";
  decisions?: Decision[];
  stage?: "start" | "complete";
  verification?: string;
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
  handoff?: Review & { brief: Snapshot; planResolution: Snapshot };
  repairs: Partial<
    Record<
      "implementation" | "hosted",
      { status: "started" | "complete"; head?: string; verification?: string }
    >
  >;
  publication?: Receipt;
  hosted?: Hosted;
  finished?: string;
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
    repairs: {},
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
function findings(state: Workflow, phase: Phase | "hosted") {
  if (phase === "hosted") {
    requireThat(
      state.hosted?.status === "completed",
      "Hosted review has not completed",
    );
    return state.hosted.findings.map((item) => item.id);
  }
  const round = state.rounds[phase];
  requireThat(round, "Review has not run");
  return reviewRoles[phase].flatMap((role) => {
    const review = round.reviews[role];
    requireThat(
      review.status === "complete" && review.outcomes,
      `${role} review is incomplete or failed`,
    );
    return Object.entries(review.outcomes).flatMap(([id, outcome]) => {
      requireThat(
        outcome.status !== "blocked",
        `${role}:${id} is blocked evidence`,
      );
      return outcome.status === "finding"
        ? outcome.findings.map((finding) => `${role}:${id}:${finding.id}`)
        : [];
    });
  });
}
export function settled(state: Workflow, phase: Phase | "hosted") {
  findings(state, phase);
  const decisions = state.decisions[phase];
  requireThat(
    decisions && !decisions.some((decision) => decision.action === "question"),
    `${phase} findings need explicit triage or user input`,
  );
  return decisions;
}
function repaired(state: Workflow, phase: "implementation" | "hosted") {
  const decisions = settled(state, phase);
  requireThat(
    !decisions.some((decision) => decision.action === "fix") ||
      state.repairs[phase]?.status === "complete",
    `${phase} repairs require completed verification`,
  );
}
export function receipt(input: Partial<Receipt>): Receipt {
  requireThat(
    nonempty(input.artifactUrl) &&
      /^https:\/\//.test(input.artifactUrl) &&
      nonempty(input.head) &&
      (input.reviewer === "genie" || input.reviewer === "nitro") &&
      input.ready === true &&
      nonempty(input.evidence),
    "Finish must supply observed Ready artifact, head, reviewer and source evidence",
  );
  return {
    artifactUrl: input.artifactUrl,
    head: input.head,
    reviewer: input.reviewer,
    ready: true,
    evidence: input.evidence,
  };
}
export async function transition(path: string, action: string, input: Input) {
  return locked(path, (state) => {
    requireThat(!state.finished, "Workflow already finished");
    if (action === "triage") {
      const phase = input.phase === "hosted" ? "hosted" : phaseOf(input.phase);
      requireThat(
        !(phase === "planning"
          ? state.handoff
          : phase === "implementation"
            ? state.publication
            : state.repairs.hosted),
        "Triage is already consumed by the next phase",
      );
      const ids = findings(state, phase);
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
    } else if (action === "repair") {
      requireThat(
        input.phase === "implementation" || input.phase === "hosted",
        "Invalid repair phase",
      );
      const phase = input.phase as "implementation" | "hosted";
      const decisions = settled(state, phase);
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
      repaired(state, "implementation");
      requireThat(!state.publication, "Publication already recorded");
      const observed = receipt(input);
      requireThat(
        observed.head ===
          (state.repairs.implementation?.head ??
            state.rounds.implementation?.head),
        "Publication head differs from reviewed or repaired implementation",
      );
      state.publication = observed;
    } else if (action === "finish") {
      repaired(state, "hosted");
      const final = receipt(input);
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
