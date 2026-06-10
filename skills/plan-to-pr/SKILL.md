---
name: plan-to-pr
description: Use when a validated plan_ready_handoff should be implemented through local verification, review gates, hosted PR or MR feedback, and artifact-host CI.
---

# Plan To PR

## Overview

Carry an already-ready plan slice to a reviewed pull request or merge request with green artifact-host CI. This skill starts from a `plan_ready_handoff`; it does not brainstorm, write the plan, or reopen scope.

## When To Use

Use when the user provides a valid `plan_ready_handoff`, says to proceed after a `plan-ready` handoff, or asks to implement an approved plan slice through PR/MR and CI.

Do not use for fuzzy ideas, unreviewed plans, OpenSpec proposal creation, or Linear tickets that still need planning. Use `plan-ready` first.

## Required Input

Before implementation, locate exactly one handoff from the current session or the user prompt:

```yaml
plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: docs/plans/example.md
  approved_slice: "Implement the first reviewed slice."
  required_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
```

Run the bundled script `scripts/plan-to-pr.ts validate-handoff` from this skill directory on the handoff before editing files.

If the handoff is missing, invalid, ambiguous, has unresolved blockers, or has `scrutiny_verdict` other than `ship`, stop and ask the user to run `plan-ready` or paste a valid handoff.

## Goal Invocation

In Codex, prefer starting this workflow as a goal with the handoff included in the objective:

```text
/goal Use $plan-to-pr with this plan_ready_handoff: <handoff>. Validate the handoff, implement only the approved slice, run local verification, local review, implementation scrutiny, code quality, simplification, deslop, conditional security review, docs alignment, review-feedback-routing, create or update the routed PR/MR, run artifact-host review, wait for routed latest-head review feedback, iterate until feedback is resolved, watch artifact-host CI, and finish only when CI is green or blocked with evidence. Include the final delivery gate ledger.
```

For non-Codex agents or tools without goal state, use the same objective as a normal prompt.

## Progress Output

Make helper-skill use visible in the transcript. Before running any named helper skill or its plain-English fallback, send a short status line naming the skill, why it is being used, and the artifact or diff it is checking. Examples:

- `Using $session-start to anchor this delivery run in live repo, branch, PR, and CI state.`
- `Using $review-feedback-routing to select artifact host, create/inspect adapters, and review feedback route.`
- `Using $pull-request-review on the local implementation diff before hosted review.`
- `Using $scrutinize on the implementation diff before hosted review and CI completion.`
- `Using $code-quality-review on the implementation diff for maintainability findings.`
- `Using $code-simplifier to apply behavior-preserving simplification.`
- `Using $deslop to remove AI-shaped clutter before review.`
- `Using $docs-alignment-review on the final diff so docs and agent instructions stay aligned.`
- `Using $github-pr-create to open the GitHub draft PR for the reviewed branch.`
- `Using $gitlab-review to gather GitLab MR context and apply $pull-request-review to the hosted diff.`
- `Using $github-review to gather GitHub PR context and apply $pull-request-review to the hosted diff.`

When a helper skill is unavailable and a fallback is used, say that explicitly in the same status line.

After each gate, report the verdict in one line with the gate name, artifact or head, verdict, and next action.

## Workflow

1. Validate the handoff with the bundled script `scripts/plan-to-pr.ts validate-handoff`.
2. Run `scripts/plan-to-pr.ts detect` and start from live state with `session-start`: repo rules, branch/worktree, dirty state, PRs, CI, and the referenced planning artifact.
3. Confirm the referenced plan/OpenSpec/Linear artifact exists or is reachable. If it is unavailable, block with evidence.
4. Use `review-feedback-routing` before PR/MR creation when available.
   - Detect artifact host from remotes before PR/MR creation.
   - GitLab for `git.fullscript.io` or other GitLab remotes.
   - GitHub for `github.com` or GitHub Enterprise remotes.
   - If host ownership still conflicts after inspecting workflow evidence, ask one blocking question.
5. Implement only `plan_ready_handoff.approved_slice`.
6. Run the narrowest useful local verification for touched code.
7. Run local PR/diff review with `pull-request-review`; fix actionable findings and repeat.
8. Run `scrutinize` on the implementation diff. The verdict must be `ship` before hosted/background review unless the user explicitly accepts a documented `fix-then-ship` or `rework` trade-off. A `reject` verdict requires changing or abandoning the goal.
9. Run the pre-commit quality gate:
   - `code-quality-review`;
   - `code-simplifier`;
   - `deslop`;
   - security review when the diff touches auth, authorization, secrets, token handling, sensitive data, dependency trust, webhooks, or externally reachable surfaces;
   - `docs-alignment-review`.
10. Push the branch and open or update the PR/MR through the routed artifact host:
    - GitLab: use the GitLab MR creation path (`glab-mr-create` or its successor).
    - GitHub: use `github-pr-create`.
    - Unknown artifact host: ask for the target host or stop with exact ambiguity.
11. Run the artifact-host inspection adapter on the created or existing artifact:
    - GitLab: use `gitlab-review`.
    - GitHub: use `github-review`.
