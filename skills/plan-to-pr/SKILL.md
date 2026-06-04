---
name: plan-to-pr
description: Use when an idea, feature request, implementation plan, Codex goal, or non-Codex agent task should become a reviewed pull request with green CI.
---

# Plan To PR

## Overview

Carry feature work from interactive planning to a pull request that is reviewed and CI-verified. Treat plan review, implementation review, hosted/background review, and CI as gates in one workflow.

## When To Use

Use for plan-first feature delivery, "brainstorm then implement", "kickstart implementation", "continue through PR", "iterate until no feedback", Codex goal objectives, or work that should finish with an open PR and green CI. Skip for one-command fixes, status-only requests, or review-only tasks.

## Goal Invocation

In Codex, prefer starting this workflow as a goal with the skill named in the objective:

```text
/goal Use $plan-to-pr for <feature>. Brainstorm and write the plan file, run an explicit plan-review loop with a clean verdict before coding, implement the approved plan or first approved slice, run docs alignment, open or update a PR, wait for local and hosted/background review feedback on the latest PR head, iterate until feedback is resolved, and finish only when CI is green or blocked with evidence.
```

For non-Codex agents or tools without goal state, use the same objective as a normal prompt:

```text
Use the plan-to-pr workflow for <feature>. Brainstorm and write the plan file, run an explicit plan-review loop with a clean verdict before coding, implement the approved plan or first approved slice, run docs alignment, open or update a PR, wait for local and hosted review feedback on the latest PR head, iterate until feedback is resolved, and finish only when CI is green or blocked with evidence.
```

If named helper skills are unavailable, perform their plain-English equivalent: inspect live repo, PR, and CI state; clarify scope; review the plan for implementation readiness; check whether docs or agent docs must change with the diff; review the final diff; wait for hosted review feedback when it was requested; and keep iterating until the same gates pass.

Do not rely on a bare `$plan-to-pr` invocation as the whole objective; the persistent goal or task text must include the deliverable and stop rule.

## Workflow

1. Start from live state with `session-start`: repo rules, branch/worktree, dirty state, PRs, CI, and relevant plan files.
2. If the design is not settled, use `brainstorming` until scope, constraints, and success criteria are clear.
3. Write the plan in the project's established plan/spec location. Keep the first slice narrow and implementation-ready.
4. Run the plan review checkpoint before coding. A read-through is not enough: produce a short plan-review verdict covering scope, sequencing, edge cases, simplification, verification, and repo-rule fit.
5. If plan feedback is actionable, update the plan and repeat the review checkpoint. Do not start implementation until the latest checkpoint verdict is clean, blocked by a product decision, or the user explicitly accepts a documented trade-off.
6. After a clean plan-review verdict, continue directly into implementation. If the plan defines multiple PRs or slices, implement the first approved implementation slice by default. Do not stop to ask for a second goal or tell the user to restart with a narrower objective unless the plan has no implementation-ready slice or a product decision blocks slice selection.
7. Implement the approved plan or first approved slice with the repo's feature-delivery rules.
8. Run local verification and local PR/diff review with `pull-request-review`; fix actionable findings and repeat.
9. Run `docs-alignment-review` over the implementation diff. If it finds required docs, plan, agent-doc, automation, or PR-description updates, make them before opening or updating the PR unless explicitly deferred with reason and risk.
10. Push the branch and open or update the PR.
11. Request hosted, cloud, or background-agent review when available. Ask reviewers to use repo-visible review rubrics when present; if the repo lacks one, recommend adapting `templates/background-agent-pr-review-rubric.md` from the AI repo.
12. Wait for hosted review feedback to materialize before treating the gate as complete. For Codex GitHub review, poll PR reviews, review comments, timeline comments, and request reactions until the latest pushed head has a `chatgpt-codex-connector` review/comment, a thumbs-up/no-issues reaction on the request, actionable inline findings, or a clear timeout/blocker. Do not stop just because the `@codex review` comment was posted.
13. Apply actionable hosted feedback and repeat local verification, local review, docs alignment, push, and hosted review on the updated diff. If the branch head changes after feedback or CI fixes, the earlier hosted review is stale unless it clearly reviewed the new head.
14. Watch CI. Fix branch-caused failures, rerun relevant verification, rerun docs alignment if the diff changed, and push updates. Before finishing, make sure the latest docs alignment verdict and hosted review verdict apply to the final branch diff. Finish only when CI is green or the blocker is external, permission-related, flaky infrastructure, hosted-review timeout, or a product decision with evidence.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Plan | At least one explicit plan-review verdict exists, and the latest verdict has no actionable feedback |
| Implementation | The approved plan or first approved implementation slice is implemented and local verification passes |
| Local review | No actionable local PR/diff findings remain |
| Docs alignment | Docs alignment verdict is `clean` or `not applicable`, or required docs updates are made/deferred with stated reason and risk |
| Background review | Hosted/cloud/background review has produced a latest-head result with no actionable findings, or a timeout/blocker is evidenced |
| CI | Required checks are green, or a non-branch blocker is evidenced |

## Mistakes

| Mistake | Fix |
| --- | --- |
| Starting implementation before plan feedback is resolved | Update the plan and rerun plan review first |
| Treating a read-through as plan review | Produce a verdict with findings or `clean`, then proceed only from the latest verdict |
| Stopping after a clean plan review | Implement the approved plan or first approved slice in the same goal unless blocked |
| Asking for a second goal after the plan is clean | Continue with the first approved slice; ask only if no implementation-ready slice exists |
| Shipping behavior, workflow, or architecture changes without a docs alignment verdict | Run `docs-alignment-review` and either update docs/agent docs or state why no update is needed |
| Treating review feedback as optional noise | Fix actionable feedback or report the trade-off explicitly |
| Reusing an old docs alignment verdict after review or CI fixes | Rerun docs alignment on the final diff before declaring the PR complete |
| Treating `@codex review` as the review result | Poll PR reviews/comments/reactions until Codex feedback or a no-issues signal lands on the latest head |
| Reusing hosted review from an older head | Re-request hosted review after pushing fixes and wait for the latest-head result |
| Stopping at PR creation | Continue through review loops and CI state |
| Assuming background agents can see local rules | Put the review rubric in repo-visible docs or report the context gap |
| Letting the workflow sprawl | Keep the first implementation slice small enough to review and verify |
| Saying "done" with pending or unknown CI | Watch checks or state the exact verification gap |

## Test Evidence

- RED: prior goal-style prompts often required the user to restate the plan-review, PR-review, background-review, and CI-green loop.
- RED: session `019e90cb-eab6-74c2-8685-eb720aea6437` requested Codex review on PR 67, but feedback landed later; the next goal turn had to address feedback that should have been awaited before completion.
- GREEN: this skill provides a single objective template with explicit deliverables, review gates, and stop rule.
- REFACTOR: the plan gate now requires a clean verdict, then forces implementation of the approved plan or first approved slice instead of handing off to a second goal; final-diff docs alignment and latest-head hosted review close the late-review and CI-fix skip paths.
