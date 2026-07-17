# Investigation and implementation rules

These rules define semantic routing, planning artifacts, implementation
ownership, and the mandatory OpenSpec rehearsal boundary.

## Diagnose and explore before mutation

- Every new substantive task begins in Explore before inferred mutation
  authority can exist. `brainstorming` is the default Explore specialist for a
  substantive change request; matching new-effort intake continues to use
  `start-project`, and an explicitly named mode or bounded read-only specialist
  overrides inference.
- Opening imperatives such as "fix", "implement", "change", or "build",
  specificity, urgency, an apparently obvious solution, and a clean owned
  worktree do not independently authorize mutation. The first pass inspects
  context, maps the problem and recommendation, and may report that the task is
  ready for Execute, but it remains read-only.
- After the initial exploration, a later explicit instruction such as
  "proceed", "implement the accepted approach", or "make the changes" supplies
  mutation authority for that accepted task. Semantic readiness then selects
  Plan or Execute.
- A materially different requested outcome creates a new task boundary and
  resets to Explore, including during Plan, Execute, or Finish. Answers to
  active exploration questions, refinements within the accepted outcome,
  review feedback, and CI failures inside an already authorized delivery do not
  reset the task by themselves.
- Troubleshooting, investigation, debugging, research, project intake, and
  divergent design begin in Explore and remain read-only.
- Present findings before entering Execute. Do not edit, fix, commit, publish,
  or mutate external state until the user requests implementation.
- When the symptom may come from local runtime, hooks, plugins, or automation,
  inspect the relevant local state before assuming the repository is at fault.
- Agreement on a design confirms the decision; it does not authorize artifact
  or implementation writes.
- Once Plan, Execute, Review, or Finish has the required authority, continue
  within that granted scope without asking for renewed permission. Interrupt
  only when the next action expands authority, requires a human-only action, or
  changes a material behavior, architecture, migration, safety, ownership,
  ordering, cross-component, verification, delivery, or rollout decision.
  Contract-preserving wording, formatting, validation, test, CI, review, and
  schema repairs return automatically to the current mode owner. Existing
  authenticated commands do not require renewed approval; credential entry or
  a new credential grant remains a human action.
- When a user response clearly accepts an explicit recommendation bundle, treat
  every recommendation in that bundle as accepted. Do not infer unstated scope,
  repository mutation, provider mutation, or terminal authority from that
  agreement.
- Every non-trivial design starts with a repository precedent scan. Reuse is
  the default even when the request does not mention an existing approach;
  similarity wording narrows the scan but never triggers it.
- If the user rejects a name, structure, taxonomy, folder layout, API shape, or
  other design choice, present alternatives and tradeoffs before changing it.

## Route semantically

After the initial Explore gate and later mutation authority, Direct Execute is
eligible only when the accepted request fits one coherent final MR and has no
unresolved behavior, architecture, migration, safety, ownership, ordering,
cross-component contract, or verification decision. File count and line count
may inform risk but never select the workflow.

Enter Plan when any material implementation decision remains. Plan stays
conversational until scope, design, delivery shape, risk, acceptance, proof, and
policy are coherent. If direct Execute discovers a material unresolved
decision, freeze writes and return the decision plus worktree identity to Plan.

Plan selects one artifact:

- Use an atomic plan at `.agents/plans/<slug>.md` for one coherent
  implementation unit that needs no durable cross-component contract or
  mandatory full rehearsal. The plan and implementation are one change set in
  one final PR/MR.
- Use one OpenSpec change for independently reviewable delivery units, a durable
  cross-component contract, migration design, or work requiring the full POC.

The primary plan or OpenSpec records a reuse and deviation contract with
inspected precedents, canonical owners, direct reuse or extension, genuinely new
mechanisms, justified deviations, and their proof. Execute verifies that
contract before writing and pauses on sibling implementations, repeated
invariants, feature branches in shared infrastructure, or a second source of
truth.

Keep the primary artifact at the durable-contract level: objective, selected
high-level approach, material decisions and constraints, delivery shape, and
observable end-to-end proof. Exact files, symbols, commands, exhaustive test or
edge-case matrices, CI wiring mechanics, provider receipts, review chronology,
and intermediate findings remain task-local unless they change externally
observable behavior, architecture or canonical ownership, safety or rollout
policy, migration, a delivery-unit boundary, or end-to-end acceptance.

Before writing an OpenSpec, derive its top-level units from behavior, ownership,
deployment, security, migration, rollback, verification, and repository
boundaries. Treat existing headings as hypotheses and inspect prior
implementation or POC evidence when available. Each unit must be safe and
correct when merged before its successors, own objective proof, and have a
coherent reviewer, risk, rollback, and deployment boundary. Split distinct
shared prerequisites, feature behavior, proof infrastructure, activation,
repositories or owners, security, rollback, and deployment seams. Combine
unused-foundation, unverifiable-intermediate, and checkbox-only candidates.

Only primary atomic-plan Markdown belongs under `.agents/plans`. Reviewer
requests, selections, blueprints, handoffs, ledgers, fingerprints, command
proof, and other private workflow evidence remain task-local. Do not commit a
second representation of an OpenSpec.

## Own one worktree

- Before the first Plan or Execute write, verify or create one dedicated branch
  and worktree with exactly one write owner.
