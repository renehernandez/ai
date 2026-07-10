## MODIFIED Requirements

### Requirement: Single Stacked Delivery Mode
The system SHALL use a planning PR/MR as the reviewed base for every planned implementation and SHALL derive atomic or multi-unit stack shape from the primary artifact.

#### Scenario: Atomic plan uses two review artifacts
- **WHEN** Plan produces one atomic plan with one delivery unit
- **THEN** delivery uses one planning PR/MR containing only the plan and one implementation PR/MR stacked on the planning branch
- **AND** it does not create a POC unless the user explicitly requests one

#### Scenario: OpenSpec uses planning rehearsal and delivery artifacts
- **WHEN** Plan produces an OpenSpec with several delivery units
- **THEN** delivery uses one planning PR/MR, one closed-unmerged full-rehearsal PR/MR, and one implementation PR/MR per delivery-unit heading
- **AND** nested checkbox work items become cohesive commits inside their unit MR rather than separate MRs

#### Scenario: Planning review is the stack base
- **WHEN** the exact planning head passes required local and hosted planning gates, the common Linear gate, and any mandatory rehearsal
- **THEN** implementation records the planning branch and SHA as the expected stack base

#### Scenario: OpenSpec planning head becomes eligible for rehearsal
- **WHEN** the exact planning head has passed local artifact review, has a planning PR/MR, satisfies the common Linear gate, and has clean or resolved latest-head hosted planning feedback
- **THEN** Plan may create the rehearsal artifact
- **AND** final planning approval remains pending until accepted rehearsal and resulting planning revisions complete

#### Scenario: Direct Execute remains outside planned orchestration
- **WHEN** a small unambiguous request qualifies for direct Execute without a Plan artifact
- **THEN** it may produce one implementation PR/MR without a planning predecessor
- **AND** it still satisfies automatic Review and provider policy

### Requirement: Nitro-Capable Hosted Route
The system SHALL require Nitro only when the active work profile or project policy selects Nitro for the current GitLab artifact.

#### Scenario: Fullscript GitLab route selects Nitro
- **WHEN** Plan, POC, or Finish operates on a Fullscript GitLab project whose policy requires Nitro
- **THEN** it requests Nitro feedback using the configured review-request contract
- **AND** Nitro must pass for the latest required head

#### Scenario: GitHub uses its configured route
- **WHEN** the artifact host is GitHub
- **THEN** the workflow uses GitHub PR, CI, approval, and configured automated-review policies
- **AND** absence of Nitro does not block the lifecycle

#### Scenario: Generic GitLab uses its configured route
- **WHEN** the artifact host is non-Fullscript GitLab
- **THEN** the workflow uses that project's MR, CI, approval, and automated-review policies

#### Scenario: Provider route is ambiguous
- **WHEN** repository host or required provider policy cannot be determined
- **THEN** publication blocks with the routing gap
- **AND** completed local Plan, Execute, or Review work remains valid for its exact state

### Requirement: Shared Nitro Feedback Gate
The system SHALL normalize Nitro feedback through `nitro_feedback_gate` only for artifacts whose active project or work-profile policy requires Nitro.

#### Scenario: Selected Nitro start timeout blocks progress
- **WHEN** Nitro is required for the latest head and does not acknowledge or start within the project-defined timeout
- **THEN** the workflow reports `nitro_review_start_blocked`
- **AND** it does not treat the artifact as approved or merge-ready

#### Scenario: Selected Nitro pending does not pass completion
- **WHEN** required Nitro feedback status is pending
- **THEN** the workflow records review-start evidence and reports completion pending

#### Scenario: Selected latest-head findings block advancement
- **WHEN** required Nitro returns actionable findings for the latest head
- **THEN** the owning Plan or Execute mode fixes or dispositions the findings
- **AND** a material new head requires fresh Nitro feedback

#### Scenario: Selected stale Nitro feedback does not pass
- **WHEN** required Nitro feedback belongs to an older artifact head
- **THEN** the workflow reports it stale and requests fresh feedback for the current head

