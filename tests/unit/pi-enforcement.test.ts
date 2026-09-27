import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import enforcement from "../../hooks/pi/enforcement.ts";
import { launchArguments, rpcDenial } from "../../hooks/pi/launch.ts";
import {
  parseContract,
  runtimeDenial,
  toolDenial,
} from "../../hooks/pi/policy.ts";

const baseArgs = [
  "review-astra",
  "openai-codex",
  "gpt-6-astra",
  "low",
  "--mode",
  "rpc",
];
const contract = parseContract({
  role: "review-astra",
  provider: "openai-codex",
  model: "gpt-6-astra",
  thinking: "low",
  nonce: "test",
});

test("managed arguments preserve Paseo extensions and enforce the fixed route", () => {
  const result = launchArguments([
    ...baseArgs,
    "--model",
    "openai-codex/gpt-6-astra",
    "--thinking",
    "low",
    "-e",
    "/tmp/paseo.ts",
    "--session",
    "/tmp/session.jsonl",
  ]);
  assert.ok(result.args.includes("/tmp/paseo.ts"));
  assert.ok(result.args.includes("/tmp/session.jsonl"));
  assert.ok(result.args.includes("--no-extensions"));
  assert.ok(result.args.some((v) => v.endsWith("/pi/enforcement.ts")));
  assert.equal(result.args.at(-1), "read,grep,find,ls");
  assert.ok(!result.args.some((v) => v.includes("pi-mcp-adapter")));
  const implementation = launchArguments([
    "implementer",
    "openai-codex",
    "gpt-5.6-sol",
    "medium",
    "--mode",
    "rpc",
  ]);
  assert.ok(implementation.args.includes("npm:pi-mcp-adapter@2.34.0"));
  for (const tail of [
    ["--model", "gpt-5.6-sol"],
    ["--thinking=high"],
    ["--provider", "anthropic"],
    ["--tools", "bash"],
    ["--mode", "text"],
    ["--print"],
    ["a prompt"],
  ]) {
    assert.throws(() => launchArguments([...baseArgs, ...tail]));
  }
  assert.throws(() => launchArguments(["unknown", ...baseArgs.slice(1)]));
  assert.throws(() => launchArguments(baseArgs.slice(0, 4)));
});

test("runtime model and thinking drift and unsupported reviewer tools are denied", () => {
  assert.equal(
    runtimeDenial(
      contract,
      { provider: contract.provider, id: contract.model },
      "low",
    ),
    undefined,
  );
  assert.ok(
    runtimeDenial(
      contract,
      { provider: contract.provider, id: "other" },
      "low",
    ),
  );
  assert.ok(
    runtimeDenial(
      contract,
      { provider: contract.provider, id: contract.model },
      "medium",
    ),
  );
  for (const name of [
    "bash",
    "write",
    "edit",
    "mcp",
    "mcpScript",
    "paseo_create_agent",
    "unknown",
  ])
    assert.ok(toolDenial(contract.role, name, {}, process.cwd()));
  assert.equal(toolDenial(contract.role, "read", {}, process.cwd()), undefined);
  assert.ok(
    toolDenial(
      "implementer",
      "bash",
      { command: "git push --force" },
      process.cwd(),
    ),
  );
  assert.ok(
    toolDenial(
      "implementer",
      "bash",
      { command: "rm /tmp/outside" },
      process.cwd(),
    ),
  );
  assert.equal(
    toolDenial("implementer", "bash", { command: "git status" }, process.cwd()),
    undefined,
  );
  for (const tool of [
    "create_agent",
    "paseo_create_agent",
    "paseo.update_agent",
    "mcp__paseo__respond_to_permission",
  ])
    assert.ok(toolDenial("planner", "mcp", { tool }, process.cwd()));
  assert.ok(toolDenial("planner", "mcp", { action: "install" }, process.cwd()));
  assert.equal(
    toolDenial("planner", "mcp", { tool: "paseo_list_agents" }, process.cwd()),
    undefined,
  );
  assert.ok(
    rpcDenial(
      contract,
      { type: "set_model", provider: contract.provider, modelId: "other" },
      process.cwd(),
    ),
  );
});

