---
name: plan-to-pr
description: Use when an idea, feature request, implementation plan, Codex goal, or non-Codex agent task should become a reviewed GitHub pull request or GitLab merge request with artifact-host CI and review feedback follow-through.
---

# Plan To PR

## Overview

Carry feature work from interactive planning to a pull request that is reviewed and CI-verified. Treat plan review, implementation review, hosted/background review, and CI as gates in one workflow.

## When To Use

Use for plan-first feature delivery, "brainstorm then implement", "kickstart implementation", "continue through PR", "iterate until no feedback", Codex goal objectives, or work that should finish with an open PR and green CI. Skip for one-command fixes, status-only requests, or review-only tasks.

## Goal Invocation

In Codex, prefer starting this workflow as a goal with the skill named in the objective:

```text
/goal Use $plan-to-pr for <feature>. Brainstorm and write the plan file, announce each helper skill when it starts, run an explicit plan-review loop with a clean verdict, run $scrutinize on the plan before coding, implement the approved plan or first approved slice, run local review, run $scrutinize on the implementation diff, run docs alignment, use review-feedback-routing to select artifact host and review feedback, open or update a PR/MR, run the detected artifact-host review adapter, wait for routed review feedback on the latest PR/MR head, iterate until feedback is resolved, finish only when CI is green or blocked with evidence, and include a final gate ledger showing each helper skill and verdict.
```

For non-Codex agents or tools without goal state, use the same objective as a normal prompt:

```text
Use the plan-to-pr workflow for <feature>. Brainstorm and write the plan file, announce each helper skill when it starts, run an explicit plan-review loop with a clean verdict, run $scrutinize on the plan before coding, implement the approved plan or first approved slice, run local review, run $scrutinize on the implementation diff, run docs alignment, use review-feedback-routing to select artifact host and review feedback, open or update a PR/MR, run the detected artifact-host review adapter, wait for routed review feedback on the latest PR/MR head, iterate until feedback is resolved, finish only when CI is green or blocked with evidence, and include a final gate ledger showing each helper skill and verdict.
```

If named helper skills are unavailable, perform their plain-English equivalent: inspect live repo, PR, and CI state; clarify scope; review the plan for implementation readiness; adversarially validate intent, simpler alternatives, real paths, and evidence-backed claims; check whether docs or agent docs must change with the diff; review the final diff; wait for hosted review feedback when it was requested; and keep iterating until the same gates pass.

Do not rely on a bare `$plan-to-pr` invocation as the whole objective; the persistent goal or task text must include the deliverable and stop rule.

## Progress Output

Make helper-skill use visible in the transcript. Before running any named helper skill or its plain-English fallback, send a short status line naming the skill, why it is being used, and the artifact or diff it is checking. Examples:

- `Using $session-start to anchor this run in live repo, branch, PR, and CI state.`
- `Using $brainstorming to settle scope and success criteria before writing the plan.`
- `Using $scrutinize on the plan before coding; this is the adversarial plan gate.`
- `Using $pull-request-review on the local implementation diff before hosted review.`
- `Using $review-feedback-routing to select artifact host, create/inspect adapters, and review feedback route.`
- `Using $github-pr-create to open the GitHub draft PR for the reviewed branch.`
- `Using $gitlab-review to gather GitLab MR context and apply $pull-request-review to the hosted diff.`
- `Using $github-review to gather GitHub PR context and apply $pull-request-review to the hosted diff.`
- `Using $scrutinize on the implementation diff before CI completion.`
- `Using $docs-alignment-review on the final diff so docs and agent instructions stay aligned.`

When a helper skill is unavailable and a fallback is used, say that explicitly in the same status line: `Using the plain-English $scrutinize fallback on the plan because the skill is unavailable.`

After each gate, report the verdict in one line with the gate name, artifact or head, verdict, and next action. The final response must include a compact gate ledger covering at least: `session-start`, `brainstorming` when used, plan review, plan scrutiny, implementation, local review, implementation scrutiny, docs alignment, review feedback routing, artifact-host adapter review, review feedback, and CI. For mixed-host repos, also record routing evidence, chosen `artifact.host`, `create_adapter`, `inspect_adapter`, reviewer, `feedback_adapter`, CI owner, and any assumption or blocking question. If a gate did not apply, mark it `not applicable` with the reason; do not omit it. This ledger is required even when the workflow blocks early so a later reader can tell whether `scrutinize`, artifact-host review, and review feedback routing actually ran.

## Workflow

1. Start from live state with `session-start`: repo rules, branch/worktree, dirty state, PRs, CI, and relevant plan files.
   - Use `review-feedback-routing` before PR/MR creation when available.
   - Detect the artifact host from remotes before PR/MR creation: GitLab for `git.fullscript.io` or other GitLab remotes; GitHub for `github.com` or GitHub Enterprise remotes.
   - If multiple plausible artifact hosts exist, inspect tracked upstream, default branch, active PR/MR workflow, CI owner, issue links, templates, and prior merged branches.
   - If artifact host ownership still conflicts, ask one blocking question: "Should this land through GitHub PR or GitLab MR?" If the user is unavailable and work must continue, choose the host that owns required CI/review gates and mark the assumption in the gate ledger.
