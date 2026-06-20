## Why

Startup hooks and runtime-managed user assets are becoming shared infrastructure
for Codex, Claude, and the local agent runtime. The current setup relies on
manual hook registration and unsafe Git-sync behavior, while runtime mutations
can replace files or symlinks without a verified backup.

## What Changes

- Add a shared runtime backup primitive for files, directories, symlinks, and
  explicit missing-target handling.
- Integrate backup-before-mutation behavior into existing runtime-managed
  mutation paths before adding new hook behavior.
- Add a managed `hooks` scope to `agent-runtime` with `install`, `update`,
  `validate`, and `status` commands.
- Manage canonical hook and Codex/Claude hook symlink targets with
  backup-gated migration from existing real directories.
- Add a conservative TypeScript startup Git sync hook that never stashes,
  resets, force pushes, or leaves an in-progress rebase behind.
- Add idempotent Codex and Claude startup hook registration helpers with config
  backups and fixture-backed format tests.
- Update hook docs, runtime command docs, and agent instructions for the new
  managed hook lifecycle and exact verification commands.

## Capabilities

### New Capabilities

- `runtime-backups`: backup-before-mutation behavior, retention, and backup
  verification for runtime-managed files, directories, and symlinks.
- `runtime-hooks`: managed hook installation, update, validation, status,
  symlink targets, and Codex/Claude config registration through
  `agent-runtime`.
- `startup-git-sync`: conservative startup Git synchronization behavior for
  primary default-branch checkouts and safe current-worktree rebases.

### Modified Capabilities

None.

## Impact

- `scripts/agent-runtime.ts`
- `agent-runtime.config.json`
- `hooks/`
- `hooks/README.md`
- `AGENTS.md`, `instructions/AGENTS.md`, and command/runtime rules where needed
- `tests/unit` and `tests/integration` runtime fixtures
- OpenSpec validation and plan delivery workflow for this repo
