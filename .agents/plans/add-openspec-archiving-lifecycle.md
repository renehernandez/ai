# Add OpenSpec Archiving To The Lifecycle

## Goal

Make completed OpenSpec archival an explicit part of final delivery so active
change discovery contains only unfinished work and a completed change cannot
reach technical readiness while still living under `openspec/changes/<id>`.

The first observable outcome is that the five-mode contract assigns final-unit
archival to Execute, Review evaluates the resulting canonical-spec/archive
diff, and Finish refuses readiness when the latest final-unit head still
contains the completed change as active.

Proof location: run the mode-lifecycle integration test and observe assertions
that a completed OpenSpec is archived by Execute before the final hook-clean
commit, that Review inspects the same canonical-spec/archive head, and that
Finish treats archived state as a readiness input rather than optional cleanup.

## Motivation

The current repository says that the last delivery unit carries task completion
and required OpenSpec archival, but it never assigns the transformation to a
mode or defines its position relative to the exact-head review and publication
sequence. Ordinary archive language routes to the five modes, while the
generated `openspec-archive-change` adapter remains explicit-only. As a result,
the repository has a required end state without a lifecycle owner.

The ambiguity is visible in the live change inventory: most entries reported by
`openspec list` are task-complete but remain in the active namespace. Fresh
agents must infer active versus historical status from checkboxes and prose.

## Decisions

### Execute owns completed-change archival

In the last final delivery unit, Execute verifies that every reconciled task and
requirement is implemented and verified, marks final task state complete,
synchronizes delta specifications into canonical specifications, and moves the
change into the dated archive. This occurs before the final hook-clean commit
and before draft publication for that exact head.

Incomplete or unverified work blocks completed-change archival. Plan continues
to own abandoned or superseded dispositions; those paths do not silently mark
a change complete.

### Review binds closure evidence to the final head

Review evaluates implementation, completed task state, canonical specification
updates, and the archived record as one exact-head artifact. An archive or
canonical-spec repair changes HEAD and invalidates prior readiness evidence in
the same way as an implementation repair.

### Finish consumes archived state

Finish requires the last final-unit head to contain the expected completed
archive and canonical specifications before reporting technical readiness. It
publishes and follows hosted gates for that head but does not perform archival
as merge follow-through or branch/worktree cleanup.

The explicit developer adapter remains available only when the user names it.
Ordinary delivery uses the lifecycle-owned semantics without inferring or
delegating to the explicit adapter.

## Reuse And Deviation Contract

- Extend the existing final-unit owner in `skills/execute` and the existing
  archive requirements in shared OpenSpec rules and canonical specifications.
- Extend exact-head planning/implementation review in `skills/review` instead
  of adding an archive-specific review mode or receipt.
- Extend Finish readiness inputs in `skills/finish`; keep provider and terminal
  mutation ownership unchanged.
- Reuse upstream OpenSpec archive semantics: completed tasks, synchronized
  canonical specs, and a dated archive directory.
- Do not modify or infer the explicit-only generated archive adapter.
- Deviate from the previous underspecified contract by making archive timing
  and ownership mandatory before publication of the last final-unit head.

End-to-end proof is the lifecycle integration contract: Execute owns the
completed transformation, Review inspects the resulting exact head, and Finish
cannot report readiness for a completed-but-active change.

## Scope

### In Scope

- Align shared instructions, lifecycle skills, rules, and canonical OpenSpec
  specifications with the accepted Execute-to-Review-to-Finish archive flow.
- Add focused regression coverage for ownership, timing, incomplete-state
  blocking, exact-head invalidation, and readiness requirements.
- Apply `writing-skills` and repository-native verification to the changed
  agent behavior.

### Out Of Scope

- Archiving the repository's existing backlog of completed active changes.
- Changing upstream OpenSpec CLI behavior or generated explicit adapters.
- Introducing a new lifecycle mode, persistent workflow state, archive receipt,
  background sweeper, or post-merge cleanup action.
- Defining a new durable format for abandoned or superseded dispositions.
- Refreshing the live AX runtime from the feature branch; live sync remains a
  post-merge action from clean `main`.

## Implementation Tasks

### 1. Lifecycle Closure Contract

- [x] 1.1 Assign final-unit completion, canonical-spec synchronization, and
      dated archival to Execute before the final hook-clean commit; make Review
      and Finish consume that same exact-head state.

### 2. Canonical Specifications And Verification

- [x] 2.1 Align the canonical workflow specifications and add focused lifecycle
      regression assertions for completed, incomplete, repaired, and readiness
      states.

### 3. Shared Behavior Readiness

- [x] 3.1 Run `writing-skills`, focused lifecycle verification, strict OpenSpec
      validation, repository skill validation, and the native commit suite.

## Acceptance

- A final OpenSpec delivery cannot reach technical readiness while the
  completed change remains in the active namespace.
- Execute archives only after all reconciled tasks and requirements are
  implemented and verified.
- The archive transformation is part of the last implementation unit before
  its final hook-clean commit and draft publication.
- Review inspects implementation, canonical specs, completed tasks, and archive
  state against one exact HEAD; later repairs invalidate stale evidence.
- Finish consumes archive completeness as a readiness gate and does not treat
  archival as merge, deployment, or branch/worktree cleanup.
- Ordinary archive language remains routed through the five modes, while the
  generated adapter remains explicit-only.
- Existing completed changes are not bulk-archived by this delivery.

## Verification

- Focused mode-lifecycle integration assertions cover ownership, archive timing,
  incomplete-state blocking, exact-head freshness, and Finish readiness.
- Shared instruction and skill validation confirms the same contract across
  personal and repository policy surfaces.
- Strict OpenSpec validation passes for all active and canonical specs.
- `writing-skills` confirms the changed shared behavior is specific, routed,
  and regression-protected.
- The native hook-enabled commit suite passes before publication.

## Risks And Controls

| Risk | Control |
| --- | --- |
| A change is archived before its implementation is complete | Require every reconciled task and requirement to be implemented and verified before Execute transforms it. |
| Archival invalidates an already-reviewed head | Perform it before the final hook-clean commit and make any later archive repair refresh exact-head evidence. |
| Finish conflates archival with cleanup authority | Specify archival as repository implementation state consumed by Finish, not a terminal action. |
| Ordinary delivery bypasses the lifecycle through the generated adapter | Keep the adapter explicit-only and encode equivalent semantics in Execute. |
| Historical backlog expands this MR | Leave existing completed active changes unchanged and scope cleanup separately. |

## Recommended Delivery

Deliver this atomic plan and lifecycle-contract implementation in one final
draft MR. It needs no OpenSpec or POC because it is one coherent correction to
the existing five-mode workflow contract.
