## ADDED Requirements

### Requirement: Ax Owns Runtime Manager Guidance
The system SHALL keep AX command, runtime profile, installed path, managed
symlink, private plan-artifact command, and runtime refresh guidance inside the
`ax-cli` skill and AI repo runtime surfaces.

#### Scenario: Agent needs AX command guidance
- **WHEN** an agent needs to install, update, validate, inspect, or refresh
  managed runtime assets
- **THEN** the agent uses `ax-cli` guidance
- **AND** non-`ax-cli` skills do not duplicate the AX command syntax

#### Scenario: Private plan-artifact command is needed
- **WHEN** an agent needs file-backed private workflow artifact recovery
- **THEN** the concrete AX record or list command is documented by `ax-cli`
- **AND** non-`ax-cli` workflow skills describe the storage boundary without
  teaching the AX command

### Requirement: Reusable Scripts Are Not A Skill Portability Mechanism
The system SHALL NOT use `runtime.reusableScripts` as the mechanism that makes
shared skills portable.

#### Scenario: Shared skill needs helper logic
- **WHEN** a shared skill needs helper logic to run a documented command
- **THEN** that helper logic is packaged in the skill folder or supplied as a
  package dependency
- **AND** the skill does not rely on `runtime.reusableScripts` to find repo
  source files
