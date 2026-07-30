---
name: glab-stacked-diffs
description: Use when creating or managing stacked GitLab merge requests with `glab stack`, especially when publishing real diffs in order, promoting a child after predecessor merge, or recovering stack-managed history.
allowed-tools: Bash(glab:*), Bash(git:*), AskUserQuestion
---

# GitLab Stacked Diffs

Use `glab stack` as a bounded specialist inside the active lifecycle mode. It
preserves one Git predecessor order while keeping each MR boundary visible.
It does not grant repository-write, provider-write, ready, merge, deployment,
or cleanup authority.

## When to Use

- A change has several independently reviewable, sequential MRs.
- A published ancestor must change without restacking descendants.
- A direct Git operation may have diverged from `glab stack` metadata.
- A predecessor merged and the next child must be retargeted and restacked.

Use a single MR for one coherent change. Use separate, unrelated MRs when the
changes have no predecessor relationship.

## Core Invariants

- **One total Git order:** every descendant targets its immediate predecessor
  until that predecessor merges.
- **One substantive owner:** identify the MR whose incremental diff owns each
  requested change. Descendants changed only by rebase are propagation-only.
- **Sequential initial publication:** create every real-diff draft MR one after
  another in total Git order. Never create empty placeholders.
- **Promotion-only restacking:** an open predecessor push does not restack
  descendants. After it merges, restack only its immediate child; keep deeper
  descendants untouched.
- **Managed history:** use `glab stack save` for new stack commits and
  `glab stack amend` only during unpublished construction or at the tip. Amend
  a published non-tip source branch natively so descendant refs stay fixed.
  Do not synthesize replacement history unless the user explicitly requests it
  or Plan accepts recovery because the managed stack cannot represent the live
  topology.
- **Hooks stay enabled:** never use a hook-bypass flag.
- **Draft is durable:** technical readiness does not mark an MR ready. Explicit
  merge authority controls ready state and bottom-to-top merging.

## Authority Routing

| Operation | Lifecycle owner |
| --- | --- |
| Inspect stack, branches, MRs, and remote heads | Explore or Review |
| Edit, stage, validate, `stack save`, `stack amend` | Execute |
| `stack sync`, create/update MRs, descriptions, hosted gates | Finish |
| Mark ready, merge, deploy, or clean up | Explicit terminal authority |

When a workflow crosses a boundary, return control to that owner. This skill
supplies stack mechanics; it never expands the current mode's authority.

## Managed-Stack Preflight

Before any amendment or sync:

1. Run `glab auth status` and resolve the selected GitLab repository.
2. Inspect `git status --short`, `git branch --show-current`, remote URLs, and
   `glab stack list`.
3. Map every stack MR in target-branch order. Record its IID, source branch,
   target branch, state, draft state, and current remote source SHA.
4. Verify the intended branches belong to the active managed stack. A direct
   commit, missing branch, closed or merged MR, unexpected target, or external
   remote-head change stops mutation for recovery inspection.
5. Separate the substantive update set from the propagation-only descendant
   set. Do not broaden the requested MR merely because later commits depend on
   it.

For a fully published stack, do not use `glab stack sync` to propagate rewritten
heads. An open predecessor change stays local to that MR. After predecessor
merge, promote the immediate child with an exact expected-head lease.
`stack sync` also
cannot safely create new final MRs under this policy: it has no draft option and
cannot attach a separately created draft MR to an empty stack reference. It is
experimental and may remove managed entries for merged MRs, so inspect all
states first.

See [workflows.md](references/workflows.md) for the concrete preflight and
publication loop.

## Building a New Stack Locally

1. Decide the incremental MR boundaries and one total order.
2. Run `glab stack create <stack-name>`.
3. Implement, stage, validate, and save each logical unit with
   `glab stack save -m "<semantic imperative description>"`. The description is
   also the commit subject, so keep provider state such as `Draft:` out of it.
