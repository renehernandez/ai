import { execFile } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  inFlight,
  locked,
  nonempty,
  requireThat,
  type Transport,
  type Workflow,
} from "./paseo-workflow-state.ts";

// herdr-core has no scheduler, so a chain of short-lived ticker terminals wakes the orchestrator.
// Each ticker sleeps one interval, starts its successor, and exits; herdr-core types a note about the exit into its parent.
const execute = promisify(execFile);
export const tickerIntervalMs = 5 * 60_000;
export const chainLifetimeMs = 24 * 60 * 60_000;
const tickerScript = fileURLToPath(import.meta.url);

export type TickerConfig = {
  generation: number;
  workflowId: string;
  stopFile: string;
  parent: string;
  cwd: string;
  labels: Record<string, string>;
  expiresAt: number;
  intervalMs: number;
  prompt: string;
};
export type TickerDeps = {
  hc: (args: string[]) => Promise<string>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  readStop: () => Promise<number>;
};
type TickerOutcome =
  | "stopped"
  | "expired"
  | "orphaned"
  | "successor"
  | "successor-failed";

export const tickerName = (config: TickerConfig, seq: number) =>
  `ax-tick-${config.workflowId}-${config.generation}-${seq}`;
export function tickerRunArgs(
  config: TickerConfig,
  configPath: string,
  seq: number,
) {
  return [
    "run",
    "--bg",
    "--json",
    "--rm",
    "--name",
    tickerName(config, seq),
    "--cwd",
    config.cwd,
    "--parent",
    config.parent,
    ...Object.entries({
      ...config.labels,
      "ax.workflow": config.workflowId,
      "ax.role": "ticker",
      "ax.generation": String(config.generation),
    }).flatMap(([key, value]) => ["--label", `${key}=${value}`]),
    "--",
    "node",
    tickerScript,
    configPath,
    String(seq),
  ];
}

// Only definite evidence that the orchestrator terminal is gone ends the chain; a transient failure never does.
async function parentLive(config: TickerConfig, deps: TickerDeps) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const terminal = JSON.parse(
        await deps.hc(["get", "--json", config.parent]),
      );
      return terminal?.state === "live";
    } catch (error) {
      const detail = `${String((error as { stdout?: unknown }).stdout ?? "")} ${String(error)}`;
      if (/not_found/.test(detail)) return false;
      if (attempt < 3) await deps.sleep(1000 * attempt);
    }
  }
  return true;
}

// One ticker lifetime: wait, honor the stop marker, expiry, and orphan bound, then start the successor.
export async function tickerStep(
  config: TickerConfig,
  configPath: string,
  seq: number,
  deps: TickerDeps,
): Promise<TickerOutcome> {
  await deps.sleep(config.intervalMs);
  if ((await deps.readStop()) >= config.generation) return "stopped";
  if (deps.now() >= config.expiresAt) return "expired";
  if (!(await parentLive(config, deps))) return "orphaned";
  // A stop recorded while the parent was checked must still win.
  if ((await deps.readStop()) >= config.generation) return "stopped";
  try {
    await deps.hc(tickerRunArgs(config, configPath, seq + 1));
    return "successor";
  } catch {
    // The exit still notes the orchestrator, and that tick finds no live ticker and starts a chain.
    return "successor-failed";
  }
}

