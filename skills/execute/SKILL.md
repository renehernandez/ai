---
name: execute
description: Use when implementing a clear request, an atomic plan, an OpenSpec POC, or one final OpenSpec delivery unit in an owned worktree.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Write, Edit, Bash
---

# Execute

## Authority

Execute owns repository implementation writes in one coordinated worktree. It
does not own provider mutation, merge, deployment, or remote cleanup. Announce
Execute, repository-write authority, and the goal once on non-trivial entry.

Enter only when no material behavior, architecture, migration, safety,
ownership, ordering, cross-component, or proof decision remains. Freeze writes
and return the decision plus worktree identity to Plan when implementation
invalidates that condition. Apply the accepted-proposal contract and shared
scheduling mechanics in `rules/investigation-and-implementation.md`.

## Setup and Ownership

Before the first write and after resume:

1. inspect repository instructions, branch, HEAD, remotes, hosted artifact,
   changed paths, and untracked paths;
2. verify expected branch/worktree ownership and diff fingerprint;
3. confirm documented setup, runtime, package manager, required commands, and
   task credentials with one small representative command; and
4. allow exactly one writer to edit, stage, and commit the artifact.

This is ordinary Execute setup, including under Fast delivery. Do not expose it
as a separate preflight phase, report, checkpoint, or user pause.

Use another owned worktree for another writer. Read-only reviewers may run in
parallel. A handoff records branch, worktree, HEAD, changed/untracked paths, and
diff fingerprint; the previous writer stops before ownership moves.

Verify the accepted reuse and deviation contract against current precedents and
canonical owners. Search for sibling helpers, parsers, services, policies,
schemas, identities, formatting, routing, and lifecycle invariants. Inspect the
exact diff when it creates a parallel owner, repeats an invariant, branches
inside shared infrastructure, or contradicts the planned reuse path. Resolve
scoped duplication here; return changed canonical ownership or architecture to
Plan.

## Implementation Routes

- Direct or atomic work implements one coherent final MR; atomic work keeps its
  plan and implementation in the same change set and has no POC.
- Explicit eligible Fast delivery implements one concrete, settled, coherent
  final MR without a committed plan or POC. If a material decision, multi-unit
  shape, durable cross-component contract, migration design, or rehearsal need
  appears, freeze writes and return to Plan under project policy.
- A POC implements the complete reviewed OpenSpec in a disposable worktree,
  leaves source tasks unchecked, and captures durable learnings for Plan.
- Final OpenSpec work implements one top-level delivery unit per MR. Nested work
  becomes cohesive commits and is checked only when independently satisfied.

Final implementation starts from the normal target plus reconciled planning
state, never POC ancestry, commits, patches, cherry-picks, or branches.
An accepted POC remains open; closure requires an explicit request or contextual
authority that the work is ready to proceed to stack breakdown.

In the last final unit, after every reconciled requirement and task has proof,
mark tasks complete, synchronize delta specs into canonical specs, move the
change to the dated archive, and validate both canonical and archived state.
Do this before the final hook-clean commit. Leave incomplete or unverified work
active; archival is repository state, not Finish cleanup.
Ordinary completion does not invoke the explicit-only
`openspec-archive-change` adapter.

## Stack Execution

Preserve the total Git order supplied by Plan. Start independent units
immediately, contract-dependent units after their interface is fixed, and
implementation-dependent units after predecessor output exists. Each unit has
one owned branch/worktree.

The root targets the normal base; each descendant targets its immediate
predecessor. Create real-diff draft MRs sequentially in Git order. Never restack
descendants while a predecessor is open. After a predecessor merges, retarget
and restack only its immediate child and refresh that child's gates; deeper
descendants remain untouched.

## Verification and Commit Loop

Implement the smallest cohesive boundary and run affected unit, type, lint,
schema, or other narrow project-native proof. At first objective proof, run the
real entrypoint or fidelity-equivalent integration proof. Stage only intended
files and commit with native hooks; never bypass them. The hook owns the full
repository suite, so Review consumes that evidence instead of rerunning it.

Measure the complete effective diff before publication and apply the canonical
budget, removal-only, POC exemption, and semantic-exception rules from the
shared workflow rule. A material split or outcome change returns to Plan.

For every OpenSpec POC, pause at first objective proof—unit 1, 2, or 3 after no
more than two groundwork units. The exact-diff checkpoint binds target-base SHA,
diff fingerprint, reuse evidence, semantic tripwires, real-entrypoint proof, and
separate findings-only `code-quality-review`, `scrutinize`, and
`code-simplifier` identities. Missing evidence or later architecture-affecting
change blocks expansion. This first-objective phase barrier is not a user
approval checkpoint; a passing checkpoint resumes the accepted POC without
renewed permission. Contract-preserving findings return to Execute; material
contract findings return to Plan. Keep the checkpoint task-local.

## Publication and Review Dispatch

A hook-clean multi-MR unit freezes at its source branch and exact SHA. Assemble
the canonical Immutable Publication Packet from `rules/handoff-and-resume.md`
and launch one MR-scoped, provider-only Finish lane under the shared scheduling
barrier. The lane never becomes a repository writer. Do not invent a user pause
between accepted delivery units.

Under Standard delivery: After draft publication and hosted-review request,
run read-only Review against the exact hosted diff/head. Wait for the phase barrier
and receive one deduplicated findings batch. Repair as the only writer, then
run closure only for affected findings and proof. Material contract or review-risk
change returns to Plan or new bounded discovery. Review emits the exact-target
technical-readiness checkpoint.

Under Fast delivery, do not dispatch completed-code local Review or reviewer
subagents. Hand the hook-clean head to Finish for Ready publication, required CI,
and exact-head Nitro review. Repair every in-scope actionable hosted finding,
commit through native hooks, and return each new head to Finish until both gates
pass. This loop does not authorize merge, deployment, or cleanup.

Finish may route CI or hosted findings back to the current owner without a new
prompt. Execute-only or local-only scope stops before Finish. Standard or Fast
delivery hands the hook-clean commit to Finish; that handoff is not another permission
boundary and never authorizes merge, deployment, or cleanup.
