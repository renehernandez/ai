import {
  access,
  open,
  readdir,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { labelledTerminals, stopWatcher, wakeRequestFile } from "./watch.ts";
import { git, herdr, readWorktree } from "./workflow-io.ts";
import {
  type CleanupReceipt,
  type CleanupTarget,
  inFlight,
  locked,
  nonempty,
  recordCleanupReceipt,
  requireHerdrTransport,
  requireThat,
  type Transport,
  unsettledConsult,
  type Workflow,
} from "./workflow-state.ts";

export type { CleanupReceipt, CleanupTarget };
export type CleanupInput = {
  authorizationSource: string;
  head: string;
  reason?: string;
};

export const defaultTempRoots = () => [tmpdir(), "/tmp"];

function strictlyBelow(root: string, path: string) {
  const rest = relative(root, path);
  return rest !== "" && rest.split(sep)[0] !== ".." && !isAbsolute(rest);
}
const within = (root: string, path: string) =>
  resolve(path) === root || strictlyBelow(root, resolve(path));
async function exists(path: string) {
  return access(path).then(
    () => true,
    () => false,
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
      top.startsWith(".ax-snapshot-") ||
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

// Removes a linked worktree only when it is clean at the expected head, no other live terminal works inside it, and the caller stands outside it.
async function worktreeTarget(
  cwd: string,
  head: string,
  callerId: string | undefined,
  callerCwd: string,
  transport: Transport,
): Promise<CleanupTarget & { root?: string }> {
  const skip = (reason: string) => ({
    status: "skipped" as const,
    target: cwd,
    reason,
  });
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
  if (basename(commonDir) !== ".git")
    return skip(`common Git directory ${commonDir} has no main checkout`);
  const observed = await readWorktree(cwd);
  if (observed.head !== head)
    return skip(`worktree is at ${observed.head}, not the expected ${head}`);
  if (observed.uncommitted.length)
    return skip(`uncommitted changes: ${observed.uncommitted.join(", ")}`);
  if (within(cwd, callerCwd))
    return skip("the caller's working directory is inside the worktree");
  const listed = JSON.parse(await transport(["ls", "--json"], 30_000));
  requireThat(
    Array.isArray(listed?.terminals),
    "herdr-core returned an invalid terminal list",
  );
  const occupants = (listed.terminals as { address: string; cwd?: string }[])
    .filter(
      (row) =>
        row.address !== callerId && nonempty(row.cwd) && within(cwd, row.cwd),
    )
    .map((row) => row.address);
  if (occupants.length)
    return skip(`live terminals work inside it: ${occupants.join(", ")}`);
  return { status: "remaining", target: cwd, root: dirname(commonDir) };
}

// Kills each live labelled terminal and removes every labelled one, finished included, children before parents, recording progress in `receipt`; the caller is never touched.
async function removeTerminals(
  state: Workflow,
  callerId: string | undefined,
  transport: Transport,
  receipt: CleanupReceipt,
) {
  const target = receipt.terminals.target;
  const labelled = async () =>
    (
      await labelledTerminals(state.workflowId, transport, { all: true })
    ).filter((terminal) => terminal.address !== callerId);
  const listed = await labelled();
  const depth = (address: string, seen = new Set<string>()): number => {
    const parent = listed.find((item) => item.address === address)?.parent;
    if (!parent || seen.has(parent)) return 0;
    seen.add(parent);
    return 1 + depth(parent, seen);
  };
  const ordered = [...listed].sort(
    (a, b) => depth(b.address) - depth(a.address),
  );
  // A terminal started with --rm is removed as it dies, so its kill or rm reports not_found.
  const gone = (error: { stdout?: unknown }) => {
    if (!/not_found/.test(`${error?.stdout ?? ""} ${error}`)) throw error;
  };
  const removed: string[] = [];
  const progress = (remaining: string[]) => {
    receipt.terminals.reason = `removed: ${removed.join(", ") || "none"}; remaining: ${remaining.join(", ")}`;
  };
  progress(ordered.map((item) => item.address));
  for (const [index, { address, state: status }] of ordered.entries()) {
    if (status !== "finished")
      await transport(["kill", "--json", address], 30_000).catch(gone);
    await transport(["rm", "--json", address], 30_000).catch(gone);
    removed.push(address);
    progress(ordered.slice(index + 1).map((item) => item.address));
  }
  // A just-killed terminal's row is eventually consistent, so a residual is re-read with the observation backoff before it counts.
  let left = await labelled();
  for (let attempt = 1; left.length && attempt < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    left = await labelled();
  }
  if (left.length) {
    progress(left.map((item) => item.address));
    throw new Error(
      `Terminals still present after removal: ${left.map((item) => item.address).join(", ")}`,
    );
  }
  receipt.terminals = ordered.length
    ? { status: "removed", target, reason: removed.join(", ") }
    : { status: "skipped", target, reason: "no labelled terminals" };
}

// Removes the workflow's terminals, its linked worktree when safe, and its scratch folder after validating every target.
export async function cleanup(
  path: string,
  input: CleanupInput,
  caller: { terminalId?: string; cwd?: string },
  transport: Transport = herdr,
  tempRoots: string[] = defaultTempRoots(),
): Promise<{ targets: CleanupReceipt }> {
  requireThat(
    nonempty(input.authorizationSource) &&
      /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(input.head),
    "Cleanup requires the user's authorization source and the expected full worktree head",
  );
  const saved = JSON.parse(await readFile(path, "utf8"));
  requireHerdrTransport(saved);
  const pending = inFlight(saved);
  requireThat(
    !pending.length,
    `Cleanup refuses while work is in flight: ${pending.join(", ")}`,
  );
  const unsettled = unsettledConsult(saved);
  requireThat(
    !unsettled.length,
    `Cleanup waits for the current consult to settle: ${unsettled.join(", ")}`,
  );
  // Every check that can refuse runs first and mutates nothing; the reservation is saved before the first removal, so later actions refuse.
  // The watcher stops and this workflow's wake request goes only after the reservation, in the receipt's terminal step.
  const { state, targets } = await locked(path, async (state) => {
    requireThat(
      !inFlight(state).length && !unsettledConsult(state).length,
      "Work started before cleanup",
    );
    requireThat(
      state.finished || nonempty(input.reason),
      "Cleanup of an unfinished workflow requires a reason for abandoning it",
    );
    const scratch = await scratchTarget(path, state, tempRoots);
    state.cleanup = {
      authorizationSource: input.authorizationSource,
      head: input.head,
      ...(input.reason ? { reason: input.reason } : {}),
      startedAt: new Date().toISOString(),
    };
    const targets: CleanupReceipt = {
      terminals: {
        status: "remaining",
        target: `ax.workflow=${state.workflowId}`,
      },
      worktree: { status: "remaining", target: resolve(state.cwd) },
      scratch,
    };
    return { state: structuredClone(state), targets };
  });
  let watcherStopped = false;
  const step = async <T>(name: string, body: () => Promise<T>) => {
    try {
      return await body();
    } catch (error) {
      await recordCleanupReceipt(path, targets, watcherStopped).catch(() => {});
      throw new Error(
        `Cleanup stopped at ${name} without retry: ${String(error)}\n${JSON.stringify({ targets })}`,
      );
    }
  };
  await step("terminal removal", async () => {
    // The watcher goes first: its stop generation lands before any kill, so it types nothing during cleanup.
    await stopWatcher(path, state, transport);
    watcherStopped = true;
    if (state.wake && nonempty(state.workflowId))
      await rm(wakeRequestFile(state.wake, state.workflowId), { force: true });
    await removeTerminals(state, caller.terminalId, transport, targets);
  });
  const { root, ...worktree } = await step("worktree check", () =>
    worktreeTarget(
      resolve(state.cwd),
      input.head,
      caller.terminalId,
      resolve(caller.cwd ?? process.cwd()),
      transport,
    ),
  );
  targets.worktree = worktree;
  if (targets.worktree.status === "remaining" && root)
    await step("worktree removal", async () => {
      // Plain removal: Git itself refuses a dirty or locked worktree, and no branch is deleted.
      await git(root, ["worktree", "remove", targets.worktree.target]);
      if (await exists(targets.worktree.target))
        throw new Error("git left the worktree in place");
      targets.worktree.status = "removed";
    });
  // The state survives when its scratch folder is skipped or its deletion fails, so it keeps the receipt.
  await step("receipt", () =>
    recordCleanupReceipt(path, targets, watcherStopped),
  );
  if (targets.scratch.status === "remaining")
    await step("scratch deletion", async () => {
      await rm(targets.scratch.target, { recursive: true });
      targets.scratch.status = "removed";
    });
  return { targets };
}
