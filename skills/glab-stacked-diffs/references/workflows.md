# Stacked Diffs Workflows

These workflows preserve visible MR boundaries and one Git predecessor order
without spending resources on speculative descendant restacks. Lifecycle
authority remains with Explore, Plan, Execute, Review, and Finish.

## Contents

- Create a stack
- Map a published stack
- Update one published MR
- Review provisional descendants
- Add or reorder a diff
- Rebase onto an updated base
- Handle a predecessor merge
- Maintain navigation and descriptions

## Create a Stack

### 1. Plan incremental units

Each MR should be independently understandable and testable. Record one total
Git order even when some units can be developed concurrently. The first MR
targets the normal base; every descendant targets its immediate predecessor.

### 2. Create and verify the managed stack

```bash
glab stack create <stack-name>
```

```bash
glab stack list
```

### 3. Save each unit

For each unit, implement the smallest cohesive boundary, run focused proof,
stage only its files, and save it through the stack manager.

```bash
git add <paths>
```

```bash
glab stack save -m "<semantic imperative description>"
```

Inspect the current incremental commit before starting the next unit. The
managed description is also the commit subject, so keep it semantic.

### 4. Publish real diffs sequentially

After each branch contains a coherent implementation, invoke
`change-request-create` and publish its draft MR. Create the root first, then
each child one after another in total Git order so its immediate predecessor
branch already exists. Never create an empty placeholder MR.

## Map a Published Stack

Do this before every feedback or repair cycle.

1. Resolve the selected GitLab repository and authenticate.
2. Run `glab stack list` and identify the active stack.
3. List the open MRs and map source branch to target branch.
4. Walk the target-branch chain from the normal base to the tip.
5. For each MR, record IID, title, source, target, state, draft state, source
   SHA, and current pipeline/review context needed by the active mode.
6. Compare the managed entries with the live MR chain.

Stop before mutation if:

- a branch is not represented in the managed stack;
- an expected MR is closed, merged, missing, or targets the wrong branch;
- a direct commit is outside the known managed history;
- the working tree contains unrelated changes; or
- another writer changed a remote head.

## Update One Published MR

When feedback changes one MR, amend and publish only that MR:

1. Select it with `glab stack move`.
2. Verify the current branch.
3. Resolve the live MR for that exact source branch.
4. Apply only that MR's correction.
5. Stage intended files and run focused proof.
6. Amend only the selected source branch with native hooks enabled. Use
   `glab stack amend` only when the selected entry is the stack tip; otherwise
   use `git commit --amend` so descendant refs do not move.

```bash
git branch --show-current
```

```bash
glab mr list --source-branch <current-branch>
```

```bash
git add <paths>
```

```bash
git commit --amend --no-edit
```

Do not accept an automatic descendant rewrite or invoke the stack tool's
descendant-rewriting amendment path for a published non-tip MR. Preserve the
descendants' existing source heads and mark their gates provisional.

Immediately before publication, re-read this MR's remote head. If it still
matches preflight, Finish publishes only this branch with an exact lease:

```bash
git push --force-with-lease=refs/heads/<branch>:<expected-sha> <selected-GitLab-url> refs/heads/<branch>:refs/heads/<branch>
```

After success, verify that branch's live head and target, update reviewer-facing
content through `change-request-create`, and explicitly request current hosted
review. Do not restack or request Nitro for target-only movement on descendants.

## Review Provisional Descendants

Review bottom-to-top. For each MR:

1. Compare its source branch with its current target branch.
2. Confirm substantive changes live in their declared owning MR.
3. Treat every unpromoted descendant gate as provisional after an ancestor
   changes.
4. Refresh proof, CI, approvals, and hosted review only when that descendant is
   promoted after predecessor merge.

A green pipeline from an older source head or older predecessor head is stale.
Review gates can execute concurrently, but readiness and merge order remain
bottom-to-top.

## Add or Reorder a Diff

Adding a diff changes stack membership and is not part of an ordinary repair
unless explicitly accepted.

`glab stack save` in version 1.108 is append-only. It adds a new diff after the
last entry even when another entry is selected. Appending a local unit therefore
uses the normal semantic save workflow. After acceptance and local proof,
publish its coherent real-diff draft through `change-request-create` against
the current last branch.

A mid-stack insertion or reorder returns to Plan. Version 1.108
`glab stack reorder` changes local stack metadata and immediately retargets
hosted MRs; it does not rebase Git ancestry. If Plan accepts a recovery, it must
name the recoverable ancestry operation, exact source-versus-target diff proof,
and total target order. Execute repairs and verifies local ancestry first.
Finish alone may run `stack reorder` or otherwise retarget hosted MRs, followed
by one exact-leased source publication at a time in the accepted total order
and refreshed gates for every materially changed effective diff. This is an
explicit topology repair, not automatic descendant propagation after ordinary
feedback. Do not present `stack save` plus `stack reorder` as an insertion or
restack primitive.

## Rebase onto an Updated Base

Rebase only for a concrete reason such as conflicts, base-sensitive failures,
or an explicit request. Avoid churn from routine freshness rebases.

1. Fetch the normal base.
2. Navigate to the first diff.
3. Record current remote heads.
4. Rebase onto the resolved base commit.
5. Resolve conflicts bottom-to-top and inspect every incremental diff.
6. If this changes an already published predecessor, publish only that branch
   with an exact expected-SHA lease. Do not propagate the rewrite to
   descendants before predecessor merge.

```bash
git fetch origin <base>
```

```bash
glab stack first
```

```bash
git rebase <resolved-base-sha>
```

Do not combine these observations and mutations into one compound command.

## Handle a Predecessor Merge

This workflow requires explicit merge authority for the predecessor.

1. Verify the predecessor's live source head and merge result.
2. Fetch the normal base and resolve the merged commit.
3. Confirm GitLab retargeted the immediate child to the normal base.
4. Capture the child's exact remote source SHA.
5. Restack the child using the merged commit and old predecessor head so the
   predecessor commits are not replayed.
6. Publish the child atomically with an explicit lease naming the captured
   remote head.
7. Refresh every changed effective-diff gate before the child can be marked
   ready.
8. Leave deeper descendants untouched until their own predecessor merges.

If the lease is rejected, stop and inspect external commits. Do not accept the
new remote SHA and retry blindly.

All technically ready MRs remain draft. Single-MR merge authority marks only
the current bottom MR ready immediately before its merge and is consumed after
that merge. Complete the required child repair, but leave the child draft and
stop before another merge. Continue bottom-to-top only under a user-authored
aggregate stack scope or user-authored sequential instruction. Generic assent
such as `yes`, `agreed`, or `proceed` to an agent-proposed sequence is
insufficient. Preserve valid sequence authority across a
patch-equivalent restack only. A material effective-diff change stops the
sequence before the affected MR and leaves it and changed descendants draft
until the user renews merge authority after review.

## Maintain Navigation and Descriptions

Navigation is reviewer-facing description content. It must not bypass the
host-neutral description policy.

1. Build the ordered MR chain by walking target branches, not by sorting branch
   names.
2. Skip navigation for a single-MR stack.
3. For each MR, prepare only the applicable Prev, Next, First, and Last links.
4. Use idempotent managed markers if the repository's description policy
   permits them.
5. Invoke `change-request-create` to preserve human-owned content and apply the
   reviewer-facing body policy.
6. Let its internal GitLab mechanics mutate the artifact and read the hosted
   body back.

Run this only when MR membership, titles, targets, or navigation actually
changed. Do not directly replace complete MR descriptions from shell variables
or raw provider commands.
