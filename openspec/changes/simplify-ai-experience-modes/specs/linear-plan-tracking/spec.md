## ADDED Requirements

### Requirement: Start Project produces a Linear-ready description
The system SHALL include an initial Linear project description in the conversational Start Project output without creating external state during Explore.

#### Scenario: Project intake completes
- **WHEN** Explore finishes a Start Project intake
- **THEN** it returns a title, summary, problem or opportunity, desired outcome, scope, success signals, systems, constraints, dependencies, open questions, and recommended planning step
- **AND** the content is ready to create or update a Linear project during Plan

### Requirement: Every Plan artifact has Linear delivery records
The system SHALL create or update corresponding Linear issue records before a Plan artifact can complete normally.

#### Scenario: Plan previews writes before mutation
- **WHEN** Plan has reviewed the artifact and completed read-only Linear discovery
- **THEN** it presents the exact project, issue titles, outcomes, acceptance, proof, dependencies, and create/reuse/update actions
- **AND** it performs no Linear write until the user explicitly approves that preview

#### Scenario: Artifact approval did not include the Linear preview
- **WHEN** the user approved the planning artifact before seeing the exact Linear preview
- **THEN** Plan still requests approval of the preview
- **AND** it does not infer write authority from artifact approval

#### Scenario: Atomic plan maps to one issue
- **WHEN** Plan produces one atomic plan and one implementation MR
- **THEN** it creates or reuses one Linear implementation issue for that outcome

#### Scenario: OpenSpec maps units to issues
- **WHEN** Plan produces an OpenSpec with several delivery-unit headings
- **THEN** it creates or reuses one Linear issue per delivery unit/MR
- **AND** nested OpenSpec checkboxes remain work items inside the delivery-unit issue rather than separate issues

#### Scenario: Existing matching issue is found
- **WHEN** read-only discovery finds an issue representing the same delivery outcome
- **THEN** Plan previews reuse or update instead of creating a duplicate

### Requirement: Linear project selection is explicit when ambiguous
The system SHALL inspect Linear teams and projects read-only before creating issues and SHALL not guess when project association is unclear.

#### Scenario: One project clearly matches
- **WHEN** exactly one active Linear project matches the repository and planning context
- **THEN** Plan may reuse that project
- **AND** records its stable ID and URL rather than relying on name alone

#### Scenario: Several projects match
- **WHEN** multiple Linear projects could own the work
- **THEN** Plan presents the strongest candidates and asks the user to select one
- **AND** it does not create issues until the choice is clear

#### Scenario: No project matches a Start Project or OpenSpec
- **WHEN** the artifact came from Start Project or has multiple OpenSpec delivery units and no project matches
- **THEN** Plan asks whether to create a project from the initial description

#### Scenario: Atomic plan has no project
- **WHEN** a standalone atomic plan does not belong to a broader effort
- **THEN** the user may explicitly select standalone issue delivery

### Requirement: Linear issue content is outcome-centered
The system SHALL derive each issue from the reviewed delivery unit and SHALL include enough evidence for independent implementation review.

#### Scenario: Delivery issue is created
- **WHEN** Plan creates a Linear issue
- **THEN** the issue contains goal, outcome slice, scope, acceptance criteria, verification, out-of-scope work, dependencies, and references to the planning artifact and hosted review when available
- **AND** hosted, integration, migration, automation, or external-system claims include direct proof required before the implementation MR is ready

### Requirement: Planning and delivery surfaces have distinct authority
The system SHALL keep the Plan artifact canonical for work definition, the planning PR/MR canonical for exact-head discussion and approval, and Linear canonical for scheduling and delivery status.

#### Scenario: Scope changes in Linear
- **WHEN** a Linear edit or comment changes scope, design, acceptance, verification, or delivery units
- **THEN** the workflow returns to Plan and updates the primary artifact first
- **AND** it does not treat the tracker edit as an implicit artifact amendment

