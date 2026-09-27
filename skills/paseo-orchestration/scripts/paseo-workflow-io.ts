import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  inFlight,
  locked,
  nonempty,
  ordersBlock,
  requireThat,
  type Transport,
  type Workflow,
  type WorkspaceBinding,
} from "./paseo-workflow-state.ts";

// Provider and Git access shared by the runner entrypoint and its cleanup action.
const execute = promisify(execFile);
export const paseo: Transport = async (args, timeout, env) =>
  (
    await execute("paseo", args, {
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
const runner = fileURLToPath(new URL("./paseo-workflow.ts", import.meta.url));
const heartbeatLifetimeMs = 24 * 60 * 60_000;

export type Worktree = { branch: string; head: string; uncommitted: string[] };
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

export type WorkspaceRow = {
  workspaceId: string;
  cwd: string;
  isolation?: string;
  archived?: boolean;
};

export async function listWorkspaces(transport: Transport) {
  const rows = JSON.parse(
    await transport(["workspace", "ls", "--json"], 30_000),
  );
  requireThat(
    Array.isArray(rows) &&
      rows.every((row) => nonempty(row.workspaceId) && nonempty(row.cwd)),
    "Paseo returned an invalid workspace list",
  );
  return rows as WorkspaceRow[];
}
export function matchingWorkspace(
  rows: WorkspaceRow[],
  cwd: string,
  workspaceId?: string,
): WorkspaceBinding | undefined {
  const available = rows.filter((row) => !row.archived);
  if (workspaceId) {
    const row = available.find((item) => item.workspaceId === workspaceId);
    requireThat(row, `Paseo workspace ${workspaceId} is missing or archived`);
    requireThat(
      resolve(row.cwd) === cwd,
      `Paseo workspace ${workspaceId} does not match canonical cwd ${cwd}`,
    );
    return { id: row.workspaceId, cwd };
  }
  const matches = available.filter((row) => resolve(row.cwd) === cwd);
  requireThat(
    matches.length <= 1,
    `Canonical cwd ${cwd} has ambiguous Paseo workspaces`,
  );
  return matches[0] ? { id: matches[0].workspaceId, cwd } : undefined;
}

export function tickPrompt(path: string, state: Workflow) {
  return `AX orchestration tick. Run \`node ${runner} ${resolve(path)} tick\` and take the next step it names in this turn. When the result is \`unchanged\`, end the turn with no user-visible message. Report to the user only on a completed phase, a new blocker, an open gate, or finish.\n\n${ordersBlock(state)}`;
}

async function deleteHeartbeat(
  heartbeat: NonNullable<Workflow["heartbeat"]>,
  transport: Transport,
) {
  try {
    await transport(["heartbeat", "delete", heartbeat.id, "--json"], 30_000, {
      PASEO_AGENT_ID: heartbeat.agentId,
    });
  } catch (error) {
    // An expired or already deleted heartbeat is the desired end state.
    if (!/not found/i.test(String(error))) throw error;
  }
}

// Keeps one heartbeat on the caller while work is in flight, renewing it before half its lifetime passes.
export async function syncHeartbeat(
  path: string,
  input: { agentId?: string },
  transport: Transport = paseo,
  now = Date.now,
) {
  return locked(path, async (state) => {
    const current = state.heartbeat;
    if (state.finished || !inFlight(state).length) {
      if (current) await deleteHeartbeat(current, transport);
      delete state.heartbeat;
      return undefined;
    }
    const agentId = input.agentId;
    requireThat(
      nonempty(agentId),
      "Arming the orchestrator heartbeat requires the caller's PASEO_AGENT_ID",
    );
    const prompt = tickPrompt(path, state);
    if (
      current?.agentId === agentId &&
      current.promptSha256 === digest(prompt) &&
      Date.parse(current.expiresAt) - now() > heartbeatLifetimeMs / 2
    )
      return current;
    const created = JSON.parse(
      await transport(
        [
          "heartbeat",
          "create",
          "--cron",
          "*/5 * * * *",
          "--expires-in",
          "24h",
          "--name",
          "ax-orchestrator-tick",
          "--json",
          prompt,
        ],
        30_000,
        { PASEO_AGENT_ID: agentId },
      ),
    );
    const target = String(created.target ?? "").replace(/^agent:/, "");
    requireThat(
      nonempty(created.id) && nonempty(target) && agentId.startsWith(target),
      "Paseo heartbeat does not target the calling orchestrator session",
    );
    state.heartbeat = {
      id: created.id,
      agentId,
      expiresAt: new Date(now() + heartbeatLifetimeMs).toISOString(),
      promptSha256: digest(prompt),
    };
    // The replacement already exists; a stale predecessor expires on its own and extra ticks are idempotent.
    if (current) await deleteHeartbeat(current, transport).catch(() => {});
    return state.heartbeat;
  });
}
