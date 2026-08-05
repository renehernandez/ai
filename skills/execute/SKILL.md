---
name: execute
description: Use when implementing a clear request, an atomic plan, an OpenSpec POC, or one final OpenSpec delivery unit in an owned worktree.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Write, Edit, Bash
---

# Execute

## Authority

Execute owns repository implementation writes in one coordinated worktree. It
does not own provider mutation, merge, deployment, or remote cleanup. For
non-trivial entry, announce `Execute`, repository-write authority, and the goal
once.

Direct Execute is allowed only for one coherent implementation MR with no
unresolved behavior, architecture, migration, safety, ownership, ordering,
cross-component, or verification decision. If implementation discovers one,
freeze writes and return the decision plus current worktree identity to Plan.

## Worktree Preflight

Before the first write and after resume:

1. inspect repository rules, current branch, HEAD, remotes, hosted artifact
   state, changed paths, and untracked paths;
2. verify the expected branch/worktree owner and diff fingerprint;
3. move to a dedicated worktree when ownership is unknown, shared, dirty from
   unrelated work, or divergent from the handoff; and
4. allow exactly one writer to edit, stage, and commit that artifact.

Before implementation writes, also run a lightweight environment preflight:

1. resolve the repository's documented setup;
2. report the actual runtime and package-manager versions;
3. confirm required commands and task-specific credentials are available; and
4. run one small representative project-native command that can expose an
   incompatible toolchain or incomplete setup.

Stop on an environment blocker before producing a substantial implementation
diff. Do not use this preflight as a reason to run the full test suite early.

Read-only reviewers may run in parallel. Another writer needs a different
branch/worktree with one writer. Prefer disjoint paths, but allow declared
integration hotspots whose normal restack conflicts belong to the descendant
owner. A handoff identifies branch, worktree, HEAD, changed and untracked paths,
and diff fingerprint; the previous writer stops first.

## Reuse Preflight And Tripwires

Before implementation writes, verify the accepted reuse and deviation contract
against the current repository. Locate the named precedents and canonical
owners, confirm the planned reuse path still exists, and search the affected
area for sibling helpers, parsers, handlers, services, renderers, policies,
schemas, constants, identities, formatting, routing, and lifecycle invariants.
Direct Execute without a planning artifact performs the same read-only
precedent scan and records its conclusion in the task.

Pause implementation and inspect the exact diff whenever it introduces:

- a sibling helper, parser, handler, service, renderer, or policy;
- a repeated schema, constant, identity, formatting, routing, or lifecycle
  invariant;
- a feature-specific branch inside shared infrastructure;
- a second durable source of truth; or
- evidence that the planned precedent cannot support the implementation path.

Resolve a scoped duplication or boundary finding in Execute. Return to Plan
when the evidence changes canonical ownership, the accepted reuse path, or
another material architecture decision.

## Implementation Routes

- Direct work implements one coherent final MR. Atomic work keeps the plan and
  implementation in one change set for that single final MR and has no POC.
- A POC implements the complete reviewed OpenSpec in its disposable worktree,
  including applicable production concerns, without checking source tasks.
- A technically ready or personally accepted POC remains open. Capture durable
  implementation and feedback learnings for Plan's consolidated reconciliation;
  closure requires an explicit user request or contextual authority that the
  work is ready to proceed to stack breakdown.
- Final OpenSpec work implements exactly one top-level delivery unit per MR.
  Nested tasks become cohesive commits and are checked only when final
  implementation independently satisfies them.

## Completed OpenSpec Closure

In the last final OpenSpec unit, after implementation and focused proof satisfy
every reconciled task and requirement, Execute owns the repository
transformation that removes the completed change from active discovery:

1. mark final task state complete;
2. synchronize delta specs into their canonical specs;
3. move the change into the dated archive; and
4. validate the canonical specs and archived record.

Perform this transformation before the final hook-clean commit and draft
publication so implementation, completed tasks, canonical specs, and archive
state share one exact review head. If any reconciled task or requirement is
incomplete or unverified, leave the change active and block completed-change
archival. A later archive or canonical-spec repair changes HEAD and refreshes
affected review and hosted evidence.

