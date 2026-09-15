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
  toolDenial,
} from "./policy.ts";

const directory = dirname(fileURLToPath(import.meta.url));
const mcpPackage = "npm:pi-mcp-adapter@2.34.0";

export function launchArguments(argv: string[]): {
  contract: Contract;
  args: string[];
} {
  const [role, provider, model, thinking, ...tail] = argv;
  const contract = parseContract({
    role,
    provider,
    model,
    thinking,
    nonce: randomUUID(),
  });
  const args: string[] = [];
  let rpc = false;
  const valueFlags = new Set([
    "--session",
    "--session-dir",
    "--extension",
    "-e",
    "--append-system-prompt",
  ]);
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
      !["--mode", "--model", "--provider", "--thinking"].includes(flag) &&
      !valueFlags.has(flag)
    )
      throw new Error(`Unsupported managed Pi argument: ${flag}`);
    const value = equals < 0 ? tail[++i] : token.slice(equals + 1);
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${flag}`);
    if (flag === "--mode") {
      if (value !== "rpc") throw new Error("Managed Pi requires RPC mode");
      rpc = true;
    } else if (flag === "--model") {
      if (![model, `${provider}/${model}`].includes(value))
        throw new Error("Model override rejected");
    } else if (flag === "--provider") {
      if (value !== provider) throw new Error("Provider override rejected");
    } else if (flag === "--thinking") {
      if (value !== thinking) throw new Error("Thinking override rejected");
    } else args.push(flag, value);
  }
  if (!rpc) throw new Error("Managed Pi requires --mode rpc");
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
    "../../skills/handoff-brief/references/paseo-workflow.md",
  );
  accessSync(join(directory, "enforcement.ts"), constants.R_OK);
  if (!readFileSync(workflow, "utf8").trim())
    throw new Error("Mandatory Pi workflow is empty");
  const child = spawn("pi", args, {
    env: {
      ...process.env,
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
