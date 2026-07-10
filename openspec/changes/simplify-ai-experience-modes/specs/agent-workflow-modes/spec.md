## ADDED Requirements

### Requirement: Five-mode public lifecycle
The system SHALL expose Explore, Plan, Execute, Review, and Finish as the only public lifecycle modes while retaining bounded specialist capabilities.

#### Scenario: Ordinary language selects a mode
- **WHEN** a user asks to discover, plan, implement, review, or finish work without naming a skill
- **THEN** the system selects the corresponding lifecycle mode
- **AND** an explicit mode name overrides inference

#### Scenario: Specialist capability does not become a sixth mode
- **WHEN** the user invokes research, Linear breakdown, documentation, security, code quality, project health, AX, or another retained specialist
- **THEN** the specialist runs within the current or inferred lifecycle authority
- **AND** it does not grant unrelated write, publication, or terminal authority

#### Scenario: Legacy lifecycle entrypoint is unavailable
- **WHEN** an installed personal or work profile is inspected
- **THEN** brainstorming, start-project, plan readiness/review/orchestration, POC, unit sequencing/delivery, provider publication, feedback routing, and merge follow-through are not competing public lifecycle entries
- **AND** their required reusable behavior is reachable behind the owning mode

### Requirement: OpenSpec developer escape hatches are explicit-only
The system SHALL route ordinary discovery, planning, implementation, and completion requests through the five lifecycle modes even when repo-local OpenSpec assets are installed.

#### Scenario: Ordinary request resembles an OpenSpec operation
- **WHEN** the user asks in ordinary language to explore, propose, implement, or archive a change
- **THEN** the owning lifecycle mode is selected
- **AND** no `openspec-*` adapter is inferred

#### Scenario: Developer explicitly invokes OpenSpec
- **WHEN** the user names `$openspec-explore`, `$openspec-propose`, `$openspec-apply-change`, `$openspec-archive-change`, or an `/opsx:*` command
- **THEN** the generated adapter may run as an explicit developer command
- **AND** it does not become an inferred lifecycle mode

### Requirement: Mode authority is visible and bounded
The system SHALL announce non-trivial mode entry and authority expansion once and SHALL not infer authority beyond the user's request.

#### Scenario: Non-trivial mode begins
- **WHEN** non-trivial work begins or changes mode
- **THEN** the system reports the mode, write authority, and goal once
- **AND** it does not repeatedly narrate routine helper calls

#### Scenario: Compound request authorizes a sequence
- **WHEN** the user explicitly requests multiple lifecycle outcomes in one prompt
- **THEN** the system may traverse the authorized modes without repeated confirmation
- **AND** it announces each authority-expanding transition before acting

#### Scenario: Narrow request limits later modes
- **WHEN** the user says `Execute only`, `keep it local`, Plan-only, Review-only, or equivalent limiting language
- **THEN** the workflow stops at the named authority boundary
- **AND** it does not publish, merge, deploy, or clean up implicitly

### Requirement: Explore remains read-only
The system SHALL use Explore for discovery, research, project intake, divergent brainstorming, and assumption testing without writing files or external state.

#### Scenario: Exploration ends conversationally
- **WHEN** the user asks to investigate, compare options, research, or refine an idea
- **THEN** Explore may inspect repository and provider context read-only
- **AND** it returns findings, options, decisions, or open questions without creating a planning artifact

#### Scenario: Start Project produces initial context
- **WHEN** the user asks to start, scope, map, or kick off a project
- **THEN** Explore produces a Project Context Pack and initial Linear project description in chat
- **AND** it does not create a Linear project, issue, branch, commit, PR, or MR

#### Scenario: Organic convergence requests Plan
- **WHEN** Explore converges on an approach without a direct planning instruction
- **THEN** the system proposes entry into Plan and waits for agreement before gaining artifact-write authority

### Requirement: Direct Execute is limited to clear atomic work
The system SHALL allow a direct Execute path only for small, unambiguous implementation work that requires no material planning decision.

#### Scenario: Clear small request enters Execute
- **WHEN** the user explicitly requests implementation with one clear outcome, one implementation MR, one primary ownership area, one verification story, no more than 8 substantive files and 400 non-generated lines, and no architecture, migration, cross-component contract, material safety, ordering, or ambiguity decision
- **THEN** the system may enter Execute without a Plan artifact, planning PR/MR, mandatory Linear generation, or OpenSpec rehearsal
- **AND** all Execute, Review, hook, and delivery rules still apply

#### Scenario: Direct Execute discovers expanded scope
- **WHEN** implementation reveals material ambiguity, architecture, migration, safety, or multi-unit delivery work
- **THEN** Execute stops and returns to Plan
- **AND** it does not continue informally under the direct path