test("managed roles cannot dispatch Paseo sessions outside the runner but keep read-only Paseo commands", () => {
  for (const command of [
    "paseo run --background --json --provider ax-implementer task",
    "paseo send agent-1 --prompt-file brief.md --no-wait",
    "paseo --json stop agent-1",
    "paseo --host localhost:1 delete agent-1",
    "paseo agent archive agent-1",
    "git status && paseo heartbeat create --cron '*/5 * * * *' tick",
    "env PASEO_AGENT_ID=other paseo schedule ls",
    'bash -c "paseo run task"',
    "/Applications/Paseo.app/Contents/Resources/bin/paseo send a b",
    "paseo $ACTION agent-1",
    "P=paseo; $P run task",
    '"$PASEO_BIN" send agent-1 follow-up',
  ]) {
    for (const role of ["planner", "implementer"])
      assert.match(
        toolDenial(role, "bash", { command }, process.cwd()) ?? "",
        /Paseo policy/u,
        command,
      );
  }
  for (const command of [
    "paseo --help",
    "paseo ls --json",
    "paseo inspect --json agent-1",
    "paseo logs --filter assistant_message --tail 1 agent-1",
    "paseo wait --json --timeout 60 agent-1",
    'grep -n "paseo run" skills/paseo-orchestration/references/paseo-workflow.md',
    "echo 'paseo send agent-1; paseo run task'",
    "node ~/.agents/skills/paseo-orchestration/scripts/paseo-workflow.ts state.json review input.json",
    '"$EDITOR" notes.md',
  ])
    assert.equal(
      toolDenial("planner", "bash", { command }, process.cwd()),
      undefined,
      command,
    );
});

test("write roles are denied compound shell commands, including nested shell payloads", () => {
  for (const command of [
    "git add a && git commit -m b",
    "git status || true",
    "git status; git diff",
    "git log | head",
    "sleep 5 &",
    "echo $(git rev-parse HEAD)",
    'echo "$(git rev-parse HEAD)"',
    "echo `git rev-parse HEAD`",
    "(cd /tmp)",
    "git status\ngit diff",
    "git commit -F - <<EOF\nsubject\nEOF",
    "sh -c 'a && b'",
    "bash -lc 'a; b'",
    "env -S 'git status; git diff'",
    'sh -c "$SCRIPT"',
  ]) {
    for (const role of ["planner", "implementer"])
      assert.match(
        toolDenial(role, "bash", { command }, process.cwd()) ?? "",
        /^Shell discipline .*one command per tool call/u,
        command,
      );
  }
  for (const command of [
    "git status",
    "sh -c 'git status'",
    "echo 'a && b; c | d'",
    'grep -n "a;b" notes.md',
    "pnpm run test:unit 2>&1",
    "git status &>/dev/null",
    "git status\n",
    'echo "$HOME"',
    "find . -name '*.ts' -exec true {} \\;",
    "printf '%s' '$(literal)'",
    "echo '`literal`'",
  ])
    for (const role of ["planner", "implementer"])
      assert.equal(
        toolDenial(role, "bash", { command }, process.cwd()),
        undefined,
        command,
      );
  assert.match(
    toolDenial(
      "implementer",
      "bash",
      { command: "git status && git push --force" },
      process.cwd(),
    ) ?? "",
    /^Force-push policy/u,
  );
  assert.match(
    toolDenial(
      "implementer",
      "bash",
      { command: "git status && rm /tmp/outside" },
      process.cwd(),
    ) ?? "",
    /^Deletion policy/u,
  );
});

test("compound denial applies to agent shell calls, not a person's own commands", () => {
  const f = fixture();
  const savedContract = process.env.AX_PI_CONTRACT;
  const savedWorkflow = process.env.AX_PI_WORKFLOW_FILE;
  try {
    const implementer = parseContract({
      ...contract,
      role: "implementer",
      model: "gpt-5.6-sol",
      thinking: "medium",
    });
    process.env.AX_PI_CONTRACT = JSON.stringify(implementer);
    process.env.AX_PI_WORKFLOW_FILE = join(
      f.root,
      "skills/paseo-orchestration/references/paseo-workflow.md",
    );
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    enforcement({
      on: (name, handler) =>
        handlers.set(name, handler as (...args: unknown[]) => unknown),
      getThinkingLevel: () => "medium",
      getAllTools: () => [],
      setActiveTools: () => {},
    });
    const ctx = {
      cwd: f.root,
      model: { provider: implementer.provider, id: implementer.model },
    };
    const compound = "git status && git diff";
    assert.equal(
      handlers.get("user_bash")?.({ command: compound }, ctx),
      undefined,
    );
    const agent = handlers.get("tool_call")?.(
      { toolName: "bash", input: { command: compound } },
      ctx,
    ) as { block: boolean; reason: string };
    assert.equal(agent.block, true);
    assert.match(agent.reason, /^Shell discipline/u);
    const dispatch = handlers.get("user_bash")?.(
      { command: "paseo run task" },
      ctx,
    ) as { result: { output: string; exitCode: number } };
    assert.equal(dispatch.result.exitCode, 1);
    assert.match(dispatch.result.output, /^Paseo policy/u);
  } finally {
    if (savedContract === undefined) delete process.env.AX_PI_CONTRACT;
    else process.env.AX_PI_CONTRACT = savedContract;
    if (savedWorkflow === undefined) delete process.env.AX_PI_WORKFLOW_FILE;
    else process.env.AX_PI_WORKFLOW_FILE = savedWorkflow;
    rmSync(f.root, { recursive: true, force: true });
  }
});

