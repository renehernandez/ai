## ADDED Requirements

### Requirement: Project intake produces a Linear-ready description
The system SHALL include an initial Linear project description in conversational project-intake output without creating external state during Explore.

#### Scenario: Project intake completes
- **WHEN** Explore completes project intake
- **THEN** it returns title, summary, problem or opportunity, desired outcome, scope, success signals, systems, constraints, dependencies, open questions, and recommended planning step
- **AND** the content is ready for optional use during Plan

### Requirement: Linear policy is required or disabled
The system SHALL resolve Linear behavior to exactly `required` or `disabled` from direct user instruction, project policy, and one workflow-policy profile default.

#### Scenario: Policy precedence is evaluated
- **WHEN** more than one policy source is available
- **THEN** direct user instruction overrides project policy
- **AND** project policy overrides the workflow-policy profile default

#### Scenario: Personal profile supplies the default
- **WHEN** no direct or project policy exists and `managed-runtime.json.policyProfile` is `personal`
- **THEN** Linear policy is `disabled`

#### Scenario: Work profile supplies the default
- **WHEN** no direct or project policy exists and `managed-runtime.json.policyProfile` is `work`
- **THEN** Linear policy is `required`

#### Scenario: Several profiles are installed
- **WHEN** no direct or project policy exists and the local manifest has no valid single `policyProfile` from its installed set
- **THEN** policy resolution blocks with `policy_profile_ambiguous`
- **AND** installed profile sets are not combined to choose a default

#### Scenario: Direct instruction changes policy
- **WHEN** the user explicitly enables or disables Linear for the current work
- **THEN** that instruction controls the current planning and delivery flow

#### Scenario: Unknown policy value is configured
- **WHEN** a profile or project uses a value other than `required` or `disabled`
- **THEN** validation fails with the policy source and invalid value

### Requirement: Disabled Linear policy has no side effects
The system SHALL perform no Linear workflow when resolved policy is `disabled`.

#### Scenario: Planning runs with Linear disabled
- **WHEN** Plan creates or reconciles an artifact under disabled policy
- **THEN** it performs no Linear discovery, preview, mutation, drift check, status synchronization, or gate
- **AND** it creates no skip token, receipt, or resume confirmation

#### Scenario: Delivery runs with Linear disabled
- **WHEN** Execute, Review, or Finish advances work under disabled policy
- **THEN** absence of a Linear project or issue does not block the workflow

### Requirement: Required Linear policy uses an approved preview
The system SHALL discover and reconcile required Linear state only after the user approves the exact proposed mutation.

#### Scenario: Plan discovers candidate state
- **WHEN** Plan has a reviewed artifact and Linear is required
- **THEN** it inspects teams, active projects, and matching issues read-only
- **AND** prefers reuse or update over duplicate creation

#### Scenario: Exact preview is presented
- **WHEN** discovery identifies the proposed project and issue actions
- **THEN** Plan presents stable project/issue identity, title, outcome, scope, acceptance, verification, dependencies, create/reuse/update operations, and intended lifecycle status transitions
- **AND** performs no write before explicit preview approval

#### Scenario: Artifact approval predates the preview
- **WHEN** the user approved the artifact without seeing the exact Linear mutation
- **THEN** Plan still requests approval of the preview

#### Scenario: Required write succeeds
- **WHEN** the user approves the exact preview
- **THEN** Plan applies only the approved create/reuse/update actions
- **AND** records stable IDs and URLs in task-local delivery state and team-facing references where appropriate

#### Scenario: Required state is unavailable
- **WHEN** authentication, write access, team selection, or project ownership cannot be resolved
- **THEN** the workflow blocks with the missing requirement
- **AND** it does not create an artifact-scoped skip

#### Scenario: User disables blocked integration
- **WHEN** required Linear is blocked and the user explicitly changes policy to disabled
- **THEN** the disabled-policy contract applies to the current work

### Requirement: Each final MR maps to one outcome-centered issue
The system SHALL map each OpenSpec top-level delivery unit and final implementation MR to one Linear delivery issue when policy is required.

#### Scenario: OpenSpec issues are created or reused
- **WHEN** the reviewed OpenSpec is ready for required Linear reconciliation
- **THEN** Plan creates, reuses, or updates one issue per top-level delivery unit
- **AND** nested tasks render as description checkboxes in their unit issue rather than separate issues or sub-issues

#### Scenario: OpenSpec has one delivery unit
- **WHEN** the reviewed OpenSpec contains one top-level delivery unit
- **THEN** Plan maps it to one issue and one final implementation MR

#### Scenario: Issue content is rendered
- **WHEN** Plan creates or updates the issue
- **THEN** it includes goal, scope, acceptance, verification, out-of-scope work, dependencies, OpenSpec reference, and hosted artifact links when available

#### Scenario: Matching issue already exists
- **WHEN** discovery finds an issue representing the same outcome
- **THEN** Plan previews reuse or update
- **AND** does not create a duplicate

### Requirement: Planning, hosted review, and Linear have distinct authority
The system SHALL keep the OpenSpec canonical for scope/design, hosted artifacts canonical for exact-head discussion, and Linear canonical for scheduling and delivery status.

#### Scenario: Scope changes in Linear
- **WHEN** a Linear edit or comment changes scope, design, acceptance, verification, or tasks
- **THEN** the workflow returns to Plan and updates the OpenSpec first

#### Scenario: Assignment or scheduling changes
- **WHEN** assignee, priority, cycle, estimate, or schedule changes without changing the work contract
- **THEN** Linear remains canonical and no spec revision is required

#### Scenario: POC reconciliation changes the contract
- **WHEN** accepted POC findings alter required issue content
- **THEN** Plan includes the resulting Linear update in the one reconciliation preview

### Requirement: Required Linear state follows delivery
The system SHALL verify and synchronize each required issue against current planning and implementation state.

#### Scenario: Lifecycle transition was approved
- **WHEN** current delivery state reaches a transition named in the approved preview
- **THEN** the workflow may apply that status mutation without another prompt

#### Scenario: Lifecycle transition was not approved
- **WHEN** a status mutation was absent from the approved preview
- **THEN** Plan or Finish previews it and waits for approval before writing

#### Scenario: POC is under review
- **WHEN** the draft POC exists and personal acceptance is pending
- **THEN** the issue remains in the team's planning or backlog equivalent

#### Scenario: Final implementation begins
- **WHEN** the POC is accepted, closed unmerged, and the OpenSpec is reconciled
- **THEN** each unblocked unit issue moves to the team's Ready or In Progress equivalent according to execution state

#### Scenario: Final MR is published
- **WHEN** Finish publishes the final mergeable MR
- **THEN** the corresponding issue moves to the team's In Review equivalent and links the MR

#### Scenario: Final MR merges
- **WHEN** remote merged state is verified
- **THEN** the corresponding issue moves to the team's Done equivalent

#### Scenario: Required mapping drifts
- **WHEN** the issue is missing, duplicated, unreachable, attached to the wrong project, or materially differs from the OpenSpec outcome
- **THEN** the workflow returns to Plan for an approved reconciliation