#### Scenario: Expanded scope is discovered after implementation exists
- **WHEN** direct Execute has dirty or committed partial work before the planning trigger appears
- **THEN** Execute freezes writes and forbids commit, push, and publication, then hands Plan the branch, worktree, base, HEAD, diff/commit identity, changed paths, and verification evidence privately
- **AND** Plan writes from the original target base while the partial branch remains quarantined

#### Scenario: Planned work resumes after direct escalation
- **WHEN** the new planning artifact and required gates pass
- **THEN** Execute starts from the reviewed planning base and does not reuse quarantined work automatically
- **AND** disposal or a reviewed transplant requires explicit user direction while OpenSpec clean-lineage rules remain mandatory

### Requirement: One writer owns each review-artifact worktree
The system SHALL assign one write owner to every planning, POC, or implementation MR/PR worktree and SHALL keep reviewer subagents read-only.

#### Scenario: Owner writes in an isolated worktree
- **WHEN** Plan or Execute gains write authority for a review artifact
- **THEN** it verifies or creates a dedicated branch and worktree for that artifact
- **AND** exactly one owner may edit, stage, and commit there

#### Scenario: Parallel writer uses another worktree
- **WHEN** a second implementation writer is authorized for independent work
- **THEN** the second writer receives a separate branch, worktree, and explicit ownership
- **AND** it does not share the first writer's Git index

#### Scenario: Ownership transfers explicitly
- **WHEN** another session or agent must take over a worktree
- **THEN** the handoff identifies branch, worktree, HEAD, changed paths, untracked paths, diff fingerprint, and blocker
- **AND** the previous owner stops writing before the new owner proceeds

#### Scenario: Dirty handoff diverges
- **WHEN** changed paths, untracked paths, or the diff fingerprint no longer match the ownership handoff
- **THEN** the handoff is invalid
- **AND** the receiving owner blocks or creates a new isolated worktree

#### Scenario: Ownership cannot be established
- **WHEN** a worktree is dirty, shared, or has unknown ownership without a valid handoff
- **THEN** the workflow blocks writes or creates a new isolated worktree
- **AND** it does not silently adopt the ambiguous checkout

### Requirement: Plan and Execute use native hook-owned commits
The system SHALL use native `git commit` for agent-authored planning and implementation commits and SHALL allow repository hooks to run normally.

#### Scenario: Native migration bootstraps before runtime cutover
- **WHEN** this approved change is implemented while installed instructions still mention AX commits
- **THEN** the planning commit and every implementation unit use the user's approved native Git path
- **AND** the final runtime cutover removes the stale instruction and command references atomically

#### Scenario: Cohesive boundary becomes a commit
- **WHEN** a planning artifact or implementation boundary is coherent and the worktree contains no later-boundary changes
- **THEN** the owner stages only that boundary
- **AND** runs native `git commit` without `--no-verify`
- **AND** advances only after Git creates the commit successfully

#### Scenario: Dependent work stays in one boundary
- **WHEN** a partial change cannot satisfy repository invariants independently
- **THEN** the owner combines it with its dependent change
- **AND** it does not bypass hooks to force an artificial checkpoint

#### Scenario: Hook failure is repaired before progress
- **WHEN** a pre-commit hook fails
- **THEN** the owner remains in the current boundary, diagnoses the failure, fixes it, restages the intended files, and retries
- **AND** it does not begin another boundary, push, or enter Review while the commit is unsuccessful

#### Scenario: Hook infrastructure remains blocked
- **WHEN** a nondeterministic, infrastructure-owned, or unrelated hook failure cannot be repaired safely
- **THEN** the workflow stops with command and error evidence
- **AND** it does not use a hook bypass

### Requirement: AI repo commits run the complete local suite
The system SHALL preserve staged Biome validation, shared skill validation, and the complete unit-plus-integration test suite in the AI repo pre-commit hook.

#### Scenario: AI repo commit passes verification
- **WHEN** Plan or Execute commits in the AI repo
- **THEN** Lefthook runs staged Biome validation, `pnpm skills:validate`, and `pnpm test`
- **AND** the commit succeeds only when all commands pass

#### Scenario: Current hook evidence is available
- **WHEN** the latest intended commit passed hooks in the active task, HEAD has not changed, and the worktree is clean
- **THEN** Review may treat that result as fresh local evidence

#### Scenario: Hook evidence cannot be verified
- **WHEN** a resumed task cannot verify successful hook output for the current HEAD
- **THEN** Review reruns the complete repository verification suite or blocks
- **AND** it does not infer success from commit existence alone