2. If the design is not settled, use `brainstorming` until scope, constraints, and success criteria are clear.
3. Write the plan in the project's established plan/spec location. Keep the first slice narrow and implementation-ready.
4. Run the plan review checkpoint before coding. A read-through is not enough: produce a short plan-review verdict covering scope, sequencing, edge cases, simplification, verification, and repo-rule fit.
5. Run `scrutinize` on the plan before coding. The verdict must be `ship` before implementation starts unless the user explicitly accepts a documented `fix-then-ship` or `rework` trade-off. A `reject` verdict requires changing or abandoning the goal. Fix `BLOCKER` and `MAJOR` findings first; fix scoped mechanical `MINOR` plan findings automatically before implementation.
6. If plan review or scrutiny feedback is actionable, update the plan and repeat the relevant checkpoint. Do not start implementation until the latest checkpoint verdicts are clean, blocked by a product decision, or the user explicitly accepts a documented trade-off.
7. After clean plan review and scrutiny verdicts, continue directly into implementation. If the plan defines multiple PRs or slices, implement the first approved implementation slice by default. Do not stop to ask for a second goal or tell the user to restart with a narrower objective unless the plan has no implementation-ready slice or a product decision blocks slice selection.
8. Implement the approved plan or first approved slice with the repo's feature-delivery rules.
9. Run local verification and local PR/diff review with `pull-request-review`; fix actionable findings and repeat.
10. Run `scrutinize` on the implementation diff after local review and before hosted/background review. The verdict must be `ship` before proceeding unless the user explicitly accepts a documented `fix-then-ship` or `rework` trade-off. A `reject` verdict requires changing or abandoning the goal. Fix `BLOCKER` and `MAJOR` findings first; fix local low-risk `MINOR` implementation findings automatically or report them as residual risk.
11. Run `docs-alignment-review` over the implementation diff. If it finds required docs, plan, agent-doc, automation, or PR-description updates, make them before opening or updating the PR unless explicitly deferred with reason and risk.
12. Push the branch and open or update the PR/MR through the routed artifact host:
    - GitLab: use the GitLab MR creation path (`glab-mr-create` or its successor).
    - GitHub: use `github-pr-create`.
    - Unknown artifact host: ask for the target host or stop with the exact ambiguity.
13. Run the artifact-host inspection adapter on the created or existing artifact:
    - GitLab: use `gitlab-review`, which gathers MR metadata, discussions, CI, and diff context before applying `pull-request-review`.
    - GitHub: use `github-review`, which gathers PR metadata, reviews/comments, Actions checks, and diff context before applying `pull-request-review`.
14. Request or wait for review feedback using the routed `review_feedback.primary` entry. Ask reviewers to use repo-visible review rubrics when present; if the repo lacks one, recommend adapting `templates/background-agent-pr-review-rubric.md` from the AI repo.
15. Wait for routed review feedback to materialize before treating the gate as complete. For Codex GitHub review, poll PR reviews, review comments, timeline comments, and request reactions until the latest pushed head has a `chatgpt-codex-connector` review/comment, a thumbs-up/no-issues reaction on the request, actionable inline findings, or a clear timeout/blocker. For Nitro on Fullscript GitLab, wait for the automatic feedback route configured by `review-feedback-routing`. Do not stop just because the review was requested.
16. Apply actionable hosted feedback and repeat local verification, local review, scrutiny, docs alignment, push, and hosted review on the updated diff. If the branch head changes after feedback or CI fixes, the earlier hosted review is stale unless it clearly reviewed the new head.
17. Watch CI through the artifact-host tool: `glab ci`/GitLab pipeline tools for GitLab, and `gh pr checks` or GitHub Actions checks for GitHub. Fix branch-caused failures, rerun relevant verification, rerun scrutiny and docs alignment if the diff changed, and push updates. Before finishing, make sure the latest scrutiny, docs alignment, and routed review feedback verdicts apply to the final branch diff. Finish only when CI is green or the blocker is external, permission-related, flaky infrastructure, review-feedback timeout, or a product decision with evidence.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Plan | At least one explicit plan-review verdict exists, and the latest verdict has no actionable feedback |
| Plan scrutiny | `scrutinize` verdict is `ship`, or a `fix-then-ship`/`rework` verdict is explicitly accepted as a documented trade-off; `reject` requires changing or abandoning the goal |
| Implementation | The approved plan or first approved implementation slice is implemented and local verification passes |
| Local review | No actionable local PR/diff findings remain |
| Implementation scrutiny | `scrutinize` verdict is `ship`, or a `fix-then-ship`/`rework` verdict is explicitly accepted as a documented trade-off; `reject` requires changing or abandoning the goal |
| Docs alignment | Docs alignment verdict is `clean` or `not applicable`, or required docs updates are made/deferred with stated reason and risk |
| Review feedback routing | `review-feedback-routing` selected artifact and feedback adapters, or ambiguity is blocked with evidence |
| Artifact-host adapter | `gitlab-review` or `github-review` has reviewed the latest hosted artifact head and returned no actionable findings, or a blocker is evidenced |
| Review feedback | Routed feedback has produced a latest-head result with no actionable findings, or a timeout/blocker is evidenced |
| CI | Required checks are green, or a non-branch blocker is evidenced |

