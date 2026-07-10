## ADDED Requirements

### Requirement: Every OpenSpec requires a complete implementation rehearsal
The system SHALL build one full, disposable POC review artifact for every OpenSpec before final implementation-stack execution.

#### Scenario: OpenSpec enters rehearsal
- **WHEN** the exact OpenSpec planning head has passed local artifact review, the common Linear gate passes, a planning PR/MR exists, and latest-head hosted planning feedback is clean or resolved
- **THEN** Plan owns the rehearsal scope and unmergeable draft PR/MR, Execute owns one dedicated POC branch/worktree writer from the exact planning head, and Review owns exact-head inspection
- **AND** opens one draft PR/MR that shows the OpenSpec plus all implementation units against the normal base

#### Scenario: Rehearsal finding is routed
- **WHEN** Review or hosted feedback finds an implementation-local defect
- **THEN** Plan routes it to the same Execute POC owner and Review reruns on the new head
- **AND** contract-affecting findings return to Plan for durable reconciliation and final user acceptance

#### Scenario: Hosted planning feedback is missing
- **WHEN** local planning review passed but the planning PR/MR or current hosted planning feedback is missing
- **THEN** rehearsal remains ineligible
- **AND** final planning approval remains pending

#### Scenario: Atomic plan skips mandatory rehearsal
- **WHEN** Plan produces one atomic plan rather than OpenSpec
- **THEN** no POC is required unless the user explicitly requests one

### Requirement: Full rehearsal is production-complete
The system SHALL include every production requirement and implementation slice in the POC rather than limiting it to scaffolding or architectural proof.

#### Scenario: POC covers the complete design
- **WHEN** the POC is presented for review
- **THEN** it includes all planned implementation units, tests, documentation, runbooks, observability, operational hardening, relevant exhaustive edge cases, migrations, rollback, compatibility, security, performance, and accessibility requirements
- **AND** every claimed outcome has direct visible success and failure evidence

#### Scenario: POC uses real decision boundaries
- **WHEN** an architecture or integration boundary is central to the OpenSpec
- **THEN** the POC exercises the real boundary or a fidelity-equivalent environment
- **AND** mocks do not bypass the decision being reviewed

#### Scenario: POC commits run normal verification
- **WHEN** POC code is committed
- **THEN** native Git and repository hooks run without bypass
- **AND** the same required local verification as final implementation applies

### Requirement: Rehearsal runtime activation is isolated
The system SHALL exercise runtime cutover inside disposable roots and SHALL not mutate the user's live runtime from an unmergeable POC.

#### Scenario: POC rehearses runtime installation
- **WHEN** the POC exercises profile, instruction, skill, hook, cache, config, or lock activation
- **THEN** it uses an isolated temporary HOME and isolated AX runtime roots
- **AND** live `~/.agents`, `~/.codex`, and `~/.claude` inventories remain unchanged

#### Scenario: POC targets a live runtime root
- **WHEN** a rehearsal command would write a live runtime path
- **THEN** the rehearsal blocks the command
- **AND** reserves live activation for the final clean implementation unit

### Requirement: Rehearsal completion reconciles every planned work item
The system SHALL derive a task-local completion receipt from exact planning-head `tasks.md` and SHALL not report `rehearsal_ready` until every delivery unit and nested work item has direct implementation and verification evidence.

#### Scenario: Planned work is missing or duplicated
- **WHEN** receipt unit/work-item IDs do not exactly equal parsed planning-head IDs, or any item lacks implementation or verification evidence
- **THEN** rehearsal status is `blocked`
- **AND** user acceptance cannot override the missing coverage

#### Scenario: Required production surface is not applicable
- **WHEN** documentation, runbooks, observability, operational hardening, relevant edge cases, migrations, rollback, compatibility, security, performance, accessibility, or direct success/failure proof does not apply
- **THEN** the receipt records `not_applicable` with reviewed rationale
- **AND** nested planned work items themselves cannot use `not_applicable`

#### Scenario: Exact rehearsal is complete
- **WHEN** exact unit/work-item set equality, all item evidence, every applicable production surface, CI, local and configured hosted review, OpenSpec reconciliation, the common Linear gate, and user acceptance all pass for one planning head and POC head with no missing entries
- **THEN** status is `rehearsal_ready`
- **AND** the receipt remains task-local, recomputable, and absent from Git, AX, Linear, and hosted descriptions

