## ADDED Requirements

### Requirement: Review-Only POC Workflow
The system SHALL expose `plan-poc` as an opt-in OpenSpec implementation
rehearsal workflow that is separate from final delivery.

#### Scenario: POC starts from a valid OpenSpec change
- **WHEN** `plan-poc` is invoked with an OpenSpec change reference
- **THEN** it runs strict OpenSpec validation
- **AND** it runs OpenSpec task-shape audit
- **AND** it does not require a prior planning MR

#### Scenario: Invalid task shape blocks POC implementation
- **WHEN** OpenSpec validation or task-shape audit fails
- **THEN** `plan-poc` reports the validation blocker
- **AND** it does not start implementation work

### Requirement: Draft POC Artifact
The system SHALL represent every POC rehearsal with one draft hosted review
artifact that is not intended to merge.

#### Scenario: POC artifact is created
- **WHEN** `plan-poc` opens a hosted MR or PR
- **THEN** the artifact is marked draft
- **AND** the title starts with `POC:`
- **AND** the body states that the artifact is a review-only implementation
  rehearsal
- **AND** the body states that the artifact is not intended to merge

#### Scenario: POC artifact includes spec context
- **WHEN** reviewers inspect the POC artifact
- **THEN** the artifact includes the rehearsed OpenSpec files
- **AND** the artifact includes the implementation diff
- **AND** the body states that the OpenSpec files are comparison context for
  the rehearsal

#### Scenario: Existing POC artifact is updated
- **WHEN** `plan-poc` updates an existing POC MR or PR
- **THEN** it reads the hosted body before updating
- **AND** it preserves manual reviewer context through the selected
  description-policy adapter

### Requirement: Sequential POC Phase Loop
The system SHALL implement OpenSpec delivery phases sequentially in one POC
branch and request routed reviewer feedback after each material push.

#### Scenario: Phase push requests reviewer feedback
- **WHEN** a POC phase implementation or feedback fix is pushed
- **THEN** `plan-poc` refreshes the hosted description when reviewer context
  changed
- **AND** it requests routed reviewer feedback for the latest head
- **AND** it waits for the routed reviewer gate to pass, block, or become
  unavailable with evidence

#### Scenario: POC task state is contextual
- **WHEN** `plan-poc` marks OpenSpec task checkboxes in the POC branch
- **THEN** it marks only work items relevant to the current POC phase
- **AND** it records that POC task state is contextual and non-authoritative

#### Scenario: Reviewer feedback blocks automatic advancement
- **WHEN** routed feedback is stale, pending, unavailable, or has unresolved
  actionable findings
- **THEN** `plan-poc` does not advance to the next phase automatically
- **AND** Rene may still choose to close the POC as good enough with learnings

### Requirement: Private POC Learning Summary
The system SHALL close POC artifacts unmerged and emit private learning
evidence for later OpenSpec revision.

#### Scenario: POC closes with private learnings
- **WHEN** Rene decides the POC is good enough
- **THEN** `plan-poc` closes the draft artifact unmerged
- **AND** it emits a private `poc_learning_summary`
- **AND** it does not commit the summary to the repo by default

#### Scenario: POC closes as abandoned
- **WHEN** Rene decides the POC should be abandoned or cancelled before it is
  good enough
- **THEN** `plan-poc` closes the draft artifact unmerged
- **AND** it does not start final implementation from the POC
- **AND** it emits a private `poc_learning_summary` with the abandonment
  decision, unless Rene explicitly declines learning capture

#### Scenario: Learning summary records final delivery boundary
- **WHEN** `poc_learning_summary` is emitted
- **THEN** it records `delivery_source: revised_openspec`
- **AND** it records `poc_commits_reused: false`
- **AND** it records spec corrections, implementation notes, reviewer
  dispositions, unresolved learnings, and follow-up decisions

### Requirement: POC Route Handling
The system SHALL use existing review-feedback routing for POC reviewer gates
and block or ask when a required route is unavailable.

#### Scenario: Fullscript GitLab uses Nitro route
- **WHEN** the POC artifact is a Fullscript GitLab MR
- **THEN** `plan-poc` may request Nitro through the configured routed feedback
  path

#### Scenario: Personal project route is unavailable
- **WHEN** the artifact host has no configured reviewer route
- **THEN** `plan-poc` reports the unsupported routing evidence
- **AND** it asks for a reviewer route or blocks without substituting an
  unconfigured reviewer
