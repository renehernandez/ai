import { execFile, spawn } from "node:child_process";
import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { tickPrompt } from "./paseo-workflow-io.ts";
import {
  inFlight,
  locked,
  nonempty,
  requireThat,
  type Transport,
  type Workflow,
  workers,
} from "./paseo-workflow-state.ts";

// herdr-core has no scheduler and types no parent note when a live agent finishes a turn, so one watcher
// process per workflow follows `hc events` and decides when to tick. It never types into the orchestrator:
// typing joins and submits a person's unsent draft. It writes a wake request that the orchestrator's
// managed Pi extension (hooks/pi/wake.ts) delivers in-process.
const execute = promisify(execFile);
export const watchIntervalMs = 5 * 60_000;
export const coalesceMs = 5_000;
export const resendMs = 15 * 60_000;
export const pollMs = 15_000;
export const watcherLifetimeMs = 24 * 60 * 60_000;
export const replaceAfterMs = 12 * 60 * 60_000;
const watchScript = fileURLToPath(import.meta.url);

// Mirrors hooks/pi/wake.ts, which the runner cannot import from its separately installed skill folder.
export const wakeSessionFile = "session.json";
export function wakeRoot(env: NodeJS.ProcessEnv = process.env) {
  const state = env.XDG_STATE_HOME?.trim()
    ? env.XDG_STATE_HOME
    : join(env.HOME ?? homedir(), ".local", "state");
  return resolve(state, "ax", "wake");
}
function requireAddress(address: string) {
  requireThat(
    /^[A-Za-z0-9_-]+$/u.test(address),
    `Invalid herdr-core terminal address ${address}`,
  );
  return address;
}
export const wakeDirectory = (root: string, address: string) =>
  join(root, requireAddress(address));
export type WakeRequest = {
  workflow: string;
  nonce: string;
  generation: number;
  n: number;
  prompt: string;
};
export const wakeRequestFile = (
  wake: { root: string; address: string },
  workflowId: string,
) => join(wakeDirectory(wake.root, wake.address), `${workflowId}.json`);
async function readJson(path: string) {
  try {
    const text = await readOptional(path);
    return text === undefined ? undefined : JSON.parse(text);
  } catch {
    return undefined;
  }
}
// The orchestrator Pi session's nonce, which its managed extension writes at session start.
export async function readSessionNonce(directory: string) {
  const nonce = (await readJson(join(directory, wakeSessionFile)))?.nonce;
  return nonempty(nonce) ? (nonce as string) : undefined;
}

// Records the caller's wake directory and current session nonce, and deletes every request there bound to another session.
export async function bindWake(
  state: Workflow,
  callerId: string,
  root = wakeRoot(),
) {
  const directory = wakeDirectory(root, callerId);
  const nonce = await readSessionNonce(directory);
  state.wake = { root, address: callerId, ...(nonce ? { nonce } : {}) };
  if (!nonce) return;
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (entry === wakeSessionFile || !entry.endsWith(".json")) continue;
    const file = join(directory, entry);
    if ((await readJson(file))?.nonce !== nonce)
      await rm(file, { force: true });
  }
}

export type RetiringMarker = {
  generation: number;
  terminal: string;
  recoveryPending?: true;
};

const scratchOf = (path: string, state: Workflow) =>
  state.scratch ?? dirname(resolve(path));
export const stopFileOf = (path: string, state: Workflow) =>
  resolve(scratchOf(path, state), "watcher-stop");
