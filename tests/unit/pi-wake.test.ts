import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import enforcement from "../../hooks/pi/enforcement.ts";
import {
  sessionFile,
  startWake,
  tickPromptPrefix,
  wakeDirectory,
  wakeRoot,
} from "../../hooks/pi/wake.ts";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const prompt = `${tickPromptPrefix}runner tick\``;
const request = (
  nonce: string,
  generation: number,
  n: number,
  workflow = "wf1",
) => JSON.stringify({ workflow, nonce, generation, n, prompt });

test("wake root follows XDG state and refuses addresses that are not plain terminal names", () => {
  assert.equal(
    wakeRoot({ XDG_STATE_HOME: "/x/state", HOME: "/h" }),
    "/x/state/ax/wake",
  );
  assert.equal(wakeRoot({ HOME: "/h" }), "/h/.local/state/ax/wake");
  assert.equal(wakeDirectory("/r", "t8"), "/r/t8");
  for (const address of ["../t8", "t8/x", "", "t 8"])
    assert.throws(() => wakeDirectory("/r", address), /Invalid herdr-core/u);
});

test("a wake listener delivers each newer request bound to its own session nonce once", async () => {
  const directory = join(mkdtempSync(join(tmpdir(), "ax-wake-")), "t8");
  const delivered: string[] = [];
  const wake = startWake({
    directory,
    pollMs: 60_000,
    deliver: (value) => {
      delivered.push(value);
    },
  });
  try {
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.deepEqual(
      JSON.parse(readFileSync(join(directory, sessionFile), "utf8")),
      { nonce: wake.nonce },
    );
    writeFileSync(join(directory, "wf1.json"), request(wake.nonce, 1, 1));
    wake.scan();
    wake.scan();
    await settle();
    assert.deepEqual(delivered, [prompt]);
    // An older or repeated pair is never delivered again; a newer n or generation is.
    writeFileSync(join(directory, "wf1.json"), request(wake.nonce, 1, 1));
    wake.scan();
    writeFileSync(join(directory, "wf1.json"), request(wake.nonce, 1, 3));
    wake.scan();
    writeFileSync(join(directory, "wf1.json"), request(wake.nonce, 2, 1));
    wake.scan();
    await settle();
    assert.equal(delivered.length, 3);
  } finally {
    wake.close();
    rmSync(join(directory, ".."), { recursive: true, force: true });
  }
});

test("a wake listener never delivers a stale nonce, a mismatched file, a foreign prompt, or malformed JSON", async () => {
  const directory = join(mkdtempSync(join(tmpdir(), "ax-wake-")), "t8");
  const delivered: string[] = [];
  const wake = startWake({
    directory,
    pollMs: 60_000,
    deliver: (value) => {
      delivered.push(value);
    },
  });
  try {
    writeFileSync(
      join(directory, "wf1.json"),
      request("earlier-session", 1, 1),
    );
    writeFileSync(join(directory, "wf2.json"), request(wake.nonce, 1, 1));
    writeFileSync(
      join(directory, "wf3.json"),
      JSON.stringify({
        workflow: "wf3",
        nonce: wake.nonce,
        generation: 1,
        n: 1,
        prompt: "rm -rf everything",
      }),
    );
    writeFileSync(join(directory, "wf4.json"), "{");
    wake.scan();
    await settle();
    assert.deepEqual(delivered, []);
  } finally {
    wake.close();
    rmSync(join(directory, ".."), { recursive: true, force: true });
  }
});

test("a refused delivery is retried at the next scan", async () => {
  const directory = join(mkdtempSync(join(tmpdir(), "ax-wake-")), "t8");
  let attempts = 0;
  const wake = startWake({
    directory,
    pollMs: 60_000,
    deliver: () => {
      attempts += 1;
      if (attempts === 1) throw new Error("busy");
    },
  });
  try {
    writeFileSync(join(directory, "wf1.json"), request(wake.nonce, 1, 1));
    wake.scan();
    await settle();
    wake.scan();
    await settle();
    wake.scan();
    await settle();
    assert.equal(attempts, 2);
  } finally {
    wake.close();
    rmSync(join(directory, ".."), { recursive: true, force: true });
  }
});

test("only a ticked role in a herdr-core terminal listens, delivering ticks as Pi follow-ups", async () => {
  const root = mkdtempSync(join(tmpdir(), "ax-wake-ext-"));
  const workflowFile = join(root, "workflow.md");
  writeFileSync(workflowFile, "Publish Ready.");
  const saved = {
    contract: process.env.AX_PI_CONTRACT,
    workflow: process.env.AX_PI_WORKFLOW_FILE,
    terminal: process.env.HC_TERMINAL_ID,
    state: process.env.XDG_STATE_HOME,
  };
  const start = (role: string) => {
    process.env.AX_PI_CONTRACT = JSON.stringify({
      role,
      provider: "openai-codex",
      model: "gpt-6-astra",
      thinking: "medium",
      nonce: "test",
    });
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const sent: [string, unknown][] = [];
    enforcement({
      on: (event: string, handler: (...args: unknown[]) => unknown) =>
        handlers.set(event, handler),
      getThinkingLevel: () => "medium",
      getAllTools: () => [{ name: "mcp" }],
      setActiveTools: () => {},
      sendUserMessage: (content: string, options: unknown) => {
        sent.push([content, options]);
      },
    } as never);
    try {
      handlers.get("session_start")?.(
        {},
        { model: { provider: "openai-codex", id: "gpt-6-astra" } },
      );
    } catch (error) {
      // The launcher's readiness pipe on fd 3 is absent under the test runner; the listener starts first.
      assert.equal((error as NodeJS.ErrnoException).syscall, "write");
    }
    return { handlers, sent };
  };
  try {
    process.env.AX_PI_WORKFLOW_FILE = workflowFile;
    process.env.HC_TERMINAL_ID = "t8";
    process.env.XDG_STATE_HOME = join(root, "state");
    const directory = wakeDirectory(wakeRoot(), "t8");
    const implementer = start("implementer");
    assert.throws(() => readFileSync(join(directory, sessionFile)));
    implementer.handlers.get("session_shutdown")?.({});
    const orchestrator = start("orchestrator");
    const { nonce } = JSON.parse(
      readFileSync(join(directory, sessionFile), "utf8"),
    );
    writeFileSync(join(directory, "wf1.json"), request(nonce, 1, 1));
    for (let i = 0; i < 50 && orchestrator.sent.length === 0; i += 1)
      await new Promise((resolve) => setTimeout(resolve, 20));
    orchestrator.handlers.get("session_shutdown")?.({});
    assert.deepEqual(orchestrator.sent, [[prompt, { deliverAs: "followUp" }]]);
  } finally {
    for (const [key, value] of [
      ["AX_PI_CONTRACT", saved.contract],
      ["AX_PI_WORKFLOW_FILE", saved.workflow],
      ["HC_TERMINAL_ID", saved.terminal],
      ["XDG_STATE_HOME", saved.state],
    ] as const)
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    rmSync(root, { recursive: true, force: true });
  }
});
