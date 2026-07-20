---
name: glab-stacked-diffs
description: Use when creating or managing stacked GitLab merge requests with `glab stack`, especially when amending published ancestors, propagating descendants, or recovering stack-managed history.
allowed-tools: Bash(glab:*), Bash(git:*), AskUserQuestion
---

# GitLab Stacked Diffs

Use `glab stack` as a bounded specialist inside the active lifecycle mode. It
preserves one Git predecessor order while keeping each MR boundary visible.
It does not grant repository-write, provider-write, ready, merge, deployment,
or cleanup authority.

## When to Use

- A change has several independently reviewable, sequential MRs.
- A published ancestor must change and descendants must be restacked.
- A direct Git operation may have diverged from `glab stack` metadata.
- A predecessor merged and the next child must be retargeted and restacked.

Use a single MR for one coherent change. Use separate, unrelated MRs when the
changes have no predecessor relationship.

## Core Invariants

- **One total Git order:** every descendant targets its immediate predecessor
  until that predecessor merges.
- **One substantive owner:** identify the MR whose incremental diff owns each
  requested change. Descendants changed only by rebase are propagation-only.
- **Progressive publication:** for an existing published stack, finish one
  substantive MR, publish its affected chain, and verify it before editing the
  next substantive MR.
- **Atomic propagation, concurrent gates:** publish each changed descendant
  chain in one all-or-none remote transaction; start independent CI and hosted
  review as soon as the updated MRs are visible.
- **Managed history:** use `glab stack save` and `glab stack amend` for stack
  commits. Do not synthesize replacement history unless the user explicitly
  requests it or Plan accepts recovery because the managed stack cannot
  represent the live topology.
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
heads. In `glab` 1.108 it fetches before one bulk push with an unqualified lease,
so it cannot enforce the captured expected SHA for each branch. Publish the
affected chain as one atomic, exact-leased multi-ref push. `stack sync` also
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
4. Stop before provider publication under `glab` 1.108. `stack sync` creates an
   MR from the managed description without an explicit draft field, while a
   separately created draft MR is not attached back to an empty stack reference.
5. Return to Plan for a tested draft-create-and-attach mechanism or a newer
   installed implementation that proves the same contract. Do not publish a
   transient non-draft MR or manually edit stack metadata as an ad hoc repair.

The first MR targets the normal base. Every descendant targets its immediate
predecessor branch.

## Updating a Published Stack Progressively

Never use “amend every local branch, then sync once at the end” for a published
multi-MR correction. That hides boundaries and delays the user's first usable
result.

For each substantively affected MR, earliest to latest:

1. Navigate with `glab stack move`. Verify the branch with
   `git branch --show-current` and resolve the matching MR by source branch.
2. Make only that MR's correction. Stage intended files and run the narrow
   behavior-specific proof.
3. Run `glab stack amend`. Inspect the current incremental diff and each
   descendant changed by the automatic rebase.
4. Re-read the affected remote source SHAs. If any changed since preflight,
   stop and reconcile ownership; do not retry against the new SHA blindly.
5. In Finish, publish the complete affected chain immediately as one atomic,
   multi-ref push with one exact lease per captured branch SHA. Run the command
   from
   [command-reference.md](references/command-reference.md#exact-leased-publication-for-an-existing-stack)
   once for the chain. After it succeeds, confirm every live head and target.
   An unchanged expected head is failed propagation. If the server does not
   support atomic pushes, stop without falling back to partial publication.
6. Apply any description/navigation changes through `change-request-create`.
   Request required hosted review for every changed effective diff and let
   independent gates run concurrently.
7. Only then move to the next MR needing substantive work.

This produces frequent reviewable MR checkpoints without weakening descendant
consistency. The canonical multi-unit coalescing rule still applies to
unpublished implementation heads. During published-stack repair, coalesce only
a same-ancestor propagation head made obsolete before its atomic publication;
never wait for hosted review or coalesce distinct substantive checkpoints.

## Direct Commit or Unmanaged State

Do not force-push, reset, or rebuild immediately.

1. Inspect the current branch, HEAD, reflog, `glab stack list`, MR mapping, and
   descendant remote heads.
2. Preserve valuable tips with explicit recovery branches before rewriting.
3. Determine whether the direct commit belongs in the current diff
   (`glab stack amend`) or is a new diff (`glab stack save`).
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
for ownership inspection. Refresh every changed effective-diff gate.

## Quick Reference

| Need | Command |
| --- | --- |
| Create stack | `glab stack create <name>` |
| Save staged work as a new local diff | `glab stack save -m "<semantic description>"` |
| Amend the current managed diff | `glab stack amend` |
| Publish a new stack under `glab` 1.108 | Blocked pending tested draft-create-and-attach support |
| Publish a rewritten existing chain | Use the atomic refspecs and exact leases in the command reference |
| Select a diff | `glab stack move` |
| Inspect stacks | `glab stack list` |

Run the installed command's `--help` before relying on flags because
`glab stack` is experimental. See
[command-reference.md](references/command-reference.md) for behavioral notes.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Reconstructing the complete final history first | Return to the earliest substantive MR and publish progressively. |
| Amending all MRs before one publication wave | Publish and verify after each substantive MR. |
| Treating rebased descendants as new substantive scope | Label them propagation-only and verify their incremental diffs. |
| Using stack sync to push an existing published stack | Use one atomic multi-ref push with exact expected-SHA leases. |
| Using `Draft:` in a managed description | Keep commit subjects semantic; block new-stack publication until draft creation can attach safely. |
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

Use `glab-cli` for general GitLab operations and `glab-mr-create` for a single,
non-stacked MR. Use `change-request-create` before creating or changing any
reviewer-facing MR description.
