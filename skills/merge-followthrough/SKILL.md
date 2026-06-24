---
name: merge-followthrough
description: Use when a user asks to merge, merge when green, add to merge queue, finish a PR or MR, invoke merge-followthrough, watch checks, inspect status without merging, sync main, clean up branches, verify deployment, or continue a PR/CI/merge workflow.
---

# Merge Followthrough

## Overview

Finish the remote workflow, not just the local patch. Verify CI, merge state, deployment state, and local sync before reporting done.

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
yet. In check-only mode, do not merge or queue.

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

## Workflow

1. Verify current branch, dirty state, PR number, base branch, and merge policy.
2. Check live CI/review state with provider tools.
3. If checks fail, classify:
   - branch-caused: fix and continue;
   - external/flake/permission/service: rerun or report with evidence;
   - product decision: stop and ask.
4. Select finish mode or check-only mode from the prompt and current artifact.
5. Merge or queue only in finish mode after green/acceptable checks.
6. Verify merge with provider state, not command silence.
7. Before syncing local base, verify the target checkout is clean or use a separate clean worktree. Never overwrite dirty user work.
8. Before deleting branches, check worktrees, remote PR state, and unmerged/unpushed commits.
9. If deployment verification is expected but unavailable, report the exact gap instead of saying done.
10. Report commit/PR/check/deploy evidence and residual risk.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Assuming quiet merge command worked | Verify PR state and merge commit |
| Retrying branch-caused CI blindly | Fix the branch first |
| Treating every failure as branch-caused | Classify with evidence |
| Deleting branches across active worktrees | Check worktrees first |
| Stopping after remote merge only | Sync local base when requested/expected |
| Treating metadata plus `$merge-followthrough` as check-only | Finish the metadata, then continue the merge workflow |
| Requiring deployment proof without an explicit deployment requirement | Report only the merge, CI, sync, and cleanup proof that applies |

## Validation Scenarios

- Merge queue rejects delete-branch flag: pass only if merge is retried correctly and cleanup is separate.
- CI flake after green local checks: pass only if rerun/failure classification is evidence-based.
- Multi-worktree branch cleanup: pass only if checked-out branches are not deleted.
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
