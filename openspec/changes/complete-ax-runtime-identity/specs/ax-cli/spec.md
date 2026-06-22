## MODIFIED Requirements

### Requirement: Globally linked runtime command
The system SHALL provide an `ax` command that is installed through an
AX-managed shim at `~/.local/bin/ax` and can be invoked from arbitrary target
projects.

#### Scenario: Managed shim resolves durable source root
- **WHEN** the managed `~/.local/bin/ax` command is invoked outside the AI repo
- **THEN** the runtime source root resolves to the durable AI repo checkout
- **AND** the command uses the AI repo implementation
- **AND** the executable path is reported from `AX_EXECUTABLE_PATH`

#### Scenario: Central config is default
- **WHEN** the global command is invoked without `--config`
- **THEN** the runtime config path resolves to the AI repo `ax.config.json`
- **AND** the command does not auto-discover a target repo `ax.config.json`
- **AND** the default lock file and `.ax/cache` resolve under the AX source root

#### Scenario: Repo-local scopes target cwd
- **WHEN** the global command runs a repo-local scope such as `openspec`
- **THEN** the target root resolves to the invocation current working directory

#### Scenario: Explicit config override remains available
- **WHEN** the global command is invoked with `--config <path>`
- **THEN** the runtime uses the explicit config path instead of the central default
- **AND** the default lock file and `.ax/cache` remain rooted under the AX source root

#### Scenario: Shim-safe execution is tested
- **WHEN** the command is installed through `pnpm ax shim install`
- **THEN** the command runs from outside the AI repo without relying on a target repo package script

## ADDED Requirements

### Requirement: Managed AX shim lifecycle
The system SHALL manage `~/.local/bin/ax` through `pnpm ax shim install`,
`pnpm ax shim status`, and `pnpm ax shim uninstall`.

#### Scenario: Install creates managed shim
- **WHEN** `pnpm ax shim install` runs and no conflicting `~/.local/bin/ax` exists
- **THEN** it writes an executable AX-managed shim with an ownership marker
- **AND** the shim executes the durable AI repo `bin/ax.mjs`

#### Scenario: Install refuses unmanaged file
- **WHEN** `pnpm ax shim install` finds a non-AX-managed `~/.local/bin/ax`
- **THEN** it refuses to overwrite the file
- **AND** it reports remediation guidance

#### Scenario: Status reports PATH and ownership
- **WHEN** `pnpm ax shim status` runs
- **THEN** it reports shim existence, ownership marker, executable bit, source root, executable path, PATH readiness, all matching `ax` entries, and shadowing findings

#### Scenario: Uninstall removes only managed shim
- **WHEN** `pnpm ax shim uninstall` runs
- **THEN** it removes an AX-managed `~/.local/bin/ax`
- **AND** refuses to remove an unmanaged file