#### Scenario: Assignment or schedule changes in Linear
- **WHEN** assignee, priority, cycle, estimate, or schedule changes without changing the work contract
- **THEN** the Linear update remains canonical
- **AND** no artifact revision is required

### Requirement: Linear status follows planning and implementation state
The system SHALL map semantic workflow states onto each Linear team's configured statuses without inventing global status names.

#### Scenario: Planning review is pending
- **WHEN** the planning PR/MR or required OpenSpec rehearsal has not passed
- **THEN** associated delivery issues remain backlog or planning-review state

#### Scenario: Delivery unit becomes ready
- **WHEN** the exact planning head is approved, required rehearsal passes, and all predecessor dependencies are satisfied
- **THEN** the first unblocked delivery-unit issue moves to the team's Ready-equivalent state

#### Scenario: Delivery unit executes and reviews
- **WHEN** Execute starts the unit or publishes its implementation PR/MR
- **THEN** the issue moves to the team's In Progress or In Review equivalent respectively

#### Scenario: Delivery unit merges
- **WHEN** the corresponding implementation PR/MR is remotely verified as merged
- **THEN** the issue moves to the team's Done-equivalent state

### Requirement: Linear drift blocks execution
The system SHALL verify that artifact delivery units, the approved planning head, and Linear issue mapping agree before Execute starts or resumes a unit.

#### Scenario: Mapping is current
- **WHEN** every delivery unit has one reachable issue with matching outcome, dependencies, and planning references
- **THEN** Execute may select the next ready issue

#### Scenario: Mapping drift is found
- **WHEN** an artifact unit is missing, duplicated, materially different, or attached to the wrong project
- **THEN** the workflow returns to Plan for reconciliation
- **AND** it does not silently choose one source

### Requirement: Skipping Linear requires explicit artifact-scoped confirmation
The system SHALL block Plan completion when required Linear state cannot be created unless the user explicitly confirms the skip for that artifact.

#### Scenario: Linear is unavailable or undesired
- **WHEN** authentication, team, project, or write access is missing or the user indicates Linear should not be used
- **THEN** Plan asks `Skip Linear for this planning artifact?`
- **AND** generic continuation or agent judgment does not count as confirmation

#### Scenario: User confirms the skip
- **WHEN** the user explicitly confirms skipping Linear for the named artifact
- **THEN** Plan records `linear_skipped_by_user` and the reason in the task handoff
- **AND** it may complete without issue links

#### Scenario: Common Linear gate is evaluated
- **WHEN** Plan, Execute, rehearsal, or Finish evaluates tracker readiness
- **THEN** the gate passes with either a current approved issue mapping or current artifact-scoped `linear_skipped_by_user` evidence
- **AND** neither path is treated as stronger than the other for workflow readiness

#### Scenario: Skip evidence is missing after resume
- **WHEN** a resumed task cannot recover the artifact-scoped confirmation
- **THEN** the workflow asks for confirmation again
- **AND** it does not reconstruct the skip from generic continuation language

#### Scenario: Branch is transported with Linear pending
- **WHEN** the user requests push-only branch transport and Linear is unavailable without an explicit skip
- **THEN** the handoff records `blocked_auth_pending` and may transport the locally reviewed branch
- **AND** planning PR/MR creation, rehearsal, and Execute remain blocked until the common Linear gate passes

#### Scenario: Stack sequencing consumes an approved mapping
- **WHEN** final implementation sequencing begins with current mapped issues
- **THEN** it reuses exactly one Plan-created issue per unit and creates no duplicate

#### Scenario: Stack sequencing consumes an approved skip
- **WHEN** final implementation sequencing begins with current artifact-scoped skip evidence
- **THEN** unit IDs from the reviewed artifact identify delivery without Linear issues
- **AND** missing or stale mapping/skip evidence returns to Plan rather than creating tracker state in Execute

#### Scenario: User does not confirm the skip
- **WHEN** explicit confirmation is absent
- **THEN** Plan remains blocked
