# ax-cli Specification

## Purpose
TBD - created by archiving change guide-openspec-runtime-setup. Update Purpose after archive.
## Requirements
### Requirement: Managed runtime shim
The system SHALL provide an `ax` command through an AX-managed
`~/.local/bin/ax` shim backed by the durable AI repo and invokable from
arbitrary target projects.

#### Scenario: Managed shim resolves durable source root
- **WHEN** the managed `~/.local/bin/ax` command is invoked outside the AI repo
- **THEN** the runtime source root resolves to the durable AI repo checkout
- **AND** the command uses the AI repo implementation
- **AND** the executable path is reported from `AX_EXECUTABLE_PATH`

#### Scenario: Central config is default
- **WHEN** the managed shim is invoked without `--config`
- **THEN** the runtime config path resolves to the AI repo `ax.config.json`
- **AND** the command does not auto-discover a target repo `ax.config.json`
- **AND** the default lock file and `.ax/cache` resolve under the AX source root

#### Scenario: Repo-local scopes target cwd
- **WHEN** the managed shim runs a repo-local scope such as `openspec`
- **THEN** the target root resolves to the invocation current working directory

#### Scenario: Explicit config override remains available
- **WHEN** the managed shim is invoked with `--config <path>`
- **THEN** the runtime uses the explicit config path instead of the central default
- **AND** the default lock file and `.ax/cache` remain rooted under the AX source root

#### Scenario: Shim lifecycle is managed
- **WHEN** the command is installed through `pnpm ax shim install`
- **THEN** it writes only an AX-managed executable shim at `~/.local/bin/ax`
- **AND** `pnpm ax shim status` reports ownership, executable bit, PATH
  readiness, shadowing, stale targets, and detached-worktree targets
- **AND** `pnpm ax shim uninstall` removes only an AX-managed shim
