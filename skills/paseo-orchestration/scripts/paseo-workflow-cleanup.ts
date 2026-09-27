import {
  access,
  open,
  readdir,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  git,
  listWorkspaces,
  matchingWorkspace,
  paseo,
  readWorktree,
  syncHeartbeat,
} from "./paseo-workflow-io.ts";
import {
  inFlight,
  locked,
  nonempty,
  requireThat,
  type Transport,
  type Workflow,
} from "./paseo-workflow-state.ts";

export type CleanupInput = {
  authorizationSource: string;
  head: string;
  reason?: string;
};
export type CleanupTarget = {
  status: "removed" | "skipped" | "remaining";
  target: string;
  reason?: string;
};
export type CleanupReceipt = Record<
  "worktree" | "workspace" | "scratch",
  CleanupTarget
>;

export const defaultTempRoots = () => [tmpdir(), "/tmp"];

function strictlyBelow(root: string, path: string) {
  const rest = relative(root, path);
  return rest !== "" && rest.split(sep)[0] !== ".." && !isAbsolute(rest);
}
async function exists(path: string) {
  return access(path).then(
    () => true,
    () => false,
  );
}

// Paseo lists agents with a home-relative cwd; archived agents are excluded by default.
async function busyAgents(
  cwd: string,
  transport: Transport,
): Promise<{ id: string; status: string }[]> {
  const rows = JSON.parse(
    await transport(["ls", "--global", "--json"], 30_000),
  );
  requireThat(
    Array.isArray(rows) &&
      rows.every(
        (row) => nonempty(row.id) && nonempty(row.cwd) && nonempty(row.status),
      ),
    "Paseo returned an invalid agent list",
  );
  return (rows as { id: string; cwd: string; status: string }[]).filter(
    (row) =>
      resolve(row.cwd.replace(/^~(?=$|\/)/, homedir())) === cwd &&
      row.status !== "idle" &&
      row.status !== "closed",
  );
}

async function insideGitRepository(path: string) {
  try {
    await git(path, ["rev-parse", "--git-dir"]);
    return true;
  } catch (error) {
    if (/not a git repository/i.test(String(error))) return false;
    throw error;
  }
}

const stateReadLimit = 8 * 1024 * 1024;

// STATE paths are arbitrary, so any file may hold workflow state; an oversized JSON-looking file counts as state.
async function mayBeWorkflowState(path: string) {
  const file = await open(path, "r");
  try {
    const buffer = Buffer.alloc(stateReadLimit + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    if (bytesRead > stateReadLimit) return text.trimStart().startsWith("{");
    const state = JSON.parse(text);
    return state?.version === 1 && nonempty(state.cwd) && !!state.routes;
  } catch {
    return false;
  } finally {
    await file.close();
  }
}

// Refuses a folder that holds Git metadata or any other workflow's runner state; symlinks are never followed.
async function requireOnlyThisWorkflow(directory: string, statePath: string) {
  // The runner's own snapshots, lock, and atomic-save files sit beside the state.
  const name = basename(statePath);
  const runnerOwned = (path: string) => {
    const [top, ...rest] = relative(dirname(statePath), path).split(sep);
    return (
      top === name ||
      top === `${name}.lock` ||
      top.startsWith(".paseo-snapshot-") ||
      (!rest.length &&
        top.startsWith(`${name}.`) &&
        /^\d+\.tmp$/.test(top.slice(name.length + 1)))
    );
  };
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    requireThat(
      entry.name !== ".git",
      `Scratch folder contains Git metadata at ${path}`,
    );
    if (entry.isDirectory()) await requireOnlyThisWorkflow(path, statePath);
    else
      requireThat(
        !entry.isFile() ||
          runnerOwned(path) ||
          !(await mayBeWorkflowState(path)),
        `Scratch folder holds another workflow's runner state at ${path}`,
      );
  }
}

async function scratchTarget(
  path: string,
  state: Workflow,
  tempRoots: string[],
): Promise<CleanupTarget> {
  if (!state.scratch)
    return {
      status: "skipped",
      target: dirname(resolve(path)),
      reason: "state has no recorded scratch binding",
    };
  const real = await realpath(state.scratch);
  const roots = await Promise.all(tempRoots.map((root) => realpath(root)));
  requireThat(
    roots.some((root) => strictlyBelow(root, real)),
    `Scratch folder ${state.scratch} resolves to ${real}, outside the temporary roots`,
  );
  const statePath = await realpath(path);
  requireThat(
    dirname(statePath) === real,
    `Scratch folder ${state.scratch} no longer contains this workflow's state file`,
  );
  requireThat(
    !(await insideGitRepository(real)),
    `Scratch folder ${real} is inside a Git repository`,
  );
  await requireOnlyThisWorkflow(real, statePath);
  return { status: "remaining", target: real };
}

