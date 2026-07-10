# Session startup and mode preflight

Use this shared startup pass for non-trivial repository work. It is part of
every mode preflight and is not a separate lifecycle entrypoint.

## Startup pass

Gather only the context required for the request:

1. Read the workspace `AGENTS.md` and relevant project rule files.
2. Check the branch and working tree with `git status --short --branch`.
3. Run `git worktree list` when worktrees, detached state, or branch ownership
   may affect the request.
4. Verify hosted state only when the request depends on a PR/MR, CI, review,
   merge, deployment, remote branch, or latest default branch.
5. Search memory only when prior decisions, preferences, or continuity matter.
6. Inspect directly affected files before expanding to generated or unrelated
   surfaces.

Prefer targeted `rg`, Git, and provider-CLI reads. Do not turn startup into a
broad audit unless the first pass exposes a wider risk.

## Mode preflight

For non-trivial work, report the mode, mutation authority, and goal once.
Explicit mode language overrides inference.

| Mode | Preflight requirement |
| --- | --- |
| Explore | Confirm read-only authority; create no repository, tracker, or provider state. |
| Plan | Confirm artifact-write authority, the target planning artifact, and one dedicated branch/worktree before the first write. |
| Execute | Confirm accepted implementation scope and exactly one writer for the owned branch/worktree. |
| Review | Bind inspection to one artifact fingerprint, target-base diff, or exact HEAD and remain read-only. |
| Finish | Confirm provider route, current publication checkpoint, hosted artifact identity, and explicit authority for merge, deployment, or cleanup. |

If the worktree is dirty, shared, divergent from its handoff, changed by an
uncoordinated process, or has unknown ownership, Plan and Execute block or move
to a new isolated worktree. Review may inspect the state but does not repair it.

## Resume pass

When continuing from a handoff:

1. Verify cwd, branch, worktree, HEAD, changed paths, untracked paths, and diff
   fingerprint against live state.
2. Verify provider artifact, CI, review, merge, and deployment state when they
   affect the next action.
3. Re-read only the rules and changed files needed for that action.
4. Continue from the recorded next action unless live state contradicts it.

Live state is authoritative. A contradiction invalidates ownership, exact-head
review, or publication evidence until the owning mode refreshes it.

## Startup brief

Keep the brief short: surface, repository/worktree, branch and dirty state,
relevant hosted artifact if any, mode authority, and next action.
