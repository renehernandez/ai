## ADDED Requirements

### Requirement: Managed hooks runtime scope
Agent-runtime SHALL expose a `hooks` scope with `install`, `update`,
`validate`, and `status` commands.

#### Scenario: Hooks commands are routed
- **WHEN** a user runs `agent-runtime hooks install`, `update`, `validate`, or
  `status`
- **THEN** the CLI routes the command to hook-specific runtime handling

#### Scenario: Wrapper commands include hooks
- **WHEN** a user runs top-level runtime `install`, `update`, `validate`, or
  `status`
- **THEN** the command includes hook handling after backup integration is
  available

### Requirement: Hook symlink management
Agent-runtime SHALL manage a canonical hooks directory and configured Codex and
Claude hook symlink targets.

#### Scenario: Real hook directory migration is backup gated
- **WHEN** a configured hook target already exists as a real directory
- **THEN** runtime backs it up and verifies that backup before replacing it with
  a managed symlink

#### Scenario: Unsafe hook target replacement is refused
- **WHEN** an existing hook target cannot be backed up or safely replaced
- **THEN** runtime refuses the mutation and reports the unsafe target

### Requirement: Hook status and validation reporting
Hook status and validate commands SHALL report hook file state, symlink
resolution, config registration state, hook trust state when applicable, and
selected remote warnings.

#### Scenario: Missing hook registration is reported
- **WHEN** Codex or Claude startup hook registration is missing
- **THEN** hooks validate reports the missing registration with the affected
  runtime target

### Requirement: Codex and Claude registration
Agent-runtime SHALL register startup hooks for Codex and Claude idempotently
while preserving unrelated config fields.

#### Scenario: Repeated update does not duplicate registration
- **WHEN** hooks update runs more than once
- **THEN** Codex and Claude startup hook config contains one registration for
  the managed hook

#### Scenario: Config fixtures preserve unrelated fields
- **WHEN** registration helpers update fixture Codex or Claude config files
- **THEN** unrelated JSON or TOML fields remain intact