export async function readStopGeneration(stopFile: string) {
  try {
    const value = Number((await readFile(stopFile, "utf8")).trim());
    return Number.isInteger(value) ? value : 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}
const stopFileOf = (path: string, state: Workflow) =>
  resolve(state.scratch ?? dirname(path), "ticker-stop");
const configOf = (path: string, state: Workflow, generation: number) =>
  resolve(state.scratch ?? dirname(path), `ticker-${generation}.json`);
async function writeAtomic(path: string, content: string) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

type Terminal = {
  address: string;
  labels: Record<string, string>;
  parent: string | null;
};
// The workflow's live labelled terminals: workers and tickers.
export async function labelledTerminals(
  workflowId: string | undefined,
  transport: Transport,
): Promise<Terminal[]> {
  requireThat(nonempty(workflowId), "State has no workflow label");
  const listed = JSON.parse(
    await transport(
      ["ls", "--json", "--label", `ax.workflow=${workflowId}`],
      30_000,
    ),
  );
  requireThat(
    Array.isArray(listed?.terminals) &&
      listed.terminals.every(
        (row: Terminal) =>
          nonempty(row?.address) &&
          typeof row.labels === "object" &&
          row.labels !== null,
      ),
    "herdr-core returned an invalid terminal list",
  );
  return listed.terminals.map((row: Terminal) => ({
    address: row.address,
    labels: row.labels,
    parent: row.parent ?? null,
  }));
}
const isTicker = (terminal: Terminal) =>
  terminal.labels["ax.role"] === "ticker";

// Stops the chain in two phases: record the newest generation in the stop file, then kill by label and sweep once more.
export async function stopChain(
  path: string,
  state: Workflow,
  transport: Transport,
) {
  const generation = state.tickerGenerations ?? 0;
  const stopFile = stopFileOf(path, state);
  if (!generation) return;
  if (!state.ticker && (await readStopGeneration(stopFile)) >= generation)
    return;
  await writeAtomic(stopFile, String(generation));
  for (let pass = 0; pass < 2; pass++)
    for (const terminal of (
      await labelledTerminals(state.workflowId, transport)
    ).filter(isTicker))
      await transport(["kill", "--json", terminal.address], 30_000).catch(
        () => {},
      );
  delete state.ticker;
}

export type TickerStatus =
  | { status: "armed" | "re-armed"; generation: number; reason?: string }
  | { status: "stopped" };

// Keeps one live ticker chain on the caller while work is in flight, re-arming before half its lifetime passes.
export async function syncTicker(
  path: string,
  callerId: string | undefined,
  transport: Transport,
  prompt: (state: Workflow) => string,
  now = Date.now,
): Promise<TickerStatus> {
  return locked(path, async (state) => {
    if (state.finished || !inFlight(state, now()).length) {
      await stopChain(path, state, transport);
      return { status: "stopped" as const };
    }
    requireThat(
      nonempty(callerId),
      "Arming the ticker chain requires the caller's HC_TERMINAL_ID",
    );
    const current = state.ticker;
    const live = (await labelledTerminals(state.workflowId, transport)).filter(
      isTicker,
    );
    const alive =
      current &&
      live.some(
        (terminal) =>
          terminal.labels["ax.generation"] === String(current.generation),
      );
    const reason = !current
      ? undefined
      : !alive
        ? "no live ticker"
        : current.parent !== callerId
          ? "orchestrator terminal changed"
          : Date.parse(current.expiresAt) - now() <= chainLifetimeMs / 2
            ? "chain past half its lifetime"
            : undefined;
    if (current && !reason) {
      // Standing-order changes reach the next note without restarting the chain.
      const config = JSON.parse(await readFile(current.config, "utf8"));
      if (config.prompt !== prompt(state))
        await writeAtomic(
          current.config,
          JSON.stringify({ ...config, prompt: prompt(state) }),
        );
      return { status: "armed" as const, generation: current.generation };
    }
    // A live predecessor chain is stopped before its replacement starts, so exactly one chain remains.
    if (live.length)
      await stopChain(path, { ...state, ticker: current }, transport);
    const generation = (state.tickerGenerations ?? 0) + 1;
    const config: TickerConfig = {
      generation,
      workflowId: state.workflowId ?? "",
      stopFile: stopFileOf(path, state),
      parent: callerId,
      cwd: state.scratch ?? dirname(path),
      labels:
        state.orchestrator?.id === callerId ? state.orchestrator.labels : {},
      expiresAt: now() + chainLifetimeMs,
      intervalMs: tickerIntervalMs,
      prompt: prompt(state),
    };
    const configPath = configOf(path, state, generation);
    await writeAtomic(configPath, JSON.stringify(config));
    state.tickerGenerations = generation;
    const started = JSON.parse(
      await transport(tickerRunArgs(config, configPath, 1), 30_000),
    );
    requireThat(
      nonempty(started?.address),
      "herdr-core did not start the ticker",
    );
    state.ticker = {
      generation,
      parent: callerId,
      config: configPath,
      expiresAt: new Date(config.expiresAt).toISOString(),
    };
    return {
      status: current ? ("re-armed" as const) : ("armed" as const),
      generation,
      ...(reason ? { reason } : {}),
    };
  });
}

export function loopStatus(state: Workflow, now = Date.now) {
  if (!state.ticker) return inFlight(state).length ? "unarmed" : "idle";
  return Date.parse(state.ticker.expiresAt) <= now() ? "expired" : "armed";
}

if (process.argv[1] && resolve(process.argv[1]) === tickerScript) {
  const [configPath, seq] = process.argv.slice(2);
  const config: TickerConfig = JSON.parse(await readFile(configPath, "utf8"));
  const outcome = await tickerStep(config, configPath, Number(seq), {
    hc: async (args) => (await execute("hc", args, { timeout: 30_000 })).stdout,
    now: Date.now,
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    readStop: () => readStopGeneration(config.stopFile),
  });
  // The prompt is re-read so a standing-order change made during the sleep reaches this note.
  const latest = JSON.parse(await readFile(configPath, "utf8"));
  process.stdout.write(`${outcome}\n${latest.prompt}\n`);
}
