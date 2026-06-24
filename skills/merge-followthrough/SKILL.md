---
name: merge-followthrough
description: Use when a user asks to merge, merge when green, add to merge queue, finish a PR or MR, invoke merge-followthrough, watch checks, inspect status without merging, sync main, clean up branches, verify deployment, or continue a PR/CI/merge workflow.
---

# Merge Followthrough

## Overview

Finish the remote workflow, not just the local patch. Verify CI, merge state,
local sync, and explicitly requested deployment proof before reporting done.

## When To Use

Use after explicit merge/finish instructions, when a prior instruction says to
merge once green, or when the user invokes `$merge-followthrough` for one
active PR or MR without check-only wording.

## Mode Contract

Default to finish mode for one active PR or MR when the user invokes
`$merge-followthrough`, asks to finish a PR or MR, merge when green, add to a
merge queue, or continue a merge workflow. Finish mode is permission to merge
or queue after required gates are acceptable.

Metadata or review-administration work keeps finish mode. If the user asks to
update a PR or MR description, labels, reviewers, or similar metadata and also
invokes `$merge-followthrough`, complete the metadata work, then continue
toward merge or queue after required gates are acceptable.

Use check-only mode when the user asks to watch, inspect, report status, update
status only, update without merging, see where this is, or says not to merge
yet. Check-only wording overrides metadata work if both are present. In
check-only mode, do not merge or queue.

Stack scope must be explicit. Ask for clarification before merging or queuing
multiple PRs or MRs unless the user has clearly asked to merge the stack or
fresh current stack-ready workflow evidence proves stack-wide permission.
Single-artifact finish mode does not widen to related PRs or MRs.

Before merging a stack from workflow evidence, revalidate the current hosted
state for every item: PR or MR ID, head SHA, source branch, target or base
branch, open/non-draft state, required reviews, required CI graph, hosted
source/target dependency links, and intended order. Merge or queue validated
stacks bottom-to-top. After each predecessor lands, refresh every downstream
item and verify its target or base has retargeted as expected before continuing.
If stack metadata, hosted dependency links, or order are unavailable, broken, or
ambiguous, stop and ask for the intended order.

Branch cleanup is separate from merge. Delete source branches only after the
remote artifact is confirmed merged and cleanup guards pass: source branch is
not default or protected, is not checked out in any worktree, has no unmerged or
unpushed commits, and is not referenced by any open PR or MR as source or
target/base. If any guard fails, defer cleanup and report the branch and exact
reason. Never force-delete as follow-through cleanup.

Default-branch CI completion is required after merge. Before reporting finish
mode complete, verify that the required CI graph for the merged commit or
resulting default-branch head succeeded on the default branch. Include child,
bridge, downstream, or triggered pipelines/checks when the host exposes them as
part of the required graph. If the host does not expose the default-branch graph
immediately, poll for graph creation once per minute for up to 10 minutes. If no
default-branch pipeline or check graph appears after 10 minutes, report a
verification gap and do not claim the workflow is fully done.

For stack follow-through, stop before merging or queuing the next item when the
post-merge default-branch CI graph is failed, blocked, or missing. Resume stack
merges only after the default branch is healthy and the user asks to continue.

Deployment verification is explicit. Do not require deployment verification as
a default finish gate unless the user, repo policy, or existing workflow asks
for it.

## Quick Reference

| State | Action |
| --- | --- |
| Checks pending | Watch provider checks until pass/fail/blocker |
| Branch-caused failure | Fix, verify locally, push, watch again |
| External failure | Rerun once when evidence supports flake/infrastructure |
| Merge queue enabled | Queue/merge without incompatible delete-branch flags |
| Merge complete | Verify remote state, sync local main, then clean up |
| Check-only wording | Watch or report status without merge/queue |
| Multiple PRs or MRs | Ask for explicit stack scope before merge/queue |
| Stack-ready evidence | Revalidate IDs, SHAs, branches, reviews, CI, dependencies, and order |
| Default-branch CI missing | Poll up to 10 minutes, then report a verification gap |
| Default-branch CI failed/blocked | Stop stack follow-through before subsequent merges |
| Branch cleanup blocked | Report the guard failure and do not force-delete |

