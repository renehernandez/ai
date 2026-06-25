## ADDED Requirements

### Requirement: Required-Gate Workflow Commit Mode
The system SHALL provide an explicit `ax commit` mode for workflow phases that
requires an active fresh local review gate.

#### Scenario: Required-gate mode adds strict workflow path
- **WHEN** the required-gate commit mode is implemented
- **THEN** existing ordinary `ax commit` calls keep their no-gate allow behavior
  when no active local review gate exists
- **AND** workflow phases that require local reviewer evidence use the explicit
  required-gate path instead of relying on ordinary commit behavior

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

#### Scenario: Ordinary wrapper commit rejects active workflow gate
- **WHEN** `ax commit` runs without required-gate mode
- **AND** an active workflow-required local review gate exists
- **THEN** the commit is rejected
- **AND** the diagnostic identifies the owning workflow and the required-gate
  command to use

#### Scenario: Required-gate commit validates staged diff
- **WHEN** a workflow phase invokes required-gate `ax commit`
- **AND** an active local review gate exists
- **THEN** the gate is validated against the current staged diff
- **AND** staged diff hash mismatch, stale reviewer passes, missing reviewer
  passes, malformed state, inactive state, and unresolved blocking findings
  reject the commit

### Requirement: Review Gate Consumption
The system SHALL reuse existing active review-gate consumption semantics after a
successful required-gate `ax commit` and SHALL verify that the created commit
matches the reviewed staged diff before consuming the gate.

#### Scenario: Successful gated commit consumes active gate
- **WHEN** `ax commit` validates an active review gate
- **AND** Git creates a commit
- **AND** the created commit diff matches the reviewed staged diff hash
- **THEN** the active gate is marked consumed with the created commit SHA or
  cleared
- **AND** consumed gates do not satisfy later required-gate commits

#### Scenario: Commit-time diff mutation blocks gate consumption
- **WHEN** `ax commit` validates an active review gate
- **AND** Git creates a commit whose diff does not match the reviewed staged diff
  hash
- **THEN** the active gate is not consumed as a passing gate
- **AND** the command reports the created commit SHA and the diff mismatch
- **AND** the command preserves or marks the gate blocked with recovery details
- **AND** the recovery diagnostic requires human-controlled repair before
  reviewers rerun
- **AND** the workflow treats the commit as not locally reviewed

#### Scenario: Failed Git commit preserves active gate
- **WHEN** `ax commit` validates an active review gate
- **AND** Git fails before creating a commit
- **THEN** the active gate remains available for the same staged diff

#### Scenario: Cleanup failure after commit warns only
- **WHEN** Git creates a commit after active gate validation
- **AND** consumed-state cleanup fails afterward
- **THEN** `ax commit` prints a warning
- **AND** it does not fail the already-created commit retroactively

#### Scenario: Concurrent required-gate commits cannot share one gate
- **WHEN** two required-gate commit processes attempt to validate and consume the
  same active gate
- **THEN** the consume operation is serialized or compare-and-consume checked
- **AND** at most one commit can consume the gate as passing
- **AND** the losing process fails with a stale or consumed gate diagnostic

#### Scenario: Linked worktree gate identity is enforced
- **WHEN** a gate is armed in one linked worktree
- **AND** a required-gate commit is attempted from another worktree that shares
  the same Git common directory
- **THEN** validation rejects the gate
- **AND** the diagnostic identifies the worktree identity mismatch

#### Scenario: Gate identity drift is rejected
- **WHEN** a required-gate commit validates active gate state
- **AND** the branch ref, pre-commit `HEAD`, owning workflow, unit id, or staged
  diff hash no longer matches the current worktree context
- **THEN** validation rejects the gate
- **AND** the diagnostic identifies the mismatched identity field

### Requirement: Review Gate Activation Remains Private
The system SHALL keep public `ax review-gate` commands limited to diagnostics
and validation.

#### Scenario: Public activation command is unavailable
- **WHEN** a user inspects `ax review-gate` commands or help
- **THEN** no public activation command is exposed
- **AND** status and validate-commit diagnostics remain available
