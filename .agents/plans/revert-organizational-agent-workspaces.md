# Retire Organizational Agent Workspaces

## Goal

Remove the organizational-agent hierarchy introduced by AI MRs !181 through
!186, close the unmerged Cloudflare-backed successor MR !187, and return normal
delivery to direct task-local multi-agent delegation. Preserve the independent
parallel-review and multi-agent improvements that do not require persistent
Executive Assistants, Project Managers, Squad Leads, coordinator projects, or
Linear-backed Agent Workspace records. [confidence: 0.99 - certain | reason:
the user explicitly requested a complete revert of the hierarchy and related
MRs]

## Motivation

The hierarchy was merged and synchronized, but adoption stopped after the two
Executive Assistants were activated. No Linear Project Manager, GitLab Project
Manager, or Squad Lead was activated, and normal delivery tasks continued to
delegate directly from their root tasks. The persistent coordination layer
therefore adds runtime, policy, and operating complexity without providing the
intended delivery path. [confidence: 0.98 - certain | reason: live GitLab,
Linear, Codex task, and AX runtime inspection confirmed this state]

## Rollback Boundary

| MR | State | Rollback treatment |
| --- | --- | --- |
| !181 `Add durable agent workspaces` | Merged | Remove the organizational-agent source, schemas, renderer, skill, routing contract, documentation, AX surface, dependencies that have no remaining consumer, and focused tests. |
| !182 `Add pinned coordinator control projects` | Merged | Remove coordinator project source, AX commands, registration, policy/runtime implementation, documentation, and tests. |
| !183 `fix: expose typed coordinator Linear writes` | Merged | Remove with the coordinator policy implementation. |
| !184 `fix: parse numeric coordinator fields` | Merged | Remove with the coordinator parsing and generated policy implementation. |
| !185 `Fix coordinator app connector configuration` | Merged | Remove with the coordinator project configuration. |
| !186 `Name organizational agents by purpose` | Merged | Remove with the Agent Workspace naming and activation contract. |
| !187 `Draft: Add Cloudflare-backed agent workspaces` | Open, unmerged | Close without merging; retain Git history while retiring its branch/worktree after the rollback lands. |

This is a semantic inverse on current `main`, not a blind sequence of Git
reverts. Later independent work shares files and dependencies with the retired
MRs, so implementation must preserve its current behavior while removing only
hierarchy-owned content. [confidence: 0.97 - certain | reason: current-main
inspection found later independent consumers in shared instructions, AX config
sync, and review workflow]

## Decisions

