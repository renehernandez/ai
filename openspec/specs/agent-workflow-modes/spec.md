# agent-workflow-modes Specification

## Purpose
TBD - created by archiving change simplify-ai-experience-modes. Update Purpose after archive.
## Requirements
### Requirement: Five-mode public lifecycle
The system SHALL expose Explore, Plan, Execute, Review, and Finish as the only inferred lifecycle modes while retaining bounded specialist capabilities.

#### Scenario: Ordinary language selects a mode
- **WHEN** a user asks to discover, plan, implement, review, or finish work without naming a skill
- **THEN** the system selects the corresponding lifecycle mode
- **AND** an explicit mode name overrides inference

#### Scenario: Specialist capability stays bounded
- **WHEN** the user invokes research, Linear breakdown, documentation, security, code quality, project health, AX, or another retained specialist
- **THEN** the specialist runs with its declared authority
- **AND** it does not become a sixth lifecycle mode or grant unrelated mutation authority

#### Scenario: Legacy lifecycle package is inspected
- **WHEN** an installed personal or work profile is validated
- **THEN** retired startup, planning, delivery, provider, feedback, and merge packages, including `session-start`, are absent as public entrypoints
- **AND** their retained behavior is available through the owning mode

### Requirement: OpenSpec developer commands are explicit-only
The system SHALL route ordinary discovery, planning, implementation, and completion requests through the five modes when repo-local OpenSpec assets exist.

#### Scenario: Ordinary request resembles an OpenSpec operation
- **WHEN** the user asks in ordinary language to explore, propose, implement, or archive a change
- **THEN** the owning lifecycle mode is selected
- **AND** no `openspec-*` adapter is inferred

#### Scenario: Developer explicitly invokes OpenSpec
- **WHEN** the user names an `openspec-*` adapter or `/opsx:*` command
- **THEN** that adapter may run as an explicit developer command
- **AND** its authority remains limited to the invoked OpenSpec operation

### Requirement: Mode authority is visible and bounded
The system SHALL announce non-trivial mode entry and authority expansion once and SHALL not infer authority beyond the request or activated project policy.

#### Scenario: Non-trivial mode begins
- **WHEN** non-trivial work begins or changes mode
- **THEN** the system reports the mode, mutation authority, and goal once

#### Scenario: Compound request authorizes a sequence
- **WHEN** the user requests planning, implementation, review, and publication in one prompt
- **THEN** the workflow may traverse those authorized modes
- **AND** merge, deployment, and cleanup remain unauthorized unless separately granted

#### Scenario: Narrow request limits later modes
- **WHEN** the user says Explore-only, Plan-only, Execute-only, Review-only, local-only, or equivalent limiting language
- **THEN** the workflow stops at that authority boundary
- **AND** it does not publish or perform terminal actions

### Requirement: Explore remains read-only
The system SHALL use Explore for discovery, research, project intake, divergent brainstorming, and assumption testing without repository or external writes.

#### Scenario: Exploration ends conversationally
- **WHEN** the user asks to investigate, compare, research, or refine an idea
- **THEN** Explore returns evidence, options, decisions, or open questions
- **AND** it creates no planning artifact

#### Scenario: Project-intake request produces initial context
- **WHEN** the user asks to start, scope, map, or kick off a project
- **THEN** Explore returns a Project Context Pack and initial Linear-ready project description in chat
- **AND** it creates no tracker, branch, commit, PR, or MR state

#### Scenario: Organic convergence needs Plan authority
- **WHEN** Explore converges on an approach without a direct planning instruction
- **THEN** it proposes Plan and waits before writing an artifact

### Requirement: Routing is semantic
The system SHALL select Direct Execute, an atomic Plan, or OpenSpec from unresolved decisions and contract needs without file-count or line-count thresholds.

