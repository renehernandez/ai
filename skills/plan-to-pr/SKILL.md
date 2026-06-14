---
name: plan-to-pr
description: Use when a validated plan_ready_handoff should be implemented through local verification, review gates, hosted PR or MR feedback, and artifact-host CI.
---

# Plan To PR

## Overview

Carry an already-ready plan slice to a reviewed pull request or merge request with green artifact-host CI. This skill starts from a `plan_ready_handoff`; it does not brainstorm, write the plan, or reopen scope.

## When To Use

Use when the user provides a valid `plan_followthrough_slice_handoff` or a valid `plan_ready_handoff` for one approved slice, says to proceed from `plan-followthrough`, or asks to implement an approved plan slice through PR/MR and CI.

Do not use for fuzzy ideas, unreviewed plans, OpenSpec proposal creation, or Linear tickets that still need planning. Use `plan-ready` first. For approved plans, including single-slice plans, the normal path is `plan-followthrough` before `plan-to-pr`.

## Required Input

Before implementation, locate exactly one handoff from the current session or the user prompt. Prefer a `plan_followthrough_slice_handoff` when present:

```yaml
plan_followthrough_slice_handoff:
  status: ready
  plan_ready_handoff:
    status: ready
    artifact_type: plan
    artifact_ref: docs/plans/example.md
    reviewed_slices:
      - slice-01
      - slice-02
    approved_slice: "Implement one reviewed slice."
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers_selected: []
    unresolved_blockers: []
    scrutiny_verdict: ship
  followthrough_context:
    ledger_ref: docs/plans/example.followthrough.md
    slice_advancement_mode: ship_then_continue
    slice_id: slice-01
    slice_name: Example slice
```

Otherwise, locate exactly one direct `plan_ready_handoff`:

```yaml
plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: docs/plans/example.md
  reviewed_slices:
    - slice-01
    - slice-02
  approved_slice: "Implement the first reviewed slice."
  required_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
    - refactoring-opportunities
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
```

Run the bundled script `scripts/plan-to-pr.ts validate-handoff` from this skill directory on the nested or direct `plan_ready_handoff` before editing files.

If the handoff is missing, invalid, ambiguous, has unresolved blockers, or has `scrutiny_verdict` other than `ship`, stop and ask the user to run `plan-ready` or paste a valid handoff.

If the user asks to implement a reviewed plan directly and there is no `plan_followthrough_slice_handoff`, stop and route to `plan-followthrough` unless the user explicitly asks to bypass followthrough for this run.

## Goal Invocation

In Codex, prefer starting this workflow as a goal with the handoff included in the objective:

```text
/goal Use $plan-to-pr with this plan_followthrough_slice_handoff or plan_ready_handoff: <handoff>. Validate the handoff, inspect any followthrough_context, inspect the approved slice's Refactoring / Reuse section, print and maintain the refactoring_execution ledger, implement only the approved slice, keep minor local refactors inside the slice, record naturally discovered significant_refactor_suggestions as carry-forward instead of implementing them, run local verification, launch implementation reviewers as internal Codex subagents, report launched reviewers and returned subagent IDs in-session, validate the launch report, reconcile reviewer outcomes, run review-feedback-routing, create or update the routed PR/MR, run artifact-host review, wait for routed latest-head feedback, iterate until feedback is resolved, watch artifact-host CI, and finish only when CI is green or blocked with evidence. Include the final reviewer subagent report, delivery gate ledger, and plan_followthrough_delivery when followthrough_context is present.
```

For non-Codex agents or tools without goal state, use the same objective as a normal prompt.

## Progress Output

Make workflow helper use visible in the transcript. Before running any named hosted adapter, routing helper, or plain-English fallback, send a short status line naming what is being used, why it is being used, and the artifact or diff it is checking. Reviewer checks such as `implementation-review-agent` are Codex subagent roles, not standalone skills. Examples:

- `Using $session-start to anchor this delivery run in live repo, branch, PR, and CI state.`
- `Using $review-feedback-routing to select artifact host, create/inspect adapters, and review feedback route.`
- `Launching internal Codex reviewer subagents for implementation review, implementation scrutiny, code quality, simplification, deslop, docs alignment, and conditional security review.`
- `Using $github-pr-create to open the GitHub draft PR for the reviewed branch.`
- `Using $gitlab-adapter-review to inspect the hosted GitLab MR at the latest head.`
- `Using $github-adapter-review to inspect the hosted GitHub PR at the latest head.`

When a named hosted adapter or routing helper is unavailable and a fallback is used, say that explicitly in the same status line.

