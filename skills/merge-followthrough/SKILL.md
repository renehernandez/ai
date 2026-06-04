---
name: merge-followthrough
description: Use when a user asks to merge, merge when green, add to merge queue, watch checks, finish a PR, sync main, clean up branches, verify deployment, or continue a PR/CI/merge workflow.
---

# Merge Followthrough

## Overview

Finish the remote workflow, not just the local patch. Verify CI, merge state, deployment state, and local sync before reporting done.

## When To Use

Use after explicit merge/finish instructions, or when a prior instruction says to merge once green. Do not merge without that permission.

## Quick Reference

| State | Action |
| --- | --- |
| Checks pending | Watch provider checks until pass/fail/blocker |
| Branch-caused failure | Fix, verify locally, push, watch again |
| External failure | Rerun once when evidence supports flake/infrastructure |
| Merge queue enabled | Queue/merge without incompatible delete-branch flags |
| Merge complete | Verify remote state, sync local main, then clean up |

## Workflow

1. Verify current branch, dirty state, PR number, base branch, and merge policy.
2. Check live CI/review state with provider tools.
3. If checks fail, classify:
   - branch-caused: fix and continue;
   - external/flake/permission/service: rerun or report with evidence;
   - product decision: stop and ask.
4. Merge or queue only after permission and green/acceptable checks.
5. Verify merge with provider state, not command silence.
6. Before syncing local base, verify the target checkout is clean or use a separate clean worktree. Never overwrite dirty user work.
7. Before deleting branches, check worktrees, remote PR state, and unmerged/unpushed commits.
8. If deployment verification is expected but unavailable, report the exact gap instead of saying done.
9. Report commit/PR/check/deploy evidence and residual risk.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Assuming quiet merge command worked | Verify PR state and merge commit |
| Retrying branch-caused CI blindly | Fix the branch first |
| Treating every failure as branch-caused | Classify with evidence |
| Deleting branches across active worktrees | Check worktrees first |
| Stopping after remote merge only | Sync local base when requested/expected |

## Validation Scenarios

- Merge queue rejects delete-branch flag: pass only if merge is retried correctly and cleanup is separate.
- CI flake after green local checks: pass only if rerun/failure classification is evidence-based.
- Multi-worktree branch cleanup: pass only if checked-out branches are not deleted.

## Test Evidence

- RED: baseline avoided dirty local main but relied on project-policy judgment.
- GREEN: skill run classified unavailable verification and preserved dirty user work.
- REFACTOR: workflow now has hard stops for dirty sync, branch cleanup, and deploy gaps.