#### Scenario: Clear coherent work enters Execute
- **WHEN** the request fits one coherent implementation MR and has no unresolved behavior, architecture, migration, safety, ownership, ordering, cross-component, or verification decision
- **THEN** the system may enter Execute without a planning artifact
- **AND** worktree, hook, Review, and Finish rules still apply

#### Scenario: Material decision remains
- **WHEN** any material implementation decision is unresolved
- **THEN** the request enters Plan before implementation writes begin

#### Scenario: Direct Execute discovers a planning need
- **WHEN** implementation reveals a material unresolved decision
- **THEN** Execute freezes writes and returns the decision and current worktree identity to Plan
- **AND** it does not continue under the direct path

#### Scenario: Plan selects an atomic artifact
- **WHEN** one coherent MR is expected and the work does not require a durable cross-cutting specification or mandatory full rehearsal
- **THEN** Plan creates one atomic plan

#### Scenario: Plan selects OpenSpec
- **WHEN** the work has several independently reviewable delivery units, changes a durable cross-component contract, requires migration design, or requires the full POC gate
- **THEN** Plan creates one OpenSpec change

#### Scenario: User selects a coherent route
- **WHEN** the user explicitly chooses atomic Plan or OpenSpec and the route can represent the accepted contract
- **THEN** Plan uses that route without applying numeric thresholds

### Requirement: One writer owns each review artifact
The system SHALL coordinate one write owner and dedicated branch/worktree for each planning, POC, or final implementation artifact while keeping reviewers read-only.

#### Scenario: Owner writes in an isolated worktree
- **WHEN** Plan or Execute gains write authority
- **THEN** it verifies or creates a dedicated branch and worktree
- **AND** exactly one owner may edit, stage, and commit there

#### Scenario: Parallel writers are independent
- **WHEN** independent work is delegated to another writer
- **THEN** that writer receives a different branch/worktree and disjoint file ownership

#### Scenario: Ownership transfers
- **WHEN** another session or agent takes over a worktree
- **THEN** the handoff identifies branch, worktree, HEAD, changed paths, untracked paths, and diff fingerprint
- **AND** the previous owner stops writing before transfer

#### Scenario: Ownership cannot be proven
- **WHEN** a worktree is dirty, shared, divergent from its handoff, or has unknown ownership
- **THEN** writes block or move to a new isolated worktree

#### Scenario: Uncoordinated external process writes
- **WHEN** a process outside the coordinated task changes the worktree
- **THEN** ownership evidence becomes stale and writes block
- **AND** the workflow does not claim a cross-process lease

### Requirement: Repository hooks own commit verification
The system SHALL use native hook-enabled Git commits after the five-mode cutover and SHALL never bypass repository hooks.

#### Scenario: Cohesive boundary becomes a commit
- **WHEN** a planning or implementation boundary satisfies repository invariants
- **THEN** the owner stages only that boundary and commits without `--no-verify`

#### Scenario: Hook failure occurs
- **WHEN** a commit hook fails
- **THEN** the owner fixes and restages the current boundary before retrying
- **AND** it does not push or begin a later boundary first

#### Scenario: Hook evidence is unavailable after resume
- **WHEN** Review cannot establish current hook success for the exact HEAD
- **THEN** the workflow reruns the required verification or blocks

### Requirement: Review baseline matches the target
The system SHALL automatically review every written or changed planning artifact, POC head, and final implementation head with a target-specific read-only baseline.

#### Scenario: Plan or OpenSpec is reviewed
- **WHEN** a planning artifact is written or materially changed
- **THEN** Review launches implementation-readiness, edge-case/risk, simplification/scope, and refactoring reviewers
- **AND** adds affected-domain specialists

#### Scenario: POC or final implementation is reviewed
- **WHEN** a POC or final implementation diff/head is ready
- **THEN** Review launches correctness, regression, maintainability, and verification reviewers
- **AND** adds affected-domain specialists

#### Scenario: Hosted gates are evaluated
- **WHEN** provider comments, automated review, approvals, or CI are configured
- **THEN** Finish evaluates them as provider gates
- **AND** they do not replace the local reviewer baseline

