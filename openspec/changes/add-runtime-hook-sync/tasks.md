## 1. Runtime Backup Foundation

- [x] 1.1 Add a shared backup primitive for files, directories, symlinks,
  missing targets, backup verification, seven-backup retention, and focused
  unit tests.
- [ ] 1.2 Integrate the backup primitive into existing skills, instructions,
  reusable script, and OpenSpec runtime mutation paths while keeping validate
  and status commands read-only.

## 2. Managed Hooks Runtime Scope

- [ ] 2.1 Add hook runtime configuration, `agent-runtime hooks
  install|update|validate|status`, wrapper inclusion, and backup-gated symlink
  migration for canonical, Codex, and Claude hook paths.

## 3. Startup Git Sync Hook

- [ ] 3.1 Add the conservative TypeScript startup Git sync hook with fixture
  tests for default-branch resolution, primary worktree fast-forward,
  clean-worktree rebase, detached HEAD policy, conflict aborts, and
  deterministic invocation.

## 4. Codex And Claude Registration

- [ ] 4.1 Add fixture-tested Codex and Claude startup registration helpers that
  preserve unrelated config, avoid duplicate registrations, and report trust or
  registration gaps.
- [ ] 4.2 Wire Codex and Claude registration into hooks update, validate, and
  status with config backups, then update hooks docs, command rules, and agent
  instructions.
