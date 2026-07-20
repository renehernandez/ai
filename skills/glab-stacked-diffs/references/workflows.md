# Stacked Diffs Workflows

These workflows preserve visible MR boundaries while propagating one Git
predecessor order. Lifecycle authority remains with Explore, Plan, Execute,
Review, and Finish.

## Contents

- Create a stack
- Map a published stack
- Update published MRs progressively
- Review substantive and propagation-only diffs
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
glab stack save -m "<imperative description>"
```

Inspect the current incremental commit before starting the next unit.

### 4. Publish in Finish

The initial sync may create all planned MRs:

```bash
glab stack sync
```

Verify the live source heads, immediate-predecessor targets, and draft states.
Create reviewer-facing descriptions through `change-request-create` and the
selected GitLab adapter. Start CI and hosted review as each MR becomes visible.

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

Classify the requested work separately:

| Classification | Meaning |
| --- | --- |
| Substantive MR | Its incremental source-vs-target diff intentionally changes |
| Propagation-only descendant | Its commit identity changes only because an ancestor changed |
| Unaffected MR | Neither its incremental diff nor effective base changes |

## Update Published MRs Progressively

Suppose MRs !881 through !890 need corrections owned by several different
incremental diffs. Do not reconstruct the ten-commit destination and do not
amend all ten before one sync.

For the earliest substantive MR:

1. Select it with `glab stack move`.
2. Verify the current branch.
3. Resolve the live MR for that exact source branch.
4. Apply only that MR's correction.
5. Stage intended files and run focused proof.
6. Amend the managed diff.

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
glab stack amend
```

Inspect the amended MR's incremental diff and every descendant changed by the
automatic rebase. Descendants without intentional incremental changes are
propagation-only.

Immediately before publication, re-read the affected remote heads. If they
still match preflight, Finish publishes the existing chain without creating
new MRs:

```bash
glab stack sync --skip-mr-creation
```

Verify live heads and targets from the amended MR upward. An expected unchanged
remote head or a no-op sync is a failed propagation signal. Apply description
or navigation changes through `change-request-create`, request current hosted
review, and begin independent gates concurrently.

Only after this checkpoint is visible should Execute move to the next
substantive MR and repeat. This yields early usable results and locates scope
movement at the boundary where it occurs.

### Coalescing rule

If the same ancestor is amended again before its previous propagated head was
reviewed, Finish may skip publishing the obsolete intermediate descendant
heads and publish only the newest ancestor state. Do not coalesce separate
substantive MR checkpoints or delay the first published checkpoint merely to
reduce provider churn.

## Review Substantive and Propagation-Only Diffs

Review bottom-to-top. For each MR:

1. Compare its source branch with its current target branch.
2. Confirm substantive changes live in their declared owning MR.
3. For propagation-only descendants, confirm the incremental patch is
   semantically unchanged even though commit identities moved.
4. Refresh base-sensitive proof, CI, approvals, and hosted automated review for
   every changed effective diff.

A green pipeline from an older source head or older predecessor head is stale.
Review gates can execute concurrently, but readiness and merge order remain
bottom-to-top.

## Add or Reorder a Diff

Adding a diff changes stack membership and is not part of an ordinary repair
unless explicitly accepted.

1. Navigate to the predecessor with `glab stack move`.
2. Verify its branch and MR.
3. Implement, stage, validate, and run `glab stack save`.
4. If needed, use `glab stack reorder` and inspect every affected incremental
   diff.
5. In Finish, publish without `--skip-mr-creation` because the new MR is in
   scope.
6. Verify all target branches and draft states.

Reordering can change every effective diff and therefore refreshes all affected
gates.

## Rebase onto an Updated Base

Rebase only for a concrete reason such as conflicts, base-sensitive failures,
or an explicit request. Avoid churn from routine freshness rebases.

1. Fetch the normal base.
2. Navigate to the first diff.
3. Record current remote heads.
4. Rebase onto the resolved base commit.
5. Resolve conflicts bottom-to-top and inspect every incremental diff.
6. In Finish, sync the published chain and refresh changed effective-diff
   gates.

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
6. Publish with the captured remote head as the ownership expectation.
7. Refresh every changed effective-diff gate before the child can be marked
   ready.

If the lease is rejected, stop and inspect external commits. Do not accept the
new remote SHA and retry blindly.

All technically ready MRs remain draft. Explicit merge authority marks only
the current bottom MR ready immediately before its merge.

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
6. Use the selected GitLab adapter for mutation and read the hosted body back.

Run this after a sync only when MR membership, titles, targets, or navigation
actually changed. Do not directly replace complete MR descriptions from shell
variables or raw provider commands.
