## MODIFIED Requirements

### Requirement: POC receives automated and personal review
The system SHALL require current local automated review, configured CI and hosted automated review, and explicit user acceptance of the latest POC head while keeping disposal authority separate.

#### Scenario: Local POC review runs
- **WHEN** a POC head is ready or changes
- **THEN** correctness, regression, maintainability, and verification reviewers inspect the exact target-base diff/head read-only
- **AND** affected-domain specialists are added

#### Scenario: Hosted POC review runs
- **WHEN** the draft POC MR is published or its head changes
- **THEN** configured CI and latest-head hosted automated review run
- **AND** Nitro is explicitly requested when project policy selects it

#### Scenario: Automated finding is actionable
- **WHEN** local or hosted review finds an implementation defect
- **THEN** the same POC writer fixes it and produces a hook-clean head
- **AND** local and hosted exact-head gates refresh

#### Scenario: Finding changes the contract
- **WHEN** a finding changes scope, design, acceptance, migration, safety, or verification
- **THEN** Plan records it for the consolidated reconciliation
- **AND** the POC may demonstrate the proposed correction before personal review

#### Scenario: Personal review is pending
- **WHEN** automated review is clean but the user has not accepted the current POC head
- **THEN** final implementation remains blocked

#### Scenario: User requests a correction
- **WHEN** the user rejects or requests changes during personal review
- **THEN** the POC owner updates the POC and refreshes automated review
- **AND** prior personal acceptance evidence is stale

#### Scenario: User accepts the POC
- **WHEN** the current POC head is automated-review clean and the user explicitly accepts it
- **THEN** task-local state binds acceptance to the POC URL and exact head SHA
- **AND** the workflow freezes that head for reconciliation while the POC remains open

#### Scenario: Acceptance evidence is unavailable after resume
- **WHEN** the workflow can inspect the POC head but cannot recover exact-head personal acceptance
- **THEN** it presents that head and requests fresh explicit acceptance
- **AND** final implementation remains blocked

### Requirement: POC findings reconcile the OpenSpec once per authorized cycle
The system SHALL record durable findings during the POC and SHALL perform one consolidated reconciliation against the accepted head before final implementation.

#### Scenario: Durable finding exists
- **WHEN** accepted POC evidence changes scope, design, requirements, scenarios, acceptance, verification, migration, or tasks
- **THEN** Plan updates proposal, design, delta specs, tasks, and required Linear content in one batch

#### Scenario: Finding is implementation-local
- **WHEN** a POC observation does not change the durable contract
- **THEN** it remains transient and does not expand the OpenSpec

#### Scenario: Reconciled artifact is reviewed
- **WHEN** the batch update is complete
- **THEN** the planning review baseline and affected specialists inspect the revised OpenSpec against the accepted POC head

#### Scenario: Reconciliation is behavior-covered
- **WHEN** the revised contract only records behavior proven by the accepted POC or clarifies wording
- **THEN** no second POC starts automatically

#### Scenario: Reconciliation appears materially unproved
- **WHEN** the revised contract introduces behavior or risk that the accepted POC did not prove
- **THEN** Plan presents the delta and recommendation to the user
- **AND** only explicit user direction starts another POC cycle with a later reconciliation batch

### Requirement: POC closes unmerged only under user authority
The system SHALL keep the reviewed POC open and draft until the user explicitly requests closure or contextually authorizes closure by stating readiness to proceed to stack breakdown.

#### Scenario: POC reaches technical readiness
- **WHEN** local review, CI, hosted review, and current-head Nitro have no actionable findings
- **THEN** the POC remains open and draft
- **AND** technical readiness does not authorize closure

#### Scenario: User explicitly requests closure
- **WHEN** the user directs the workflow to close the accepted POC
- **THEN** Plan completes and reviews reconciliation
- **AND** Finish closes the draft POC unmerged

#### Scenario: User proceeds to stack breakdown
- **WHEN** the user states that the accepted POC is ready to proceed to stack breakdown
- **THEN** that statement authorizes final reconciliation and unmerged POC closure
- **AND** it does not authorize final-stack merge

#### Scenario: POC is abandoned
- **WHEN** the user cancels the POC
- **THEN** it closes unmerged or remains explicitly abandoned
- **AND** final OpenSpec implementation stays blocked

