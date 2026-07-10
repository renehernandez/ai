## ADDED Requirements

### Requirement: Every OpenSpec receives one complete POC
After the five-mode cutover, the system SHALL build one full disposable POC for every subsequent OpenSpec before final implementation.

#### Scenario: Bootstrap migration is explicitly exempted
- **WHEN** the user directly authorizes this pre-cutover migration as one implementation MR without a POC
- **THEN** the migration implements and reviews the complete change once in that MR
- **AND** requests latest-head Nitro review and resolves every finding
- **AND** does not create a POC or planning MR
- **AND** the installed contract still requires full POCs for subsequent OpenSpec changes

#### Scenario: Initial OpenSpec is ready
- **WHEN** the initial OpenSpec passes local validation and the planning review baseline
- **THEN** Execute creates one dedicated POC branch/worktree from that planning commit
- **AND** Plan and Review retain their artifact and inspection responsibilities

#### Scenario: Atomic plan is selected
- **WHEN** Plan produces an atomic plan rather than OpenSpec
- **THEN** no POC is mandatory unless the user requests one

#### Scenario: POC review artifact is published
- **WHEN** the complete POC is ready for hosted review
- **THEN** Finish opens one draft PR/MR against the normal target branch with a title beginning `POC:`
- **AND** its description states that it contains the OpenSpec plus implementation for review and must close unmerged

### Requirement: POC coverage is production-complete
The system SHALL implement every explicit OpenSpec task, requirement, scenario, acceptance criterion, and applicable production concern in the POC.

#### Scenario: Complete design is exercised
- **WHEN** the POC is presented for review
- **THEN** it includes implementation, tests, documentation, operational guidance, relevant edge cases, migrations, rollback, compatibility, security, performance, accessibility, and direct success/failure proof where applicable

#### Scenario: A production concern is not applicable
- **WHEN** the accepted design makes a concern irrelevant
- **THEN** the POC review context explains the rationale
- **AND** explicit OpenSpec tasks or acceptance criteria may not be skipped as not applicable

#### Scenario: Central boundary is exercised
- **WHEN** an architecture or integration boundary is central to the decision
- **THEN** the POC exercises the real boundary or a fidelity-equivalent environment
- **AND** mocks do not bypass the behavior under review

#### Scenario: Coverage is incomplete
- **WHEN** an explicit requirement, task, acceptance criterion, or applicable concern lacks implementation and verification evidence
- **THEN** automated review or Plan blocks personal review
- **AND** no separate receipt can waive the missing coverage

#### Scenario: POC covers tasks without completing source state
- **WHEN** POC implementation satisfies an OpenSpec task
- **THEN** review evidence proves that task's rehearsal coverage
- **AND** source `tasks.md` remains unchecked until independent final implementation satisfies it

#### Scenario: POC rehearses delivery bookkeeping
- **WHEN** the final delivery contract requires task completion and OpenSpec archival
- **THEN** the POC exercises that transformation in a disposable repository copy and validates the resulting canonical specs/archive
- **AND** it does not check source tasks, archive the live POC change, or claim to be the final MR

### Requirement: POC runtime proof is isolated
The system SHALL exercise AX synchronization in disposable roots and SHALL NOT mutate the user's live runtime from the POC.

#### Scenario: POC exercises runtime synchronization
- **WHEN** the POC tests profiles, instructions, skills, hooks, manifest, cache, transactions, backups, or OpenSpec sync
- **THEN** it uses isolated HOME and runtime roots
- **AND** live `~/.agents`, `~/.codex`, and `~/.claude` inventories remain unchanged

#### Scenario: POC targets a live runtime root
- **WHEN** a rehearsal command would write a live user runtime path
- **THEN** the command is rejected

### Requirement: POC receives automated and personal review
The system SHALL require current local automated review, configured CI and hosted automated review, and explicit user acceptance of the latest POC head.

#### Scenario: Local POC review runs
- **WHEN** a POC head is ready or changes
- **THEN** correctness, regression, maintainability, and verification reviewers inspect the exact target-base diff/head read-only
- **AND** affected-domain specialists are added

#### Scenario: Hosted POC review runs
- **WHEN** the draft POC MR is published or its head changes
- **THEN** configured CI and latest-head hosted automated review run
- **AND** Nitro is requested when project policy selects it

