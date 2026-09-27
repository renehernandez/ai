import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { findForcePush } from "../block-agent-force-push.ts";
import { evaluateCommand } from "../block-delete-outside-cwd.ts";
import {
  basename,
  isCompoundCommand,
  isShellCommandFlag,
  SHELLS,
  type ShellWord,
  tokenize,
  unwrap,
} from "../shell-command.ts";

export const roles = [
  "planner",
  "implementer",
  "review-correctness",
  "review-architecture",
  "review-contract",
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

const paseoValueOptions = new Set(["-o", "--format", "--host", "--home"]);
const paseoRunnerCommands = new Set([
  "run",
  "send",
  "stop",
  "delete",
  "archive",
  "heartbeat",
  "schedule",
]);

function paseoSubcommand(words: ShellWord[], start: number) {
  let index = start;
  while (index < words.length) {
    const word = words[index];
    if (word.dynamic || !word.value.startsWith("-")) return { word, index };
    index += paseoValueOptions.has(word.value) ? 2 : 1;
  }
}

function paseoDispatch(words: ShellWord[]): string | undefined {
  const { words: unwrapped, splitCommand } = unwrap(words);
  if (splitCommand)
    return splitCommand.dynamic
      ? "<dynamic split command>"
      : findPaseoDispatch(splitCommand.value);
  if (unwrapped.length === 0) return undefined;
  // A variable executable such as `$P run` could conceal the Paseo CLI.
  const next = unwrapped[1]?.value ?? "";
  if (unwrapped[0].dynamic && paseoRunnerCommands.has(next)) return next;
  const executable = basename(unwrapped[0].value);
  if (SHELLS.has(executable)) {
    const flag = unwrapped.findIndex((word) => isShellCommandFlag(word.value));
    const nested = flag >= 0 ? unwrapped[flag + 1] : undefined;
    return nested ? findPaseoDispatch(nested.value) : undefined;
  }
  if (executable !== "paseo") return undefined;
  let found = paseoSubcommand(unwrapped, 1);
  if (found?.word.value === "agent" && !found.word.dynamic)
    found = paseoSubcommand(unwrapped, found.index + 1);
  if (found?.word.dynamic) return found.word.value || "<dynamic subcommand>";
  return found && paseoRunnerCommands.has(found.word.value)
    ? found.word.value
    : undefined;
}

export function findPaseoDispatch(command: string): string | undefined {
  for (const words of tokenize(command)) {
    const match = paseoDispatch(words);
    if (match) return match;
  }
  return undefined;
}

// Nested shell `-c` and `env -S` payloads are checked like the outer command; an uninspectable one counts as compound.
function compoundPayload(words: ShellWord[]): boolean {
  const { words: unwrapped, splitCommand } = unwrap(words);
  if (splitCommand)
    return splitCommand.dynamic || findCompoundCommand(splitCommand.value);
  if (!SHELLS.has(basename(unwrapped[0]?.value ?? ""))) return false;
  const flag = unwrapped.findIndex((word) => isShellCommandFlag(word.value));
  const nested = flag >= 0 ? unwrapped[flag + 1] : undefined;
  return (
    nested !== undefined &&
    (nested.dynamic || findCompoundCommand(nested.value))
  );
}

export function findCompoundCommand(command: string): boolean {
  return isCompoundCommand(command) || tokenize(command).some(compoundPayload);
}

const compoundRoles = new Set(["planner", "implementer"]);

// Git subcommands that change branch content; the planner delegates them to a runner-launched implementer.
const plannerGitMutations = new Set([
  "add",
  "am",
  "apply",
  "checkout",
  "checkout-index",
  "cherry-pick",
  "commit",
  "commit-tree",
  "merge",
  "mv",
  "read-tree",
  "rebase",
  "reset",
  "restore",
  "revert",
  "rm",
  "stash",
  "switch",
  "update-ref",
]);
const gitValueOptions = new Set([
  "-C",
  "-c",
  "--git-dir",
  "--work-tree",
  "--namespace",
]);

function gitMutation(words: ShellWord[]): string | undefined {
  const { words: unwrapped, splitCommand } = unwrap(words);
  if (splitCommand)
    return splitCommand.dynamic
      ? "<dynamic split command>"
      : findPlannerGitMutation(splitCommand.value);
  if (unwrapped.length === 0) return undefined;
  const next = unwrapped[1]?.value ?? "";
  if (unwrapped[0].dynamic && plannerGitMutations.has(next)) return next;
  const executable = basename(unwrapped[0].value);
  if (SHELLS.has(executable)) {
    const flag = unwrapped.findIndex((word) => isShellCommandFlag(word.value));
    const nested = flag >= 0 ? unwrapped[flag + 1] : undefined;
    return nested ? findPlannerGitMutation(nested.value) : undefined;
  }
  if (executable !== "git") return undefined;
  let index = 1;
  while (index < unwrapped.length) {
    const word = unwrapped[index];
    if (word.dynamic) return word.value || "<dynamic subcommand>";
    if (!word.value.startsWith("-")) break;
    index += gitValueOptions.has(word.value) ? 2 : 1;
  }
  const subcommand = unwrapped[index]?.value;
  if (!subcommand) return undefined;
  if (plannerGitMutations.has(subcommand)) return subcommand;
  // A pull that may merge creates a planner-authored commit; a fast-forward only moves to published history.
  if (
    subcommand === "pull" &&
    !unwrapped.slice(index + 1).some((word) => word.value === "--ff-only")
  )
    return subcommand;
  return undefined;
}

export function findPlannerGitMutation(command: string): string | undefined {
  for (const words of tokenize(command)) {
    const match = gitMutation(words);
    if (match) return match;
  }
  return undefined;
}

function insideGitWorkTree(path: string): boolean {
  for (let directory = dirname(path); ; directory = dirname(directory)) {
    if (existsSync(join(directory, ".git"))) return true;
    if (dirname(directory) === directory) return false;
  }
}

// The planner writes only its plan and private task files; implementation belongs to a fresh implementer.
function plannerWriteDenial(
  input: Record<string, unknown>,
  cwd: string,
): string | undefined {
  const raw = input.path ?? input.file_path;
  if (typeof raw !== "string" || raw.length === 0)
    return "Planner writes require an explicit path";
  const target = resolve(cwd, raw.replace(/^~(?=$|\/)/u, homedir()));
  if (target.startsWith(`${resolve(cwd, ".agents/plans")}${sep}`))
    return undefined;
  if (!insideGitWorkTree(target)) return undefined;
  return `Planner policy: ${target} is inside a Git work tree; the planner writes only .agents/plans and private task files, and implementation goes to a fresh implementer through the runner handoff or repair`;
}

export function shellDenial(
  command: unknown,
  cwd: string,
  denyCompound: boolean,
  denyGitMutation = false,
): string | undefined {
  if (typeof command !== "string") return "Shell command must be a string";
  const force = findForcePush(command);
  if (force) return `Force-push policy: ${force.detail}`;
  const paseo = findPaseoDispatch(command);
  if (paseo)
    return `Paseo policy: \`paseo ${paseo}\` dispatches or changes session lifecycle; managed roles use the Paseo workflow runner, and read-only ls, inspect, logs, and wait remain available`;
  const deletion = evaluateCommand(command, cwd);
  if (deletion) return `Deletion policy: ${deletion.detail}`;
  if (denyCompound && findCompoundCommand(command))
    return "Shell discipline (rules/command-and-tools.md): compound commands are denied; issue one command per tool call without `&&`, `||`, `;`, pipes, background `&`, subshells, command substitution, or newline-separated commands";
  const mutation = denyGitMutation
    ? findPlannerGitMutation(command)
    : undefined;
  if (mutation)
    return `Planner policy: \`git ${mutation}\` changes branch content; the planner delegates code, merges, and conflict resolution to a fresh implementer through the runner handoff or repair`;
}

export function toolDenial(
  role: string,
  name: string,
  input: Record<string, unknown>,
  cwd: string,
  // Shell discipline governs agent tool calls; a person's own `!` commands skip only the compound check.
  origin: "agent" | "user" = "agent",
): string | undefined {
  if (!allowedTools(role).includes(name))
    return `Tool ${name} is unavailable for fixed role ${role}`;
  if (name === "bash")
    return shellDenial(
      input.command,
      cwd,
      origin === "agent" && compoundRoles.has(role),
      origin === "agent" && role === "planner",
    );
  if (role === "planner" && (name === "edit" || name === "write"))
    return plannerWriteDenial(input, cwd);
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