After each gate, report the verdict in one line with the gate name, artifact or head, verdict, and next action.

When reviewer subagents are launched, immediately print a session report using `scripts/plan-to-pr.ts reviewer-template`, record the returned subagent id for each launched reviewer, and validate it with `scripts/plan-to-pr.ts validate-launch-report` before waiting for outcomes:

```yaml
reviewer_subagent_launch:
  status: launched
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  subagent_ids:
    - implementation-review-agent: 019...
    - implementation-scrutiny-agent: 019...
    - code-quality-review-agent: 019...
    - code-simplifier-agent: 019...
    - deslop-agent: 019...
    - docs-alignment-review-agent: 019...
```

When reviewer subagents finish, include a final reviewer outcome report in the session and validate it with `scripts/plan-to-pr.ts validate-review-report`:

```yaml
reviewer_subagent_report:
  status: complete
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  outcomes:
    - implementation-review-agent: passed - no actionable correctness or regression findings
    - implementation-scrutiny-agent: passed - scrutiny verdict ship
    - code-quality-review-agent: passed - no critical or warning maintainability findings
    - code-simplifier-agent: passed - simplification applied or not needed
    - deslop-agent: passed - AI-shaped clutter removed or not present
    - docs-alignment-review-agent: passed - docs alignment clean or updated
```

## Workflow

1. Validate the handoff with the bundled script `scripts/plan-to-pr.ts validate-handoff`.
2. Run `scripts/plan-to-pr.ts detect` and start from live state with `session-start`: repo rules, branch/worktree, dirty state, PRs, CI, and the referenced planning artifact.
3. Confirm the referenced plan/OpenSpec/Linear artifact exists or is reachable. If it is unavailable, block with evidence.
4. Use `review-feedback-routing` before PR/MR creation when available.
   - Detect artifact host from remotes before PR/MR creation.
   - GitLab for `git.fullscript.io` or other GitLab remotes.
   - GitHub for `github.com` or GitHub Enterprise remotes.
   - If host ownership still conflicts after inspecting workflow evidence, ask one blocking question.
5. Inspect the approved slice's `Refactoring / Reuse` section. Print `scripts/plan-to-pr.ts refactoring-template` and fill `refactoring_execution` before editing:
   - `minor_in_slice`: local behavior-preserving refactors already inside the approved slice boundary;
   - `significant_refactor_suggestions`: significant refactors discovered naturally during delivery, recorded for later planning but not implemented in this slice.
6. Implement only `plan_ready_handoff.approved_slice`.
7. Run the narrowest useful local verification for touched code. When review feedback, CI, a bug fix, or browser checks reveal missing coverage, apply the Fastest Durable Regression rule from `rules/testing-and-verification.md`: add the lowest practical durable regression and report any skipped local layer explicitly.
8. Launch implementation reviewers as internal Codex subagents in the current harness, then immediately print and validate the reviewer launch report in the session.
   - In Codex, use the internal Codex subagent tool exposed by the current harness and omit model overrides unless the user explicitly asks for one.
   - Do not invoke the `dispatch` skill, Claude Code `Task`, or any external Claude harness for `plan-to-pr` implementation reviewers from Codex.
   - Launch these reviewers after implementation and local verification: `implementation-review-agent`, `implementation-scrutiny-agent`, `code-quality-review-agent`, `code-simplifier-agent`, `deslop-agent`, and `docs-alignment-review-agent`.
   - Launch `ai-readiness-upkeep-agent` when the diff touches verification scripts, task commands, hooks, CI/release/deploy config, generated artifacts, schemas/contracts, infra config, agent instructions, rules, skills, prompts, review rubrics, or review feedback that future agents should repeat or avoid; otherwise list it under `skipped_reviewers` with a not-applicable reason.
   - When launched, require `ai-readiness-upkeep-agent` to emit a validated `ai_readiness_upkeep_report`. `passed` maps to reviewer outcome `passed`; `findings` maps to `passed` only after nonblocking findings are recorded as residual risk or future work; `blocked`, invalid YAML, unknown lanes, or missing required fields map to `blocked` until fixed or explicitly accepted.
   - Launch `security-review-agent` only when the diff touches auth, authorization, secrets, token handling, sensitive data, dependency trust, webhooks, or externally reachable surfaces; otherwise list it under `skipped_reviewers` with a not-applicable reason.
   - Record each returned subagent id in `reviewer_subagent_launch.subagent_ids`.
   - Give each reviewer one bounded prompt, the diff or artifact it owns, and the expected output: `passed`, `findings`, `blocked`, or `not_applicable` with evidence.
