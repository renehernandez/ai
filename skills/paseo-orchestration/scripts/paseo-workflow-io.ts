import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  nonempty,
  ordersBlock,
  type Transport,
  type Workflow,
  type WorktreeState,
} from "./paseo-workflow-state.ts";

// herdr-core and Git access shared by the runner entrypoint and its cleanup action.
const execute = promisify(execFile);
// Session JSONL lives on this machine; reading it goes through the transport seam so a scripted fake can serve it.
export const sessionCommand = "session-jsonl";
async function readSessionFile(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    // Pi creates the file with the first entry it writes; a missing file holds no reply yet.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}
export const herdr: Transport = async (args, timeout, env) =>
  args[0] === sessionCommand
    ? readSessionFile(args[1])
    : (
        await execute("hc", args, {
          timeout,
          maxBuffer: 8 * 1024 * 1024,
          ...(env ? { env: { ...process.env, ...env } } : {}),
        })
      ).stdout;
export const readProbe: Transport = async (args, timeout) =>
  (
    await execute(args[0], args.slice(1), {
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout;
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");

// Observation calls retry transient transport errors; non-repeatable calls never come through here.
export async function observe(
  transport: Transport,
  args: string[],
  timeout: number,
) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transport(args, timeout);
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
export async function hcVersion(transport: Transport) {
  return (await observe(transport, ["-V"], 30_000)).trim();
}
export type Inspection = {
  id: string;
  cwd: string;
  argv: string[];
  state: string;
  // Pi's reported program status; null until the terminal confirms status reporting.
  status: string | null;
  turn: number;
  reported: boolean;
  parent: string | null;
  labels: Record<string, string>;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
// Decodes only the required `hc get` fields and fails closed, naming the field and the herdr-core version.
export async function inspectTerminal(
  id: string,
  transport: Transport,
): Promise<Inspection> {
  const raw = JSON.parse(
    await observe(transport, ["get", "--json", id], 30_000),
  );
  const fields: [string, (value: unknown) => boolean][] = [
    ["address", nonempty],
    ["cwd", nonempty],
    ["argv", (value) => Array.isArray(value) && value.every(nonempty)],
    ["state", nonempty],
    [
      "status",
      (value) => value === null || nonempty(isRecord(value) && value.state),
    ],
    ["turn", Number.isInteger],
    ["reported", (value) => typeof value === "boolean"],
    ["parent", (value) => value === null || nonempty(value)],
    ["labels", isRecord],
  ];
  for (const [field, valid] of fields)
    if (!isRecord(raw) || !(field in raw) || !valid(raw[field])) {
      const version = await hcVersion(transport).catch(() => "unknown");
      throw new Error(
        `herdr-core ${version} get output lacks required field ${field}`,
      );
    }
  return {
    id: raw.address,
    cwd: raw.cwd,
    argv: raw.argv,
    state: raw.state,
    status: raw.status?.state ?? null,
    turn: raw.turn,
    reported: raw.reported,
    parent: raw.parent,
    labels: raw.labels,
  };
}
// A blocked program waits on a person's dialog, so it counts as still working.
export function lifecycle(actual: Inspection) {
  if (actual.state !== "live") return "ended";
  if (actual.status === "working" || actual.status === "blocked")
    return "active";
  if (actual.status === "idle" || actual.status === "done") return "quiet";
  return actual.status === "error" ? "errored" : "unknown";
}

type SessionEntry = {
  type?: string;
  message?: {
    role?: string;
    content?: unknown;
    stopReason?: string;
    errorMessage?: string;
  };
};
// An unparseable trailing line is a partial or cut-short write and is ignored; earlier damage fails closed.
async function sessionEntries(path: string | undefined, transport: Transport) {
  if (!path) return [];
  const lines = (await observe(transport, [sessionCommand, path], 30_000))
    .split("\n")
    .filter((line) => line.trim());
  return lines.flatMap((line, index): SessionEntry[] => {
    try {
      return [JSON.parse(line)];
    } catch (error) {
      if (index === lines.length - 1) return [];
      throw new Error(
        `Session ${path} line ${index + 1} is unreadable: ${error}`,
      );
    }
  });
}
function messageText(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}
const messagesOf = (entries: SessionEntry[], role: string) =>
  entries.flatMap((entry) =>
    entry.type === "message" && entry.message?.role === role
      ? [entry.message]
      : [],
  );
const messages = (entries: SessionEntry[], role: string) =>
  messagesOf(entries, role).map((message) => messageText(message.content));
// The last assistant message in the worker's session JSONL; empty until one is written. A turn that ended in a provider error throws.
export async function lastReply(
  session: string | undefined,
  transport: Transport,
) {
  const last = messagesOf(
    await sessionEntries(session, transport),
    "assistant",
  ).at(-1);
  if (last?.stopReason === "error" || nonempty(last?.errorMessage))
    throw new Error(
      `Worker turn ended in error: ${last?.errorMessage ?? "no message"}`,
    );
  return last ? messageText(last.content) : "";
}
// Whether a user message in the session carries the assignment digest.
export async function receivedAssignment(
  session: string | undefined,
  assignmentDigest: string,
  transport: Transport,
) {
  return messages(await sessionEntries(session, transport), "user").some(
    (text) => text.includes(assignmentDigest),
  );
}
const runner = fileURLToPath(new URL("./paseo-workflow.ts", import.meta.url));

export type Worktree = WorktreeState;
export type WorktreeReader = (cwd: string) => Promise<Worktree>;
// Runs Git against cwd, ignoring any caller Git environment redirects.
export async function git(cwd: string, args: string[]) {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return (await execute("git", ["-C", cwd, ...args], { timeout: 30_000, env }))
    .stdout;
}
// Reads the workflow worktree's Git identity.
export const readWorktree: WorktreeReader = async (cwd) => {
  return {
    branch: (await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])).trim(),
    head: (await git(cwd, ["rev-parse", "HEAD"])).trim(),
    uncommitted: (await git(cwd, ["status", "--porcelain=v1"]))
      .trimEnd()
      .split("\n")
      .filter(nonempty)
      .sort(),
  };
};

export function tickPrompt(path: string, state: Workflow) {
  return `AX orchestration tick. Run \`node ${runner} ${resolve(path)} tick\` and take the next step it names in this turn. When the result is \`unchanged\`, end the turn with no user-visible message. Report to the user only on a completed phase, a new blocker, an open gate, or finish.\n\n${ordersBlock(state)}`;
}