- Parallel writers use disjoint branches/worktrees with one writer each. Prefer
  disjoint paths, but allow declared integration hotspots; the descendant owner
  resolves normal restack conflicts and material contract conflicts return to
  Plan.
- A transfer records branch, worktree, HEAD, changed paths, untracked paths, and
  diff fingerprint. The previous owner stops writing first.
- Dirty, shared, contradictory, or externally changed ownership blocks writes
  until reconciled or moved to a clean isolated worktree.
- Reviewers stay read-only. Plan owns planning fixes; Execute owns implementation
  fixes.

## Rehearse every OpenSpec completely

Every OpenSpec receives one full disposable implementation POC before final
implementation. An atomic plan has no POC phase or POC PR/MR. If the accepted
contract requires a rehearsal, select OpenSpec instead of adding a POC to an
atomic plan.

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
6. Receives current local implementation review, configured CI,
   latest-effective-diff hosted automated review, and personal acceptance of
   the exact clean HEAD.
7. Runs bounded closure after repairs and emits a fresh exact-head technical-
   readiness checkpoint.
8. Freezes after acceptance, closes unmerged, and removes its local worktree.

At the POC's first objective proof, in slice 1 or slice 2 after at most one
setup-only slice, Execute pauses before broadening. Review runs the exact-diff
checkpoint with independent findings-only `code-quality-review` and
`scrutinize` reviewer runs plus targeted verification of the real entrypoint and
visible outcome. Any later architecture-affecting change invalidates that
checkpoint. Keep its evidence task-local. The completed stable POC publishes a
hook-clean draft, requests hosted review, then receives every completed-code
review type against that exact hosted head.

The POC rehearses task completion and archival in a disposable repository copy
without checking the source `tasks.md` or archiving the live change. POC commits
must never be merged, rebased, cherry-picked, or applied into final delivery.

After acceptance, Plan reconciles durable findings into proposal, design, delta
specs, tasks, and required tracker content once per authorized cycle. Local-only
implementation observations remain transient. A materially unproved
reconciliation delta returns to the user before another POC cycle.

Reconciliation also reruns top-level delivery decomposition against the POC's
actual footprint, owners, findings, proof, rollback needs, and deployment seams.
If a unit proved broader than planned, split it before final implementation.
Any material top-level-unit change returns to the user instead of silently
rewriting the accepted delivery contract.

## Deliver final artifacts by top-level unit

- There is no separate planning MR and no reconciliation-only MR.
- An atomic plan and its implementation form one change set in one final MR.
  Do not split them into planning, POC, and implementation artifacts.
- OpenSpec produces one final implementation MR per top-level delivery unit.
  Nested work items become cohesive commits inside that unit.
- Final implementation starts independently from the reconciled OpenSpec, never
  from POC ancestry.
- Plan classifies each unit as independent, contract-dependent, or
  implementation-dependent and records one total Git predecessor order.
  Independent units need no predecessor output; contract-dependent units may
  start when their accepted interface is fixed in the stack seed;
  implementation-dependent units wait for predecessor code, generated output,
  runtime behavior, or verification evidence.
- The first unit contains the reconciled planning-base state. Each later unit
  branches from the previous unit in the total Git order. Semantically eligible
  units may implement and follow review concurrently in separately owned
  worktrees even though publication, restack propagation, and merge ancestry
  remain ordered.
- Each final unit carries its own task/spec changes. The last unit carries task
  completion and required OpenSpec archive changes.
- A material final-implementation contract delta returns to Plan; the user
  decides whether another POC is required.

## Review and publication boundary

Review gives every planning artifact, completed POC, and final implementation
one discovery pass covering every phase-specific review type. Planning types
are implementation readiness, edge cases and risk, simplification and scope,
refactoring, and delivery shape. Completed-code types are `code-simplifier`,
`code-quality-review`, `deslop`, `diff-review`, and `scrutinize`. One integrated
inline pass may cover a small coherent change; use subagents only when
delegation is faster. Add affected-domain specialists when the exact target
exposes their domain. Planning Review requests an artifact repair only for a
durable contract gap and returns implementation mechanics and non-contract
discoveries to Execute task-locally.

Review evidence is task-local and bound to an artifact fingerprint or exact
target-base/HEAD pair. It returns one phase-barrier findings batch, then runs one
closure check limited to affected review types and verification. The native
pre-commit hook owns the full local suite. Finish publishes the hook-clean draft
and requests hosted review before local implementation Review starts on that
same head. Review then emits `technical_readiness_checkpoint` with artifact,
target-base diff, hook evidence, every required type, closure evidence when
needed, selected specialists, provider route, and blockers. A materially
changed contract or review risk requires new discovery. A patch-equivalent
rebase may preserve discovery only after base-sensitive validation and a fresh
exact-target checkpoint.

Finish follows hosted gates after draft publication. Implementation and
delivery requests permit publication but do not permit merge. Merge,
deployment, and cleanup require explicit language or activated project policy.

## Repository artifacts

Do not stage or commit reviewer scratch, readiness reports, reviewer reports,
delivery ledgers, screenshots, command proof, local paths, or private support
pointers. Reusable rules, mode packages, validators, runtime code, and regression
fixtures may be committed in the repository that owns them when they are the
feature being changed.

Portable shared skills keep executable helper logic inside the owning skill
folder or a real package dependency.