9. Reconcile implementation reviewer outcomes:
   - fix actionable `findings` and rerun affected reviewers;
   - stop on `blocked` unless the blocker is external, permission-related, or explicitly accepted by the user;
   - do not continue to PR/MR creation until reviewer outcomes are complete and no actionable findings remain.
10. Validate the final reviewer outcome report with `scripts/plan-to-pr.ts validate-review-report`.
11. Before pushing, reconcile `refactoring_execution`:
    - minor in-slice refactors are implemented or deferred with evidence;
    - new reusable surfaces have at least one real current consumer;
    - significant refactor suggestions remain unimplemented unless they are already part of the approved slice;
    - behavior-preserving verification ran at the fastest practical layer.
12. Push the branch and open or update the PR/MR through the routed artifact host:
    - GitLab: use the GitLab MR creation path (`glab-mr-create` or its successor).
    - GitHub: use `github-pr-create`.
    - Unknown artifact host: ask for the target host or stop with exact ambiguity.
13. Run the artifact-host inspection adapter on the created or existing artifact:
    - GitLab: use `gitlab-adapter-review`.
    - GitHub: use `github-adapter-review`.
14. Request or wait for review feedback using the routed `review_feedback.primary` entry.
15. Request or wait for routed feedback before treating the gate as complete. For Codex GitHub review, poll PR reviews, review comments, timeline comments, and request reactions until the latest pushed head has a `chatgpt-codex-connector` review/comment, a thumbs-up/no-issues reaction on the request, actionable inline findings, or a clear timeout/blocker. For Nitro on Fullscript GitLab, follow `review-feedback-routing`: when it selects explicit Nitro feedback, post `glab mr note <MR_IID> -m "/request_review @nitro"` after MR creation or material follow-up pushes, then poll for latest-head Nitro feedback.
16. Apply actionable hosted feedback and repeat local verification plus affected internal Codex reviewer subagents on the updated diff, then push and rerun hosted review. If feedback exposes missing coverage, apply the Fastest Durable Regression rule before rerunning broad checks. If the branch head changes after feedback or CI fixes, earlier hosted review is stale unless it clearly reviewed the new head.
17. Watch CI through the artifact-host tool: `glab ci`/GitLab pipeline tools for GitLab, and `gh pr checks` or GitHub Actions checks for GitHub. Fix branch-caused failures, rerun relevant verification, rerun scrutiny and docs alignment if the diff changed, and push updates.
18. Before finishing, generate the gate ledger shape with `scripts/plan-to-pr.ts gate-template`, fill it, and validate it with `validate-ledger`.
19. If `followthrough_context` was present, generate `scripts/plan-to-pr.ts followthrough-delivery-template`, fill it, and validate it with `validate-followthrough-delivery`.
20. Finish only when CI is green or the blocker is external, permission-related, flaky infrastructure, review-feedback timeout, or a product decision with evidence.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Handoff validation | `plan_ready_handoff` validates and has `scrutiny_verdict: ship` |
| Session start | Live repo, branch/worktree, remotes, and planning artifact state are inspected |
| Slice status | Branch, PR/MR if any, latest head, and current next action are recorded |
| Implementation | The approved slice is implemented and no unrelated scope is added |
| Local verification | Narrow verification for touched code passes or blocker is evidenced |
| Refactoring execution | Required refactors are implemented or explicitly deferred; reusable surfaces have real consumers; behavior-preserving verification ran |
| Reviewer subagents | Internal Codex reviewer subagents are launched, reported, and complete |
| Implementation review | `implementation-review-agent` subagent has no actionable correctness or regression findings remaining |
| Implementation scrutiny | `implementation-scrutiny-agent` subagent returns `passed`, or a trade-off is explicitly accepted |
| Code quality review | `code-quality-review-agent` subagent has no critical or warning maintainability findings unresolved |
| Code simplifier | `code-simplifier-agent` subagent applied behavior-preserving simplification or marked not applicable |
| Deslop | `deslop-agent` subagent removed AI-shaped clutter/style drift or marked not applicable |
| Security review | `security-review-agent` subagent reviewed relevant security surface, or skipped with reason |
| AI readiness upkeep | `ai-readiness-upkeep-agent` returns a validated passing report, has only accepted nonblocking findings, or is skipped with not-applicable evidence |
| Docs alignment | `docs-alignment-review-agent` subagent is clean/not applicable, or updates are made/deferred with reason |
| Review feedback routing | Artifact and feedback adapters are selected, or ambiguity is blocked with evidence |
| Artifact creation/update | Routed PR/MR exists for the latest branch |
| Artifact-host review | `gitlab-adapter-review` or `github-adapter-review` reviewed the latest hosted artifact head |
| Review feedback | Routed feedback produced a latest-head result with no actionable findings, or blocker is evidenced |
| CI | Required checks are green, or non-branch blocker is evidenced |

