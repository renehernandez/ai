# Investigation and implementation rules

These rules define semantic routing, planning artifacts, implementation
ownership, and the mandatory OpenSpec rehearsal boundary.

## Diagnose and explore before mutation

- Troubleshooting, investigation, debugging, research, project intake, and
  divergent design begin in Explore and remain read-only.
- Present findings before entering Execute. Do not edit, fix, commit, publish,
  or mutate external state until the user requests implementation.
- When the symptom may come from local runtime, hooks, plugins, or automation,
  inspect the relevant local state before assuming the repository is at fault.
- Agreement on a design confirms the decision; it does not authorize artifact
  or implementation writes.
- If the user rejects a name, structure, taxonomy, folder layout, API shape, or
  other design choice, present alternatives and tradeoffs before changing it.

## Route semantically

Direct Execute is eligible only when the request fits one coherent final MR and
has no unresolved behavior, architecture, migration, safety, ownership,
ordering, cross-component contract, or verification decision. File count and
line count may inform risk but never select the workflow.

Enter Plan when any material implementation decision remains. Plan stays
conversational until scope, design, delivery shape, risk, acceptance, proof, and
policy are coherent. If direct Execute discovers a material unresolved
decision, freeze writes and return the decision plus worktree identity to Plan.

Plan selects one artifact:

- Use an atomic plan at `.agents/plans/<slug>.md` for one coherent final MR that
  needs no durable cross-component contract or mandatory full rehearsal.
- Use one OpenSpec change for independently reviewable delivery units, a durable
  cross-component contract, migration design, or work requiring the full POC.

Only primary atomic-plan Markdown belongs under `.agents/plans`. Reviewer
requests, selections, blueprints, handoffs, ledgers, fingerprints, command
proof, and other private workflow evidence remain task-local. Do not commit a
second representation of an OpenSpec.

## Own one worktree

- Before the first Plan or Execute write, verify or create one dedicated branch
  and worktree with exactly one write owner.
- Parallel writers use disjoint branches/worktrees and disjoint file ownership.
- A transfer records branch, worktree, HEAD, changed paths, untracked paths, and
  diff fingerprint. The previous owner stops writing first.
- Dirty, shared, contradictory, or externally changed ownership blocks writes
  until reconciled or moved to a clean isolated worktree.
- Reviewers stay read-only. Plan owns planning fixes; Execute owns implementation
  fixes.

## Rehearse every OpenSpec completely

Every OpenSpec receives one full disposable implementation POC before final
implementation. An atomic plan does not require a POC unless the user requests
one.

The POC:

1. Starts from the locally reviewed initial OpenSpec commit in its own
   branch/worktree.
2. Implements every task, requirement, scenario, acceptance criterion, and
   applicable production concern with direct success and failure proof.
3. Exercises real decision boundaries or fidelity-equivalent environments.
4. Uses isolated HOME and runtime roots for AX behavior and never mutates the
   live user runtime.
5. Opens one draft review-only PR/MR whose title starts with `POC:` and whose
   description says it must close unmerged.
6. Receives current local implementation review, configured CI, latest-head
   hosted automated review, and personal acceptance of the exact clean HEAD.
7. Refreshes every exact-head gate after any POC HEAD change.
8. Freezes after acceptance, closes unmerged, and removes its local worktree.

The POC rehearses task completion and archival in a disposable repository copy
without checking the source `tasks.md` or archiving the live change. POC commits
must never be merged, rebased, cherry-picked, or applied into final delivery.

After acceptance, Plan reconciles durable findings into proposal, design, delta
specs, tasks, and required tracker content once per authorized cycle. Local-only
implementation observations remain transient. A materially unproved
reconciliation delta returns to the user before another POC cycle.

## Deliver final artifacts by top-level unit

- There is no separate planning MR and no reconciliation-only MR.
- An atomic plan produces one final implementation MR containing the plan and
  implementation.
- OpenSpec produces one final implementation MR per top-level delivery unit.
  Nested work items become cohesive commits inside that unit.
- Final implementation starts independently from the reconciled OpenSpec, never
  from POC ancestry.
- The first unit contains the reconciled planning-base state. Each later unit
  branches from the previous unit in one total Git predecessor order, even when
  logical dependencies permit parallel work.
- Each final unit carries its own task/spec changes. The last unit carries task
  completion and required OpenSpec archive changes.
- A material final-implementation contract delta returns to Plan; the user
  decides whether another POC is required.

## Review and publication boundary

Review inspects every changed planning artifact with implementation-readiness,
edge-case/risk, simplification/scope, and refactoring reviewers. It inspects POC
and final implementation targets with correctness, regression, maintainability,
and verification reviewers. Add affected-domain specialists.

Review evidence is task-local and bound to an artifact fingerprint or exact
target-base/HEAD pair. Before any push or hosted artifact mutation, Review emits
`publication_checkpoint` with target-base diff, hook evidence, required local
reviewers, provider route, and blockers. Any HEAD or target-base change makes it
stale.

Finish consumes the current checkpoint, publishes the configured final
artifact, and follows hosted gates. Implementation and delivery requests permit
publication but do not permit merge. Merge, deployment, and cleanup require
explicit language or activated project policy.

## Repository artifacts

Do not stage or commit reviewer scratch, readiness reports, reviewer reports,
delivery ledgers, screenshots, command proof, local paths, or private support
pointers. Reusable rules, mode packages, validators, runtime code, and regression
fixtures may be committed in the repository that owns them when they are the
feature being changed.

Portable shared skills keep executable helper logic inside the owning skill
folder or a real package dependency.
