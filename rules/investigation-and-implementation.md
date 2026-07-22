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
  agreement. The narrow exception is an immediate `proceed` after the agent
  presents one exact artifact scope and one merge action as the sole pending
  action awaiting approval; it grants only that merge authority. Standalone or
  ambiguous `proceed` grants no merge authority, and contextual assent never
  grants deployment or cleanup.
- Every non-trivial design starts with a repository precedent scan. Reuse is
  the default even when the request does not mention an existing approach;
  similarity wording narrows the scan but never triggers it.
- If the user rejects a name, structure, taxonomy, folder layout, API shape, or
  other design choice, present alternatives and tradeoffs before changing it.

## Schedule for user throughput

Within accepted authority and safety boundaries, optimize for the first useful
checkpoint and total user-visible completion latency. Maintain a task-local
dependency map and ready queue, start every safe, authorized, useful ready lane
that will reduce latency, and backfill available capacity as dependencies
resolve. This scheduling state is not a committed ledger or another lifecycle
owner.

Serialize only for a concrete constraint: an unresolved required input,
exclusive mutation ownership, ordered Git or provider mutation, an unstable
exact target, unavailable capacity, or an authority, safety, credential, or
external-state blocker. Coordination cost is valid only when it makes a
genuinely small coherent task faster inline. When ready work and capacity
remain, start it or state the specific constraint. Do not combine several
independent lanes into one nominal task to avoid starting them. One writer owns
each worktree; that never prevents independent writers in separately owned
worktrees or concurrent read-only lanes. A phase barrier is a join point for
work already launched, not a start gate.

Apply the same rule across modes: Explore overlaps independent evidence reads;
Plan fixes dependencies and ownership; Execute starts semantically eligible
units; Review fills ready reviewer capacity; and Finish overlaps stable local
and hosted gates. Preserve a small coherent task inline when delegation,
worktree setup, or handoff cost would increase latency.

One MR per unit is an artifact boundary, not a user approval checkpoint. Once
a multi-unit delivery is accepted, continue every eligible unit and publish
each hook-clean artifact. Do not wait for `continue`, user review, or approval
between units. Wording such as "update each MR separately" defines that
boundary, not a pause. Stop only when the user explicitly requests a staged
checkpoint or a normal authority, contract, ownership, safety, or provider
blocker requires it.

Each MR-specific Finish lane must remain active through draft technical
readiness. If it exits, errors, or stalls before then, the coordinator replaces
it with another provider-only subagent using a refreshed immutable packet that
preserves the delivery fields and advances the provider-ownership generation.
Before replacement, revoke the prior generation, confirm the prior lane exited
or explicitly interrupt it at a safe boundary, and confirm it is inactive.
Reinspect live provider state, revalidate source and target identities, and
designate exactly one replacement as the current provider owner before provider
mutation. A resumed lane holding the revoked generation is read-only and
returns status. Monitoring continuity does not require a user prompt.

A hook-clean, frozen multi-MR unit is `publication-ready`. Publication
authority, provider routing, credentials, and a known stable target-base identity
are launch prerequisites, not readiness conditions. Missing prerequisites do
not revoke publication readiness.

That transition creates a task-wide dispatch barrier. Before any agent begins
another repository mutation, the coordinator signals every active Execute
owner to pause. A repository mutation already in flight may finish, but its
owner pauses at the next safe tool boundary and acknowledges that it is paused
before its next mutation. The coordinator starts one MR-specific, provider-only
Finish subagent with the immutable publication packet. If capacity is unavailable,
free one worker slot for the Finish subagent by ending or interrupting other
non-Finish subagent work at a safe boundary. If no slot can be freed safely, the
barrier remains closed.

A credential, authority, provider-routing, target-base identity, or remaining
capacity blocker does not release the dispatch barrier. Only explicit
withdrawal or supersession of the unit may release it without starting the
lane. Successfully starting the Finish subagent releases the barrier; the
coordinator then signals the paused Execute owners to resume. Execute lanes
continue without waiting for MR creation, CI, or hosted review. Report the
launch or concrete blocker once in task commentary and rely on the subagent and
live Git/provider state afterward. The small coherent inline exception applies
to single-MR work with no useful overlap; a multi-unit or multi-MR delivery is
not eligible for that exception while descendant or other useful work is ready.

