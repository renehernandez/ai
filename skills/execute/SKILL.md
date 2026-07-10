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

Read-only reviewers may run in parallel. Another writer needs a different
branch/worktree with one writer. Prefer disjoint paths, but allow declared
integration hotspots whose normal restack conflicts belong to the descendant
owner. A handoff identifies branch, worktree, HEAD, changed and untracked paths,
and diff fingerprint; the previous writer stops first.

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

Implement the smallest cohesive boundary, verify it, stage only intended files,
and use native hook-enabled Git commit behavior. Never use `--no-verify`. Fix a
hook failure before starting the next boundary.

Automatically invoke Review read-only for the exact implementation diff/head.
Execute fixes in-scope implementation findings, then refreshes Review. A
finding that changes the contract returns to Plan. When local Review passes,
hand its publication checkpoint to Finish when publication is authorized.

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
| Treating logical independence as missing Git order | Preserve one total predecessor chain. |
| Publishing or merging from Execute | Hand a current checkpoint to Finish. |
