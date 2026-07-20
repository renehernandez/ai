# review-first-plan-orchestration Specification

## Purpose
Define the reviewed planning workflow for plan and OpenSpec delivery, including
stacked implementation artifacts, Nitro feedback gates, stack integrity, and
runtime alignment requirements.
## Requirements
### Requirement: Nitro-Capable Hosted Route
The system SHALL require Nitro only when direct user, project, or workflow-policy profile selects it for the current GitLab artifact.

#### Scenario: Fullscript GitLab selects Nitro
- **WHEN** a POC or final MR belongs to a Fullscript project whose policy requires Nitro
- **THEN** Finish posts the configured review request
- **AND** Nitro must pass for the latest required head

#### Scenario: GitHub route is selected
- **WHEN** the artifact host is GitHub
- **THEN** the workflow uses configured GitHub review, CI, and approval policy
- **AND** absence of Nitro does not block

#### Scenario: Generic GitLab route is selected
- **WHEN** the artifact host is non-Fullscript GitLab
- **THEN** the workflow uses that project's MR, CI, approval, and automated-review policy

#### Scenario: Provider policy is ambiguous
- **WHEN** host or required reviewer policy cannot be resolved
- **THEN** publication blocks with the routing gap
- **AND** completed local work remains valid for its exact state

### Requirement: Shared Nitro Feedback Gate
The system SHALL normalize Nitro feedback only for artifacts whose active policy requires Nitro.

#### Scenario: Required Nitro does not start
- **WHEN** Nitro is required for the latest head and does not acknowledge or start within project policy
- **THEN** the workflow reports the current blocked state
- **AND** does not treat the artifact as approved

#### Scenario: Required Nitro is pending
- **WHEN** latest-head Nitro feedback is pending
- **THEN** completion remains pending

#### Scenario: Required Nitro has findings
- **WHEN** Nitro returns actionable findings for the latest head
- **THEN** the owning Plan or Execute mode fixes or dispositions them
- **AND** every new head requires fresh feedback

#### Scenario: Nitro feedback is stale
- **WHEN** required feedback belongs to an older head
- **THEN** it does not satisfy the gate

#### Scenario: Required Nitro is clean
- **WHEN** Nitro completes latest-head review without unresolved actionable findings
- **THEN** the Nitro gate passes

#### Scenario: Nitro is not selected
- **WHEN** active policy does not require Nitro
- **THEN** the workflow relies on configured local review, hosted automation, approvals, and CI

### Requirement: Material Push Feedback Refresh
The system SHALL refresh each provider review bound to the latest head after every head-changing push.

#### Scenario: Feedback fix changes the head
- **WHEN** Plan or Execute pushes a feedback fix
- **THEN** Finish requests current configured hosted feedback for the new head

#### Scenario: Other material change occurs
- **WHEN** a head changes through conflict repair, pipeline repair, user edit, rebase, or spec/implementation correction
- **THEN** every latest-head-bound gate refreshes before readiness

#### Scenario: Provider has no latest-head automated reviewer
- **WHEN** active policy configures no hosted automated reviewer
- **THEN** remaining approvals and CI apply
- **AND** local Review remains required

### Requirement: Stack Identity Evidence
The system SHALL carry live identity for the POC and every final delivery unit without persisting private reviewer state in team artifacts.

#### Scenario: Planned delivery shape is recorded
- **WHEN** local planning review completes
- **THEN** task state records the normal target base, logical dependencies, total Git predecessor order, and expected final artifact count
- **AND** every unit after the first has exactly one Git predecessor even when logical work could run independently

#### Scenario: POC identity is recorded
- **WHEN** the full POC is created or updated
- **THEN** task state records planning commit, POC branch/head, draft URL, target base, review freshness, personal-acceptance status, and accepted SHA
- **AND** the POC is never an implementation predecessor

#### Scenario: Final unit identity is recorded
- **WHEN** a final delivery-unit PR/MR is created or updated
- **THEN** task state records unit ID, branch/head, target base or predecessor, artifact URL, and current gate state

#### Scenario: Team-facing artifact is rendered
- **WHEN** a POC or final description is created
- **THEN** it contains team-relevant scope, unit/dependency links, decisions, verification, and review intent
- **AND** omits local fingerprints, reviewer identities, ledgers, and handoff paths

### Requirement: Stack-Ready Completion
The system SHALL report planned delivery ready only when the POC and every artifact derived from the reviewed delivery shape satisfy current gates.

#### Scenario: Atomic plan is ready
- **WHEN** its one final MR passes required local review, provider review, CI, and applicable Linear policy
- **THEN** Finish reports merge readiness for that exact head

#### Scenario: OpenSpec stack is ready
- **WHEN** the POC is accepted and closed unmerged, every final delivery-unit MR passes current local/provider/CI gates, task/spec state is complete, dependencies are valid, and required Linear mappings are current
- **THEN** Finish reports `stack_ready`

#### Scenario: OpenSpec has one delivery unit
- **WHEN** its POC is accepted and its one final MR passes every current gate
- **THEN** Finish reports merge readiness for that MR without manufacturing a multi-MR stack

#### Scenario: Earlier unit changes
- **WHEN** an earlier delivery-unit head changes after dependent units exist
- **THEN** affected descendants restack and every changed exact head refreshes local and hosted gates

