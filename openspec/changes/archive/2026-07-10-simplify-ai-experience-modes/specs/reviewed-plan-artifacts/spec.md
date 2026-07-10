## ADDED Requirements

### Requirement: Plan is conversational until decisions settle
The system SHALL use Plan for convergent design and SHALL delay artifact creation until scope, design, delivery shape, risks, acceptance, proof, and policy choices are coherent.

#### Scenario: Plan begins
- **WHEN** a user requests planning or confirms transition from Explore
- **THEN** Plan resolves material decisions conversationally
- **AND** it does not create a partial artifact merely because the mode started

#### Scenario: Bounded research settles one decision
- **WHEN** one factual gap blocks the active design
- **THEN** Plan may gather that evidence read-only and continue

#### Scenario: Research reopens the problem space
- **WHEN** evidence materially changes the problem, candidate solutions, or requested outcome
- **THEN** Plan returns to Explore before formalizing the artifact

### Requirement: Plan selects one artifact semantically
The system SHALL finish with one repository-owned atomic plan or OpenSpec selected from contract needs rather than numeric size thresholds.

#### Scenario: Atomic delivery is appropriate
- **WHEN** one coherent MR is expected and the work does not require a durable cross-cutting specification or mandatory full POC
- **THEN** Plan writes `.agents/plans/<slug>.md` with context, decisions, scope, acceptance, verification, risks, and implementation handoff
- **AND** commits it with final delivery without review sidecars

#### Scenario: OpenSpec is appropriate
- **WHEN** the work has several independently reviewable delivery units, changes a durable cross-component contract, requires migration design, or requires a full POC
- **THEN** Plan writes one complete OpenSpec change
- **AND** it creates no second plan representation

#### Scenario: Expected implementation size is estimated
- **WHEN** Plan considers reviewability or delivery risk
- **THEN** file and line estimates may inform scope discussion
- **AND** they do not determine the artifact route

#### Scenario: User chooses a coherent route
- **WHEN** the user explicitly selects an atomic plan or OpenSpec that represents the accepted contract
- **THEN** Plan follows that route

#### Scenario: Material decision is unresolved
- **WHEN** route selection depends on unresolved scope, risk, or migration behavior
- **THEN** Plan asks for the decision and writes no placeholder artifact

### Requirement: Planning artifacts receive local automatic review
The system SHALL validate and review a written or materially changed planning artifact before POC or implementation work begins.

#### Scenario: Planning baseline runs
- **WHEN** a Plan artifact is written or changed
- **THEN** Review launches implementation-readiness, edge-case/risk, simplification/scope, and refactoring reviewers against one artifact fingerprint
- **AND** adds affected-domain specialists

#### Scenario: In-scope finding is repaired
- **WHEN** a finding preserves accepted scope and design
- **THEN** Plan revises and validates the artifact
- **AND** affected reviewers rerun against the new fingerprint

#### Scenario: Finding changes a settled decision
- **WHEN** a finding changes scope, architecture, safety, or delivery shape
- **THEN** Plan returns that decision to the user

#### Scenario: Artifact review evidence is private
- **WHEN** review completes or becomes stale
- **THEN** evidence remains task-local and recomputable
- **AND** it is not committed, stored through AX, or copied into hosted descriptions

### Requirement: Planning isolation begins before the first write
The system SHALL protect unrelated checkout state before Plan writes its artifact.

#### Scenario: Primary checkout is dirty
- **WHEN** Plan is about to write
- **THEN** it records primary branch, HEAD, changed paths, untracked paths, and diff fingerprint
- **AND** writes in a dedicated planning/final-delivery worktree

#### Scenario: Plan completes
- **WHEN** the artifact is committed or handed off
- **THEN** the original primary snapshot remains unchanged

### Requirement: Initial OpenSpec is not a separate planning MR
The system SHALL keep the locally reviewed initial OpenSpec on a local planning-base branch and SHALL not publish a planning-only PR/MR.

#### Scenario: Plan-only work completes
- **WHEN** the user authorized planning without implementation
- **THEN** Plan may stop with the locally reviewed artifact
- **AND** it publishes no planning MR

#### Scenario: OpenSpec implementation is authorized
- **WHEN** the user authorizes the full implementation workflow
- **THEN** the initial OpenSpec commit becomes the POC branch starting point
- **AND** the reconciled planning-base commits appear in the first final delivery-unit MR and flow through dependent units

#### Scenario: Atomic implementation is authorized
- **WHEN** an atomic plan is selected
- **THEN** the plan and implementation may be published together in one final MR

#### Scenario: Atomic delivery completes or is abandoned
- **WHEN** final delivery merges or the plan is abandoned
- **THEN** the atomic plan remains a durable record or receives an explicit disposition

### Requirement: POC reconciliation is one batch per authorized cycle
The system SHALL update durable planning state once after the user's personal review of each explicitly authorized POC cycle.

#### Scenario: Durable POC findings exist
- **WHEN** POC evidence changes scope, design, requirements, acceptance, verification, migration, or tasks
- **THEN** Plan updates all affected OpenSpec artifacts and required Linear preview content together

#### Scenario: Reconciliation is reviewed
- **WHEN** the batch is complete
- **THEN** the planning baseline and affected specialists review the revised artifact

#### Scenario: No material contract finding exists
- **WHEN** the POC confirms the initial contract
- **THEN** Plan records no speculative expansion and proceeds with the validated artifact

#### Scenario: Reconciliation appears unproved
- **WHEN** the revised spec contains a materially new behavior or risk
- **THEN** Plan asks the user whether another POC is required
- **AND** does not start another POC cycle automatically

### Requirement: Plan artifacts stay associated with final delivery
The system SHALL publish reconciled planning state with the owning final implementation unit and SHALL avoid planning-only or reconciliation-only review artifacts.

#### Scenario: Final implementation unit is reviewed
- **WHEN** a final MR is prepared
- **THEN** its Plan/OpenSpec content receives current planning review and its code receives current implementation review

#### Scenario: OpenSpec completes
- **WHEN** every reconciled task and requirement is implemented and verified
- **THEN** the last delivery unit carries final task completion and required archive changes
- **AND** the planning baseline reviews the resulting canonical-spec/archive diff

#### Scenario: Plan is abandoned
- **WHEN** an artifact will not be implemented
- **THEN** Plan records the disposition in the appropriate durable project surface
- **AND** Finish does not mark it complete silently
