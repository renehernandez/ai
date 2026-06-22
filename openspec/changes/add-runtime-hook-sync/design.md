## Context

`ax` currently manages skills, instructions, reusable scripts, and
repo-local OpenSpec scaffolding. Those flows can replace directories, files,
and symlinks directly. The repo also has user-level hooks under `hooks/`, but
hook installation and Codex/Claude startup registration are still manual and
the existing startup Git sync approach has known unsafe patterns around stashing
and rebasing.

The change is intentionally sequenced. Backup behavior lands first, then the
existing runtime mutation paths adopt it, then hooks become a managed runtime
scope, then the startup Git hook and config registration are enabled.

## Goals / Non-Goals

**Goals:**

- Add a reusable backup-before-mutation primitive with deterministic retention.
- Route existing runtime mutation helpers through verified backups before adding
  new hook mutations.
- Add a managed `hooks` runtime scope with install, update, validate, and
  status commands.
- Add conservative startup Git sync that mutates only clean and safe checkouts.
- Add fixture-tested Codex and Claude registration helpers before live config
  writes are wired into runtime commands.

**Non-Goals:**

- Add automatic rollback commands.
- Reintroduce an `agents` runtime scope.
- Stash, reset, force push, create merge commits, or resolve Git conflicts.
- Mutate live Codex or Claude config from automated tests.

## Decisions

1. Backups are a shared primitive, not hook-specific logic.

   Runtime helpers such as file replacement, directory replacement, symlink
   replacement, reusable script installation, instruction pruning, and OpenSpec
   normalization should call a common helper before mutating existing managed
   targets. This avoids a second safety model for hooks.

2. Missing targets have explicit semantics.

   Missing targets do not need a content backup, but the helper must make that
   state observable so callers can prove they checked before mutation. The
   implementation can use a manifest entry or an explicit skipped result, but
   tests must lock the chosen behavior.

3. Hook management is separate from startup Git behavior.

   `ax hooks install|update|validate|status` should first make hook
   paths and symlinks observable. The Git sync hook then builds on stable paths.
   Codex and Claude config registration comes last because those formats are
   harness-specific and more likely to drift.

4. Detached worktrees are safe only when Git can prove reachability.

   The startup hook may rebase a clean branch or a detached HEAD that is already
   reachable from the selected remote default branch. Detached local commits are
   skipped rather than rewritten by startup automation.

5. Config registration helpers are fixture-first.

   Codex and Claude registration should use small format-specific helpers. Tests
   use fixture config files and assert unrelated config survives, duplicate
   entries are not added, and missing trust or registration state is reported.

## Risks / Trade-offs

- Existing hook directories may be real directories, not symlinks -> migration
  must back them up and refuse replacement if backup verification fails.
- The repo has multiple remotes -> hook status and validate output must report
  the selected remote URL and warn when it differs from the expected primary
  remote.
- Startup hooks run before the user has thread context -> dirty, conflicted, or
  detached-local states must skip mutation with explicit diagnostics.
- TypeScript hook execution can depend on local tooling -> invocation must be
  deterministic and tested with minimal `PATH` and no project-local
  `node_modules`.

## Migration Plan

1. Land the backup primitive with unit tests only.
2. Integrate backups into existing runtime mutations and verify current runtime
   commands still pass.
3. Add hook configuration and hook symlink management with fixture-backed
   migration tests.
4. Add startup Git sync behavior and disposable Git repository tests.
5. Add Codex and Claude registration helpers and wire them into hooks update,
   validate, and status.

## Open Questions

- Whether missing-target backup state should be represented as a manifest-only
  backup directory or a structured skipped result. Task 1.1 must choose and test
  one behavior before later tasks rely on it.