function fixture(): { root: string; launcher: string; env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(join(tmpdir(), "pi-enforcement-"));
  cpSync(resolve("hooks"), join(root, "hooks"), { recursive: true });
  const references = join(root, "skills/paseo-orchestration/references");
  mkdirSync(references, { recursive: true });
  writeFileSync(
    join(references, "paseo-workflow.md"),
    "One local review pass. Publish Ready. Never merge.",
  );
  mkdirSync(join(root, "bin"));
  const fake = join(root, "bin/pi");
  writeFileSync(
    fake,
    `#!${process.execPath}
const fs = require('node:fs');
const readline = require('node:readline');
if (process.env.FAKE_PI_MODE === 'no-handshake') { setTimeout(() => process.exit(0), 30); }
else {
 const c = JSON.parse(process.env.AX_PI_CONTRACT);
 fs.writeSync(3, JSON.stringify({ready:true,nonce:c.nonce})+'\\n');
 readline.createInterface({input:process.stdin}).on('line', line => process.stdout.write(JSON.stringify({received:JSON.parse(line)})+'\\n'));
}
`,
  );
  chmodSync(fake, 0o755);
  return {
    root,
    launcher: join(root, "hooks/pi/launch.ts"),
    env: {
      ...process.env,
      PATH: `${join(root, "bin")}:${process.env.PATH}`,
      AX_PI_CONTRACT: "untrusted override",
      AX_PI_WORKFLOW_FILE: "/missing",
    },
  };
}