Archival is implementation state, not merge follow-through or branch/worktree
cleanup. Ordinary delivery follows this lifecycle contract without inferring
the explicit-only `openspec-archive-change` adapter. An abandoned or superseded
change returns to Plan for an explicit disposition and is never silently marked
complete.

Final work starts from the normal target base plus reconciled planning state,
never from POC ancestry. Do not merge, rebase, cherry-pick, or apply POC commits.

Top-level units have a total Git predecessor order even when logical
dependencies permit parallel work. Create one singly owned branch/worktree per
unit. Start independent units immediately, contract-dependent units when their
accepted interface is fixed in the stack seed, and implementation-dependent
units only after required predecessor output exists.

The root branch targets the normal target; every descendant targets its
immediate predecessor branch. Create the initial real-diff draft MRs one after
another in total Git order and never create empty placeholders. Eligible owners
may implement and fix feedback concurrently. Once the stack exists, an open
predecessor push does not restack any descendant. After a predecessor
squash-merges, retarget and restack only its immediate child without replaying
predecessor commits; deeper descendants remain untouched. Refresh the promoted
child's gates, including the delivery budget.

## Commit And Review Loop

Use progressive verification. Implement the smallest cohesive boundary and run
the affected unit, type, lint, schema, or other narrow project-native proof.
At first objective proof, run the targeted integration, route, browser, or
equivalent real-entrypoint proof. Do not manually rerun the complete repository
suite before Review; the native pre-commit hook owns that full proof for each
committed head. If a hook failure may predate the branch, reproduce it against
the target base before attributing it to the diff.

After the narrow proof passes, stage only intended files and use native hook-
enabled Git commit behavior. Never use `--no-verify`. Fix a hook failure before
starting the next boundary.

Before the hook-clean publication commit, measure the complete effective diff.
A non-removal final implementation targets at most 10 changed files and 500
additions plus deletions. Above either target, retain the accepted
unsafe-to-split rationale. More than 15 files or 1,000 changed lines returns to
Plan unless the user approved a semantic exception for the named artifact,
accepted outcome, and unsafe-to-split rationale. Contract-preserving rebases,
base movement, and Review, Nitro, CI, validation, or path repairs preserve that
authority. Renew it for a material outcome, ownership, behavior, deployment,
review-boundary, or practical split change. A non-removal final MR may never
exceed 50 files.

A removal-only MR has no numeric file or line cap when it adds no replacement
behavior, dependency, migration, or unrelated refactoring. The complete
disposable POC is exempt.

## Publication-Ready Dispatch

In a multi-MR delivery, a hook-clean commit freezes that unit at its source
branch and exact SHA. Apply the canonical scheduling rule in
`rules/investigation-and-implementation.md`; it owns publication readiness, the
task-wide barrier, pause and resume signaling, capacity recovery, blockers, and
user-checkpoint semantics. Resolve its launch prerequisites and assemble the
canonical Immutable Publication Packet from `rules/handoff-and-resume.md`, then
start one MR-specific Finish subagent. Do not begin another repository mutation
until the canonical scheduling rule releases the barrier.

The packet is not a repository ownership handoff. The Finish subagent never
becomes a writer, and implementation findings return to the current Execute
owner as one deduplicated batch. Report the lane launch or concrete blocker once
in task commentary; maintain no parallel status representation. Single-MR work
with no useful concurrent lane may keep Finish inline, but the speed of MR
creation does not make a multi-MR delivery eligible for that exception.

One MR per unit is an artifact boundary, not a user approval checkpoint. Apply
the canonical rule without inventing a pause between accepted eligible units.

For every OpenSpec POC, enter a phase barrier when the first stack objective
proof exists: unit 1, 2, or 3 after at most two reviewed groundwork units. The
first-objective phase barrier is not a user approval checkpoint. Before
broadening the POC, run an exact-diff checkpoint against the reviewed reuse
contract, target-base SHA, diff fingerprint, inspected precedents, and triggered
semantic tripwires. A passing checkpoint resumes the accepted POC in Execute
without renewed permission. Contract-preserving findings return automatically
to Execute; findings that change a material contract return to Plan and the
user. The checkpoint must contain separate findings-only `code-quality-review`
and `scrutinize` reviewer-run identities, a separate findings-only
`code-simplifier` reviewer-run identity, and targeted proof of the real
entrypoint and visible outcome. Every first-proof reviewer result records the
exact evidence inspected, including a passing result. Do not
run `deslop` or `diff-review` against intentionally incomplete POC code. A later
architecture-affecting change invalidates the checkpoint. Keep it task-local;
create no repository ledger or sidecar.