4. Publish each coherent real diff sequentially through
   `change-request-create`, preserving the immediate-predecessor target and
   draft state. Do not create an empty placeholder to reserve stack topology.

The first MR targets the normal base. Every descendant targets its immediate
predecessor branch.

## Updating a Published Stack

Amend and publish only the substantive MR. Do not restack its descendants;
their current gates remain provisional. Use the published-stack workflow for
navigation, focused proof, live verification, and promotion after merge.

## Direct Commit or Unmanaged State

Do not force-push, reset, or rebuild immediately.

1. Inspect the current branch, HEAD, reflog, `glab stack list`, MR mapping, and
   descendant remote heads.
2. Preserve valuable tips with explicit recovery branches before rewriting.
3. Determine whether the direct commit belongs in the current diff or is a new
   tip diff. For a published non-tip MR, recover it through a native
   hook-enabled amendment that leaves descendant refs untouched. Use
   `glab stack amend` only before publication or at the stack tip.
   Use `glab stack save` only when
   the current entry is the last stack entry and the new unit belongs after it.
   From any middle entry, preserve the patch and return to Plan because version
   1.108 would silently append it to the stack tip.
4. Use a recoverable Git operation to return the changes to the index or work
   tree, then apply the supported stack command.
5. Compare the resulting tree and incremental boundaries with the preserved
   tips before progressive publication.

If the live topology cannot be represented safely, freeze writes and return
the evidence to Plan. Destructive recovery requires explicit authorization.

See [troubleshooting.md](references/troubleshooting.md) for recovery cases.

## Predecessor Merge

After an explicitly authorized predecessor merge, follow the canonical Finish
contract: verify the merged commit, confirm the immediate child retargeted to
the normal base, and restack without replaying predecessor commits. Capture the
expected child remote head before its push. A rejected lease stops the sequence
for ownership inspection. Refresh that child's gates and leave deeper
descendants untouched.

## Quick Reference

| Need | Command |
| --- | --- |
| Create stack | `glab stack create <name>` |
| Save staged work as a new local diff | `glab stack save -m "<semantic description>"` |
| Amend an unpublished or tip diff | `glab stack amend` |
| Amend a published non-tip MR | Native hook-enabled `git commit --amend`; do not move descendant refs |
| Publish a new stack | Create each coherent real-diff draft sequentially through `change-request-create` |
| Publish an amended MR | Exact-lease only its source branch; leave descendants untouched |
| Select a diff | `glab stack move` |
| Inspect stacks | `glab stack list` |

Run the installed command's `--help` before relying on flags because
`glab stack` is experimental. See
[command-reference.md](references/command-reference.md) for behavioral notes.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Creating empty placeholder MRs | Implement coherent real diffs and create MRs one after another. |
| Restacking descendants after an open predecessor changes | Publish only the predecessor; descendants remain provisional. |
| Using stack sync to push an existing published stack | Wait for predecessor merge, then promote only the immediate child with an exact lease. |
| Using `Draft:` in a managed description | Keep commit subjects semantic; `change-request-create` owns the hosted draft title and body. |
| Ordinary `git commit` inside a managed stack | Preserve the tip, inspect metadata, and recover through amend/save. |
| Re-running after a lease rejection | Inspect the external remote-head change and re-establish ownership. |
| Updating descriptions directly | Apply `change-request-create`, then provider mechanics and readback. |
| Marking green MRs ready | Leave them draft until explicit merge authority begins. |

## References

- [workflows.md](references/workflows.md) — creation, progressive amendment,
  propagation, review, and predecessor-merge workflows
- [troubleshooting.md](references/troubleshooting.md) — recoverable failure paths
- [command-reference.md](references/command-reference.md) — command behavior and
  safety constraints
- [upstream.md](references/upstream.md) — fork provenance

Use `glab-cli` for general GitLab inspection. Use `change-request-create` as the
only selectable owner for creating or changing any reviewer-facing MR.
