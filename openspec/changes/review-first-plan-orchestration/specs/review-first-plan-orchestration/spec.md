## ADDED Requirements

### Requirement: Top-level plan orchestration
The system SHALL provide `plan-orchestrator` as the end-to-end plan workflow
entrypoint from fuzzy idea, feature request, ticket, plan, or OpenSpec request
to delivery completion when no blockers appear.

#### Scenario: Fuzzy request is routed through readiness
- **WHEN** a user invokes `plan-orchestrator` with a fuzzy implementation request
- **THEN** the workflow runs the configured brainstorming entrypoint when needed
- **AND** writes or updates planning artifacts under `.agents/plans/`
- **AND** runs `plan-ready` before hosted review or implementation

#### Scenario: Atomic request routes to planning review
- **WHEN** `plan-ready` emits `plan_delivery_handoff`
- **THEN** `plan-orchestrator` creates a `plan_review_request` for the plan
  artifact
- **AND** invokes `plan-review` before any implementation unit starts

#### Scenario: Complex request routes through OpenSpec proposal
- **WHEN** `plan-ready` emits `openspec_blueprint`
- **THEN** `plan-orchestrator` invokes the configured OpenSpec propose entrypoint
- **AND** runs strict OpenSpec validation before invoking `plan-review`

### Requirement: Mandatory planning review before implementation
The system SHALL require a planning-only PR or MR before implementation starts
for atomic plans and OpenSpec changes.

#### Scenario: Ship-then-continue waits for merge
- **WHEN** the selected mode is `ship_then_continue`
- **THEN** implementation sequencing does not start until the planning PR or MR
  is merged into the target branch

#### Scenario: Stack-when-ready waits for reviewed stack base
- **WHEN** the selected mode is `stack_when_ready`
- **THEN** implementation sequencing does not start until planning feedback is
  addressed, developer review is approved or waived by policy, the planning PR
  or MR is ready for merge, and the reviewed head is usable as the stack base

#### Scenario: Pending developer review blocks implementation
- **WHEN** developer review is still pending on the planning PR or MR
- **THEN** the workflow reports `planning_review_blocked`
- **AND** implementation sequencing does not start

### Requirement: Reviewed planning handoff
The system SHALL make `plan-review` emit a validated `planning_review` handoff
as the only handoff from planning review into implementation sequencing.

#### Scenario: Planning review handoff includes continuation evidence
- **WHEN** `plan-review` completes with implementation allowed
- **THEN** it emits `planning_review`
- **AND** the handoff includes artifact type, artifact ref, review PR or MR,
  mode, gate outcome, target branch, target base SHA, planning branch, reviewed
  head, stack-base evidence, task-state fingerprint, validation evidence,
  review evidence, and blockers

#### Scenario: Gate ledger does not replace planning review
- **WHEN** `plan-review` records detailed gate evidence
- **THEN** it embeds or references that evidence under `planning_review`
- **AND** it does not require downstream skills to derive implementation
  readiness from a separate `plan_review_gate_ledger`

### Requirement: Implementation unit sequencing
The system SHALL provide `plan-unit-sequencer` as the implementation sequencing
skill after reviewed planning evidence exists.

#### Scenario: Unreviewed sequencing is rejected
- **WHEN** `plan-unit-sequencer` is invoked without a valid `planning_review`
  handoff
- **THEN** it reports `needs_reviewed_planning`
- **AND** it does not call `plan-unit-delivery`

#### Scenario: Atomic plan creates one implementation unit
- **WHEN** `planning_review.artifact_type` is `plan`
- **THEN** `plan-unit-sequencer` creates exactly one implementation unit for
  `plan-unit-delivery`

#### Scenario: OpenSpec change selects one task
- **WHEN** `planning_review.artifact_type` is `openspec`
- **THEN** `plan-unit-sequencer` selects one unchecked deliverable task at a time
- **AND** each selected task maps to one `plan-unit-delivery` run and one
  implementation artifact

### Requirement: Plan readiness remains pre-delivery
The system SHALL keep `plan-ready` as a readiness gate that stops before
OpenSpec file creation, hosted planning review, and implementation.

#### Scenario: Atomicity ignores mandatory planning review artifact
- **WHEN** `plan-ready` evaluates whether a plan is atomic
- **THEN** it considers whether the implementation requires multiple PRs or MRs
- **AND** it does not treat the mandatory planning-review PR or MR as evidence
  that the implementation is non-atomic

#### Scenario: Complex work emits blueprint only
- **WHEN** work is multi-deliverable
- **THEN** `plan-ready` emits `openspec_blueprint`
- **AND** it does not create OpenSpec files or invoke hosted review

### Requirement: Implementation artifacts stay separate from planning artifacts
The system SHALL require implementation artifacts to be separate from planning
review artifacts.

#### Scenario: Implementation PR differs from planning PR
- **WHEN** `plan-unit-delivery` opens or updates the implementation PR or MR
- **THEN** it proves the implementation artifact is separate from the planning
  review PR or MR

#### Scenario: OpenSpec task checkbox is updated with implementation
- **WHEN** an implementation unit delivers an OpenSpec task
- **THEN** the selected task checkbox is marked complete in the same
  implementation PR or MR as the code change

### Requirement: Shared planning contract validation
The system SHALL share planning-contract parsing and validation helpers across
plan workflow scripts.

#### Scenario: Existing handoffs validate through shared helpers
- **WHEN** plan skill scripts validate `plan_delivery_handoff`,
  `plan_review_request`, or `planning_review`
- **THEN** they use shared helper logic for fenced YAML extraction, scalar,
  list, and map parsing, and legacy input rejection

#### Scenario: Legacy inputs are rejected consistently
- **WHEN** a legacy plan slice, followthrough ledger, old plan-ready handoff, or
  old direct-sequencing input is provided
- **THEN** the relevant plan workflow script rejects it with a consistent
  failure route

### Requirement: Runtime cleanup after skill renames
The system SHALL remove stale installed old-name skill surfaces when runtime
skill updates apply renamed plan skills.

#### Scenario: Old plan-review name is pruned
- **WHEN** runtime update installs `plan-review`
- **THEN** stale installed `plan-to-review` skill directories or symlinks are
  removed from managed runtime skill targets

#### Scenario: Old sequencer name surfaces are pruned
- **WHEN** runtime update installs `plan-unit-sequencer` and the new
  `plan-orchestrator`
- **THEN** stale old-name managed surfaces that would invoke retired semantics
  are absent from `.agents`, `.codex`, and `.claude` runtime skill directories

#### Scenario: Lockfile reflects renamed skills
- **WHEN** runtime update completes after the rename
- **THEN** `agent-runtime.lock.json` contains `plan-review` and
  `plan-unit-sequencer`
- **AND** it does not contain `plan-to-review`

### Requirement: Machine-readable outputs remain readable
The system SHALL include a concise `## Readable Summary` before any YAML or JSON
contract emitted by the plan workflow.

#### Scenario: Planning review output is summary-first
- **WHEN** `plan-review` emits `planning_review`
- **THEN** the thread output includes `## Readable Summary` before the YAML
  block

#### Scenario: Sequencer output is summary-first
- **WHEN** `plan-unit-sequencer` emits a handoff, blocked state, stack-ready
  state, or completion state
- **THEN** the thread output includes `## Readable Summary` before the
  machine-readable block
