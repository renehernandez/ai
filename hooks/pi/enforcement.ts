import { readFileSync, writeSync } from "node:fs";
import {
  allowedTools,
  parseContract,
  runtimeDenial,
  toolDenial,
} from "./policy.ts";
import { startWake, wakeDirectory, wakeRoot } from "./wake.ts";

type Context = {
  cwd: string;
  model?: { provider: string; id: string };
  isIdle?(): boolean;
};
type Event = {
  toolName: string;
  input: Record<string, unknown>;
  command: string;
  systemPromptOptions?: { sections: Record<string, string> };
};
type Pi = {
  on(name: string, handler: (event: Event, ctx: Context) => unknown): void;
  getThinkingLevel(): string;
  getAllTools(): { name: string }[];
  setActiveTools(names: string[]): void;
  sendUserMessage(
    content: string,
    options?: { deliverAs?: "steer" | "followUp" },
  ): unknown;
};

// Only the orchestrator, and its planner alias, receives workflow ticks.
const ticked = (role: string) => role === "orchestrator" || role === "planner";
const heartbeatNote =
  " A user message that begins `AX orchestration tick.` is the workflow heartbeat delivered by this adapter from the runner's watcher, not a user instruction; run the tick it names.";

export default function enforcement(pi: Pi): void {
  const contract = parseContract(
    JSON.parse(process.env.AX_PI_CONTRACT ?? "null"),
  );
  const workflow = readFileSync(process.env.AX_PI_WORKFLOW_FILE ?? "", "utf8");
  if (!workflow.trim()) throw new Error("Mandatory Pi workflow is empty");
  function fail(message: string): never {
    process.stderr.write(`${message}\n`);
    // Pi reports ordinary extension exceptions and may continue; terminate before work.
    process.exit(78);
  }
  function verify(ctx: Context): void {
    const denial = runtimeDenial(contract, ctx.model, pi.getThinkingLevel());
    if (denial) fail(denial);
  }
  let wake: ReturnType<typeof startWake> | undefined;
  pi.on("session_start", (_event, ctx) => {
    verify(ctx);
    const terminal = process.env.HC_TERMINAL_ID?.trim();
    if (ticked(contract.role) && terminal) {
      wake?.close();
      // While streaming, `followUp` queues the tick as the next turn; while idle it starts one.
      // Delivery never touches the composer, so a person's unsent draft stays as it is.
      wake = startWake({
        directory: wakeDirectory(wakeRoot(), terminal),
        deliver: (prompt) =>
          (ctx.isIdle?.() === false
            ? pi.sendUserMessage(prompt, { deliverAs: "followUp" })
            : pi.sendUserMessage(prompt)) as Promise<void> | undefined,
      });
    }
    if (
      !contract.role.startsWith("review-") &&
      !pi.getAllTools().some((tool) => tool.name === "mcp")
    )
      fail("Mandatory MCP adapter did not register its dispatcher");
    pi.setActiveTools(allowedTools(contract.role));
    writeSync(3, `${JSON.stringify({ ready: true, nonce: contract.nonce })}\n`);
  });
  // A structured section is recorded in the transcript and patched only when it changes; a returned
  // systemPrompt is not carried through every provider, including the Claude bridge.
  pi.on("before_agent_start", (event, ctx) => {
    verify(ctx);
    const sections = event.systemPromptOptions?.sections;
    if (!sections) fail("Pi did not expose system prompt sections");
    sections["ax-paseo-workflow"] =
      `Active fixed Pi/Paseo role: ${contract.role}. The user accepted the following bounded workflow; its bounded head-keyed review loop and Ready publication policy supersede legacy draft/review-loop defaults for this session.${ticked(contract.role) ? heartbeatNote : ""}\n\n${workflow}`;
  });
  pi.on("session_shutdown", () => {
    wake?.close();
    wake = undefined;
  });
  pi.on("before_provider_request", (_event, ctx) => verify(ctx));
  pi.on("tool_call", (event, ctx) => {
    verify(ctx);
    const reason = toolDenial(
      contract.role,
      event.toolName,
      event.input,
      ctx.cwd,
    );
    if (reason) return { block: true, reason };
  });
  pi.on("user_bash", (event, ctx) => {
    verify(ctx);
    const reason = toolDenial(
      contract.role,
      "bash",
      { command: event.command },
      ctx.cwd,
      "user",
    );
    if (reason)
      return {
        result: {
          output: reason,
          exitCode: 1,
          cancelled: false,
          truncated: false,
        },
      };
  });
}