### Requirement: POC receives automated and user review
The system SHALL require latest-head automatic review plus explicit user acceptance before the rehearsal gate passes.

#### Scenario: Automatic POC feedback runs
- **WHEN** the POC has a material new head
- **THEN** read-only local reviewer subagents, configured CI, and project-selected hosted automated reviewers inspect that exact head
- **AND** actionable findings return to the POC owner for hook-clean fixes and fresh review

#### Scenario: User review is pending
- **WHEN** automated feedback is clean but the user has not accepted the POC
- **THEN** the rehearsal remains pending
- **AND** final implementation does not start

#### Scenario: User accepts the POC
- **WHEN** the latest POC head is automated-review clean and the user explicitly accepts it
- **THEN** the rehearsal may close after durable learnings are reconciled into Plan

#### Scenario: POC head changes after acceptance
- **WHEN** any commit changes the accepted POC head
- **THEN** exact-head automated review and user acceptance become stale
- **AND** the completion receipt is recomputed before rehearsal can pass

### Requirement: POC findings revise durable planning state
The system SHALL return contract-affecting POC learnings to Plan and SHALL synchronize affected Linear records before final planning approval.

#### Scenario: POC reveals a planning correction
- **WHEN** implementation or review changes scope, design, requirements, acceptance, verification, migration, or delivery units
- **THEN** Plan updates the OpenSpec and affected Linear issues
- **AND** reruns artifact validation, automatic planning reviewers, and required hosted planning review for the new head

#### Scenario: POC finding is implementation-local
- **WHEN** a finding changes only POC code while preserving the reviewed contract
- **THEN** the POC owner fixes it without changing the OpenSpec

### Requirement: Material planning changes invalidate rehearsal evidence
The system SHALL classify OpenSpec changes after rehearsal and SHALL rerun the required POC scope before final implementation.

#### Scenario: Global design changes
- **WHEN** architecture, public contract, migration strategy, security model, operational model, or delivery-unit structure changes
- **THEN** the complete POC and its automatic/user review gates rerun

#### Scenario: One unit changes materially
- **WHEN** localized behavior, failure handling, acceptance, or verification changes
- **THEN** the affected unit reruns in the same complete POC
- **AND** the repository's complete regression verification still runs

#### Scenario: Behavior-preserving edit occurs
- **WHEN** only wording, formatting, or behavior-preserving implementation details change
- **THEN** the full implementation exercise may remain valid
- **AND** exact-head review, receipt reconciliation, and user acceptance still refresh

#### Scenario: Invalidation classification is ambiguous
- **WHEN** reviewers cannot agree whether the accepted rehearsal still covers the change
- **THEN** the workflow asks the user and does not infer a waiver

### Requirement: POC is never promoted to final delivery
The system SHALL close the accepted or abandoned POC unmerged and SHALL build the final implementation stack from the revised OpenSpec on clean worktrees.

#### Scenario: POC is accepted
- **WHEN** durable learnings are reconciled and the user accepts the latest head
- **THEN** the draft PR/MR closes unmerged
- **AND** its worktree is removed before final implementation begins

#### Scenario: Final lineage is verified
- **WHEN** a final implementation branch is created or reviewed
- **THEN** it descends from the reviewed planning/implementation predecessor and excludes POC ancestry, commit IDs, cherry-pick trailers, matching stable patch IDs, and POC branch/diff writer inputs
- **AND** behavior independently recreated from the revised OpenSpec remains allowed

#### Scenario: POC is abandoned
- **WHEN** the user cancels the rehearsal
- **THEN** the draft PR/MR closes unmerged or remains explicitly abandoned
- **AND** final implementation remains blocked until a valid OpenSpec rehearsal succeeds

#### Scenario: Final implementation diverges materially
- **WHEN** a final implementation unit changes architecture, behavior, or contracts beyond the accepted POC and revised OpenSpec
- **THEN** Execute stops and returns to Plan and the required rehearsal scope
- **AND** it does not rationalize the drift during Review
