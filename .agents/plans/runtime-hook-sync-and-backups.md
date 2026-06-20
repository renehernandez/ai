# Runtime Hook Sync and Backups

## Goal

Add a managed startup hook that keeps agent worktrees current while avoiding
unsafe Git mutations, and extend the agent runtime so user-level runtime assets
are backed up before any install, update, validation repair, or configuration
edit changes them.

The first user-visible outcome is that Codex and Claude startup can refresh a
repo's primary default-branch checkout and cleanly rebase the current worktree
onto the remote default branch when possible. If the rebase would conflict, the
hook aborts and leaves the current worktree unchanged.

## Motivation

Managed Codex worktrees can be created from a stale local default branch when
the long-lived primary checkout has not been fetched or fast-forwarded. A global
startup hook can reduce that drift across repositories, but the hook must be
conservative because it runs before the user has context for the thread.

A previous Claude hook implementation showed the unsafe failure mode to avoid:
stashing a dirty worktree, rebasing, then popping the stash can leave conflicts
behind while startup continues. The replacement should never stash or reset user
work, and conflict handling must be explicit.

Runtime installation also needs a broader safety layer. The agent runtime
already manages skills, instructions, agents, and generated sub-agent
definitions. Adding hooks and config editing means the runtime will mutate more
user-level files, so it should create bounded backups before changing any
runtime-managed target.

## Desired Behavior

### Startup Git Sync Hook

Add a TypeScript hook under `hooks/` as the source of truth. The runtime should
symlink that source into the Codex and Claude runtime hook folders, and app
configuration should invoke the symlinked hook path.

On startup inside a Git repository, the hook should:

1. Resolve the repository default branch from `origin/HEAD`, then fall back to
   `origin/main`, then `origin/master`.
2. Fetch `origin` for the resolved branch.
3. Find the primary worktree with `git worktree list --porcelain`.
4. Fast-forward the primary worktree only when it is clean and currently on the
   resolved default branch.
5. Inspect the current worktree.
6. If the current worktree is dirty, skip current-worktree rebasing and report
   the reason.
7. If the current worktree is clean, attempt to rebase it onto the remote
   default branch.
8. If the rebase succeeds, report success.
9. If the rebase conflicts, run `git rebase --abort`, report that the checkout
   was left unchanged, and return a failing startup result rather than silently
   continuing.

The hook must never stash, force push, reset, create merge commits, or leave an
in-progress rebase behind.

### Runtime Hook Management

Extend `agent-runtime` with managed hook assets:

- `runtime.canonicalHooksDir`, expected to point at `~/.agents/hooks`.
- `runtime.hookSymlinkTargets`, expected to include `~/.codex/hooks` and
  `~/.claude/hooks`.
- `agent-runtime hooks install|update|validate|status`.
- Wrapper commands should include hooks alongside skills, agents, and
  instructions.

The canonical hooks directory should be a symlink to this repo's `hooks/`
folder, matching the existing documented pattern.

### Automatic Config Registration

The runtime should register the startup hook automatically for Codex and Claude
instead of relying only on README snippets.

Registration must be idempotent:

- Re-running `agent-runtime hooks update` must not duplicate entries.
- Existing unrelated user config must be preserved.
- If config parsing or writing fails, the command should stop after preserving
  the pre-change backup.

Codex registration should target user-level Codex config and register the hook
for the startup session event.

Claude registration should target the user-level Claude hook configuration and
register the same behavior through Claude's corresponding startup hook surface.

The implementation should keep harness-specific config editing contained behind
small helpers so Codex and Claude formats can evolve independently.

### Runtime Backups

Before the runtime changes any user-level target, it should back up the current
state under:

```text
~/.agents/runtime/backups/<asset-kind>/<target-name>/<timestamp>/
```

Asset kinds should cover at least:

- `skills`
- `instructions`
- `agents`
- `hooks`
- `config`

Targets should be stable labels such as `agents`, `codex`, and `claude`.

Backup behavior:

1. Create the backup before changing the target.
2. Back up both files and directories.
3. Preserve symlink information where the target is a symlink.
4. Verify the backup exists before mutating the target.
5. Prune only after a new backup succeeds.
6. Keep the most recent seven backups per asset kind and target.
7. Do not delete older backups when backup creation fails.

Rollback commands are explicitly out of scope for the first implementation, but
the backup layout should make manual restoration straightforward.

## Implementation Tasks

This work is multi-deliverable and should be represented as an OpenSpec change
before implementation. The task list below describes the expected OpenSpec
`tasks.md` shape.

## 1. Shared Backup Primitive

- [ ] 1.1 Add a runtime backup helper that can snapshot files, directories, and
  symlinks into `~/.agents/runtime/backups`.
- [ ] 1.2 Add seven-backup retention per asset kind and target, pruning only
  after successful backup creation.
- [ ] 1.3 Integrate the backup helper into existing skills, instructions, and
  agents runtime mutations before adding hook-specific behavior.
- [ ] 1.4 Add unit tests for file, directory, symlink, missing-target, and
  retention behavior.

## 2. Managed Hook Runtime Scope

- [ ] 2.1 Extend `agent-runtime.config.json` and runtime config parsing with
  canonical hook and hook symlink target settings.
- [ ] 2.2 Add `agent-runtime hooks install|update|validate|status`.
- [ ] 2.3 Include hooks in wrapper `install|update|validate|status` commands.
- [ ] 2.4 Back up hook targets before creating or replacing symlinks.
- [ ] 2.5 Update hook README documentation to describe the managed runtime
  flow.

## 3. Startup Git Sync Hook

- [ ] 3.1 Add the TypeScript startup hook under `hooks/`.
- [ ] 3.2 Implement default-branch resolution with `origin/HEAD`, `origin/main`,
  and `origin/master` fallback.
- [ ] 3.3 Implement primary worktree detection and clean default-branch
  fast-forward.
- [ ] 3.4 Implement clean current-worktree rebase onto the remote default
  branch.
- [ ] 3.5 Abort and report cleanly when the current-worktree rebase conflicts.
- [ ] 3.6 Add fixture-backed tests for non-Git directories, missing remotes,
  dirty primary checkouts, dirty current worktrees, clean detached worktrees,
  clean feature branches, successful rebases, and conflict aborts.

## 4. Automatic Codex and Claude Registration

- [ ] 4.1 Add idempotent Codex config editing for startup hook registration.
- [ ] 4.2 Add idempotent Claude config editing for startup hook registration.
- [ ] 4.3 Back up Codex and Claude config files before changing them.
- [ ] 4.4 Add tests proving repeated updates do not duplicate hook
  registrations and unrelated config survives.
- [ ] 4.5 Add status and validate output that reports whether hook files,
  symlinks, and config registrations are live.

## Verification

Use package-managed commands:

```sh
pnpm test:unit
pnpm test:integration
pnpm biome:check:all
pnpm agent-runtime hooks validate --profile personal
pnpm agent-runtime hooks validate --profile work
```

Manual verification should cover at least one disposable Git repository with a
primary default-branch worktree and one separate worktree that can be rebased
cleanly, plus one disposable repository where the rebase conflicts and the hook
aborts without leaving an in-progress rebase.

## Out of Scope

- Automatic rollback or restore commands.
- Force-pushing, resetting, stashing, or conflict resolution.
- Rewriting project-local setup scripts.
- Editing app config outside the Codex and Claude startup hook registration
  needed for this feature.
- Supporting non-`origin` remotes in the first version.