#### Scenario: Selected clean Nitro feedback passes
- **WHEN** required Nitro completes latest-head review with no unresolved actionable findings
- **THEN** the Nitro gate outcome is `passed`

#### Scenario: Nitro is not selected
- **WHEN** the active provider policy does not require Nitro
- **THEN** the workflow relies on the configured local reviewers, hosted automated review, approvals, and CI
- **AND** it does not synthesize a Nitro requirement

### Requirement: Material Push Feedback Refresh
The system SHALL refresh every provider review that active policy binds to the latest head after a material head-changing push.

#### Scenario: Feedback fix refreshes required review
- **WHEN** Plan, the POC owner, or Execute pushes a material feedback fix
- **THEN** the owning mode requests fresh configured hosted feedback for the new head

#### Scenario: Restack or conflict fix refreshes required review
- **WHEN** an artifact head changes because of restack, conflict repair, pipeline repair, user edit, rebase, or material plan/spec change
- **THEN** every latest-head-bound automated review reruns before approval or merge readiness

#### Scenario: Provider policy has no latest-head automated reviewer
- **WHEN** active policy does not configure such a reviewer
- **THEN** the workflow uses remaining approvals and CI gates
- **AND** local automatic Review remains required

### Requirement: Stack Identity Evidence
The system SHALL carry live stack identity through planning, rehearsal, implementation, and merge follow-through without persisting private local reviewer state in team artifacts.

#### Scenario: Planning artifact records stack base
- **WHEN** planning review completes
- **THEN** private task state records planning branch, exact head SHA, target base, hosted artifact URL, and approval freshness

#### Scenario: POC records sibling identity
- **WHEN** the full rehearsal is created or updated
- **THEN** task state records the planning head rehearsed, POC branch/head, draft artifact URL, and acceptance freshness
- **AND** the POC is never recorded as an implementation predecessor

#### Scenario: Implementation artifact records predecessor
- **WHEN** an implementation PR/MR is created or updated
- **THEN** task state records predecessor artifact, expected base ref/SHA, implementation URL, head SHA, delivery-unit ID, and restack-required state

#### Scenario: Hosted stack linearizes logical dependencies
- **WHEN** task units have several logical prerequisites
- **THEN** each hosted implementation branch still has exactly one Git predecessor in the declared linear order
- **AND** the workflow does not create an implicit multi-parent join

#### Scenario: Team artifact is rendered
- **WHEN** a PR/MR description or Linear issue is created
- **THEN** it includes team-relevant stack links and dependencies
- **AND** it omits internal reviewer identities, fingerprints, ledgers, and local handoff paths

### Requirement: Stack-Ready Completion
The system SHALL report planned delivery ready only when the planning artifact and every implementation artifact satisfy current local, provider, Linear, and stack-integrity gates.

#### Scenario: Atomic artifact is stack-ready
- **WHEN** one planning PR/MR and one implementation PR/MR have current required reviews, approvals, CI, and valid base/head identity
- **AND** the common Linear gate passes and any mapped issue is in the provider-appropriate review state
- **THEN** Finish reports `stack_ready`

#### Scenario: OpenSpec stack is ready
- **WHEN** the planning PR/MR is approved, the full rehearsal is accepted and closed unmerged, every delivery-unit PR/MR has current required reviews/CI, and stack relationships are valid
- **AND** the stack-tip OpenSpec tasks and the common Linear gate account for every completed unit
- **THEN** Finish reports `stack_ready`

#### Scenario: Final task evidence is incomplete
- **WHEN** parsed stack-tip `tasks.md` contains an unchecked delivery unit or nested work item, or a checked item lacks an implementation artifact, exact HEAD, predecessor, or verification evidence
- **THEN** `stack_ready` is blocked
- **AND** self-attested task completion cannot replace artifact evidence

#### Scenario: Next dependent unit begins before hosted completion
- **WHEN** the predecessor implementation unit has passed local Review, has a published PR/MR, and the child heading declares `Hosted predecessor gate: concurrent`
- **THEN** Execute may begin the child on a stacked worktree while hosted review runs concurrently

