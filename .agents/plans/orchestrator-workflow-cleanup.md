# Orchestrator workflow cleanup

## Objective

Let the managed planner orchestrator clean up after a workflow once the user
authorizes it: remove the workflow's linked worktree, archive the Paseo
workspace that owns the worker tabs, and delete the private scratch folder that
holds the runner state and snapshots. Today the shared deletion hook denies
every `rm` outside the session cwd, so the orchestrator cannot delete its own
`/tmp` scratch folder (including a secrets file it created) and asks the user to
run `rm -rf` by hand. Worktree removal only works because the hook does not
inspect `git worktree remove`, which no contract describes.

## Accepted scope

One atomic plan plus implementation in one Ready AI-repository PR. Add one
runner action, `cleanup`, that performs all three removals itself after
validating each target. Keep `hooks/block-delete-outside-cwd.ts` and the Pi
shell policy unchanged; no role gains broader shell deletion.

Out of scope: deleting local or remote branches, cleaning workflows other than
the one named by the state file, bulk cleanup, and any change to merge,
deployment, or publication authority.

## Reuse and deviation

- The runner (`skills/paseo-orchestration/scripts/paseo-workflow.ts`) already
  owns every lifecycle side effect, the Paseo transport, workspace binding,
  and the worktree reader. `cleanup` reuses the transport, `readWorktree`, the
  recorded `workspace` binding, the state lock, and the compact JSON result.
- The state module owns `nextStep`, in-flight detection, and `finished`;
  cleanup consumes them rather than re-deriving phase.
- Both modules are already about 1,300 lines, so the cleanup logic lives in one
  cohesive sibling module wired into `main`, following the prior plan's
  direction to extract rather than enlarge.
- Rejected alternative: allow the planner role to `rm` under the temp
  directory and worktree roots. That would weaken the hook shared by every
  managed session on path grounds alone, and it would not bind deletion to the
  workflow's own recorded targets.

## Behavior

Input: `authorizationSource` (the user statement, or the active standing-order
ID that carries it), the expected worktree `head`, and, only when the workflow
is not finished, a `reason`.

Preconditions, all checked before any removal:

- Nothing is in flight: no reserved or running worker and no pending hosted
  probe. The runner deletes its heartbeat if one remains.
- The workflow is finished, or the input carries a `reason` for abandoning
  it. The tripdy workflow ended outside the runner's `finish` step, so
  requiring `finish` alone would leave that case unsolved.
- The recorded workspace binding still resolves to exactly one non-archived
  Paseo workspace for the workflow cwd, reusing the runner's existing
  ambiguity refusal. Paseo keys workspaces by exact directory and exposes no
  workspace identity on agents, so workspace membership is defined as agents
  whose cwd equals that verified workspace cwd. No such non-archived agent may
  be running. Idle agents are acceptable because archiving the workspace
  closes them. This also refuses when the orchestrator itself runs inside the
  workflow workspace.

Worktree and workspace: a main checkout or local-checkout workspace is never
removed or archived; the result records both as skipped. For a linked worktree
(its Git dir differs from the common dir) whose HEAD equals the expected head
with no uncommitted changes, cleanup runs one fixed sequence with a single
worktree-removal owner. The first implementation step is the proof below; it
selects that owner before any cleanup code is written. If archiving a Paseo
worktree workspace removes the directory and its Git registration, archive
alone owns removal. Otherwise, plain `git worktree remove`, never `--force`,
runs first, then archive. The chosen sequence has no order-tolerance branches.

Scratch folder: the runner records a scratch binding when it initializes a new
state: the state file's directory, which the contract requires to be dedicated
to that one workflow. Cleanup deletes only that recorded directory, and only
when its real path sits strictly below the real path of `os.tmpdir()` or
`/tmp`, it still contains the state file, it holds no other workflow's runner
state, and it is not inside any Git work tree. States without a scratch
binding, including ones created before this change, record the folder as
skipped. Scratch deletion runs last because it removes the runner record.

Any failed precondition refuses the whole action with no removal. A failure
after a removal has started stops immediately and reports what was removed and
what remains; the runner never retries or escalates to forced removal. The
compact result line lists each target as removed or skipped, with the reason,
and serves as the receipt once the state is gone.

## Contract changes

- `paseo-workflow.md`: add `cleanup` to the runner table. The user-gates
  section stays authoritative: cleanup still requires user authority; the
  runner is the mechanism, not the authority. The table notes that a standing
  order can supply the authorization source.
- `SKILL.md`: keep "grants no merge, deployment, or cleanup authority" and add
  that authorized cleanup goes through the runner's `cleanup` action rather
  than shell deletion.

## Acceptance and proof

First visible proof: on a disposable Paseo worktree workspace in this
repository's project, observe whether `paseo workspace archive` removes the
worktree directory and its `git worktree list` entry, and whether it tolerates
an already-removed worktree. Record the result task-locally and fix the
ordering from it.

Unit tests in the existing workflow suite, using real temporary Git
repositories and a fake Paseo transport:

- the full success path: linked worktree removed, workspace archived, scratch
  folder deleted, receipt lists each;
- refusals with nothing removed: work in flight, unfinished without a reason,
  a running agent in the workspace, dirty worktree, head mismatch, scratch
  folder outside the temp roots, scratch folder inside a Git work tree, and a
  symlinked scratch path that resolves outside the temp roots;
- skips: main checkout, local-checkout workspace, and state without a
  scratch binding;
- partial failures stop without retrying and report removed and remaining
  targets: workspace archive failing after worktree removal (when that
  sequence is selected), and scratch deletion failing after archive;
- a scratch folder holding another workflow's state is refused;
- `--force` is never passed and no branch is deleted.

Run the project's lint, format, and native hook suites, and `writing-skills`
pressure scenarios for the changed contract text. Run one planning review round
and one implementation review round. Exercise the runner only against isolated
state and disposable worktrees; do not touch the live runtime before merge.
Publish Ready on GitHub `origin` under the AI repository policy (no hosted CI
or automated reviewer required). No merge is authorized.

## Delivery boundary and risk

One coherent outcome: authorized, bounded workflow cleanup. The main risks are
deleting the wrong directory and deleting work that was never pushed. Controls
are exact-target validation against recorded state, temp-root containment with
real-path resolution, non-force worktree removal bound to the expected head,
live-agent refusal, and preserving branches for recovery.