## Workflow

1. Verify current branch, dirty state, PR number, base branch, and merge policy.
2. Check live CI/review state with provider tools.
3. If checks fail, classify:
   - branch-caused: fix and continue;
   - external/flake/permission/service: rerun or report with evidence;
   - product decision: stop and ask.
4. Select finish mode or check-only mode from the prompt and current artifact.
5. For stacks, validate explicit permission, hosted dependency links, current
   source/target branches, current head SHAs, and bottom-to-top order before
   merging.
6. Merge or queue only in finish mode after green/acceptable checks.
7. Verify merge with provider state, not command silence.
8. Verify the required default-branch CI graph for the merged commit or
   resulting default-branch head, including child/bridge/downstream/triggered
   graph components when exposed. If graph creation is delayed, poll once per
   minute for up to 10 minutes. Treat a missing graph after that as a
   verification gap, not done.
9. For stacks, stop subsequent merges when default-branch CI is failed, blocked,
   or missing until the default branch is healthy and the user asks to continue.
10. Before syncing local base, verify the target checkout is clean or use a separate clean worktree. Never overwrite dirty user work.
11. Before deleting branches, check protected/default status, worktrees, remote
   PR/MR source and target/base references, and unmerged/unpushed commits.
12. If deployment verification is expected but unavailable, report the exact gap instead of saying done.
13. Report commit/PR/check/deploy evidence and residual risk.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Assuming quiet merge command worked | Verify PR state and merge commit |
| Retrying branch-caused CI blindly | Fix the branch first |
| Treating every failure as branch-caused | Classify with evidence |
| Deleting branches across active worktrees | Check worktrees first |
| Stopping after remote merge only | Sync local base when requested/expected |
| Calling finish done before default-branch CI completes | Verify the required default-branch graph, including child/bridge/downstream/triggered checks, or report the gap |
| Continuing a stack after default-branch CI is failed, blocked, or missing | Stop before the next merge and wait for healthy default-branch CI plus a user continue request |
| Treating metadata plus `$merge-followthrough` as check-only | Finish the metadata, then continue the merge workflow |
| Requiring deployment proof without an explicit deployment requirement | Report only the merge, CI, sync, and cleanup proof that applies |
| Widening a single MR/PR request to a stack | Ask for explicit stack scope or require fresh stack-ready evidence |
| Cleaning a branch still used by open artifacts | Defer cleanup until hosted source/target dependencies are clear |

## Validation Scenarios

- Merge queue rejects delete-branch flag: pass only if merge is retried correctly and cleanup is separate.
- CI flake after green local checks: pass only if rerun/failure classification is evidence-based.
- Multi-worktree branch cleanup: pass only if checked-out branches are not deleted.
- Stack-wide merge: pass only if fresh stack-ready evidence is revalidated and
  the stack merges bottom-to-top with downstream retarget checks after each
  predecessor lands.
- Branch cleanup: pass only if merged state, protected/default status,
  worktrees, unmerged/unpushed commits, and open source/target artifact
  references are checked before deletion.
- Default-branch CI completion: pass only if the merged commit or resulting
  default-branch head has a successful required CI graph, including child,
  bridge, downstream, or triggered graph components when required by the host.
- No post-merge pipeline: pass only if graph creation is polled once per minute
  for up to 10 minutes and a missing graph is reported as a verification gap.
- Stack continuation after merge: pass only if subsequent merges stop when
  default-branch CI is failed, blocked, or missing, and resume only after the
  default branch is healthy and the user asks to continue.
- Metadata update plus `$merge-followthrough`: pass only if the workflow still
  proceeds in finish mode after metadata is updated.
- Check-only wording: pass only if the workflow reports status without merge or
  queue.

## Test Evidence

- RED: baseline avoided dirty local main but relied on project-policy judgment.
- RED: baseline could treat metadata work plus `$merge-followthrough` as lacking
  explicit merge permission.
- GREEN: skill run classified unavailable verification and preserved dirty user work.
- GREEN: finish/check-only mode contract defines `$merge-followthrough` as
  finish permission for one active PR or MR unless check-only wording is present.
- REFACTOR: workflow now has hard stops for dirty sync, branch cleanup, and deploy gaps.