12. Request or wait for review feedback using the routed `review_feedback.primary` entry.
13. Wait for routed feedback to materialize before treating the gate as complete. For Codex GitHub review, poll PR reviews, review comments, timeline comments, and request reactions until the latest pushed head has a `chatgpt-codex-connector` review/comment, a thumbs-up/no-issues reaction on the request, actionable inline findings, or a clear timeout/blocker. For Nitro on Fullscript GitLab, wait for the automatic feedback route configured by `review-feedback-routing`.
14. Apply actionable hosted feedback and repeat local verification, local review, scrutiny, quality gates, docs alignment, push, and hosted review on the updated diff. If the branch head changes after feedback or CI fixes, earlier hosted review is stale unless it clearly reviewed the new head.
15. Watch CI through the artifact-host tool: `glab ci`/GitLab pipeline tools for GitLab, and `gh pr checks` or GitHub Actions checks for GitHub. Fix branch-caused failures, rerun relevant verification, rerun scrutiny and docs alignment if the diff changed, and push updates.
16. Before finishing, generate the gate ledger shape with `scripts/plan-to-pr.ts gate-template`, fill it, and validate it with `validate-ledger`.
17. Finish only when CI is green or the blocker is external, permission-related, flaky infrastructure, review-feedback timeout, or a product decision with evidence.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Handoff validation | `plan_ready_handoff` validates and has `scrutiny_verdict: ship` |
| Session start | Live repo, branch/worktree, remotes, and planning artifact state are inspected |
| Implementation | The approved slice is implemented and no unrelated scope is added |
| Local verification | Narrow verification for touched code passes or blocker is evidenced |
| Local review | No actionable local PR/diff findings remain |
| Implementation scrutiny | `scrutinize` verdict is `ship`, or a trade-off is explicitly accepted |
| Code quality review | No critical or warning maintainability findings remain unresolved |
| Code simplifier | Behavior-preserving simplification is applied or marked not applicable |
| Deslop | AI-shaped clutter/style drift is removed or marked not applicable |
| Security review | Relevant security surface is reviewed, or the gate is not applicable with reason |
| Docs alignment | Docs alignment verdict is clean/not applicable, or updates are made/deferred with reason |
| Review feedback routing | Artifact and feedback adapters are selected, or ambiguity is blocked with evidence |
| Artifact creation/update | Routed PR/MR exists for the latest branch |
| Artifact-host review | `gitlab-review` or `github-review` reviewed the latest hosted artifact head |
| Review feedback | Routed feedback produced a latest-head result with no actionable findings, or blocker is evidenced |
| CI | Required checks are green, or non-branch blocker is evidenced |

## Final Delivery Ledger

The final response must include every gate. Use `passed`, `blocked`, or `not_applicable` and one line of evidence.

```yaml
delivery_gate_ledger:
  handoff_validation:
    status: passed
    evidence: "plan_ready_handoff validated"
  session_start:
    status: passed
    evidence: "repo, branch, remotes, and artifact inspected"
  implementation:
    status: passed
    evidence: "approved slice implemented"
  local_verification:
    status: passed
    evidence: "<command>"
  local_review:
    status: passed
    evidence: "no actionable findings"
  implementation_scrutiny:
    status: passed
    evidence: "Scrutinize verdict: ship"
  code_quality_review:
    status: passed
    evidence: "no structural findings"
  code_simplifier:
    status: passed
    evidence: "simplification pass complete"
  deslop:
    status: passed
    evidence: "deslop pass complete"
  security_review:
    status: not_applicable
    evidence: "no relevant security surface changed"
  docs_alignment:
    status: passed
    evidence: "docs alignment clean or updated"
  review_feedback_routing:
    status: passed
    evidence: "artifact and feedback adapters selected"
  artifact_creation_update:
    status: passed
    evidence: "PR/MR URL"
  artifact_host_review:
    status: passed
    evidence: "hosted artifact reviewed at latest head"
  review_feedback:
    status: passed
    evidence: "latest-head routed feedback resolved"
  ci:
    status: passed
    evidence: "required checks green"
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Brainstorming inside `plan-to-pr` | Stop and run `plan-ready` |
| Implementing without a handoff | Ask for a valid `plan_ready_handoff` |
| Expanding beyond `approved_slice` | Update the plan through `plan-ready` first |
| Treating local review as enough | Run implementation `scrutinize` and the quality gates |
| Treating review request as feedback | Wait for latest-head routed feedback |
| Reusing hosted review from an older head | Re-request hosted review after pushing fixes |
| Finishing without a final ledger | Generate, fill, and validate the ledger |
| Saying "done" with pending or unknown CI | Watch checks or state the exact blocker |

## Test Evidence

- RED: prior `plan-to-pr` flow could begin from a fuzzy idea and mix planning with implementation.
- GREEN: this skill requires a validated `plan_ready_handoff` before editing files.
- REFACTOR: implementation delivery gates remain explicit, but planning gates move to `plan-ready`.
- GREEN: pressure testing confirmed missing handoffs and non-`ship` scrutiny handoffs block before implementation.