### Requirement: Review is automatic and read-only
The system SHALL automatically enter read-only Review after a Plan artifact, every material POC head, direct Execute, and each implementation unit.

#### Scenario: Review launches relevant subagents
- **WHEN** a reviewable artifact or implementation diff is ready
- **THEN** Review launches baseline correctness, regression, maintainability, and verification reviewers plus affected-domain specialists
- **AND** every reviewer inspects one exact artifact fingerprint or HEAD read-only

#### Scenario: Blocking finding returns to the owner
- **WHEN** Review finds an actionable in-scope blocker
- **THEN** the owning Plan or Execute agent fixes it and creates a fresh hook-clean commit when applicable
- **AND** required reviewers rerun against the changed artifact or HEAD

#### Scenario: Scope-changing finding returns to Plan
- **WHEN** Review identifies a material scope, architecture, safety, or delivery-shape change
- **THEN** the workflow returns to Plan
- **AND** it does not implement the expansion silently

#### Scenario: Repeated or conflicting blocker stops
- **WHEN** the same normalized blocker appears after one attempted fix or required reviewers conflict on a material decision
- **THEN** Review stops for user direction with the competing evidence

### Requirement: Standalone Review selects an explicit target
The system SHALL support direct read-only review of planning, implementation, provider, and tracker surfaces without granting fix authority.

#### Scenario: Direct Review has one clear target
- **WHEN** the prompt or current context identifies one plan/OpenSpec, POC, dirty worktree, branch diff, PR/MR, or Linear mapping
- **THEN** Review states the target and comparison base
- **AND** reports `review_complete` with findings

#### Scenario: Direct Review target is ambiguous
- **WHEN** several materially different review targets are plausible
- **THEN** Review asks the user to select the target
- **AND** it does not choose silently

#### Scenario: Ready to finish requires exact implementation state
- **WHEN** a committed implementation HEAD is clean, hook evidence is fresh, all required reviewers report no blockers, and no post-review Finish gate applies
- **THEN** Review emits `ready_to_finish` tied to that exact HEAD

#### Scenario: Unit 8 requires a post-review activation gate
- **WHEN** Unit 8 is clean, hook-clean, and Review-clean but live runtime activation has not passed
- **THEN** Review emits `review_complete` and `activation_ready` instead of `ready_to_finish`
- **AND** authorized Finish emits `ready_to_finish` only after `runtime_activation_gate` passes for that exact head

#### Scenario: Review and fix grants a transition
- **WHEN** the user explicitly requests review and fixes
- **THEN** Review reports findings first and transitions to Plan or Execute as appropriate
- **AND** the write owner remains separate from reviewer subagents

### Requirement: Local orchestration remains private
The system SHALL keep mode state, reviewer identities, fingerprints, transcripts, verdict ledgers, retries, and handoffs out of team-facing durable artifacts.

#### Scenario: Local review evidence is current
- **WHEN** automatic review completes
- **THEN** the task retains the evidence privately for current-session routing
- **AND** committed artifacts, Linear records, and hosted descriptions contain only team-relevant work content

#### Scenario: Local evidence is stale or missing
- **WHEN** the artifact or HEAD changes or a resumed task cannot recover exact evidence
- **THEN** the workflow reruns required reviewers
- **AND** it does not create a committed sidecar, Git note, AX record, or hosted metadata ledger

### Requirement: Finish owns implementation delivery and terminal actions
The system SHALL use Finish for implementation publication, hosted feedback follow-through, merge readiness, and explicitly authorized terminal actions.

#### Scenario: Delivery-authorized implementation publishes
- **WHEN** Execute and automatic Review complete under an `implement` or `deliver` request
- **THEN** Finish pushes or updates the implementation PR/MR and follows configured CI and hosted review
- **AND** it does not merge

#### Scenario: Local-only execution stops
- **WHEN** the user requested `Execute only` or `keep it local`
- **THEN** the workflow stops at `ready_to_finish` without pushing

#### Scenario: Hosted finding returns to Execute
- **WHEN** hosted review reports an actionable implementation finding on the latest head
- **THEN** Finish routes it to the same Execute owner, then automatic Review, then Finish publication of the new head

#### Scenario: Merge requires explicit language
- **WHEN** the user says `merge`, `ship`, `merge when green`, or equivalent terminal language
- **THEN** Finish may merge after required latest-head checks, reviews, approvals, and stack-integrity gates pass
- **AND** it verifies remote merged state before reporting completion

#### Scenario: Deployment and cleanup require authority
- **WHEN** publication or merge completes
- **THEN** Finish deploys or deletes branches/worktrees only when the request or activated project policy authorizes those actions