## Significant Refactor Suggestions

`plan-to-pr` does not hunt for new significant refactors. Those should have
been caught during `plan-ready` and turned into approved slices before delivery.

If a significant refactor appears naturally during implementation, local review,
hosted review, or CI repair, record it as carry-forward data and keep delivering
the approved slice:

```yaml
significant_refactor_suggestions:
  - title: <short suggested refactoring slice>
    discovered_during: implementation | local_review | hosted_review | ci_fix
    why_not_in_scope: <why this changes slice scope, sequencing, boundary, contract, or acceptance criteria>
    suggested_planning_action: add_refactor_slice | revisit_sequence | reject_later
    affected_slices:
      - <slice id, title, or unknown>
```

The suggestion is nonblocking by default. It blocks only when the current
approved slice can no longer satisfy its acceptance criteria or verification
without reopening the plan; in that case, report `blocked` or `needs_replan`
with evidence rather than implementing the significant refactor opportunistically.

## Final Delivery Ledger

The final response must include every gate. Use `passed` or `blocked` for mandatory gates, and use `not_applicable` only for conditional gates accepted by `validate-ledger`, with one line of evidence.

When no `followthrough_context` is present, also include
`significant_refactor_suggestions` after the ledger, using `[]` when none were
discovered.

```yaml
delivery_gate_ledger:
  handoff_validation:
    status: passed
    evidence: "plan_ready_handoff validated"
  session_start:
    status: passed
    evidence: "repo, branch, remotes, and artifact inspected"
  slice_status:
    status: passed
    evidence: "branch, PR/MR, latest head, review state, CI state, and next action recorded"
  implementation:
    status: passed
    evidence: "approved slice implemented"
  local_verification:
    status: passed
    evidence: "<command>"
  refactoring_execution:
    status: passed
    evidence: "minor refactors implemented/deferred and significant refactor suggestions recorded"
  reviewer_subagents:
    status: passed
    evidence: "reviewer_subagent_launch and reviewer_subagent_report validated"
  implementation_review:
    status: passed
    evidence: "no actionable correctness or regression findings"
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
  ai_readiness_upkeep:
    status: not_applicable
    evidence: "no AI readiness verification or agent-surface contract changed"
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

When invoked from `plan-followthrough`, also include:

```yaml
plan_followthrough_delivery:
  slice_id: slice-01
  slice_name: Example slice
  status: shipped
  artifact:
    pr_or_mr: <url>
    commit: <sha>
    branch: <branch>
  delivery_ledger_ref: final response
  verification:
    passed: []
    gaps: []
  review_feedback:
    resolved: []
    carried_forward: []
  refactoring_reuse:
    implemented: []
    deferred: []
    must_consume_later: []
  significant_refactor_suggestions: []
  changed_assumptions: []
  recommended_next_action: <next action for plan-followthrough>
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Brainstorming inside `plan-to-pr` | Stop and run `plan-ready` |
| Implementing without a handoff | Ask for a valid `plan_ready_handoff` |
| Starting from a reviewed plan with no followthrough handoff | Route through `plan-followthrough` unless explicitly bypassed |
| Treating `reviewed_slices` as current implementation scope | Use it as upfront slice-plan evidence; implement only `approved_slice` |
| Expanding beyond `approved_slice` | Update the plan through `plan-ready` first |
| Ignoring `Refactoring / Reuse` | Fill `refactoring_execution` before editing and reconcile it before push/final delivery |
| Adding reusable surfaces with no consumer | Rework or defer the abstraction until a current or named later slice consumes it |
| Hunting for new significant refactors during implementation | Stay on the approved slice and record only naturally discovered suggestions |
| Implementing a significant refactor discovered during delivery | Record it as carry-forward unless the current plan is invalid and must block or return to planning |
| Encoding every review bug in browser E2E | Apply `rules/testing-and-verification.md` and add the fastest durable regression layer |
| Running reviewers locally in the main agent only | Launch internal Codex reviewer subagents and report launch/outcomes |
| Routing Codex implementation reviewers through `dispatch` or Claude | Use the current harness's internal Codex subagent tool |
| Reporting only one reviewer | Launch and report all required reviewers: `implementation-review-agent`, `implementation-scrutiny-agent`, `code-quality-review-agent`, `code-simplifier-agent`, `deslop-agent`, and `docs-alignment-review-agent` |
| Omitting AI readiness accounting | Launch `ai-readiness-upkeep-agent` when verification or agent-surface contracts changed, otherwise list it under `skipped_reviewers` with not-applicable evidence |
| Omitting conditional security review | Launch `security-review-agent` when applicable, otherwise list it under `skipped_reviewers` with not-applicable evidence |
| Leaving `findings` or `blocked` in the final reviewer report | Fix findings, resolve blockers, and validate only the reconciled final report |
| Treating implementation review as enough | Run all implementation reviewer subagents and reconcile outcomes |
| Treating review request as feedback | Wait for latest-head routed feedback |
| Reusing hosted review from an older head | Re-request hosted review after pushing fixes |
| Waiting for automatic Nitro feedback when routing requires an explicit request | Post `/request_review @nitro`, then poll the latest head |
| Omitting the reviewer outcome report | Generate it, validate it, and include it before the delivery ledger |
| Finishing without a final ledger | Generate, fill, and validate the ledger |
| Omitting followthrough delivery when followthrough context was present | Generate and validate `plan_followthrough_delivery` |
| Saying "done" with pending or unknown CI | Watch checks or state the exact blocker |

