## ADDED Requirements

### Requirement: Conservative startup Git synchronization
The startup Git sync hook SHALL fetch the selected remote default branch,
fast-forward the clean primary default-branch worktree, and rebase only clean
and safe current worktrees.

#### Scenario: Dirty worktree is skipped
- **WHEN** the current worktree has tracked changes, untracked files, or
  in-progress Git operation state
- **THEN** the hook skips rebase and reports the reason

#### Scenario: Primary worktree is selected by branch ref
- **WHEN** multiple worktrees exist
- **THEN** the hook selects the primary default-branch worktree using
  `git worktree list --porcelain` branch refs rather than first-worktree order

### Requirement: Unsafe Git operations are forbidden
The startup Git sync hook SHALL NOT stash, reset, force push, create merge
commits, or leave an in-progress rebase behind.

#### Scenario: Rebase conflict aborts cleanly
- **WHEN** a clean current-worktree rebase conflicts
- **THEN** the hook aborts the rebase, reports that the checkout was left
  unchanged, exits non-zero, and leaves no `.git/rebase-*` state behind

### Requirement: Detached HEAD policy
The startup Git sync hook SHALL skip detached HEAD states that include local
commits not reachable from the selected remote default branch.

#### Scenario: Detached local commit is not rebased
- **WHEN** the current worktree is detached at a local commit that is not
  reachable from the selected remote default branch
- **THEN** the hook skips mutation and reports the detached-local state

### Requirement: Deterministic hook invocation
The startup Git sync hook SHALL run without depending on `npx` downloading
packages or project-local `node_modules` in the repository where startup runs.

#### Scenario: Minimal path execution
- **WHEN** the hook runs in a disposable repository with a minimal `PATH` and no
  project-local `node_modules`
- **THEN** the hook executes through the managed runtime invocation strategy