## Mistakes

| Mistake | Fix |
| --- | --- |
| Starting implementation before plan feedback is resolved | Update the plan and rerun plan review first |
| Starting implementation before plan scrutiny passes | Run `scrutinize`, fix findings, and rerun before coding |
| Running a helper skill without naming it in the transcript | Announce the skill before it starts and record its verdict in the final gate ledger |
| Finishing without a gate ledger | Add the ledger with every required gate marked passed, blocked, or not applicable |
| Treating a read-through as plan review | Produce a verdict with findings or `clean`, then proceed only from the latest verdict |
| Stopping after a clean plan review | Implement the approved plan or first approved slice in the same goal unless blocked |
| Treating local review as enough for adversarial validation | Run `scrutinize` on the implementation diff before hosted review or CI completion |
| Asking for a second goal after the plan is clean | Continue with the first approved slice; ask only if no implementation-ready slice exists |
| Shipping behavior, workflow, or architecture changes without a docs alignment verdict | Run `docs-alignment-review` and either update docs/agent docs or state why no update is needed |
| Treating review feedback as optional noise | Fix actionable feedback or report the trade-off explicitly |
| Reusing an old docs alignment verdict after review or CI fixes | Rerun docs alignment on the final diff before declaring the PR complete |
| Using the wrong artifact-host adapter | Detect the remote host first; use `gitlab-review` for GitLab MRs and `github-review` for GitHub PRs |
| Opening a GitHub PR with GitLab mechanics | Use `github-pr-create`; keep `glab` for GitLab workflows |
| Guessing between live GitHub and GitLab remotes | Use `review-feedback-routing`, inspect workflow evidence first, and ask the target host when ownership still conflicts |
| Treating `@codex review` as the review result | Poll PR reviews/comments/reactions until Codex feedback or a no-issues signal lands on the latest head |
| Reusing hosted review from an older head | Re-request hosted review after pushing fixes and wait for the latest-head result |
| Stopping at PR creation | Continue through review loops and CI state |
| Assuming background agents can see local rules | Put the review rubric in repo-visible docs or report the context gap |
| Letting the workflow sprawl | Keep the first implementation slice small enough to review and verify |
| Saying "done" with pending or unknown CI | Watch checks or state the exact verification gap |

## Test Evidence

- RED: prior goal-style prompts often required the user to restate the plan-review, PR-review, background-review, and CI-green loop.
- RED: session `019e7b05-b280-7433-bb29-7eefe79ed17d` left it unclear whether `scrutinize` had run, because helper-skill use was not named or summarized in the output.
- RED: session `019e90cb-eab6-74c2-8685-eb720aea6437` requested Codex review on PR 67, but feedback landed later; the next goal turn had to address feedback that should have been awaited before completion.
- GREEN: this skill provides a single objective template with explicit deliverables, review gates, and stop rule.
- GREEN: progress output now requires a status line before every named helper skill or fallback and a final gate ledger that records `scrutinize` verdicts explicitly.
- REFACTOR: the plan gate now requires a clean verdict, then forces implementation of the approved plan or first approved slice instead of handing off to a second goal; final-diff docs alignment and latest-head hosted review close the late-review and CI-fix skip paths.
- REFACTOR: plan and implementation scrutiny are mandatory gates so adversarial intent, simpler-path, trace, and evidence checks cannot be skipped by ordinary plan review or local PR review.
- REFACTOR: artifact-host routing now chooses `github-pr-create`/`github-review` for GitHub and GitLab MR creation/`gitlab-review` for GitLab, preventing host-specific review and CI steps from being skipped.
- GREEN: sub-agent `019eae14-5e09-7ab2-b13f-1cb2b6409e27` identified the mixed-provider gate sequence, ambiguity checks, and residual risks around hidden branch protection, required reviewers, provider templates, mirrored repos, private CI, and background reviewer availability.
- GREEN: sub-agent `019eae16-876d-7970-9bf6-b1b0a65839d2` passed the mixed GitHub/GitLab pressure test and recommended recording provider evidence, chosen adapter, CI owner, and assumptions in the final ledger.
- REFACTOR: `review-feedback-routing` now separates artifact host from review feedback so Fullscript GitLab can use Nitro automatically while GitHub uses Codex explicitly.
