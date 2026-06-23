## ADDED Requirements

### Requirement: Explicit Readiness Reviewer Evidence
The system SHALL make `plan-ready` emit explicit reviewer evidence for both
atomic handoffs and OpenSpec blueprints.

#### Scenario: Readiness output records reviewer evidence
- **WHEN** `plan-ready` emits a ready atomic handoff or OpenSpec blueprint
- **THEN** the output records the static `plan-ready` baseline reviewers:
  `implementation-readiness`, `edge-cases-and-risks`,
  `simplification-and-scope-control`, and `refactoring-opportunities`
- **AND** records selected dynamic reviewers
- **AND** records each reviewer status, summary, artifact fingerprint, skipped
  rationale when applicable, blocking findings, completion timestamp, and final
  gate outcome

#### Scenario: Dynamic readiness reviewers are catalog-only
- **WHEN** `plan-ready` validates selected dynamic reviewers
- **THEN** every dynamic reviewer is selected from the optional reviewer catalog
- **AND** unknown reviewer names are rejected

#### Scenario: Selected readiness reviewers become downstream gate passes
- **WHEN** an optional readiness reviewer is selected for a run
- **THEN** the reviewer is explicit in the ready output
- **AND** the reviewer becomes a required downstream gate pass unless it is
  explicitly recorded as `not_applicable` with rationale

### Requirement: Planning Commit Readiness Gate
The system SHALL make `plan-review` bind valid readiness reviewer evidence to
the staged planning diff before committing planning artifacts.

#### Scenario: Plan review binds readiness evidence to staged diff
- **WHEN** `plan-review` prepares a planning commit from `plan_review_request`
- **THEN** it validates the readiness reviewer evidence carried by the request
- **AND** it validates the reviewed artifact fingerprint
- **AND** it binds that evidence to the current staged planning diff hash before
  arming the local review gate

#### Scenario: OpenSpec planning proves blueprint provenance before commit
- **WHEN** `plan-orchestrator` materializes an OpenSpec change from an
  `openspec_blueprint`
- **THEN** it carries readiness reviewer evidence and blueprint provenance
  evidence into `plan_review_request`
- **AND** `plan-review` validates source plan, change id, reviewed artifact
  fingerprint, generated paths, and strict OpenSpec validation evidence before
  arming the local review gate
- **AND** if blueprint-to-OpenSpec provenance cannot be proven, readiness
  reviewers rerun against the materialized OpenSpec diff before commit

#### Scenario: Planning commit requires active local gate
- **WHEN** `plan-review` commits material planning workflow changes
- **THEN** it invokes the required-gate `ax commit` path
- **AND** a missing, stale, malformed, inactive, or blocking gate prevents the
  planning commit

#### Scenario: Plan ready remains classifier only
- **WHEN** `plan-ready` emits readiness reviewer evidence
- **THEN** normal readiness workflows do not write active readiness review-gate
  state, commit, or publish the planning branch
- **AND** `plan-review` remains the planning commit owner

#### Scenario: Legacy plan-ready gate activation is retired
- **WHEN** an existing caller attempts to use `plan-ready` as the
  readiness-to-planning-commit gate writer
- **THEN** the workflow rejects that path with a diagnostic that routes the
  caller to `plan-review`
- **AND** the retired path does not silently write active readiness review-gate
  state, no-op, or commit planning artifacts

### Requirement: Implementation Commit Reviewer Gate
The system SHALL make `plan-unit-delivery` require fresh explicit reviewer
evidence for each material implementation commit.

Every head-changing commit owned by `plan-unit-delivery` for a selected unit is
material for this workflow. This includes implementation edits, tests, OpenSpec
task checkbox updates, review-feedback fixes, pipeline fixes, conflict fixes,
and restack fixes. `ax commit` SHALL NOT decide materiality by inspecting paths,
branch names, or commit messages.

#### Scenario: Implementation evidence binds to staged diff
- **WHEN** `plan-unit-delivery` prepares a material implementation commit
- **THEN** it validates required reviewer outcomes for the current staged diff
- **AND** selected non-skipped dynamic reviewers are required gate passes for
  that commit

#### Scenario: Implementation commit uses required-gate path
- **WHEN** `plan-unit-delivery` creates a head-changing commit for the selected
  implementation unit
- **THEN** it invokes the required-gate `ax commit` path
- **AND** ordinary no-gate `ax commit` is not used for that workflow-owned commit

#### Scenario: Skipped implementation reviewer remains evidence only
- **WHEN** an implementation reviewer is recorded as `not_applicable`
- **THEN** the reviewer entry includes explicit rationale
- **AND** it is preserved as evidence
- **AND** it is not counted as a required gate pass

#### Scenario: Each material implementation commit requires fresh evidence
- **WHEN** one implementation unit needs more than one commit through the
  required-gate workflow commit path
- **THEN** each material commit requires fresh reviewer evidence for its staged
  diff
- **AND** a consumed or stale gate from a previous commit does not satisfy the
  next material commit

### Requirement: Orchestrator Evidence Routing
The system SHALL keep `plan-orchestrator` responsible for phase evidence
validation and routing without writing local review-gate state.

#### Scenario: Orchestrator routes stale readiness evidence
- **WHEN** `plan-orchestrator` finds missing or stale readiness evidence
- **THEN** it routes the workflow back to `plan-ready`
- **AND** it does not write review-gate state

#### Scenario: Orchestrator routes stale delivery evidence
- **WHEN** `plan-orchestrator` finds missing or stale delivery evidence
- **THEN** it routes the workflow back to `plan-unit-delivery`
- **AND** it does not write review-gate state

#### Scenario: Orchestrator routes missing planning commit evidence
- **WHEN** `plan-orchestrator` finds missing or stale planning commit evidence
- **THEN** it routes the workflow back to `plan-review`
- **AND** it does not write review-gate state

#### Scenario: Orchestrator does not invent reviewers
- **WHEN** `plan-orchestrator` validates phase evidence
- **THEN** it does not invent reviewer lists
- **AND** it does not recompute dynamic reviewer policy

### Requirement: Local Gate And Hosted Gate Separation
The system SHALL keep local reviewer gates separate from hosted planning and
Nitro review gates.

#### Scenario: Local reviewer gate does not satisfy hosted planning review
- **WHEN** a local reviewer gate passes for a planning commit
- **THEN** the workflow still requires a valid `planning_review` handoff before
  implementation sequencing
- **AND** local reviewer evidence does not satisfy MR approval or CI inspection

#### Scenario: Local reviewer gate does not satisfy Nitro gate
- **WHEN** a local reviewer gate passes for an implementation commit
- **THEN** the workflow still requires latest-head hosted Nitro feedback before
  stack advancement or delivery completion

#### Scenario: Local reviewer gate does not replace unsupported host routing
- **WHEN** the artifact host is unsupported for required Nitro review
- **THEN** the workflow reports unsupported routing
- **AND** it does not substitute local reviewer evidence for hosted review