#### Scenario: Hosted predecessor gate is required
- **WHEN** the child heading declares `Hosted predecessor gate: required`
- **THEN** Execute waits for predecessor latest-head hosted review and CI in addition to local Review and publication

#### Scenario: Hosted predecessor marker is missing or invalid
- **WHEN** Plan validation, task audit, or resume cannot establish `required|concurrent`
- **THEN** planning publication blocks or resume uses safe default `required`
- **AND** only Plan may change the durable marker

#### Scenario: Earlier artifact changes after descendants exist
- **WHEN** an earlier planning or implementation artifact changes after descendants exist
- **THEN** affected descendants are restacked and every changed exact head reruns required local and hosted gates

#### Scenario: Unqualified Finish reaches readiness
- **WHEN** all required stack gates pass and the user did not authorize merge
- **THEN** Finish reports `stack_ready` and does not merge

#### Scenario: Unit 8 runtime activation gate is missing or failed
- **WHEN** Unit 8 is in the stack and its Finish-owned `runtime_activation_gate` has not passed for the exact reviewed head
- **THEN** Unit 8 publication, `ready_to_finish`, and `stack_ready` remain blocked
- **AND** failed activation restores previous values of touched managed entries

#### Scenario: Unit 8 transitions through activation
- **WHEN** Unit 8 Review passes for the immutable head
- **THEN** Review emits `review_complete` and `activation_ready`, authorized Finish runs activation, and Finish emits `ready_to_finish` only after success

#### Scenario: Explicit merge continues bottom-to-top
- **WHEN** the user explicitly authorizes merge
- **THEN** Finish merges the planning artifact and implementation artifacts bottom-to-top, rechecks retargeted descendants, and verifies remote merged state

### Requirement: Rule And Runtime Alignment
The system SHALL align shared instructions, mode skills, specialist helpers, runtime profiles, provider rules, and verification with the five-mode lifecycle.

#### Scenario: Personal profile is provider-neutral
- **WHEN** personal instructions or mode skills describe planning and delivery
- **THEN** they do not require Fullscript GitLab, Nitro, or a specific host globally

#### Scenario: Work profile preserves Fullscript policy
- **WHEN** the work profile is installed for a Fullscript project
- **THEN** Fullscript GitLab, Nitro, CI, approval, and review-request requirements remain available through project/work rules and internal provider helpers

#### Scenario: Lifecycle discoverability is validated
- **WHEN** personal or work runtime profiles are built
- **THEN** validation finds exactly five public lifecycle entries and the configured retained specialists
- **AND** no retired lifecycle package is installed as a competing entrypoint

#### Scenario: Runtime refresh proves installed behavior
- **WHEN** shared mode skills, specialist helper routing, instructions, rules, hooks, or OpenSpec assets change
- **THEN** update, status, and validation run for every affected personal/work and repo-local surface

## ADDED Requirements

### Requirement: OpenSpec changes stay associated with delivery units
The system SHALL update an OpenSpec change in the implementation PR/MR whose delivery unit introduces the contract change and SHALL avoid a final reconciliation-only artifact.

#### Scenario: One unit changes its contract
- **WHEN** implementation changes that unit's proposal, design, requirement, scenario, acceptance, verification, or task state
- **THEN** the same implementation PR/MR carries the OpenSpec and Linear updates
- **AND** automatic Review covers the combined diff

#### Scenario: Change affects several units
- **WHEN** implementation reveals a cross-unit architecture or delivery change
- **THEN** affected writers freeze and the workflow returns the contract delta to the planning branch or a focused amendment
- **AND** approved Linear state, local and hosted planning review, rehearsal, stack base, descendant restacking, and exact-head reviews refresh before affected execution resumes

#### Scenario: Final unit completes the OpenSpec
- **WHEN** the last implementation unit inherits all earlier completed task/spec changes and completes its own work
- **THEN** its PR/MR carries only its own necessary changes plus OpenSpec archival
- **AND** no separate spec-reconciliation PR/MR is created