#### Scenario: Finding preserves the contract
- **WHEN** Review finds an in-scope actionable defect
- **THEN** the Plan or Execute owner fixes it and refreshes affected review evidence

#### Scenario: Finding changes the contract
- **WHEN** Review identifies a material scope, architecture, safety, or delivery change
- **THEN** the workflow returns to Plan

#### Scenario: Target changes
- **WHEN** reviewed artifact content or implementation HEAD changes
- **THEN** evidence tied to the previous target becomes stale

### Requirement: Review produces an exact-head publication checkpoint
The system SHALL replace persisted AX review-gate state with a task-local publication checkpoint consumed by Finish.

#### Scenario: Publication checkpoint is ready
- **WHEN** the exact implementation HEAD has current target-base diff inspection, hook evidence, required local reviewers, provider route, and no blockers
- **THEN** Review emits `publication_checkpoint` bound to that HEAD and base

#### Scenario: Publication target changes
- **WHEN** HEAD or target base changes after the checkpoint
- **THEN** the checkpoint becomes stale and Review recomputes it before provider mutation

#### Scenario: Checkpoint evidence is unavailable
- **WHEN** a resumed task cannot recover the checkpoint
- **THEN** Review reruns its inputs rather than reconstructing persisted AX gate state

### Requirement: Local orchestration evidence remains private
The system SHALL keep reviewer identities, transcripts, fingerprints, retries, handoffs, and mode state out of committed artifacts, tracker records, and hosted descriptions.

#### Scenario: Evidence is current
- **WHEN** local review completes
- **THEN** the task retains the evidence for routing
- **AND** durable team surfaces contain only work-relevant content

#### Scenario: Evidence is missing
- **WHEN** a resumed task cannot recover exact review evidence
- **THEN** it reruns the required reviewers
- **AND** it creates no sidecar, Git note, AX record, or hosted ledger

### Requirement: Finish owns publication and terminal actions
The system SHALL use Finish for implementation publication, hosted feedback follow-through, merge readiness, and explicitly authorized terminal actions.

#### Scenario: Delivery-authorized implementation publishes
- **WHEN** Execute and local Review complete under an implementation or delivery request
- **THEN** Finish pushes or updates each configured delivery-unit PR/MR and follows hosted gates
- **AND** it does not merge

#### Scenario: Hosted finding returns to Execute
- **WHEN** hosted review reports an actionable latest-head implementation finding
- **THEN** Review retrieves and normalizes the finding, and Finish routes it to the same Execute owner
- **AND** local Review and hosted gates refresh for the changed head

#### Scenario: Hosted review is requested or polled
- **WHEN** a provider mutation or polling action is required
- **THEN** Finish performs it and hands provider, artifact URL, target base, head SHA, normalized status, and findings to Review

#### Scenario: Provider route is resolved
- **WHEN** Finish selects a host and reviewer policy
- **THEN** direct user instruction overrides project policy, which overrides profile policy, which overrides remote inference
- **AND** ambiguous routing blocks publication

#### Scenario: Merge is explicitly authorized
- **WHEN** the user says merge, ship, merge when green, or equivalent terminal language
- **THEN** Finish may merge after current checks, approvals, and review gates pass
- **AND** it verifies remote merged state

#### Scenario: Deployment or cleanup is considered
- **WHEN** publication or merge completes
- **THEN** Finish deploys or removes branches/worktrees only under explicit authority or activated project policy

#### Scenario: Publication-only wording is used
- **WHEN** the user says implement, deliver, or proceed without merge language
- **THEN** Finish may publish and follow review feedback
- **AND** it does not merge

#### Scenario: OpenSpec stack reaches readiness
- **WHEN** every declared delivery-unit MR has current local/provider gates and valid predecessor identity
- **THEN** Finish reports stack readiness without merging