This task-wide hold is intentional when the MR-specific Finish lane for a
publication-ready unit cannot launch. It prioritizes publication correctness and
progressive MR visibility over temporary throughput so later mutation cannot
bypass the accepted publication boundary or consume the capacity reserved to
make that boundary visible. The cost is bounded: eligible mutation resumes
immediately after the lane starts, or after explicit withdrawal or supersession
releases the unit.

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
correct when merged before its successors, own local proof, and have a
coherent reviewer, risk, rollback, and deployment boundary. Split distinct
shared prerequisites, feature behavior, proof infrastructure, activation,
repositories or owners, security, rollback, and deployment seams. Combine
unused-foundation, unverifiable-intermediate, and checkbox-only candidates.
Prefer stack objective proof in unit 1, but allow one or two groundwork units
first when each safely improves the current system, directly enables a named
successor, and reduces the first outcome MR's size or risk. Proof after unit 3,
speculative groundwork, or contradictory proposal/task/MR topology returns to
Plan. Use actual implementation or POC footprint to stress-test a root unit
that dominates the stack.

Every atomic implementation MR and final OpenSpec unit plans for at most 10
changed files and 500 additions plus deletions across its complete effective
diff. Above either target, record why another safe semantic split is
impractical. A forecast above 15 files or 1,000 changed lines returns to Plan.
After an effective diff exists, only explicit user approval bound to its
artifact, HEAD, target-base SHA, counts, rationale, consequences, and task-local
approval evidence can exceed the cap. Recheck after repairs or restacks; the
complete POC is exempt.

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

At the POC's first stack objective proof, in unit 1, 2, or 3 after at most two
reviewed groundwork units, Execute pauses before broadening. Review runs the
exact-diff checkpoint with a separate findings-only `code-simplifier` reviewer-run
identity and independent findings-only `code-quality-review` and `scrutinize`
reviewer runs plus targeted verification of the real entrypoint and visible
outcome. Any later architecture-affecting change invalidates that checkpoint.
Keep its evidence task-local. The completed stable POC publishes a hook-clean
draft, requests hosted review, then receives every completed-code review type
against that exact hosted head.

The POC rehearses task completion and archival in a disposable repository copy
without checking the source `tasks.md` or archiving the live change. POC commits
must never be merged, rebased, cherry-picked, or applied into final delivery.

After acceptance, Plan reconciles durable findings into proposal, design, delta
specs, tasks, and required tracker content once per authorized cycle. It also
creates one task-local execution seed containing the frozen contract, final
units, dependency classification, total Git order, worktree ownership, and
required proof. The seed is a handoff, not a committed ledger. Local-only
implementation observations remain transient. A materially unproved
reconciliation delta returns to the user before another POC cycle.

Reconciliation also reruns top-level delivery decomposition against the POC's
actual footprint, owners, findings, proof, rollback needs, and deployment seams.
If a unit proved broader than planned, split it before final implementation.
Any material top-level-unit change returns to the user instead of silently
rewriting the accepted delivery contract.

The pre-POC topology is provisional. Post-POC planning Review is the
authoritative final-topology gate inside the existing parallel review barrier.
Require fingerprint-bound delivery-shape evidence for every final unit and
every material POC footprint entry. Assign each footprint entry to one owning
unit or a declared cross-unit integration hotspot, challenge plausible split
and merge alternatives, and block the final execution seed for missing, stale,
incomplete, unassigned, or non-cohesive evidence. Keep exact footprint evidence
task-local; only final topology decisions and concise rationale are durable.
The planning checkpoint must discriminate post-POC handoff from atomic or
pre-POC review, derive the accepted POC head and footprint fingerprint from the
accepted POC, and record material topology change independently of unit IDs.
The existing Plan-to-Execute barrier runs Review's planning-checkpoint command
against that task-local context; a library contract or prose-only pass is not
handoff evidence.

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
- Each final unit carries its own task/spec changes. In the last unit, Execute
  completes task state, synchronizes delta specs into canonical specs, and
  moves the verified change into the dated archive before the final hook-clean
  commit and draft publication. Incomplete or unverified requirements block
  archival.
- Review inspects the resulting canonical-spec/archive state on the exact final
  head. Finish consumes that state as a readiness gate and does not perform
  archival as merge follow-through or branch/worktree cleanup.
- A material final-implementation contract delta returns to Plan; the user
  decides whether another POC is required.

## Review and publication boundary

Review gives every planning artifact, completed POC, and final implementation
one discovery pass covering every phase-specific review type. Planning types
are implementation readiness, edge cases and risk, `code-simplifier`,
refactoring, and delivery shape. Completed-code types are `code-simplifier`,
`code-quality-review`, `deslop`, `diff-review`, and `scrutinize`. One integrated
inline pass may cover a small coherent change; use subagents only when
delegation is faster. Add affected-domain specialists when the exact target
exposes their domain. `code-simplifier` is a core reviewer with its own recorded
outcome for planning, first-objective-proof, completed POC, and final
implementation targets; another review type cannot substitute for it.
Planning Review requests an artifact repair only for a durable contract gap and
returns implementation mechanics and non-contract discoveries to Execute
task-locally.

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