export const retiringFileOf = (
  path: string,
  state: Workflow,
  generation: number,
) => resolve(scratchOf(path, state), `watcher-retiring-${generation}.json`);
async function writeAtomic(path: string, content: string) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}
async function readOptional(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function readStopGeneration(stopFile: string) {
  const value = Number((await readOptional(stopFile))?.trim());
  return Number.isInteger(value) ? value : 0;
}
async function readRetiring(path: string, state: Workflow, generation: number) {
  const text = await readOptional(retiringFileOf(path, state, generation));
  return text === undefined ? undefined : (JSON.parse(text) as RetiringMarker);
}

// Terminal addresses of in-flight workers, including conflicted earlier attempts, whichever orchestrator started them.
export function watchedAddresses(state: Workflow, now = Date.now()) {
  const names = new Set(inFlight(state, now));
  return new Set(
    workers(state)
      .filter(({ name }) => names.has(name))
      .flatMap(({ worker }) => [
        worker.agentId,
        ...(worker.attempts ?? [])
          .filter((attempt) => attempt.status === "conflict")
          .map((attempt) => attempt.agentId),
      ])
      .filter(nonempty),
  );
}

type Terminal = {
  address: string;
  labels: Record<string, string>;
  parent: string | null;
};
// The workflow's live labelled terminals: workers and the watcher.
// herdr-core 0.1.21 `ls` rows carry no labels and its `--label` filter matches nothing, so each live terminal's labels come from `get`.
export async function labelledTerminals(
  workflowId: string | undefined,
  transport: Transport,
): Promise<Terminal[]> {
  requireThat(nonempty(workflowId), "State has no workflow label");
  const listed = JSON.parse(await transport(["ls", "--json"], 30_000));
  requireThat(
    Array.isArray(listed?.terminals) &&
      listed.terminals.every((row: Terminal) => nonempty(row?.address)),
    "herdr-core returned an invalid terminal list",
  );
  const terminals: Terminal[] = [];
  for (const { address } of listed.terminals as Terminal[]) {
    let terminal: Partial<Terminal>;
    try {
      terminal = JSON.parse(
        await transport(["get", "--json", address], 30_000),
      );
    } catch (error) {
      // A terminal that ended between `ls` and `get` is no longer live.
      if (
        /not_found/.test(
          `${(error as { stdout?: unknown }).stdout ?? ""} ${error}`,
        )
      )
        continue;
      throw error;
    }
    requireThat(
      typeof terminal?.labels === "object" && terminal.labels !== null,
      `herdr-core get output for ${address} lacks labels`,
    );
    if (terminal.labels["ax.workflow"] === workflowId)
      terminals.push({
        address,
        labels: terminal.labels,
        parent: terminal.parent ?? null,
      });
  }
  return terminals;
}
const isWatcher = (terminal: Terminal) =>
  terminal.labels["ax.role"] === "watcher";

// Records the stop generation first, so a watcher older than it requests nothing, then kills watchers by label and sweeps once more.
async function retireWatchers(
  path: string,
  state: Workflow,
  transport: Transport,
  stopGeneration: number,
) {
  await writeAtomic(stopFileOf(path, state), String(stopGeneration));
  // The stop file alone silences an old watcher, so the kill sweep is best-effort.
  for (let pass = 0; pass < 2; pass++)
    for (const terminal of (
      await labelledTerminals(state.workflowId, transport).catch(() => [])
    ).filter(isWatcher))
      await transport(["kill", "--json", terminal.address], 30_000).catch(
        () => {},
      );
  delete state.watcher;
}
export async function stopWatcher(
  path: string,
  state: Workflow,
  transport: Transport,
) {
  const generation = state.watcherGenerations ?? 0;
  if (!generation) return;
  if (
    !state.watcher &&
    (await readStopGeneration(stopFileOf(path, state))) > generation
  )
    return;
  await retireWatchers(path, state, transport, generation + 1);
}

export function watcherRunArgs(
  path: string,
  state: Workflow,
  parent: string,
  generation: number,
) {
  const labels = {
    ...(state.orchestrator?.id === parent ? state.orchestrator.labels : {}),
    "ax.workflow": state.workflowId ?? "",
    "ax.role": "watcher",
    "ax.generation": String(generation),
  };
  return [
    "run",
    "--bg",
    "--rm",
    "--no-notify",
    "--json",
    "--name",
    `ax-watch-${state.workflowId?.slice(0, 4)}${generation}`,
    "--cwd",
    scratchOf(path, state),
    "--parent",
    parent,
    ...Object.entries(labels).flatMap(([key, value]) => [
      "--label",
      `${key}=${value}`,
    ]),
    "--",
    "node",
    watchScript,
    resolve(path),
    parent,
    String(generation),
  ];
}

export type WatcherStatus =
  | { status: "watching"; generation: number }
  | { status: "started"; generation: number; reason?: string }
  | { status: "missing"; reason: string }
  | { status: "stopped" };

// Keeps exactly one live watcher under the caller while work is in flight; a retiring, lost, moved, or 12-hour-old watcher is replaced.
export async function syncWatcher(
  path: string,
  callerId: string | undefined,
  transport: Transport,
  now = Date.now,
): Promise<WatcherStatus> {
  return locked(path, async (state) => {
    // The runner runs inside the orchestrator's Pi, so its environment names the extension's wake root.
    if (nonempty(callerId)) await bindWake(state, callerId);
    if (state.finished || !inFlight(state, now()).length) {
      await stopWatcher(path, state, transport);
      return { status: "stopped" as const };
    }
    requireThat(
      nonempty(callerId),
      "Starting the workflow watcher requires the caller's HC_TERMINAL_ID",
    );
    const current = state.watcher;
    let live: Terminal[];
    try {
      live = (await labelledTerminals(state.workflowId, transport)).filter(
        isWatcher,
      );
    } catch (error) {
      // An unobservable watcher is kept, or left missing, rather than duplicated; the next tick looks again.
      return current
        ? { status: "watching" as const, generation: current.generation }
        : {
            status: "missing" as const,
            reason: `terminal list unavailable: ${(error as Error).message}`,
          };
    }
    const retiring =
      current && (await readRetiring(path, state, current.generation));
    const reason = !current
      ? undefined
      : retiring
        ? retiring.recoveryPending
          ? "watcher retired with recovery pending"
          : "watcher retiring"
        : !live.some(
              (terminal) =>
                terminal.labels["ax.generation"] === String(current.generation),
            )
          ? "no live watcher"
          : current.parent !== callerId
            ? "orchestrator terminal changed"
            : now() - Date.parse(current.startedAt) >= replaceAfterMs
              ? "watcher older than 12 hours"
              : undefined;
    if (current && !reason)
      return { status: "watching" as const, generation: current.generation };
    const generation = (state.watcherGenerations ?? 0) + 1;
    // Every earlier watcher is silenced and killed before the replacement starts, so exactly one remains.
    if (current || live.length)
      await retireWatchers(path, state, transport, generation);
    state.watcherGenerations = generation;
    const started = JSON.parse(
      await transport(
        watcherRunArgs(path, state, callerId, generation),
        30_000,
      ),
    );
    requireThat(
      nonempty(started?.address),
      "herdr-core did not start the workflow watcher",
    );
    state.watcher = {
      generation,
      terminal: started.address,
      parent: callerId,
      startedAt: new Date(now()).toISOString(),
    };
    return {
      status: "started" as const,
      generation,
      ...(reason ? { reason } : {}),
    };
  });
}

// What `status` reports without contacting herdr-core: a missing, retired, or expired watcher while work is in flight.
export async function watcherStatus(
  path: string,
  state: Workflow,
  now = Date.now,
) {
  if (!inFlight(state, now()).length) return "idle";
  if (!state.watcher) return "missing";
  const retiring = await readRetiring(path, state, state.watcher.generation);
  if (retiring?.recoveryPending) return "missing (recovery pending)";
  if (retiring) return "missing (retiring)";
  return Date.parse(state.watcher.startedAt) + watcherLifetimeMs <= now()
    ? "expired"
    : "watching";
}

export type WatchConfig = {
  state: string;
  orchestrator: string;
  generation: number;
};
export type WatchDeps = {
  // Read-only herdr-core observation; the watcher never sends.
  hc: (args: string[], timeoutMs: number) => Promise<string>;
  // The orchestrator Pi session's current nonce, re-read before each request so a restarted Pi keeps its ticks.
  readNonce: (state: Workflow) => Promise<string | undefined>;
  // Writes this workflow's one wake request atomically.
  writeRequest: (state: Workflow, request: WakeRequest) => Promise<void>;
  now: () => number;
  readState: () => Promise<Workflow>;
  readStop: () => Promise<number>;
  writeRetiring: (marker: RetiringMarker) => Promise<void>;
  // The watcher's own terminal address, named in its retiring marker.
  terminal: string;
};
type StreamEvent = {
  terminal?: string;
  type?: string;
  data?: { status?: { state?: string } | null; state?: string };
};

// The watcher's decisions, driven by event lines and a once-a-second step, so a scripted `hc` can test them.
export function createWatcher(config: WatchConfig, deps: WatchDeps) {
  const startedAt = deps.now();
  // The first change of the current burst; the burst is sent as one tick prompt once it is coalesceMs old.
  let changedAt: number | undefined;
  // A skipped or failed request waits for the next change, the orchestrator unblocking, or the interval.
  let owed = false;
  let lastSentAt: number | undefined;
  // Requests within this generation; a replacement watcher's newer generation orders after every one of them.
  let requests = 0;
  let lastPeriodicAt = startedAt;
  let polling = false;
  let lastPollAt = 0;
  const polled = new Map<string, string>();
  const markChange = () => {
    changedAt ??= deps.now();
  };
  const watched = async () => watchedAddresses(await deps.readState());

  async function onLine(line: string) {
    let event: StreamEvent | undefined;
    try {
      const message = JSON.parse(line);
      event = message?.method === "event" ? message.params : undefined;
    } catch {
      return;
    }
    if (!event?.terminal) return;
    if (event.terminal === config.orchestrator) {
      if (
        owed &&
        event.type === "status" &&
        event.data?.status?.state !== "blocked"
      )
        markChange();
      return;
    }
    const state = event.data?.status?.state;
    const relevant =
      event.type === "turn" ||
      event.type === "finished" ||
      (event.type === "status" &&
        (state === "done" || state === "blocked" || state === "error"));
    if (relevant && (await watched()).has(event.terminal)) markChange();
  }

  // Once the stream is open, a worker that already ended its turn, blocked, errored, or exited before it, for example during the dispatch that started this watcher or while the stream was down, counts as a change.
  async function onOpen() {
    for (const address of await watched()) {
      let terminal: { state?: string; status?: { state?: string } | null };
      try {
        terminal = JSON.parse(
          await deps.hc(["get", "--json", address], 30_000),
        );
      } catch (error) {
        if (
          /not_found/.test(
            `${(error as { stdout?: unknown }).stdout ?? ""} ${error}`,
          )
        )
          markChange();
        continue;
      }
      const status = terminal?.status?.state;
      if (
        terminal?.state !== "live" ||
        status === "done" ||
        status === "blocked" ||
        status === "error"
      )
        markChange();
    }
  }

  // While the event stream is down, `hc get` on each watched worker detects a changed state, status, or turn.
  async function poll() {
    for (const address of await watched()) {
      let fingerprint: string;
      try {
        const terminal = JSON.parse(
          await deps.hc(["get", "--json", address], 30_000),
        );
        fingerprint = `${terminal?.state}|${terminal?.status?.state}|${terminal?.turn}`;
      } catch (error) {
        fingerprint = /not_found/.test(
          `${(error as { stdout?: unknown }).stdout ?? ""} ${error}`,
        )
          ? "gone"
          : (polled.get(address) ?? "");
      }
      const previous = polled.get(address);
      if (previous !== undefined && previous !== fingerprint) markChange();
      polled.set(address, fingerprint);
    }
  }

  // Writes a wake request unless the orchestrator is blocked, for example at a permission dialog.
  async function requestTick(state: Workflow) {
    try {
      const orchestrator = JSON.parse(
        await deps.hc(["get", "--json", config.orchestrator], 30_000),
      );
      if (
        orchestrator?.state !== "live" ||
        orchestrator?.status?.state === "blocked"
      )
        return false;
      const nonce = await deps.readNonce(state);
      if (!nonempty(nonce) || !nonempty(state.workflowId)) return false;
      requests += 1;
      await deps.writeRequest(state, {
        workflow: state.workflowId,
        nonce,
        generation: config.generation,
        n: requests,
        prompt: tickPrompt(config.state, state),
      });
    } catch {
      return false;
    }
    lastSentAt = deps.now();
    lastPeriodicAt = lastSentAt;
    return true;
  }

  async function step(): Promise<"stopped" | "expired" | undefined> {
    if ((await deps.readStop()) > config.generation) return "stopped";
    const now = deps.now();
    if (now - startedAt >= watcherLifetimeMs) return "expired";
    if (polling && now - lastPollAt >= pollMs) {
      lastPollAt = now;
      await poll();
    }
    const changeDue = changedAt !== undefined && now - changedAt >= coalesceMs;
    const periodicDue = now - lastPeriodicAt >= watchIntervalMs;
    if (!changeDue && !periodicDue) return undefined;
    if (periodicDue) lastPeriodicAt = now;
    changedAt = undefined;
    const state = await deps.readState();
    const lastTick = Date.parse(state.lastTickAt ?? "") || 0;
    // A periodic tick is skipped when a tick ran within the interval.
    if (!changeDue && !owed && now - lastTick < watchIntervalMs)
      return undefined;
    // One unconsumed prompt: the queued tick will see this change; after resendMs it counts as dropped.
    if (
      lastSentAt !== undefined &&
      lastSentAt > lastTick &&
      now - lastSentAt < resendMs
    )
      return undefined;
    owed = !(await requestTick(state));
    return undefined;
  }

  // A hang-up or termination while current leaves a retiring marker and one recovery tick, or records that recovery is pending.
  async function retire(): Promise<"stopped" | "retired" | "recovery-pending"> {
    if ((await deps.readStop()) > config.generation) return "stopped";
    const marker = { generation: config.generation, terminal: deps.terminal };
    await deps.writeRetiring(marker);
    if (await requestTick(await deps.readState())) return "retired";
    await deps.writeRetiring({ ...marker, recoveryPending: true });
    return "recovery-pending";
  }

  return {
    onOpen,
    onLine,
    step,
    retire,
    setPolling: (value: boolean) => {
      polling = value;
      if (value) lastPollAt = 0;
    },
    lastSentAt: () => lastSentAt,
  };
}

// Follows the event stream, reopening it with backoff after it ends; the watcher polls while it is down.
export async function followEvents(
  open: () => AsyncIterable<string>,
  handlers: {
    onOpen: () => Promise<void>;
    onLine: (line: string) => Promise<void>;
    setPolling: (polling: boolean) => void;
  },
  sleep: (ms: number) => Promise<void>,
  running: () => boolean,
) {
  let backoff = 1000;
  while (running()) {
    try {
      let opened = false;
      for await (const line of open()) {
        if (!opened) {
          opened = true;
          handlers.setPolling(false);
          backoff = 1000;
          await handlers.onOpen();
        }
        await handlers.onLine(line);
        if (!running()) return;
      }
    } catch {
      /* A failed or ended stream is reopened below. */
    }
    if (!running()) return;
    handlers.setPolling(true);
    await sleep(backoff);
    backoff = Math.min(backoff * 2, 30_000);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === watchScript) {
  const [statePath, orchestrator, generation] = process.argv.slice(2);
  const readState = async () =>
    JSON.parse(await readFile(statePath, "utf8")) as Workflow;
  const initial = await readState();
  const config = {
    state: statePath,
    orchestrator,
    generation: Number(generation),
  };
  // The runner records the orchestrator's wake root, so this process need not share its environment.
  const directory = (state: Workflow) =>
    wakeDirectory(state.wake?.root ?? wakeRoot(), orchestrator);
  const watcher = createWatcher(config, {
    hc: async (args, timeout) =>
      (await execute("hc", args, { timeout, maxBuffer: 8 * 1024 * 1024 }))
        .stdout,
    readNonce: (state) => readSessionNonce(directory(state)),
    writeRequest: (state, request) =>
      writeAtomic(
        join(directory(state), `${request.workflow}.json`),
        JSON.stringify(request),
      ),
    now: Date.now,
    readState,
    readStop: () => readStopGeneration(stopFileOf(statePath, initial)),
    writeRetiring: (marker) =>
      writeAtomic(
        retiringFileOf(statePath, initial, marker.generation),
        JSON.stringify(marker),
      ),
    terminal: process.env.HC_TERMINAL_ID ?? "",
  });
  let running = true;
  let events: ReturnType<typeof spawn> | undefined;
  const exit = () => {
    running = false;
    events?.kill();
    process.exit(0);
  };
  let retiring: Promise<unknown> | undefined;
  for (const signal of ["SIGHUP", "SIGTERM"] as const)
    process.on(signal, () => {
      retiring ??= watcher
        .retire()
        .catch(() => {})
        .finally(exit);
    });
  let busy = false;
  setInterval(async () => {
    if (busy || retiring) return;
    busy = true;
    try {
      if (await watcher.step()) exit();
    } catch {
      /* A transient read or write failure is retried at the next step. */
    } finally {
      busy = false;
    }
  }, 1000);
  await followEvents(
    () => {
      events = spawn("hc", ["events", "--json"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      return createInterface({ input: events.stdout as NodeJS.ReadableStream });
    },
    watcher,
    (ms) => new Promise((done) => setTimeout(done, ms)),
    () => running,
  );
}