test("subprocess RPC waits for adapter handshake and filters role mutations", () => {
  const f = fixture();
  try {
    const commands = [
      { id: "state", type: "get_state" },
      {
        id: "model",
        type: "set_model",
        provider: contract.provider,
        modelId: "other",
      },
      { id: "effort", type: "set_thinking_level", level: "high" },
      { id: "bash", type: "bash", command: "touch should-not-exist" },
    ];
    const result = spawnSync(process.execPath, [f.launcher, ...baseArgs], {
      env: f.env,
      input: `${commands.map((v) => JSON.stringify(v)).join("\n")}\n`,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    const output = result.stdout
      .trim()
      .split("\n")
      .map((v) => JSON.parse(v));
    assert.deepEqual(
      output.filter((v) => v.received).map((v) => v.received.id),
      ["state"],
    );
    assert.equal(output.filter((v) => v.success === false).length, 3);
    const missing = spawnSync(process.execPath, [f.launcher, ...baseArgs], {
      env: { ...f.env, FAKE_PI_MODE: "no-handshake" },
      input: '{"type":"prompt","message":"must not run"}\n',
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(missing.status, 78, missing.stderr);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /without mandatory adapter/u);
    rmSync(join(f.root, "hooks/pi/enforcement.ts"));
    const absent = spawnSync(process.execPath, [f.launcher, ...baseArgs], {
      env: f.env,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(absent.status, 78);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("Paseo MCP config reaches the pinned adapter only for nonreview roles", () => {
  for (const role of ["planner", "implementer"]) {
    for (const tail of [
      ["--mcp-config", "/tmp/paseo mcp.json"],
      ["--mcp-config=/tmp/paseo mcp.json"],
    ]) {
      const result = launchArguments([
        role,
        "openai-codex",
        "gpt-5.6-sol",
        "medium",
        "--mode",
        "rpc",
        ...tail,
      ]);
      const index = result.args.indexOf("--mcp-config");
      assert.notEqual(index, -1);
      assert.equal(result.args[index + 1], "/tmp/paseo mcp.json");
      assert.ok(result.args.includes("npm:pi-mcp-adapter@2.34.0"));
    }
    assert.throws(
      () =>
        launchArguments([
          role,
          "openai-codex",
          "gpt-5.6-sol",
          "medium",
          "--mode",
          "rpc",
          "--mcp-config",
        ]),
      /Missing value/,
    );
  }
  assert.throws(
    () =>
      launchArguments([
        "review-astra",
        "openai-codex",
        "gpt-6-astra",
        "low",
        "--mode",
        "rpc",
        "--mcp-config",
        "/tmp/mcp.json",
      ]),
    /Unsupported managed Pi argument/,
  );
});

test("adapter injects the canonical workflow and retains preexisting system prompt", () => {
  const f = fixture();
  const savedContract = process.env.AX_PI_CONTRACT;
  const savedWorkflow = process.env.AX_PI_WORKFLOW_FILE;
  try {
    process.env.AX_PI_CONTRACT = JSON.stringify(contract);
    process.env.AX_PI_WORKFLOW_FILE = join(
      f.root,
      "skills/paseo-orchestration/references/paseo-workflow.md",
    );
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    enforcement({
      on: (name, handler) =>
        handlers.set(name, handler as (...args: unknown[]) => unknown),
      getThinkingLevel: () => "low",
      getAllTools: () => [],
      setActiveTools: () => {},
    });
    const ctx = {
      cwd: f.root,
      model: { provider: contract.provider, id: contract.model },
    };
    const result = handlers.get("before_agent_start")?.(
      { systemPrompt: "Paseo original instructions" },
      ctx,
    ) as { systemPrompt: string };
    assert.match(result.systemPrompt, /^Paseo original instructions/u);
    assert.match(result.systemPrompt, /Publish Ready/u);
    const blocked = handlers.get("tool_call")?.(
      { toolName: "bash", input: { command: "git status" } },
      ctx,
    ) as { block: boolean };
    assert.equal(blocked.block, true);
  } finally {
    if (savedContract === undefined) delete process.env.AX_PI_CONTRACT;
    else process.env.AX_PI_CONTRACT = savedContract;
    if (savedWorkflow === undefined) delete process.env.AX_PI_WORKFLOW_FILE;
    else process.env.AX_PI_WORKFLOW_FILE = savedWorkflow;
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("installed Pi RPC loads the adapter and rejects model changes", {
  skip: process.env.AX_PI_LIVE_RPC_TEST !== "1",
}, async () => {
  const f = fixture();
  const child = spawn(
    process.execPath,
    [
      f.launcher,
      ...baseArgs,
      "--offline",
      "--no-session",
      "--no-context-files",
      "--no-skills",
      "--no-prompt-templates",
    ],
    {
      env: { ...process.env, PI_CODING_AGENT_DIR: join(f.root, "agent") },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  try {
    const responses: Record<string, unknown>[] = [];
    let buffer = "";
    let stderr = "";
    child.stderr.on("data", (v) => {
      stderr += v.toString();
    });
    await new Promise<void>((resolvePromise, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Pi RPC timeout: ${stderr}`)),
        20_000,
      );
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Pi exited ${code}: ${stderr}`));
      });
      child.stdout.on("data", (data) => {
        buffer += data.toString();
        while (buffer.includes("\n")) {
          const newline = buffer.indexOf("\n");
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          const response = JSON.parse(line);
          if (response.type === "response") responses.push(response);
          if (responses.length === 2) {
            clearTimeout(timer);
            resolvePromise();
          }
        }
      });
      child.stdin.write(
        '{"id":"state","type":"get_state"}\n{"id":"change","type":"set_model","provider":"openai-codex","modelId":"wrong"}\n',
      );
    });
    assert.equal(responses.find((v) => v.id === "change")?.success, false);
    const state = responses.find((v) => v.id === "state") as {
      data: { model: { id: string }; thinkingLevel: string };
    };
    assert.equal(state.data.model.id, contract.model);
    assert.equal(state.data.thinkingLevel, "low");
    const driftExtension = join(f.root, "drift.ts");
    writeFileSync(
      driftExtension,
      'export default function(pi) { pi.on("session_start", () => pi.setThinkingLevel("high")); }',
    );
    const drift = spawnSync(
      process.execPath,
      [
        f.launcher,
        ...baseArgs,
        "--offline",
        "--no-session",
        "--no-context-files",
        "--no-skills",
        "--no-prompt-templates",
        "-e",
        driftExtension,
      ],
      {
        env: {
          ...process.env,
          PI_CODING_AGENT_DIR: join(f.root, "drift-agent"),
        },
        input: '{"type":"prompt","message":"must not reach inference"}\n',
        encoding: "utf8",
        timeout: 20_000,
      },
    );
    assert.equal(drift.status, 78, drift.stderr);
    assert.match(drift.stderr, /does not match the fixed role/u);
  } finally {
    child.kill();
    rmSync(f.root, { recursive: true, force: true });
  }
});
