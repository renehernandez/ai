import { findForcePush } from "../block-agent-force-push.ts";
import { evaluateCommand } from "../block-delete-outside-cwd.ts";

export const roles = [
  "planner",
  "implementer",
  "review-glm",
  "review-deepseek",
  "review-astra",
];
export type Contract = {
  role: string;
  provider: string;
  model: string;
  thinking: string;
  nonce: string;
};
export const readTools = ["read", "grep", "find", "ls"];
export const writeTools = [...readTools, "bash", "edit", "write", "mcp"];

export function parseContract(value: unknown): Contract {
  const c = value as Contract;
  if (
    !c ||
    !roles.includes(c.role) ||
    ![c.provider, c.model, c.thinking, c.nonce].every(
      (v) => typeof v === "string" && v.length > 0,
    )
  ) {
    throw new Error("Invalid mandatory Pi role contract");
  }
  if (
    !["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
      c.thinking,
    )
  )
    throw new Error("Invalid fixed thinking level");
  return c;
}

export function allowedTools(role: string): string[] {
  return role.startsWith("review-") ? readTools : writeTools;
}

export function shellDenial(command: unknown, cwd: string): string | undefined {
  if (typeof command !== "string") return "Shell command must be a string";
  const force = findForcePush(command);
  if (force) return `Force-push policy: ${force.detail}`;
  const deletion = evaluateCommand(command, cwd);
  if (deletion) return `Deletion policy: ${deletion.detail}`;
}

export function toolDenial(
  role: string,
  name: string,
  input: Record<string, unknown>,
  cwd: string,
): string | undefined {
  if (!allowedTools(role).includes(name))
    return `Tool ${name} is unavailable for fixed role ${role}`;
  if (name === "bash") return shellDenial(input.command, cwd);
  if (name === "mcp") {
    if (input.action !== undefined)
      return "MCP configuration and authentication actions require explicit operator handling";
    if (
      typeof input.tool === "string" &&
      /(?:^|[^a-z])(?:create_agent|update_agent|respond_to_permission)$/u.test(
        input.tool,
      )
    ) {
      return "Agent orchestration must use the bounded workflow runner";
    }
  }
}

export function runtimeDenial(
  c: Contract,
  model: { provider: string; id: string } | undefined,
  thinking: string,
): string | undefined {
  if (
    !model ||
    model.provider !== c.provider ||
    model.id !== c.model ||
    thinking !== c.thinking
  )
    return "Active Pi model or thinking level does not match the fixed role";
}