// A Paseo worktree workspace owns its linked worktree: archiving it removes the directory and its Git registration.
async function worktreeTargets(
  cwd: string,
  workspace: { id: string; isolation?: string },
  head: string,
): Promise<Pick<CleanupReceipt, "worktree" | "workspace">> {
  const skip = (reason: string) => ({
    worktree: { status: "skipped" as const, target: cwd, reason },
    workspace: { status: "skipped" as const, target: workspace.id, reason },
  });
  if (workspace.isolation !== "worktree")
    return skip("local-checkout workspace");
  const [gitDir, commonDir] = (
    await git(cwd, [
      "rev-parse",
      "--path-format=absolute",
      "--git-dir",
      "--git-common-dir",
    ])
  )
    .trim()
    .split("\n");
  if (gitDir === commonDir) return skip("main checkout");
  const observed = await readWorktree(cwd);
  requireThat(
    observed.head === head,
    `Worktree ${cwd} is at ${observed.head}, not the expected head ${head}`,
  );
  requireThat(
    !observed.uncommitted.length,
    `Worktree ${cwd} has uncommitted changes: ${observed.uncommitted.join(", ")}`,
  );
  return {
    worktree: { status: "remaining", target: cwd },
    workspace: { status: "remaining", target: workspace.id },
  };
}

// Removes the workflow's own linked worktree, Paseo workspace, and scratch folder after validating every target.
export async function cleanup(
  path: string,
  input: CleanupInput,
  caller: { agentId?: string },
  transport: Transport = paseo,
  tempRoots: string[] = defaultTempRoots(),
): Promise<{ targets: CleanupReceipt }> {
  requireThat(
    nonempty(input.authorizationSource) &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(input.head),
    "Cleanup requires the user's authorization source and the expected full worktree head",
  );
  const pending = inFlight(JSON.parse(await readFile(path, "utf8")));
  requireThat(
    !pending.length,
    `Cleanup refuses while work is in flight: ${pending.join(", ")}`,
  );
  await syncHeartbeat(path, caller, transport);
  const targets = await locked(path, async (state) => {
    requireThat(!inFlight(state).length, "Work started before cleanup");
    requireThat(
      state.finished || nonempty(input.reason),
      "Cleanup of an unfinished workflow requires a reason for abandoning it",
    );
    requireThat(state.workspace, "Cleanup requires a recorded workspace");
    const cwd = resolve(state.cwd);
    const rows = await listWorkspaces(transport);
    const binding = matchingWorkspace(rows, cwd);
    requireThat(
      binding?.id === state.workspace.id,
      `Recorded workspace ${state.workspace.id} no longer resolves uniquely for ${cwd}`,
    );
    const busy = await busyAgents(cwd, transport);
    // The calling orchestrator may run inside the workspace; archiving would close it mid-action.
    const selfHosted =
      busy.length > 0 && busy.every((agent) => agent.id === caller.agentId);
    requireThat(
      !busy.length || selfHosted,
      `Agents are still running in workspace ${binding.id}: ${busy.map((agent) => `${agent.id} (${agent.status})`).join(", ")}`,
    );
    const workspace = rows.find((row) => row.workspaceId === binding.id);
    const reason = `the calling orchestrator session runs in this workspace; archive workspace ${binding.id} from Paseo when done`;
    const receipt: CleanupReceipt = {
      ...(selfHosted
        ? {
            worktree: { status: "skipped", target: cwd, reason },
            workspace: { status: "skipped", target: binding.id, reason },
          }
        : await worktreeTargets(
            cwd,
            { id: binding.id, isolation: workspace?.isolation },
            input.head,
          )),
      scratch: await scratchTarget(path, state, tempRoots),
    };
    state.cleanup = {
      authorizationSource: input.authorizationSource,
      head: input.head,
      ...(input.reason ? { reason: input.reason } : {}),
      startedAt: new Date().toISOString(),
    };
    return receipt;
  });
  const stop = (step: string, error: unknown) =>
    new Error(
      `Cleanup stopped at ${step} without retry: ${String(error)}\n${JSON.stringify({ targets })}`,
    );
  if (targets.workspace.status === "remaining") {
    try {
      await transport(
        ["workspace", "archive", targets.workspace.target],
        60_000,
      );
    } catch (error) {
      throw stop("workspace archive", error);
    }
    targets.workspace.status = "removed";
    if (await exists(targets.worktree.target))
      throw stop("worktree removal", "archive left the worktree in place");
    targets.worktree.status = "removed";
  }
  if (targets.scratch.status === "remaining") {
    try {
      await rm(targets.scratch.target, { recursive: true });
    } catch (error) {
      throw stop("scratch deletion", error);
    }
    targets.scratch.status = "removed";
  }
  return { targets };
}
