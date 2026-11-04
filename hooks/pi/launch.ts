import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  allowedTools,
  type Contract,
  parseContract,
  roles,
  toolDenial,
} from "./policy.ts";

const directory = dirname(fileURLToPath(import.meta.url));
const mcpPackage = "npm:pi-mcp-adapter@7.0.0";
const claudeBridgePackage = "npm:pi-claude-bridge@0.9.3";
const alternateBillingEnvironment = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_OAUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
];

export function launchEnvironment(
  provider: string,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...source };
  if (provider === "claude-bridge")
    for (const name of alternateBillingEnvironment) delete env[name];
  return env;
}

type Route = { provider: string; model: string; thinking: string };

function parseRoute(spec: string): Route {
  const slash = spec.indexOf("/");
  const colon = spec.lastIndexOf(":");
  if (slash <= 0 || colon <= slash + 1 || colon === spec.length - 1)
    throw new Error(`Invalid managed route: ${spec}`);
  return {
    provider: spec.slice(0, slash),
    model: spec.slice(slash + 1, colon),
    thinking: spec.slice(colon + 1),
  };
}

// Only the orchestrator lists `provider/model:thinking` routes, the first being the default; every other role has one route.
function launchRoutes(role: string, rest: string[]) {
  if (role !== "orchestrator") {
    const [provider, model, thinking, ...tail] = rest;
    return { routes: [{ provider, model, thinking }], tail };
  }
  const count = rest.findIndex((token) => token.startsWith("-"));
  const specs = count < 0 ? rest : rest.slice(0, count);
  if (specs.length === 0) throw new Error("Missing orchestrator routes");
  return { routes: specs.map(parseRoute), tail: rest.slice(specs.length) };
}

// Paseo's launch model and thinking select one listed route; the session then stays on it.
function selectRoute(routes: Route[], requested: Record<string, string[]>) {
  const byModel = routes.filter((route) =>
    requested["--model"].every((value) =>
      [route.model, `${route.provider}/${route.model}`].includes(value),
    ),
  );
  if (byModel.length === 0) throw new Error("Model override rejected");
  const byProvider = byModel.filter((route) =>
    requested["--provider"].every((value) => value === route.provider),
  );
  if (byProvider.length === 0) throw new Error("Provider override rejected");
  const route = byProvider.find((route) =>
    requested["--thinking"].every((value) => value === route.thinking),
  );
  if (!route) throw new Error("Thinking override rejected");
  return route;
}

