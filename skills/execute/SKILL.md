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
- Final OpenSpec work implements exactly one top-level delivery unit per MR.
  Nested tasks become cohesive commits and are checked only when final
  implementation independently satisfies them.

Final work starts from the normal target base plus reconciled planning state,
never from POC ancestry. Do not merge, rebase, cherry-pick, or apply POC commits.

Top-level units have a total Git predecessor order even when logical
dependencies permit parallel work. Create one singly owned branch/worktree per
unit. Start independent units immediately, contract-dependent units when their
accepted interface is fixed in the stack seed, and implementation-dependent
units only after required predecessor output exists.

The root branch targets the normal target; every descendant targets its
immediate predecessor branch and restacks onto the predecessor's current
published head before first publication. Eligible owners may implement and fix
feedback concurrently. Restack propagation stays ordered and coalesces obsolete
upstream heads. After a predecessor squash-merges, retarget the immediate child
to the normal target and restack it without replaying predecessor commits, then
refresh every changed effective-diff gate.

## Commit And Review Loop

Use progressive verification. Implement the smallest cohesive boundary and run
the affected unit, type, lint, schema, or other narrow project-native proof.
At first objective proof, run the targeted integration, route, browser, or
equivalent real-entrypoint proof. Run the complete repository-required
verification only when the head is stable for final Review, scheduling
independent commands concurrently when safe. If a final failure may predate the
branch, reproduce it against the target base before attributing it to the diff.

After the narrow proof passes, stage only intended files and use native hook-
enabled Git commit behavior. Never use `--no-verify`. Fix a hook failure before
starting the next boundary.

For every OpenSpec POC, pause when the first objective proof exists: slice 1,
or slice 2 after at most one setup-only slice. Before broadening the POC, run an
exact-diff checkpoint against the reviewed reuse contract, target-base SHA,
diff fingerprint, inspected precedents, and triggered semantic tripwires. It
must contain separate findings-only `code-quality-review` and `scrutinize`
reviewer-run identities plus targeted proof of the real entrypoint and visible
outcome. Do not run the other three completed-code reviewers against
intentionally incomplete POC code. A later architecture-affecting change
invalidates the checkpoint. Keep it task-local; create no repository ledger or
sidecar.

Automatically invoke Review read-only for the exact implementation diff/head.
Review launches independent work as capacity-aware waves and holds mutation
until its phase barrier closes. Execute receives one deduplicated findings
batch, applies accepted fixes as the only writer, and reruns only invalidated
intermediate review and verification surfaces. Read-only investigation and test
design may proceed concurrently, but no reviewer edits this worktree.

When the implementation converges, run the complete five-reviewer exact-head
wave and full stable-head verification once for the publication checkpoint. A
finding that changes the contract returns to Plan. When local Review passes,
hand its checkpoint to Finish when publication is authorized.

Finish may reactivate the current lane owner for CI or hosted-review findings
after publication without another user prompt. If that owner is unavailable,
perform the standard exclusive ownership handoff before a replacement edits.

Execute-only or local-only wording stops before Finish. `implement`, `deliver`,
or `proceed` authorizes the normal publication sequence after Review, but never
authorizes merge.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Continuing after a material decision appears | Freeze writes and return to Plan. |
| Letting several agents edit one worktree | Select one writer; keep reviewers read-only. |
| Promoting POC code into final work | Reimplement from reconciled planning state. |
| Broadening a POC after its first proof without architecture review | Stop and pass the target-specific architecture checkpoint first. |
| Treating working end-to-end behavior as proof of architecture fit | Trace the exact diff to canonical owners and resolve parallel paths. |
| Editing as each reviewer responds | Wait for the phase barrier and apply one accepted findings batch. |
| Running the full suite after every small edit | Use progressive verification and reserve full proof for stable final heads. |
| Treating logical independence as missing Git order | Preserve one total predecessor chain. |
| Publishing or merging from Execute | Hand a current checkpoint to Finish. |

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
