import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  launchArguments,
  parseRoute,
  readRoutes,
} from "../../hooks/pi/launch.ts";
import {
  wakeDirectory as extensionWakeDirectory,
  wakeRoot as extensionWakeRoot,
  sessionFile,
  startWake,
  tickPromptPrefix,
} from "../../hooks/pi/wake.ts";
import {
  createWatcher,
  readSessionNonce,
  wakeDirectory as runnerWakeDirectory,
  wakeRoot as runnerWakeRoot,
  wakeSessionFile,
  watchIntervalMs,
  writeWakeRequest,
} from "../../skills/herdr-orchestration/scripts/watch.ts";
import { launchArgv } from "../../skills/herdr-orchestration/scripts/workflow.ts";
import { tickPrompt } from "../../skills/herdr-orchestration/scripts/workflow-io.ts";
import {
  roles,
  routesFromTable,
  type Workflow,
} from "../../skills/herdr-orchestration/scripts/workflow-state.ts";

// The runner skill installs apart from hooks/pi, so it mirrors the extension's wake protocol and the launcher's route parsing; these tests hold both sides equal.
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("the runner and the Pi wake extension agree on the wake root, directory, session file, and tick prompt", () => {
  for (const env of [
    { XDG_STATE_HOME: "/x/state", HOME: "/h" },
    { XDG_STATE_HOME: "   ", HOME: "/h" },
    { XDG_STATE_HOME: "", HOME: "/h" },
    { XDG_STATE_HOME: "relative/state", HOME: "/h" },
    { HOME: "/h" },
  ])
    assert.equal(
      runnerWakeRoot(env),
      extensionWakeRoot(env),
      JSON.stringify(env),
    );
  for (const address of ["t8", "T_8-x", "t12"])
    assert.equal(
      runnerWakeDirectory("/r", address),
      extensionWakeDirectory("/r", address),
    );
  for (const address of ["../t8", "t8/x", "", "t 8", "t8.json"]) {
    assert.throws(
      () => runnerWakeDirectory("/r", address),
      /Invalid herdr-core/u,
    );
    assert.throws(
      () => extensionWakeDirectory("/r", address),
      /Invalid herdr-core/u,
    );
  }
  assert.equal(wakeSessionFile, sessionFile);
  const state = { standingOrders: [] } as unknown as Workflow;
  assert.ok(
    tickPrompt("/tmp/wf/state.json", state).startsWith(tickPromptPrefix),
  );
});

test("a tick request the watcher writes is accepted and delivered once by the Pi wake extension", async () => {
  const root = mkdtempSync(join(tmpdir(), "ax-wake-parity-"));
  const directory = runnerWakeDirectory(root, "t8");
  const delivered: string[] = [];
  const wake = startWake({
    directory: extensionWakeDirectory(root, "t8"),
    pollMs: 60_000,
    deliver: (prompt) => {
      delivered.push(prompt);
    },
  });
  try {
    const statePath = join(root, "state.json");
    const state = {
      workflowId: "wf1",
      standingOrders: [{ op: "add", id: "single-pr", constraint: "One PR." }],
    } as unknown as Workflow;
    let now = 1_000_000;
    const watcher = createWatcher(
      { state: statePath, orchestrator: "t8", generation: 1 },
      {
        hc: async () =>
          JSON.stringify({ state: "live", status: { state: "idle" } }),
        readNonce: () => readSessionNonce(directory),
        writeRequest: (_state, request) => writeWakeRequest(directory, request),
        now: () => now,
        readState: async () => state,
        readStop: async () => 0,
        writeRetiring: async () => {},
        terminal: "w1",
      },
    );
    now += watchIntervalMs;
    await watcher.step();
    assert.ok(watcher.lastSentAt(), "the watcher wrote a periodic request");
    wake.scan();
    wake.scan();
    await settle();
    assert.deepEqual(delivered, [tickPrompt(statePath, state)]);
  } finally {
    wake.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("the runner reads every routes.json route as the launcher does, and the launcher accepts each worker launch argv", () => {
  const table = readRoutes();
  for (const [role, entry] of Object.entries(table))
    for (const spec of entry.routes)
      assert.doesNotThrow(() => parseRoute(spec), `${role}: ${spec}`);
  const parsed = routesFromTable(table);
  const state = {
    routes: parsed,
    launcher: "/installed/hooks/pi/launch.ts",
  } as unknown as Workflow;
  for (const role of roles) {
    assert.deepEqual(parsed[role], parseRoute(table[role].routes[0]), role);
    const session = `/tmp/sessions/${role}.jsonl`;
    const argv = launchArgv(state, role, session);
    assert.deepEqual(argv.slice(0, 2), ["node", state.launcher], role);
    const { contract, args } = launchArguments(argv.slice(2), table);
    assert.deepEqual(
      {
        role: contract.role,
        provider: contract.provider,
        model: contract.model,
        thinking: contract.thinking,
      },
      { role, ...parsed[role] },
      role,
    );
    assert.equal(args[args.indexOf("--session") + 1], session, role);
  }
});
