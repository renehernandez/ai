## ADDED Requirements

### Requirement: Plan is conversational until decisions settle
The system SHALL use Plan for convergent brainstorming and SHALL delay artifact creation until scope, design, delivery shape, risks, acceptance, and proof are settled.

#### Scenario: Plan begins without immediate file creation
- **WHEN** a user directly requests planning or confirms transition from Explore
- **THEN** Plan structures and resolves the implementation design conversationally
- **AND** it does not write a partial artifact merely because the mode started

#### Scenario: Targeted research supports a Plan decision
- **WHEN** one bounded fact is needed to settle the active design
- **THEN** Plan may gather that evidence read-only and continue

#### Scenario: Research reopens the problem space
- **WHEN** evidence materially changes the problem, candidate solutions, or requested outcome
- **THEN** Plan returns to Explore before formalizing the artifact

### Requirement: Plan selects one primary artifact deterministically
The system SHALL finish with one primary repository-owned artifact selected from delivery shape, semantic size, ownership, risk, migration, and verification complexity.

#### Scenario: Atomic delivery selects a plan file
- **WHEN** the design has one independently reviewable implementation MR, one outcome, one primary ownership area, and one verification story
- **THEN** Plan writes `.agents/plans/<slug>.md`
- **AND** the plan contains context, goals, non-goals, decisions, delivery scope, acceptance, verification, objective proof, risks, and implementation handoff

#### Scenario: Multi-unit delivery selects OpenSpec
- **WHEN** the design needs two or more delivery-unit MRs, ordered migrations, coordinated cross-component contracts, or separately reviewable outcomes
- **THEN** Plan writes one complete OpenSpec change
- **AND** it does not create an intermediate source plan or blueprint

#### Scenario: Semantic size influences routing
- **WHEN** Plan estimates substantive files and non-generated changed lines
- **THEN** it biases toward atomic plan at about 8 files and 400 lines or less, applies judgment through about 15 files or 800 lines, and biases toward OpenSpec above that range
- **AND** generated, lockfile, and mechanical codemod output does not inflate semantic size

#### Scenario: User overrides the route
- **WHEN** the user explicitly selects a single plan or OpenSpec
- **THEN** Plan follows that route and records it as user-selected
- **AND** it does not repeatedly challenge the selection unless repository policy or internal coherence makes it impossible

#### Scenario: Artifact route remains materially ambiguous
- **WHEN** Plan cannot determine a coherent route without a decision that changes scope, risk, or delivery
- **THEN** it asks for that decision
- **AND** it does not create a placeholder artifact

### Requirement: Materialized Plan artifacts receive automatic review
The system SHALL validate and automatically review the final written artifact before creating a planning commit or publishing planning state.

#### Scenario: Baseline and contextual reviewers run
- **WHEN** a Plan artifact is written or materially changed
- **THEN** Plan invokes the shared Review-mode core, which launches implementation-readiness, edge-case/risk, simplification/scope, and refactoring reviewers
- **AND** selects affected documentation/agent, AX/skill, security, data, infrastructure, UI, or other specialist reviewers

#### Scenario: Plan consumes one Review pipeline
- **WHEN** artifact findings are normalized or evidence becomes stale, repeated, or conflicting
- **THEN** Review owns those mechanics for the artifact fingerprint
- **AND** Plan owns artifact repair and user escalation without implementing a second reviewer pipeline

#### Scenario: In-scope finding is repaired
- **WHEN** a reviewer finds a blocker that preserves settled scope and design
- **THEN** Plan revises and revalidates the artifact
- **AND** required reviewers rerun against the new fingerprint

#### Scenario: Finding changes a settled decision
- **WHEN** a finding changes scope, architecture, safety, or delivery shape
- **THEN** Plan returns the decision to the user
- **AND** it does not revise the artifact silently

#### Scenario: Artifact review evidence is not durable team state
- **WHEN** review completes or becomes stale
- **THEN** reviewer evidence remains private and is rerun when unavailable
- **AND** it is not committed, added to the planning description, or stored through AX

#### Scenario: Planning commit preserves reviewed identity
- **WHEN** Plan creates the planning commit
- **THEN** it proves the committed artifact content and allowed planning-only diff match the reviewed artifact fingerprint
- **AND** the new commit SHA does not stale fingerprint-keyed artifact review by itself

### Requirement: Planning isolation begins before the first artifact write
The system SHALL protect unrelated checkout state before Plan writes its primary artifact.

#### Scenario: Primary checkout is dirty
- **WHEN** Plan is about to write the artifact
- **THEN** it records the primary branch, HEAD, changed paths, untracked paths, and diff fingerprint and creates or verifies a dedicated planning worktree
- **AND** completion proves the primary snapshot is unchanged

### Requirement: Plan creates one native planning checkpoint
The system SHALL create one native artifact-only planning commit after local artifact validation and automatic review pass.

#### Scenario: OpenSpec task audit is current
- **WHEN** Plan prepares an OpenSpec planning checkpoint or publication
- **THEN** it runs the deterministic OpenSpec task audit and retains status, exact tasks fingerprint, unit/work-item IDs, next deliverable, manual pending items, and errors task-locally
- **AND** only `status: pass` for the current artifact fingerprint advances