export function launchArguments(argv: string[]): {
  contract: Contract;
  args: string[];
} {
  const [role, ...rest] = argv;
  if (!roles.includes(role))
    throw new Error("Invalid mandatory Pi role contract");
  const { routes, tail } = launchRoutes(role, rest);
  const requested: Record<string, string[]> = {
    "--model": [],
    "--provider": [],
    "--thinking": [],
  };
  const args: string[] = [];
  let rpc = false;
  const valueFlags = new Set([
    "--session",
    "--session-dir",
    "--extension",
    "-e",
    "--append-system-prompt",
  ]);
  if (!role.startsWith("review-")) valueFlags.add("--mcp-config");
  const booleanFlags = new Set([
    "--offline",
    "--no-session",
    "--no-context-files",
    "--no-skills",
    "--no-prompt-templates",
  ]);
  for (let i = 0; i < tail.length; i++) {
    const token = tail[i];
    const equals = token.indexOf("=");
    const flag = equals < 0 ? token : token.slice(0, equals);
    if (booleanFlags.has(flag) && equals < 0) {
      args.push(flag);
      continue;
    }
    if (
      flag !== "--mode" &&
      !Object.hasOwn(requested, flag) &&
      !valueFlags.has(flag)
    )
      throw new Error(`Unsupported managed Pi argument: ${flag}`);
    const value = equals < 0 ? tail[++i] : token.slice(equals + 1);
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${flag}`);
    if (flag === "--mode") {
      if (value !== "rpc") throw new Error("Managed Pi requires RPC mode");
      rpc = true;
    } else if (Object.hasOwn(requested, flag)) requested[flag].push(value);
    else args.push(flag, value);
  }
  if (!rpc) throw new Error("Managed Pi requires --mode rpc");
  const { provider, model, thinking } = selectRoute(routes, requested);
  const contract = parseContract({
    role,
    provider,
    model,
    thinking,
    nonce: randomUUID(),
  });
  args.push(
    "--mode",
    "rpc",
    "--provider",
    provider,
    "--model",
    model,
    "--thinking",
    thinking,
    "--no-extensions",
  );
  if (provider === "claude-bridge") args.push("-e", claudeBridgePackage);
  if (!role.startsWith("review-")) args.push("-e", mcpPackage);
  args.push(
    "-e",
    join(directory, "enforcement.ts"),
    "--tools",
    allowedTools(role).join(","),
  );
  return { contract, args };
}

export function rpcDenial(
  contract: Contract,
  request: Record<string, unknown>,
  cwd: string,
): string | undefined {
  if (
    request.type === "set_model" &&
    (request.provider !== contract.provider ||
      request.modelId !== contract.model)
  )
    return "Model override rejected";
  if (
    request.type === "set_thinking_level" &&
    request.level !== contract.thinking
  )
    return "Thinking override rejected";
  if (["cycle_model", "cycle_thinking_level"].includes(String(request.type)))
    return "Fixed role model and thinking cannot be cycled";
  if (request.type === "bash")
    return toolDenial(contract.role, "bash", { command: request.command }, cwd);
}

export function launch(argv: string[]): void {
  const { contract, args } = launchArguments(argv);
  const workflow = resolve(
    directory,
    "../../skills/paseo-orchestration/references/paseo-workflow.md",
  );
  accessSync(join(directory, "enforcement.ts"), constants.R_OK);
  if (!readFileSync(workflow, "utf8").trim())
    throw new Error("Mandatory Pi workflow is empty");
  const child = spawn("pi", args, {
    env: {
      ...launchEnvironment(contract.provider),
      AX_PI_CONTRACT: JSON.stringify(contract),
      AX_PI_WORKFLOW_FILE: workflow,
    },
    stdio: ["pipe", "pipe", "pipe", "pipe"],
  });
  let ready = false;
  let failed = false;
  let pending = "";
  let inputEnded = false;
  const timer = setTimeout(
    () => fail("Mandatory Pi adapter initialization timed out"),
    60_000,
  );
  function fail(message: string): void {
    if (failed) return;
    failed = true;
    clearTimeout(timer);
    process.stderr.write(`${message}\n`);
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 1000).unref();
    process.exitCode = 78;
    input.close();
    process.stdin.pause();
  }
  function send(line: string): void {
    let request: Record<string, unknown>;
    try {
      request = JSON.parse(line);
      if (
        !request ||
        typeof request !== "object" ||
        typeof request.type !== "string"
      )
        throw new Error("Invalid RPC request");
    } catch {
      fail("Invalid Pi RPC input");
      return;
    }
    const denial = rpcDenial(contract, request, process.cwd());
    if (denial) {
      process.stdout.write(
        `${JSON.stringify({ id: request.id, type: "response", command: request.type, success: false, error: denial })}\n`,
      );
      return;
    }
    child.stdin.write(`${line}\n`);
  }
  const input = createInterface({ input: process.stdin });
  input.on("line", (line) => {
    if (failed) return;
    if (ready) send(line);
    else {
      pending += `${line}\n`;
      if (pending.length > 4 * 1024 * 1024)
        fail("Pi startup input exceeded limit");
    }
  });
  input.on("close", () => {
    inputEnded = true;
    if (ready) child.stdin.end();
  });
  const handshake = child.stdio[3];
  if (!handshake || !("readable" in handshake))
    throw new Error("Pi handshake channel unavailable");
  createInterface({ input: handshake }).on("line", (line) => {
    if (failed) return;
    try {
      const message = JSON.parse(line);
      if (message.ready !== true || message.nonce !== contract.nonce)
        throw new Error("Invalid handshake");
      ready = true;
      clearTimeout(timer);
      for (const queued of pending.trimEnd().split("\n"))
        if (queued) send(queued);
      pending = "";
      if (inputEnded) child.stdin.end();
    } catch {
      fail("Mandatory Pi adapter initialization failed");
    }
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.stdin.on("error", () => fail("Pi RPC input channel closed"));
  child.on("error", () => fail("Could not start managed Pi"));
  child.on("exit", (code, signal) => {
    clearTimeout(timer);
    if (!ready && !failed)
      fail("Pi exited without mandatory adapter initialization");
    process.exitCode = failed ? 78 : (code ?? (signal ? 1 : 0));
    input.close();
    process.stdin.pause();
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => child.kill(signal));
}

if (import.meta.main) {
  try {
    launch(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 78;
  }
}
