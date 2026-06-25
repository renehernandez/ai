## ADDED Requirements

### Requirement: Phase-Based OpenSpec Delivery
The system SHALL use phases as the default implementation MR unit for
OpenSpec delivery in review-first plan orchestration.

#### Scenario: Planning review reports phase shape
- **WHEN** a reviewed OpenSpec change is prepared for planning review
- **THEN** the planning review evidence includes expected phase count and
  sub-task count
- **AND** it reports whether any phase exceeds the split-smell threshold

#### Scenario: Phase MR completes one phase
- **WHEN** an implementation MR is created for an OpenSpec delivery phase
- **THEN** the MR is associated with exactly one selected phase
- **AND** it may complete multiple nested sub-tasks only inside that selected
  phase

#### Scenario: Multiple phases in one MR are rejected
- **WHEN** an implementation MR changes task state for more than one phase
- **THEN** phase-delta validation rejects the MR
- **AND** the workflow reports the selected phase and the unrelated changed
  phase evidence

### Requirement: Phase Shape Validation
The system SHALL validate phase size and phase coherence before implementation
sequencing starts.

#### Scenario: Normal phase size passes
- **WHEN** a phase contains between 2 and 6 sub-tasks
- **AND** the phase represents one reviewable outcome with one verification
  story
- **THEN** readiness and planning review treat the phase shape as valid

#### Scenario: Oversized phase blocks readiness
- **WHEN** a phase contains more than 8 sub-tasks
- **THEN** readiness blocks with `needs_spec_redesign`
- **AND** implementation sequencing does not start

#### Scenario: Split smell is reported
- **WHEN** a phase contains more than 6 sub-tasks and at most 8 sub-tasks
- **THEN** readiness reports a split smell
- **AND** the phase must include justification before planning review can pass

#### Scenario: Phase justification is parsed consistently
- **WHEN** a phase-size or tiny-phase rule requires justification
- **THEN** the shared phase parser reads a `Justification:` paragraph attached to
  that phase before the first nested sub-task
- **AND** downstream planning and delivery scripts use that parsed phase
  justification evidence
- **AND** justification attached to another phase or nested sub-task does not
  satisfy the phase

#### Scenario: Tiny phase merge smell is reported
- **WHEN** a phase contains one sub-task
- **AND** the sub-task is not independently risky, independently deployable, or
  independently reviewable
- **THEN** readiness blocks with `needs_spec_redesign`

### Requirement: Shared Phase Task Model
The system SHALL use `openspec-tasks` as the shared source of truth for
phase/sub-task parsing, task-shape classification, and legacy-flat
compatibility.

#### Scenario: Planning scripts consume shared phase parser
- **WHEN** `plan-ready`, `plan-review`, `plan-unit-sequencer`,
  `plan-unit-delivery`, or stack validation needs OpenSpec task state
- **THEN** it consumes the shared phase/sub-task model from `openspec-tasks`
- **AND** it does not reimplement heading grouping, phase sizing, merge-smell
  detection, or legacy-flat normalization

#### Scenario: Legacy flat task is independently reviewable
- **WHEN** a legacy flat OpenSpec task file contains a task that represents one
  independently reviewable outcome
- **THEN** the shared phase model may normalize that task as a single-sub-task
  phase
- **AND** compatibility evidence records the normalization

#### Scenario: Legacy flat task hides multiple outcomes
- **WHEN** a legacy flat OpenSpec task hides multiple reviewable outcomes
- **THEN** the shared phase model rejects it with `needs_spec_redesign`
- **AND** downstream planning and delivery skills do not select it for
  implementation

### Requirement: Phase-Aware Review Artifact Evidence
The system SHALL expose phase/sub-task delivery evidence in planning and
implementation review artifacts.

#### Scenario: Planning MR describes expected implementation shape
- **WHEN** `plan-review` creates or updates a planning MR for an OpenSpec change
- **THEN** the MR description includes expected phase count, sub-task count,
  split-smell status, and phase justification when present

#### Scenario: Implementation MR describes selected phase
- **WHEN** `plan-unit-delivery` creates or updates an implementation MR
- **THEN** the MR description includes selected phase ID, completed sub-task
  IDs, phase-delta evidence, verification evidence, CI evidence, and Nitro
  evidence

#### Scenario: Change request body helpers preserve phase evidence
- **WHEN** a change-request helper creates or updates a hosted review artifact
- **THEN** it preserves phase/sub-task delivery evidence in reviewer-facing
  sections

### Requirement: Runtime Prompt Contract Alignment
The system SHALL keep runtime-facing skill prompts, templates, ledgers, and
installed-surface validation aligned with phase-based delivery.

#### Scenario: Stale per-task MR wording fails contract checks
- **WHEN** active skill prompts, script templates, ledger schema text, or
  installed-surface validation output still instruct one MR per OpenSpec task
- **THEN** the focused contract check fails
- **AND** it reports the stale surface

#### Scenario: Legacy wording is allowed only in legacy context
- **WHEN** documentation or prompt text mentions one-task delivery as legacy
  behavior
- **THEN** the contract check permits it only when the surrounding text clearly
  marks the behavior as legacy or rejected

## MODIFIED Requirements

### Requirement: Stack-Ready Completion
The system SHALL consider orchestration complete only when the full MR stack is
ready for merge.

#### Scenario: Atomic plan stack is ready
- **WHEN** a single plan has one planning MR and one implementation MR
- **AND** both MRs have passed latest-head Nitro gates
- **AND** the implementation MR is stacked on the planning MR
- **THEN** the workflow reports `stack_ready`

#### Scenario: OpenSpec stack is ready
- **WHEN** an OpenSpec change has one planning MR and one implementation MR per
  delivery phase
- **AND** every MR in stack order has passed latest-head Nitro gates
- **AND** the stack tip `tasks.md` has all phases checked
- **AND** every checked sub-task belongs to a checked phase with artifact
  evidence
- **THEN** the workflow reports `stack_ready`

#### Scenario: Earlier MR changes after descendants exist
- **WHEN** an earlier MR changes after descendant MRs exist
- **THEN** affected descendants must be restacked
- **AND** every changed MR must rerun the full Nitro feedback gate before
  `stack_ready`

#### Scenario: Merge follow-through remains separate
- **WHEN** the workflow reports `stack_ready`
- **THEN** it does not merge the stack
- **AND** merge follow-through is handled by a separate workflow
