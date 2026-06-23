## ADDED Requirements

### Requirement: Required-Gate Workflow Commit Mode
The system SHALL provide an explicit `ax commit` mode for workflow phases that
requires an active fresh local review gate.

#### Scenario: Required-gate commit blocks missing gate
- **WHEN** a workflow phase invokes required-gate `ax commit`
- **AND** no active local review gate exists
- **THEN** the commit is rejected
- **AND** the diagnostic explains how to inspect or rerun the local review gate

#### Scenario: Ordinary wrapper commit keeps no-gate path
- **WHEN** `ax commit` runs without required-gate mode
- **AND** no active local review gate exists
- **THEN** it proceeds through the ordinary wrapper commit path
- **AND** it does not infer workflow requirements from branch names, file paths,
  marker files, or commit messages

#### Scenario: Required-gate commit validates staged diff
- **WHEN** a workflow phase invokes required-gate `ax commit`
- **AND** an active local review gate exists
- **THEN** the gate is validated against the current staged diff
- **AND** stale reviewer passes, missing reviewer passes, malformed state,
  inactive state, and unresolved blocking findings reject the commit

### Requirement: Review Gate Consumption
The system SHALL consume or clear active review-gate state after a successful
gated `ax commit`.

#### Scenario: Successful gated commit consumes active gate
- **WHEN** `ax commit` validates an active review gate
- **AND** Git creates a commit
- **THEN** the active gate is marked consumed with the created commit SHA or
  cleared
- **AND** consumed gates do not satisfy later required-gate commits

#### Scenario: Failed Git commit preserves active gate
- **WHEN** `ax commit` validates an active review gate
- **AND** Git fails before creating a commit
- **THEN** the active gate remains available for the same staged diff

#### Scenario: Cleanup failure after commit warns only
- **WHEN** Git creates a commit after active gate validation
- **AND** consumed-state cleanup fails afterward
- **THEN** `ax commit` prints a warning
- **AND** it does not fail the already-created commit retroactively

### Requirement: Review Gate Activation Remains Private
The system SHALL keep public `ax review-gate` commands limited to diagnostics
and validation.

#### Scenario: Public activation command is unavailable
- **WHEN** a user inspects `ax review-gate` commands or help
- **THEN** no public activation command is exposed
- **AND** status and validate-commit diagnostics remain available
