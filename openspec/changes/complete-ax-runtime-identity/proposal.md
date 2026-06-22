## Why

The CLI has been renamed to `ax`, but live runtime defaults, global command
installation guidance, config/lock/cache names, and repo delivery rules still
carry `agent-runtime` or direct-main assumptions. This creates a split identity:
agents can call `pnpm ax`, while the durable runtime still teaches and verifies
old names.

This change completes the AX identity by making `ax` the live runtime surface,
adding a managed global shim at `~/.local/bin/ax`, and routing this repo's
implementation delivery through GitLab MR plus Nitro review.

## What Changes

- **BREAKING**: Rename live default runtime files and directories:
  `agent-runtime.config.json` to `ax.config.json`,
  `agent-runtime.lock.json` to `ax.lock.json`, and `.agent-runtime/cache` to
  `.ax/cache`.
- **BREAKING**: Replace `AGENT_RUNTIME_EXECUTABLE_PATH` with
  `AX_EXECUTABLE_PATH`; the new env var wins if both are present.
- Add `pnpm ax shim install|status|uninstall` to manage `~/.local/bin/ax`
  without requiring `pnpm link`.
- Extend `ax status` to report shim ownership, executable path health, PATH
  shadowing, source/config/target roots, and status exit semantics.
- Update live docs, skills, rules, active specs, and tests to describe the
  managed shim and AX defaults.
- Preserve old names only for archived or already-applied history, explicit
  legacy-input tests, and retired `agent-runtime-cli` cleanup.
- Update this repo's delivery guidance so implementation goes through GitLab MR
  plus Nitro review by default.

## Capabilities

### New Capabilities

- `repo-delivery-guidance`: repo-local delivery guidance for GitLab MR plus
  Nitro review as this repo's default implementation path.

### Modified Capabilities

- `ax-cli`: AX command defaults, managed shim lifecycle, config/lock/cache/env
  naming, and explicit config/rooting behavior.
- `ax-status`: executable, shim, PATH, runtime health, and exit-code reporting.
- `ax-openspec`: OpenSpec validation and generated asset checks use AX config
  naming and source-root defaults.

## Impact

- `scripts/ax.ts`, `bin/ax.mjs`, `package.json`, root runtime config/lock files,
  ignore/tooling config, and runtime backup/lock handling.
- Unit and integration tests for CLI routing, status, shim lifecycle, config
  resolution, lock/cache paths, executable env vars, and legacy-reference
  handling.
- Runtime-facing docs and agent surfaces: `docs/ax.md`, `skills/ax-cli`, root
  and portable `AGENTS.md`, rules, hooks docs, active OpenSpec specs, and
  current OpenSpec changes that define normative behavior.
- Installed runtime refresh for changed skill, instruction, hook, and OpenSpec
  surfaces.
