## ADDED Requirements

### Requirement: Normalized Readiness Reviewer Metadata
The system SHALL make `plan-ready` emit machine-readable reviewer-set metadata
for both atomic handoffs and OpenSpec blueprints.

#### Scenario: OpenSpec blueprint carries reviewer sets
- **WHEN** `plan-ready` emits an `openspec_blueprint`
- **THEN** the blueprint review metadata includes `required_reviewers`
- **AND** it includes `optional_reviewers`
- **AND** it preserves `reviewers_used` and `findings` as review evidence

#### Scenario: Baseline reviewers are always required
- **WHEN** `plan-ready` validates a ready atomic handoff or OpenSpec blueprint
- **THEN** `required_reviewers` includes `implementation-readiness`,
  `edge-cases-and-risks`, `simplification-and-scope-control`, and
  `refactoring-opportunities`

#### Scenario: Optional reviewers are catalog-only
- **WHEN** `plan-ready` validates `optional_reviewers`
- **THEN** every optional reviewer is selected from the bundled reviewer catalog
- **AND** unknown reviewer names are rejected

### Requirement: Plan Ready Review Gate Activation
The system SHALL make `plan-ready` privately arm a local review gate from
validated readiness reviewer evidence before material readiness commits.

#### Scenario: Passing readiness evidence writes active gate
- **WHEN** `plan-ready` has selected reviewers, completed required reviewer
  execution, reconciled passing outcomes, and emitted a validated ready output
- **THEN** it writes an active review gate for the current staged diff through
  the shared review-gate API
- **AND** selected optional reviewers are required gate passes for that run

#### Scenario: Readiness activation failure blocks commit
- **WHEN** required readiness subagents are unavailable, reviewer evidence is
  partial, reviewer evidence is stale, gate writing fails, gate validation
  fails, or blocking findings remain
- **THEN** `plan-ready` emits a blocked readiness outcome
- **AND** it does not write a passing gate
- **AND** it does not invoke `ax commit` for the material readiness commit

### Requirement: Plan Unit Delivery Review Gate Activation
The system SHALL make `plan-unit-delivery` privately arm a local review gate
from validated implementation reviewer evidence before material implementation
commits.

#### Scenario: Passing implementation evidence writes active gate
- **WHEN** `plan-unit-delivery` has a validated handoff, launched required
  reviewers, reconciled passing `reviewer_report` outcomes, and validated the
  staged diff
- **THEN** it writes an active review gate for the current staged diff through
  the shared review-gate API
- **AND** selected or non-skipped dynamic reviewers are required gate passes for
  that material commit

#### Scenario: Missing implementation reviewers block commit
- **WHEN** required implementation-review subagents are unavailable
- **THEN** `plan-unit-delivery` emits a blocked delivery state
- **AND** it does not write a passing gate
- **AND** it does not invoke `ax commit` for the material implementation commit

#### Scenario: Each material implementation commit requires fresh gate
- **WHEN** `plan-unit-delivery` creates more than one material commit for one
  implementation MR
- **THEN** each material commit has a fresh active gate for its staged diff
- **AND** a consumed or stale gate from a prior commit does not satisfy the next
  material commit

### Requirement: Orchestrator Phase Evidence Boundary
The system SHALL keep `plan-orchestrator` responsible for validating phase
evidence freshness without writing review-gate state directly.

#### Scenario: Orchestrator validates readiness phase evidence
- **WHEN** `plan-orchestrator` advances from a readiness phase into OpenSpec
  proposal or planning review
- **THEN** it verifies the expected readiness evidence exists and is fresh
- **AND** missing or stale readiness evidence routes back to `plan-ready`

#### Scenario: Orchestrator validates delivery phase evidence
- **WHEN** `plan-orchestrator` advances after a delivery phase
- **THEN** it verifies the expected delivery evidence exists and is fresh
- **AND** missing or stale delivery evidence routes back to
  `plan-unit-delivery`

#### Scenario: Orchestrator does not invent reviewer policy
- **WHEN** `plan-orchestrator` validates phase evidence
- **THEN** it does not write review-gate state
- **AND** it does not invent or recompute reviewer lists

### Requirement: Runtime Guidance For Phase-Owned Gates
The system SHALL align shared instructions, skill docs, adapter prompts, and
runtime validation with phase-owned review-gate activation.

#### Scenario: Agent instructions require phase-owned activation
- **WHEN** shared agent instructions describe committing material plan workflow
  changes
- **THEN** they state that the owning workflow phase must arm and validate the
  local review gate before `ax commit`
- **AND** they preserve the user's raw `git commit` escape hatch

#### Scenario: Adapter prompts describe installed behavior
- **WHEN** affected plan workflow skills are installed into runtime profiles
- **THEN** their adapter prompts describe the same phase-owned gate activation,
  fail-closed behavior, and orchestrator evidence boundary as the source skills

#### Scenario: Runtime refresh proves installed alignment
- **WHEN** shared skills, adapter prompts, instructions, or reusable runtime
  script imports change for phase-owned gates
- **THEN** runtime update, status, and validation run for all configured
  profiles
- **AND** hook validation runs when hook or commit-path behavior is affected
