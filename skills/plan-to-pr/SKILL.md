---
name: plan-to-pr
description: Use when an idea, feature request, implementation plan, Codex goal, or non-Codex agent task should become a reviewed pull request with green CI.
---

# Plan To PR

## Overview

Carry feature work from interactive planning to a pull request that is reviewed and CI-verified. Treat plan review, implementation review, hosted/cloud review, and CI as gates in one workflow.

## When To Use

Use for plan-first feature delivery, "brainstorm then implement", "kickstart implementation", "continue through PR", "iterate until no feedback", Codex goal objectives, or work that should finish with an open PR and green CI. Skip for one-command fixes, status-only requests, or review-only tasks.

## Goal Invocation

In Codex, prefer starting this workflow as a goal with the skill named in the objective:

```text
/goal Use $plan-to-pr for <feature>. Brainstorm and write the plan file, run an explicit plan-review loop with a clean verdict before coding, implement the approved plan, open or update a PR, iterate on local and Codex Cloud review feedback, and finish only when CI is green or blocked with evidence.
```

For non-Codex agents or tools without goal state, use the same objective as a normal prompt:

```text
Use the plan-to-pr workflow for <feature>. Brainstorm and write the plan file, run an explicit plan-review loop with a clean verdict before coding, implement the approved plan, open or update a PR, iterate on local and hosted review feedback, and finish only when CI is green or blocked with evidence.
```

If named helper skills are unavailable, perform their plain-English equivalent: inspect live repo, PR, and CI state; clarify scope; review the plan for implementation readiness; review the final diff; and keep iterating until the same gates pass.

Do not rely on a bare `$plan-to-pr` invocation as the whole objective; the persistent goal or task text must include the deliverable and stop rule.

## Workflow

1. Start from live state with `session-start`: repo rules, branch/worktree, dirty state, PRs, CI, and relevant plan files.
2. If the design is not settled, use `brainstorming` until scope, constraints, and success criteria are clear.
3. Write the plan in the project's established plan/spec location. Keep the first slice narrow and implementation-ready.
4. Run the plan review checkpoint before coding. A read-through is not enough: produce a short plan-review verdict covering scope, sequencing, edge cases, simplification, verification, and repo-rule fit.
5. If plan feedback is actionable, update the plan and repeat the review checkpoint. Do not start implementation until the latest checkpoint verdict is clean, blocked by a product decision, or the user explicitly accepts a documented trade-off.
6. Implement the approved plan with the repo's feature-delivery rules.
7. Run local verification and local PR/diff review with `pull-request-review`; fix actionable findings and repeat.
8. Push the branch and open or update the PR.
9. Request hosted/cloud review when available. Apply actionable feedback and repeat local verification plus review.
10. Watch CI. Fix branch-caused failures, rerun relevant verification, and push updates. Finish only when CI is green or the blocker is external, permission-related, flaky infrastructure, or a product decision with evidence.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Plan | At least one explicit plan-review verdict exists, and the latest verdict has no actionable feedback |
| Implementation | Local verification passes for touched behavior |
| Local review | No actionable local PR/diff findings remain |
| Hosted review | No actionable hosted/cloud findings remain, or the gap is reported |
| CI | Required checks are green, or a non-branch blocker is evidenced |

## Mistakes

| Mistake | Fix |
| --- | --- |
| Starting implementation before plan feedback is resolved | Update the plan and rerun plan review first |
| Treating a read-through as plan review | Produce a verdict with findings or `clean`, then proceed only from the latest verdict |
| Treating review feedback as optional noise | Fix actionable feedback or report the trade-off explicitly |
| Stopping at PR creation | Continue through review loops and CI state |
| Letting the workflow sprawl | Keep the first implementation slice small enough to review and verify |
| Saying "done" with pending or unknown CI | Watch checks or state the exact verification gap |

## Test Evidence

- RED: prior goal-style prompts often required the user to restate the plan-review, PR-review, cloud-review, and CI-green loop.
- GREEN: this skill provides a single objective template with explicit deliverables, review gates, and stop rule.
- REFACTOR: workflow delegates specialized work to existing skills instead of duplicating their detailed rubrics.
