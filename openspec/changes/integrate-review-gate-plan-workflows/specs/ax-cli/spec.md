## ADDED Requirements

### Requirement: Phase-Owned Review Gate State
The system SHALL provide shared review-gate state APIs that own active gate
serialization, staged diff hashing, Git metadata path resolution, validation,
atomic writes, and consumed-state behavior for phase-owned workflow gates.

#### Scenario: Shared API writes active gate state
- **WHEN** a workflow phase supplies validated reviewer evidence for the current
  staged diff
- **THEN** the shared review-gate API writes an active gate under the repository
  Git metadata path
- **AND** the active gate records required reviewer passes, reviewer outcomes,
  staged diff hash, workflow phase, unit identity, source provenance, and
  blocking findings

#### Scenario: Phase scripts do not serialize gate state directly
- **WHEN** `plan-ready` or `plan-unit-delivery` needs to arm a workflow gate
- **THEN** it maps its validated phase contract into the shared review-gate API
- **AND** it does not hand-write review-gate JSON or duplicate staged diff hash
  logic

#### Scenario: Linked worktree state uses Git metadata path
- **WHEN** an active or consumed review gate is written from a linked worktree
- **THEN** the gate state is isolated under the linked worktree Git metadata
  path returned by Git
- **AND** it does not write state under an unrelated parent repository or the
  worktree source checkout

### Requirement: Review Gate Commit Consumption
The system SHALL consume or clear an active review gate after a successful
gated `ax commit` without changing ordinary no-gate commit behavior.

#### Scenario: Successful gated commit consumes active gate
- **WHEN** `ax commit` validates an active review gate and Git creates a commit
- **THEN** the gate is marked consumed with the created commit SHA or cleared
- **AND** consumed gates are ignored by later commit validation

#### Scenario: Failed Git commit preserves matching active gate
- **WHEN** `ax commit` validates an active review gate
- **AND** Git fails before creating a commit
- **THEN** the active gate remains available for the same staged diff

#### Scenario: Gate consume failure after commit fails closed
- **WHEN** Git creates a commit after active gate validation
- **AND** consumed-state cleanup fails or compare-and-consume rejects the
  current gate state afterward
- **THEN** `ax commit --require-review-gate` exits nonzero
- **AND** the diagnostic says the commit was created but the review gate was not
  consumed or failed to consume
- **AND** the workflow treats the created head as not locally reviewed
- **AND** the recovery diagnostic requires inspecting the created commit,
  rerunning required local reviewers for the current gate state, and activating
  a fresh gate before retrying the workflow step

### Requirement: Non-Heuristic Commit Wrapper
The system SHALL keep `ax commit` as a mechanical gate validator that does not
infer plan workflow context.

#### Scenario: No active gate allows ordinary wrapper commit
- **WHEN** `ax commit` runs and no active gate exists
- **THEN** it proceeds through the ordinary commit wrapper path
- **AND** it does not infer workflow requirements from branch names, changed
  files, or marker files

#### Scenario: Active gate is validated for staged diff
- **WHEN** `ax commit` runs and an active gate exists
- **THEN** it validates the active gate against the current staged diff
- **AND** it blocks missing reviewer passes, stale reviewer passes, malformed
  state, and unresolved blocking findings

#### Scenario: Public activation remains unavailable
- **WHEN** a user inspects `ax review-gate` commands or help
- **THEN** no public activation command is exposed
- **AND** status and validate-commit diagnostics remain available