## Test Evidence

- RED: prior `plan-to-pr` flow could begin from a fuzzy idea and mix planning with implementation.
- GREEN: this skill requires a validated `plan_ready_handoff` before editing files.
- REFACTOR: implementation delivery gates remain explicit, but planning gates move to `plan-ready`.
- REFACTOR: implementation now carries `refactoring_execution` from the plan's `Refactoring / Reuse` section through delivery, and the final ledger records slice status plus refactoring execution.
- REFACTOR: plan-to-pr now accepts `followthrough_context` from `plan-followthrough` and must return `plan_followthrough_delivery` for reconciliation.
- RED: thread `019ec3c6-27cd-7962-9c30-313332a857d0` showed delivery slowing when significant refactor ideas stayed attached to the active slice.
- GREEN/REFACTOR: significant refactors discovered during delivery are nonblocking carry-forward suggestions unless they invalidate the approved slice; followthrough delivery now exposes them for later planning review.
- GREEN: pressure testing confirmed missing handoffs and non-`ship` scrutiny handoffs block before implementation.
- RED: baseline subagent `019eb39e-7a2b-7453-81b0-37fb35df9005` inspected committed pre-edit files and failed as expected. It cited `Run implementation diff review with diff-review`, `Run scrutinize on the implementation diff`, `Run the pre-commit quality gate`, and adapter text `run local verification, implementation review, $scrutinize...`, rationalizing: `inline helper-skill review satisfies the workflow; nothing says I must launch internal Codex reviewer subagents or report each reviewer's final outcome`.
- GREEN: subagent `019eb370-7dce-75d3-97ff-6c80d6406aab` confirmed the first patch forced internal Codex reviewer subagents and blocked dispatch/Claude, then found validator loopholes for under-launched reports, unresolved `findings`, missing security accounting, one-reviewer examples, and post-feedback inline reruns.
- REFACTOR: the script now requires six implementation reviewer agents, requires `security-review-agent` and `ai-readiness-upkeep-agent` to be launched or skipped with not-applicable evidence, rejects unresolved `findings` or `blocked`, validates `reviewer_subagent_launch` with returned subagent IDs, requires launched AI readiness outcomes to cite `validate-report` or a validated `ai_readiness_upkeep_report`, and requires `implementation-review-agent`, `implementation-scrutiny-agent`, and `code-quality-review-agent` to be `passed`.
- GREEN: subagent `019eb391-6f16-7e03-8744-1e73e0daa807` passed after refactor with `Remaining actionable ambiguity: None.`
- RED: thread `019eb821-3bda-7db2-b40d-12c90f93b4cb` blocked on Fullscript Nitro feedback because the workflow waited for automatic feedback even though no Nitro review was requested.
- GREEN: Fullscript Nitro now follows explicit routing: request `/request_review @nitro` for MR creation or material follow-up pushes, then poll latest-head feedback.
- Validation evidence: `validate-launch-report`, `validate-review-report`, and `validate-ledger` passed on valid fixtures; invalid missing reviewer IDs, under-launched reports, unresolved findings, `implementation-review-agent: not_applicable`, and mandatory ledger gate `not_applicable` fixtures were rejected; `bun build skills/plan-to-pr/scripts/plan-to-pr.ts --outfile /private/tmp/plan-to-pr-check.js` bundled successfully.