#### Scenario: Predecessor squash-merges
- **WHEN** a predecessor merges as a squash commit
- **THEN** its child retargets to the default branch and restacks onto the verified merged commit
- **AND** changed child/descendant heads refresh required gates before their merge

#### Scenario: Task evidence is incomplete
- **WHEN** a reconciled task is unchecked or a completed task lacks implementation and verification evidence
- **THEN** stack readiness is blocked

#### Scenario: Finish lacks merge authority
- **WHEN** every readiness gate passes without explicit merge authority
- **THEN** Finish reports readiness and does not merge

#### Scenario: Merge is authorized
- **WHEN** the user explicitly authorizes merge
- **THEN** Finish merges final artifacts in dependency order after current checks, approvals, and remote identity pass
- **AND** verifies remote merged state

### Requirement: Rule And Runtime Alignment
The system SHALL align shared instructions, mode skills, retained specialists, runtime profiles, provider rules, and verification with five-mode artifact-shaped delivery.

#### Scenario: Personal profile is provider-neutral
- **WHEN** personal instructions describe planning and delivery
- **THEN** they do not require a specific host or Nitro globally

#### Scenario: Work profile preserves Fullscript policy
- **WHEN** work policy is active in a Fullscript project
- **THEN** GitLab, Nitro, CI, approval, and review-request requirements remain available behind Review and Finish

#### Scenario: Lifecycle discoverability is validated
- **WHEN** personal or work profiles are built
- **THEN** validation finds exactly five public lifecycle entries and configured retained specialists
- **AND** no retired lifecycle package is installed

#### Scenario: Runtime proof runs before merge
- **WHEN** shared modes, instructions, rules, hooks, or AX behavior change
- **THEN** sync, status, and validation run against isolated roots
- **AND** live runtime remains unchanged until verified merged source is available

### Requirement: OpenSpec delivery uses a POC and task-shaped final artifacts
The system SHALL use one draft unmergeable POC artifact and one mergeable final implementation artifact per top-level OpenSpec delivery unit.

#### Scenario: Initial planning completes
- **WHEN** the OpenSpec passes local planning review
- **THEN** it remains on a local planning-base branch without a separate planning PR/MR
- **AND** the first final delivery unit later includes the reconciled planning-base commits

#### Scenario: POC is published
- **WHEN** full implementation rehearsal is ready
- **THEN** one draft POC PR/MR contains the initial OpenSpec and complete implementation against the normal target branch
- **AND** it closes unmerged after current automated and personal review

#### Scenario: Final implementation is published
- **WHEN** POC findings are reconciled and clean final implementation passes local review
- **THEN** each top-level delivery unit produces one final mergeable PR/MR with its associated specification and implementation changes
- **AND** no planning or reconciliation-only artifact exists

#### Scenario: This change has one final artifact
- **WHEN** `simplify-ai-experience-modes` retains one top-level delivery unit
- **THEN** it produces one final mergeable implementation MR after the POC

#### Scenario: Direct Execute is eligible
- **WHEN** a request qualifies for direct Execute without a planning artifact
- **THEN** it may produce one implementation PR/MR without a POC
- **AND** local Review and provider policy still apply

### Requirement: OpenSpec changes stay in owning final artifacts
The system SHALL include each unit's task/spec changes in its implementation MR and SHALL make completed-change archival part of the last unit's exact implementation head.

#### Scenario: POC changes the contract
- **WHEN** personal POC review completes with durable findings
- **THEN** Plan reconciles those findings once before final implementation

#### Scenario: Final implementation completes the change
- **WHEN** the final implementation satisfies every reconciled task and requirement
- **THEN** Execute completes task state, synchronizes delta specs into canonical specs, and moves the change into the dated archive before the final hook-clean commit and draft publication
- **AND** planning reviewers inspect the resulting canonical-spec/archive diff on the same exact implementation head
- **AND** no later spec-only MR is required

#### Scenario: Final closure state is incomplete
- **WHEN** a reconciled task or requirement is incomplete or unverified
- **THEN** the change remains active and completed-change archival is blocked

#### Scenario: Archive state changes after review
- **WHEN** a later archive or canonical-spec repair changes the final-unit head
- **THEN** prior exact-head review and hosted evidence become stale

#### Scenario: Final implementation discovers a material delta
- **WHEN** final implementation requires a contract change beyond the reconciled OpenSpec
- **THEN** work returns to Plan and the user decides whether another POC is required

### Requirement: Pre-cutover workflow bootstraps this one-unit migration
The system SHALL use current bounded workflow mechanics to deliver this change without importing a separate planning MR or unnecessary multi-unit stack.

#### Scenario: Initial spec is committed
- **WHEN** this change is locally reviewed before the five modes exist
- **THEN** the current root session and explicit OpenSpec apply workflow own the final-delivery worktree
- **AND** current repository commit rules remain in force

#### Scenario: POC mechanics run
- **WHEN** the draft POC is created or reviewed
- **THEN** current POC, GitLab publication, and Nitro adapters may provide bounded mechanics
- **AND** they create no planning MR or implementation stack

#### Scenario: Final implementation resumes
- **WHEN** the POC closes and reconciliation completes
- **THEN** execution returns to the original final-delivery branch under the user's single-MR instruction
- **AND** current `ax commit` remains the commit path until the final source cutover removes it
