# Destructive Primary Startup Sync

## Goal

Ensure every Git-backed agent session starts from the fetched remote default
branch by discarding uncommitted changes in the primary default-branch
worktree, fast-forwarding that branch, and advancing a clean newly created task
worktree before agent work begins.

## Behavioral Contract

- The startup hook fetches the remote default branch before changing either
  checkout.
- Before destructive cleanup, the hook verifies that the primary default branch
  can fast-forward to the fetched remote ref. A diverged primary branch fails
  startup unchanged with an actionable diagnostic; local commits are never
  reset or deleted.
- When the primary default-branch worktree has no in-progress Git operation and
  is fast-forward eligible, the hook discards staged and unstaged tracked
  changes and removes untracked files and directories. Ignored files remain
  untouched, then the hook fast-forwards the branch.
- An in-progress merge, rebase, cherry-pick, or revert in the primary worktree
  fails startup without cleanup.
- A clean detached task worktree whose HEAD is already reachable from the
  fetched remote default branch advances to that remote ref instead of staying
  on its stale commit.
- Existing feature branches retain the current clean-worktree rebase behavior.
  Dirty task worktrees and detached task worktrees with local commits remain
  unchanged and fail startup rather than silently continuing from stale state.
- Startup outside a Git worktree remains a successful no-op.

## Reuse And Deviation

The canonical owner is `hooks/startup-git-sync.ts`, with its integration
contract in `tests/integration/startup-git-sync.test.ts` and operational
description in `hooks/README.md`. Extend those owners directly; introduce no
parallel hook or configuration mechanism.

The material deviation from the existing conservative precedent is deliberate:
primary-worktree dirtiness changes from a skip condition to authorized cleanup,
and a safe detached task worktree changes from a no-op to an advance. Existing
guards for local commits, in-progress operations, rebase conflicts, and non-Git
directories remain the safety boundary.

## Acceptance And Proof

- Integration fixtures prove that staged changes, tracked modifications, and
  untracked paths in the primary worktree are removed, ignored paths survive,
  and the primary checkout reaches the fetched remote commit.
- Integration fixtures prove that a stale clean detached task worktree advances
  to the same fetched remote commit.
- Regression fixtures prove that a diverged primary branch, in-progress primary
  Git operations, dirty task worktrees, and detached local task commits are not
  destroyed and produce startup failure where applicable.
- Existing clean-feature rebase, conflict-abort, runtime-loader, and non-Git
  behaviors continue to pass.
- The focused startup-hook integration suite is the first real confirmation:
  it invokes the actual hook against temporary remotes and linked worktrees and
  observes filesystem cleanup plus exact Git HEAD movement.

## Delivery

Deliver this plan, the startup hook behavior, integration coverage, and hook
documentation as one atomic draft GitLab MR targeting `main`. Do not activate
the feature-branch hook in the live runtime. Live registration cleanup and AX
runtime synchronization occur only from a clean merged `main` checkout after
explicit merge authority.
