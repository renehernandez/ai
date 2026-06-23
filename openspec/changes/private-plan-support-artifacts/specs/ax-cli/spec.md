## ADDED Requirements

### Requirement: Plan Artifact Commands
The AX CLI SHALL provide repo-local commands for recording and listing private
plan workflow support artifacts.

#### Scenario: Record plan artifact from target repo
- **WHEN** `pnpm ax plans artifact record --plan <plan> --kind <kind> --file <file>`
  is invoked from a target repository
- **THEN** the command records the artifact under the private AX plan workspace
  for that target repository
- **AND** it does not key the record to the durable AX source repository unless
  the source repository is also the invocation target

#### Scenario: List plan artifacts from target repo
- **WHEN** `pnpm ax plans artifact list --plan <plan>` is invoked from a
  target repository
- **THEN** the command lists records for that plan in the target repository's
  private workspace

#### Scenario: Plan artifact command is discoverable
- **WHEN** an agent reads AX CLI guidance or command help
- **THEN** the `plans artifact record` and `plans artifact list` commands are
  documented as private support-artifact commands
- **AND** the guidance says they operate on the invocation target repository

### Requirement: Plan Artifact Runtime Guidance
The system SHALL refresh installed runtime guidance when plan artifact command
behavior changes shared skills or instructions.

#### Scenario: Plan artifact guidance is installed
- **WHEN** plan artifact storage changes shared skill behavior, adapter prompts,
  rules, or AX CLI guidance
- **THEN** runtime skill update, status, and validation run for personal and
  work profiles
- **AND** runtime instruction update, status, and validation run for personal
  and work profiles when installed instruction or rule surfaces changed