After the hook-clean commit is published to a draft PR/MR and hosted review is
requested, invoke Review read-only for the exact hosted diff/head. Review covers
every phase-specific type inline or through capacity-aware delegation and holds
mutation until its phase barrier closes. Inline Review and review subagents
consume hook evidence instead of rerunning the full suite. Execute receives one
deduplicated findings batch, applies required in-scope repairs as the only
writer, and defers optional improvements.

After repairs, run one closure check limited to the enumerated findings and
affected verification. Do not restart discovery for ordinary repair commits. A
finding or repair that materially changes the accepted contract or review risk
returns to Plan or one new bounded discovery pass. Review emits the exact-target
technical-readiness checkpoint after publication and hosted-review request.

Finish may reactivate the current lane owner for CI or hosted-review findings
after publication without another user prompt. If that owner is unavailable,
perform the standard exclusive ownership handoff before a replacement edits.

Apply the accepted-proposal contract in
[`investigation-and-implementation.md`](../../rules/investigation-and-implementation.md).
Execute-only or local-only limits stop before Finish; a standard delivery route
hands its hook-clean commit to Finish for draft publication and hosted follow-
through. That handoff is not another permission boundary and never authorizes a
terminal action.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Continuing after a material decision appears | Freeze writes and return to Plan. |
| Letting several agents edit one worktree | Select one writer; keep reviewers read-only. |
| Promoting POC code into final work | Reimplement from reconciled planning state. |
| Broadening a POC after its first proof without architecture review | Stop and pass the target-specific architecture checkpoint first. |
| Treating working end-to-end behavior as proof of architecture fit | Trace the exact diff to canonical owners and resolve parallel paths. |
| Editing as each reviewer responds | Wait for the phase barrier and apply one accepted findings batch. |
| Restarting discovery after every repair | Run one bounded closure check unless the contract or review risk materially changed. |
| Manually running the full suite before Review | Run focused proof; let the native commit hook own the full suite once. |
| Treating logical independence as missing Git order | Preserve one total predecessor chain. |
| Treating a separately owned active writer as exempt from publication dispatch | Let its in-flight mutation finish, then pause it at the next safe tool boundary until the Finish subagent starts. |
| Treating draft publication as technical readiness | Publish hook-clean, then complete local and hosted review. |
| Leaving a completed OpenSpec active for a later cleanup | Complete, synchronize, and archive it in the last Execute unit before the final commit. |

## Test Evidence

- RED: a production-complete rehearsal reached working behavior before review
  exposed sibling services, repeated invariants, and feature branches in shared
  infrastructure.
- GREEN: the reuse-first fixture permits expansion only when precedent evidence,
  semantic tripwires, architecture fit, strict code quality, target base, and
  diff identity all pass.
- REFACTOR: fixture variants reject missing evidence, unresolved tripwires,
  stale fingerprints, missing reviewers, and later architecture changes without
  adding persistent workflow state.
- RED: with only the previous final-unit archive sentence, a fresh agent could
  not determine whether Execute archived before review or Finish archived as
  cleanup, while the explicit adapter remained unavailable to ordinary wording.
- GREEN: under deadline, authority, and sunk-review pressure, the revised
  lifecycle consistently keeps completed-change archival in Execute before the
  final commit, leaves unverified work active, and does not infer the adapter.
- RED: after a hook-clean ancestor commit, a baseline delegated publication but
  claimed that a separately owned descendant writer did not pause because its
  worktree remained semantically eligible.
- GREEN: the task-wide dispatch barrier pauses every writer only at its next
  mutation until the MR-specific Finish subagent starts, then restores all
  eligible Execute concurrency without waiting for provider completion.
- RED: task `019fcd53-a12d-7171-94c0-a8979b46e333` treated a passing POC
  first-objective phase barrier as a request for user acceptance before the
  remaining accepted rehearsal could continue.
- GREEN: a passing first-objective checkpoint resumes the accepted POC
  automatically, while a material architecture finding still returns to Plan.