#### Scenario: Atomic plan has no OpenSpec task audit
- **WHEN** the reviewed route is an atomic plan file
- **THEN** the checkpoint records task audit as `not_applicable` with the reviewed route

#### Scenario: Planning checkpoint is created
- **WHEN** the artifact is validated, reviewer-clean, and isolated in its task-owned planning worktree
- **THEN** Plan stages only the primary plan/OpenSpec paths and creates a native hook-enabled commit
- **AND** no implementation or private support artifact enters the commit

#### Scenario: Planning hook changes reviewed content
- **WHEN** a commit hook modifies or rejects the planning artifact
- **THEN** Plan fixes or accepts the hook-produced artifact, revalidates it, and reruns affected reviewers before completion
- **AND** it does not publish stale review evidence

### Requirement: Plan owns planning-only hosted publication
The system SHALL publish every Plan artifact through a separate planning-only PR or MR according to the repository's provider policy.

#### Scenario: Planning artifact is published
- **WHEN** the native planning checkpoint and common Linear gate are complete
- **THEN** Plan pushes the planning branch and creates or updates a PR/MR containing the artifact but no implementation
- **AND** the hosted description contains only team-relevant problem, scope, decisions, trade-offs, delivery shape, Linear links, and requested feedback

#### Scenario: Plan-only request stops in hosted review
- **WHEN** the original request authorized Plan but not implementation
- **THEN** Plan stops with the planning PR/MR open or blocked
- **AND** it does not enter Execute

#### Scenario: Compound request waits for exact-head approval
- **WHEN** the original request authorized implementation after Plan
- **THEN** the workflow enters Execute only after required hosted planning checks, feedback, and approvals pass for the exact planning head

#### Scenario: Run-level handoff requests push only
- **WHEN** the user explicitly asks to push the reviewed planning branch and continue PR/MR creation elsewhere
- **THEN** Plan evaluates the exact-HEAD branch-transport publication checkpoint, pushes the selected remote branch, verifies the remote SHA, and reports `planning_branch_pushed`
- **AND** it does not create or update the hosted review artifact in that run
- **AND** the handoff contains provider, remote/ref, verified remote SHA, branch, target base/SHA, artifact path/fingerprint, validation and task-audit results, reviewer freshness, hook evidence, clean state, ownership release, Linear state, and remaining gates

#### Scenario: Publication checkpoint is stale or blocked
- **WHEN** the target base, exact clean HEAD, planning-only diff, reviewed fingerprint, hook evidence, provider route, or required gate is missing, stale, or blocked
- **THEN** Plan does not publish
- **AND** a branch-transport checkpoint may carry pending Linear state only when it grants no MR, rehearsal, or Execute authority

#### Scenario: Receiving machine resumes a push-only handoff
- **WHEN** another machine receives `planning_branch_pushed`
- **THEN** it verifies live remote/ref/SHA, base, artifact, worktree ownership, and Linear state
- **AND** it reruns any private review evidence that cannot be recovered

### Requirement: Planning feedback remains Plan work
The system SHALL route hosted planning feedback back to Plan and SHALL revalidate every affected planning surface before the head can be approved.

#### Scenario: Planning feedback changes the artifact
- **WHEN** hosted review finds a planning issue
- **THEN** Plan revises the artifact, updates affected Linear records, reruns validation and automatic reviewers, and creates a new native commit
- **AND** hosted review freshness resets for the new head

#### Scenario: Planning feedback asks for implementation
- **WHEN** a planning PR/MR comment requests code changes
- **THEN** Plan records the request as a planned unit, deferred item, or scope decision
- **AND** it does not implement code in the planning branch

#### Scenario: Cross-cutting change appears after implementation starts
- **WHEN** a change affects several delivery units or the approved architecture
- **THEN** the workflow returns to Plan and updates the open planning PR/MR or creates a focused planning-amendment PR/MR when the original has merged
- **AND** affected descendant reviews and rehearsal evidence become stale

#### Scenario: Cross-unit contract change is rerouted
- **WHEN** a cross-cutting change appears after implementation writers exist
- **THEN** affected writers freeze, the planning branch or amendment carries the contract delta, and approved Linear records are refreshed
- **AND** local and hosted planning review, rehearsal, new stack-base establishment, descendant restacking, and exact-head rereview complete before affected execution resumes

### Requirement: Plan artifacts remain durable through delivery
The system SHALL preserve atomic plans as durable repository records and SHALL keep OpenSpec active until its implementation stack completes.

#### Scenario: Atomic implementation completes
- **WHEN** the atomic implementation MR merges
- **THEN** the `.agents/plans/<slug>.md` artifact remains in the repository
- **AND** Finish does not delete it merely to mark completion

#### Scenario: OpenSpec implementation is active
- **WHEN** one or more OpenSpec delivery units remain incomplete
- **THEN** the OpenSpec change remains active and is updated by associated implementation MRs

#### Scenario: Plan is abandoned or superseded
- **WHEN** an approved artifact will not be implemented or is replaced
- **THEN** Plan records the team-facing disposition explicitly
- **AND** Finish does not mark it completed silently
