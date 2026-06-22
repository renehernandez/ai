## Context

The repo has already renamed the command-facing package script and bin to `ax`,
but runtime defaults still use `agent-runtime.config.json`,
`agent-runtime.lock.json`, `.agent-runtime/cache`, and
`AGENT_RUNTIME_EXECUTABLE_PATH`. Existing docs and specs also describe a
globally linked package command, while the intended global entrypoint is now a
CLI-managed shim at `~/.local/bin/ax`.

The durable AI repo must remain the source root, and commands invoked from other
projects must keep the invocation directory as the target root for repo-local
scopes such as `openspec`.

## Goals / Non-Goals

**Goals:**

- Make AX the live runtime identity across defaults, docs, tests, and active
  specs.
- Add managed shim lifecycle commands for `~/.local/bin/ax`.
- Make `ax status` report source/config/target/executable/shim health with
  explicit exit semantics.
- Keep `--config` explicit while preserving source-root lock/cache defaults.
- Route this repo's future implementation work through GitLab MR plus Nitro
  review by default.

**Non-Goals:**

- Automatic shell startup edits.
- Registry publishing or package release automation.
- Broad refactoring of `scripts/ax.ts`.
- Rewriting archived OpenSpec records or historical task prose.

## Decisions

### Managed Shim Instead Of Package Link

AX will own `~/.local/bin/ax` through `pnpm ax shim install|status|uninstall`.
The shim will carry a managed marker and exec this repo's stable `bin/ax.mjs`
entrypoint. This avoids relying on `pnpm link`, makes ownership inspectable, and
lets `ax status` diagnose PATH/shadowing issues.

Alternatives considered:

- Keep `pnpm link` as the supported path. Rejected because it is not
  self-documenting, is harder for AX to inspect, and was already causing
  ambiguity between package link health and runtime root health.
- Edit shell startup files automatically. Rejected because shell startup files
  are user-owned and machine-specific; status should print remediation instead.

### Source-Root Runtime State

Without `--config`, `ax.config.json`, `ax.lock.json`, and `.ax/cache` live under
the AX source root. With `--config <path>`, only the config path changes; the
default lock and cache roots remain under the source root. This keeps global AX
usage from writing runtime cache or lock state into arbitrary target repos.

### No Default Legacy Fallback

The old config, lock, cache, and env-var names are not default fallbacks.
`--config agent-runtime.config.json` still works because explicit config paths
can name any file. Old names may remain only in archived history or
legacy-input tests.

### Status Exit Semantics

`ax status` remains read-only, but it must distinguish target readiness from
runtime failure. Missing target OpenSpec setup exits `0`; broken source/config,
managed assets, reusable scripts, hooks, or managed shim state exits non-zero.
Warnings such as missing `~/.local/bin` on PATH exit `0` unless they prevent the
managed shim from being the active `ax`.

### GitLab MR Plus Nitro Delivery

This repo's delivery guidance will change from direct-main publication to
GitLab MR against `main` with Nitro review by default. This is included because
AX runtime changes should be reviewed through the same workflow they establish.

## Risks / Trade-offs

- Renaming config and lock defaults can break implicit old-name assumptions.
  Mitigation: use `git mv`, explicit tests, and a legacy-reference audit.
- Shim installation touches user-controlled PATH surfaces.
  Mitigation: refuse unmanaged files, avoid shell edits, and make status
  diagnostic rather than mutating.
- Delivery-governance changes affect future agents.
  Mitigation: update both repo-local and shared git/review rules and refresh
  installed instruction surfaces.

## Migration Plan

1. Rename tracked config and lock files with `git mv`.
2. Update runtime constants, wrapper env var propagation, backup names, and cache
   root resolution.
3. Add shim commands and status diagnostics.
4. Update tests before broad docs/spec cleanup.
5. Update active docs, skills, rules, specs, and instruction surfaces.
6. Refresh affected installed runtime profiles and review lock changes.
7. Deliver through a GitLab MR and request Nitro review.

Rollback is standard Git revert plus removing the managed `~/.local/bin/ax` shim
with `pnpm ax shim uninstall` if implementation reached shim installation.