#### Scenario: Automated finding is actionable
- **WHEN** local or hosted review finds an implementation defect
- **THEN** the same POC writer fixes it and produces a hook-clean head
- **AND** local and hosted exact-head gates refresh

#### Scenario: Finding changes the contract
- **WHEN** a finding changes scope, design, acceptance, migration, safety, or verification
- **THEN** Plan records it for the post-review reconciliation
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
- **AND** the workflow freezes that POC for disposal and reconciliation

#### Scenario: Acceptance evidence is unavailable after resume
- **WHEN** the workflow can inspect the closed POC head but cannot recover exact-head personal acceptance
- **THEN** it presents that head and requests fresh explicit acceptance
- **AND** final implementation remains blocked

### Requirement: POC findings reconcile the OpenSpec once per authorized cycle
The system SHALL perform one batch reconciliation of durable findings after personal review of each explicitly authorized POC cycle and before final implementation.

#### Scenario: Durable finding exists
- **WHEN** accepted POC evidence changes scope, design, requirements, scenarios, acceptance, verification, migration, or tasks
- **THEN** Plan updates proposal, design, delta specs, tasks, and required Linear content in one batch

#### Scenario: Finding is implementation-local
- **WHEN** a POC observation does not change the durable contract
- **THEN** it remains transient and does not expand the OpenSpec

#### Scenario: Reconciled artifact is reviewed
- **WHEN** the batch update is complete
- **THEN** the planning review baseline and affected specialists inspect the revised OpenSpec

#### Scenario: Reconciliation is behavior-covered
- **WHEN** the revised contract only records behavior proven by the accepted POC or clarifies wording
- **THEN** no second POC starts automatically

#### Scenario: Reconciliation appears materially unproved
- **WHEN** the revised contract introduces behavior or risk that the accepted POC did not prove
- **THEN** Plan presents the delta and recommendation to the user
- **AND** only explicit user direction starts another POC cycle with a later reconciliation batch

### Requirement: POC closes unmerged
The system SHALL close the reviewed POC without merging it and SHALL remove its worktree before final implementation begins.

#### Scenario: POC is accepted
- **WHEN** personal review is complete
- **THEN** Finish closes the draft POC MR unmerged and Execute removes its worktree
- **AND** the branch is not an implementation predecessor
- **AND** entering the mandatory POC flow supplies authority for local worktree teardown but not remote branch deletion

#### Scenario: POC is abandoned
- **WHEN** the user cancels the POC
- **THEN** it closes unmerged or remains explicitly abandoned
- **AND** final OpenSpec implementation stays blocked

### Requirement: Final implementation is independent and task-shaped
The system SHALL implement the reconciled OpenSpec without POC ancestry and SHALL publish one mergeable final PR/MR per top-level delivery unit.

#### Scenario: Final implementation starts
- **WHEN** the POC is accepted, closed unmerged, and the reconciled OpenSpec is locally reviewed
- **THEN** Execute starts the first delivery unit from the normal target base plus reconciled planning state and starts every later unit from the previous unit in the total Git order
- **AND** logical dependencies remain distinct from that hosting order
- **AND** no final unit uses the POC branch as its Git base

#### Scenario: POC code is not promoted
- **WHEN** final code is created
- **THEN** POC commits are not merged, rebased, cherry-picked, or applied into the final branch
- **AND** the workflow performs no patch-ID, similarity, or writer-input policing

#### Scenario: Final delivery is published
- **WHEN** final implementation and local review pass
- **THEN** Finish opens or updates one mergeable PR/MR per top-level delivery unit with independently implemented code and its associated spec/task changes
- **AND** no planning or reconciliation-only PR/MR is created

#### Scenario: OpenSpec has one delivery unit
- **WHEN** the reconciled OpenSpec contains one top-level delivery unit
- **THEN** final delivery contains one mergeable implementation PR/MR

#### Scenario: Final implementation changes the contract materially
- **WHEN** any final unit requires behavior or contract changes beyond the reconciled OpenSpec
- **THEN** Execute stops and returns to Plan
- **AND** Plan asks the user whether another POC is required for the unproved delta