- Retire the complete hierarchy: Delivery Executive Assistant, Executive
  Operations Assistant, Linear Project Manager, GitLab Project Manager, Squad
  Lead, typed Agent Workspace records, and the hierarchy-specific ephemeral
  Agent Run contract. [confidence: 0.99 - certain | reason: this is the common
  scope of MRs !181-!186 and the user's explicit project-leads request]
- Return delegation to task-local orchestration using the existing collaboration
  surface and one-writer-per-worktree rule. Do not remove generic subagents,
  multi-agent configuration, or review parallelization. [confidence: 0.98 -
  certain | reason: those capabilities predate or independently follow the
  hierarchy and directly serve the user's throughput priority]
- Remove hierarchy-specific content from the AI control repository's root
  `AGENTS.md` because it is part of the reverted feature, but do not touch any
  downstream project's `AGENTS.md`. Remove the corresponding portable source
  from `instructions/AGENTS.md` and shared routing rules. [confidence: 0.96 -
  certain | reason: leaving the AI-repo section would require a deleted skill
  and create contradictory instructions]
- Preserve the five-mode lifecycle, generic AX synchronization, managed Codex
  configuration, post-merge AX convergence, Linear project overview, and the
  parallel review workflow. [confidence: 0.98 - certain | reason: each has an
  independent owner and acceptance contract]
- Keep `smol-toml` because current managed-config synchronization consumes it;
  remove `ajv` if repository search after implementation confirms no remaining
  consumer. [confidence: 0.97 - certain | reason: current imports show the
  independent config-sync consumer and agent-only Ajv consumers]
- Preserve provider history. Mark the two active Root records inactive,
  increment their generations, preserve all `RENE-1` through `RENE-17` bodies,
  move unfinished hierarchy records to Linear's Canceled state, and archive
  every associated Codex activation task, including superseded attempts. Do not
  delete provider records. [confidence: 0.97 - certain | reason: this uses the
  supported provider lifecycle while keeping an auditable rollback]
- Remove live generated assets only after the rollback merges and after exact
  AX ownership markers and symlink targets are revalidated. Cleanup covers the
  canonical agent runtime, Codex agent link, two coordinator project roots, and
  coordinator registration record. [confidence: 0.95 - certain | reason: live
  inspection identified these exact managed assets]

## Domain Terms

| Term | Meaning |
| --- | --- |
| Organizational-agent hierarchy | The persistent Executive Assistant, Project Manager, and Squad Lead structure plus its typed Agent Workspace control plane. |
| Task-local delegation | Ephemeral subagents spawned and coordinated by the current Codex task without persistent hierarchy records. |
| Repository rollback | One current-main change set that removes the merged hierarchy while preserving later independent work. |
| Live cleanup | Post-merge deactivation and removal of synchronized runtime/provider artifacts after ownership verification. |
| Preserve history | Keep merged Git commits and historical Linear bodies; close, deactivate, or archive current surfaces instead of deleting their audit trail. |

## Scope

### In Scope

- Remove `agents/`, `coordinator-projects/`, `skills/agent-workspace/`, their
  two superseded atomic plans, and hierarchy-specific documentation.
- Remove AX `agents` and `coordinators` commands, runtime rendering,
  registration, validation, configuration, scripts, package scripts, generated
  artifacts, and focused tests.
- Remove organizational-agent routing and activation language from the AI
  repository instructions, portable instructions, shared rules, handoff
  guidance, AX docs, and surviving regression fixtures.
- Reconcile package metadata and the lockfile without removing dependencies
  used by independent current-main features.
- Add regression coverage proving that shared instructions and runtime config
  contain no active organizational-agent entrypoints while generic task-local
  multi-agent and parallel-review policy remains intact.
- Close open draft MR !187 without merging it.
- After explicit merge authority, deactivate the active Delivery and Operations
  assistants, cancel unfinished `RENE-1` through `RENE-17` hierarchy records,
  archive every associated Codex activation task, synchronize clean `main`,
  remove the exact AX-managed generated assets, retire the related clean
  worktrees/branches, and verify no active hierarchy surface remains.

### Out Of Scope

- Modifying Nitro, Stat, or any other downstream project's `AGENTS.md`.
- Removing task-local subagents, collaboration tools, `multi_agent_v2`, review
  parallelization, specialist review skills, or one-writer-per-worktree safety.
- Reverting unrelated MRs that happened to touch the same instruction or AX
  files.
- Rewriting or deleting merged Git history.
- Deleting historical Linear records or comments.
- Merging the rollback MR before Rene grants explicit merge authority.

## Reuse And Deviation Contract

The rollback reuses the pre-!181 task-local delegation model, the current
five-mode lifecycle, the current review-parallelization contract, AX's existing
skill retirement behavior for `agent-workspace`, and the existing post-merge
clean-main synchronization gate. The canonical owners remain the current task,
the collaboration surface, Review, Finish, and AX runtime synchronization.

The only manual deviation is removal of non-skill generated runtime roots. AX
currently prunes named retired skills but does not prune omitted agent or
coordinator surfaces. Adding a new generalized retirement subsystem merely to
remove the subsystem being retired would leave unnecessary durable machinery;
the rollback instead verifies the existing AX ownership markers and removes
the four exact generated roots plus the coordinator registration file during
authorized post-merge cleanup. [confidence: 0.94 - certain | reason: runtime
source inspection confirmed omitted agent/coordinator config does not delete
existing targets]

## Atomic Implementation Unit

Deliver one plan-plus-implementation MR targeting `main`. Repository removal,
portable instruction removal, AX surface removal, and regression proof share
one behavior, reviewer, rollback, and release boundary: the organizational
hierarchy is either an active supported system or it is not. Splitting the
removal would leave broken references or partially managed runtime surfaces.
No OpenSpec or POC is required. [confidence: 0.97 - certain | reason: the
rollback is one coherent current-main outcome with no migration design or safe
independent intermediate unit]

## Acceptance Criteria

- Current repository source contains no active Delivery Executive Assistant,
  Executive Operations Assistant, Linear Project Manager, GitLab Project
  Manager, Squad Lead, Agent Workspace, or coordinator-project runtime contract.
- AX exposes no `agents` or `coordinators` command and declares no agent or
  coordinator runtime target.
- The `agent-workspace` skill is removed from source and configured profiles
  and is declared retired so normal live AX sync removes installed copies.
- Generic task-local subagent roles, multi-agent configuration, review
  parallelization, and one-writer-per-worktree safety remain supported.
- No downstream project-specific `AGENTS.md` is changed.
- Package dependencies and generated lockfile entries have no hierarchy-only
  residue and preserve every independent current-main consumer.
- Open draft MR !187 is closed without merge.
- Before post-merge runtime removal, both active Root records are transitioned
  to inactive with incremented generations, unfinished `RENE-1` through
  `RENE-17` records are Canceled, and every associated Codex activation task is
  archived; historical Linear bodies and completed records remain available.
- Post-merge live inspection finds none of these active assets:
  `~/.agents/agents`, `~/.codex/agents`, the Delivery Coordination project root,
  the Executive Operations project root, or
  `~/.agents/runtime/control-projects.json`.
- `pnpm ax status` and `pnpm ax validate` pass from clean updated `main` after
  cleanup, with no organizational-agent desired or observed paths.

## First Real Confirmation

In an isolated HOME/runtime fixture, synchronize the rollback branch through
the real AX entrypoint and show that portable instructions and skills install,
generic multi-agent Codex configuration remains enabled, and no agent runtime,
coordinator project, `agent-workspace` skill, or organizational routing text is
produced. This is the earliest visible confirmation without mutating the live
runtime before merge. [confidence: 0.96 - certain | reason: it exercises the
real installation boundary while respecting feature-branch isolation]

## Verification Strategy

- Add focused tests for removal of hierarchy entrypoints and preservation of
  generic multi-agent/review-parallelization contracts.
- Run repository formatting, skill validation, focused AX runtime tests, and
  the complete repository test suite through native hook-enabled commit.
- Run `writing-skills` RED-GREEN-REFACTOR scenarios against the changed shared
  instructions and remaining skill behavior.
- Run isolated `pnpm ax sync`, `pnpm ax status`, and `pnpm ax validate` with an
  isolated HOME and runtime root; verify the absent generated surfaces and the
  preserved managed Codex configuration.
- Publish one draft GitLab MR, run configured CI and Nitro review, and perform
  exact-head local Review without rerunning the hook's full suite.
- After explicit merge authority, execute the deactivation and cleanup sequence
  from the clean `main` worktree and verify both provider state and filesystem
  absence.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Blind Git reverts discard later independent workflow improvements | Implement a semantic inverse on current `main` and assert preserved multi-agent/review behavior. |
| Portable instructions retain dangling hierarchy references | Search all maintained sources and installed isolated outputs for the retired role and skill names. |
| Removing `smol-toml` breaks managed config synchronization | Keep it while any independent import remains; remove only unused Ajv code and lock entries. |
| Live or superseded coordinator tasks remain visible after repository removal | Deactivate the active Roots and archive every verified hierarchy activation task before removing installed prompts and control roots. |
| Manual cleanup removes user-owned paths | Revalidate exact symlink targets and `.ax-managed.json` ownership markers immediately before moving only the enumerated paths to recoverable trash. |
| Open MR !187 is mistaken for an active successor | Close it explicitly and report that its commits remain recoverable in Git history. |
| AI root instructions conflict with deleted portable behavior | Remove only the hierarchy-specific section from this control repository; do not modify downstream project instructions. |

## Delivery And Cleanup Policy

The plan and implementation ship together in one draft GitLab MR targeting
`main`. Implementation wording authorizes publication, CI, Nitro, and hosted
feedback closure, but not merge. Closing the superseded open draft !187 is part
of the requested rollback and may occur when the replacement rollback MR is
published. Merge, Linear cancellation, live runtime cleanup, Codex task
archival, and branch/worktree cleanup occur only after explicit merge authority,
despite being required for the complete rollback outcome.

If rollback of this rollback is required before live cleanup, revert the single
MR. After live cleanup, restoring the hierarchy requires reverting this MR,
running clean-main AX sync, and deliberately reactivating new workspace
generations; historical inactive records must not be silently reused.
