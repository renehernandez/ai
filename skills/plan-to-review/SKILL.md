---
name: plan-to-review
description: Use when a reviewed plan, OpenSpec change, or planning-only branch should be published as a PR or MR for Nitro, Codex, and developer feedback before implementation.
---

# Plan To Review

## Overview

Publish an existing planning artifact as a planning-only hosted review. This skill is parallel to `plan-to-pr`: it creates or updates the PR/MR for plan feedback, waits for routed hosted feedback, and stops before implementation.

## When To Use

Use when the user wants to publish a plan, OpenSpec change, or planning-only branch for Nitro, Codex, or developer review before coding starts.

Use `plan-ready` first when the plan still needs scope hardening. Use `plan-to-pr` when the user is ready to implement an approved slice.

## Required Input

Locate exactly one input from the current session or user prompt:

```yaml
plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - nitro
    - developers
  unresolved_blockers: []
```

A `plan_ready_handoff` from `plan-ready` is also valid input when `status: ready`, `artifact_type`, `artifact_ref`, `approved_slice`, `unresolved_blockers: []`, and `scrutiny_verdict: ship` are present.

Run `scripts/plan-to-review.ts validate-request` from this skill directory before publishing anything. If input is missing, ambiguous, stale, or has unresolved blockers, stop and ask for `plan-ready` or a valid `plan_review_request`.

## Progress Output

Announce each helper before it starts:

- `Using $session-start to inspect live repo, branch, remotes, and planning-artifact state.`
- `Using $review-feedback-routing to select the hosted review artifact and feedback route.`
- `Using $github-pr-create to open or update the planning-only GitHub draft PR.`
- `Using the GitLab MR creation path to open or update the planning-only GitLab draft MR.`
- `Using $nitro-review-feedback to wait for Nitro feedback on the latest MR head.`
- `Using the Fullscript GitLab review-request path to assign Nitro or request review for the updated MR head.`
- `Using $codex-review-feedback to wait for Codex feedback on the latest PR head.`

After each gate, report one line with the gate, artifact or head SHA, verdict, and next action.

## Workflow

1. Validate the input with `scripts/plan-to-review.ts validate-request`.
2. Run `scripts/plan-to-review.ts detect` and start from live state with `session-start`: repo rules, branch/worktree, dirty state, remotes, existing PRs/MRs, CI, and the referenced planning artifact.
3. Confirm the referenced plan/OpenSpec/Linear planning artifact exists or is reachable. If unavailable, block with evidence.
4. Inspect the branch diff against the target branch before committing or publishing. The diff must be planning-only: plans, OpenSpec files, docs that explain the plan, skill/rule workflow docs, or review metadata. If implementation files are present, stop and ask whether to split them out.
5. Run artifact-specific validation:
   - OpenSpec: `openspec validate <change-id> --strict --no-interactive`.
   - Markdown plan: check links or render only when the repo has an established doc validation command.
   - Linear-only plan: verify the linked ticket is reachable; do not mirror ticket text into the repo unless asked.
6. Run `review-feedback-routing` before PR/MR creation. Detect artifact host from remotes and route reviewer feedback separately from artifact creation.
7. Commit and push the planning-only branch when the hosted-review creation path requires a clean pushed branch. Do not include implementation changes in the commit.
8. Create or update the routed draft PR/MR with a title and description that make the planning-only state explicit:
   - state that implementation has not started;
   - name the plan/OpenSpec artifact;
   - name the requested feedback, such as Nitro and developer review;
   - include exact planning validation performed.
   For Fullscript GitLab MRs, ensure Nitro is assigned as a reviewer when the MR is created or updated. If pushing changes to an existing MR changes the branch head, do not assume the previous Nitro state still applies.
9. Run the artifact-host inspection adapter (`gitlab-review` or `github-review`) only for host metadata, discussions, and CI/review state. Do not run implementation code review against a planning-only diff unless the plan changes agent/runtime behavior that requires it.
10. Wait for routed automated feedback on the latest head:
    - Fullscript GitLab/Nitro: use `nitro-review-feedback` first. If the MR was created or the branch was pushed against an existing MR and latest-head Nitro feedback is missing or stale, assign Nitro or post the standard Nitro review request for the current head, then wait again. Automatic routing is not enough evidence after a new push until Nitro is assigned/requested for the latest head or the host shows a fresh pending Nitro review state.
    - GitHub/Codex: use `codex-review-feedback` when routing selects Codex.
    - Developer review: keep the PR/MR open and report pending human review; do not fabricate approval.
11. Apply only plan/documentation feedback. If feedback asks for implementation, record it as a follow-up or blocker; do not start coding.
12. If the branch head changes after feedback fixes, rerun artifact validation, push, and wait for latest-head automated feedback again.
13. Before finishing, generate `scripts/plan-to-review.ts gate-template`, fill it, and validate it with `validate-ledger`.
14. Finish when the planning-only artifact is published and automated feedback is resolved, pending with evidence, unavailable with evidence, or explicitly waived. Developer review may remain pending when the goal is to publish for review.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Request validation | Exactly one valid `plan_review_request` or `plan_ready_handoff` is available |
| Session start | Live repo, branch, remotes, existing artifacts, and planning artifact are inspected |
| Planning-only diff | Diff contains no implementation changes, or implementation changes are explicitly split out |
| Artifact validation | OpenSpec/doc/ticket validation passes or a precise gap is reported |
| Review feedback routing | Artifact and feedback adapters are selected, or ambiguity is blocked |
| Artifact creation/update | Draft PR/MR exists for the latest planning-only branch |
| Artifact-host inspection | Host metadata, discussions, and check state are inspected |
| Automated feedback | Routed automated feedback is resolved, pending, unavailable, or waived with evidence; on Fullscript GitLab, missing/stale latest-head Nitro feedback after create/update must include evidence that Nitro was assigned or a fresh review was requested for that head |
| Developer review | Human developer review is requested or pending on the hosted artifact |
| No implementation | No implementation work starts in this workflow |

## Final Review Ledger

The final response must include every gate. Use `passed` or `blocked`; use `not_applicable` only for conditional gates accepted by `validate-ledger`.

```yaml
plan_review_gate_ledger:
  request_validation:
    status: passed
    evidence: "plan_review_request validated"
  session_start:
    status: passed
    evidence: "repo, branch, remotes, and artifact inspected"
  planning_only_diff:
    status: passed
    evidence: "diff limited to OpenSpec files"
  artifact_validation:
    status: passed
    evidence: "openspec validate example-change --strict --no-interactive"
  review_feedback_routing:
    status: passed
    evidence: "GitLab artifact with Nitro feedback route selected"
  artifact_creation_update:
    status: passed
    evidence: "MR URL"
  artifact_host_inspection:
    status: passed
    evidence: "MR metadata and discussions inspected"
  automated_feedback:
    status: passed
    evidence: "Nitro latest-head feedback returned no findings, or Nitro was assigned/requested for the latest head and remains pending"
  developer_review:
    status: passed
    evidence: "MR published for developer review"
  no_implementation:
    status: passed
    evidence: "no implementation files changed"
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Implementing after the plan is published | Stop and ask the user to invoke `plan-to-pr` after review |
| Treating `plan_ready_handoff` as approval to code | Use it only as evidence the artifact is ready to publish |
| Publishing implementation files in the review branch | Split them out before creating the planning review |
| Treating automatic Nitro routing as sufficient after pushing a new head to an existing Fullscript MR | Assign Nitro or request a fresh Nitro review for the current head, then wait for latest-head feedback or pending state |
| Requesting Nitro repeatedly when a fresh latest-head Nitro review is already pending | Stop polling after recording the pending review state, MR head, and request/assignment evidence |
| Calling pending developer review a pass | Report it as published and pending with the PR/MR URL |
| Applying code changes from review feedback | Convert implementation requests into plan changes or follow-ups |

## Test Evidence

- RED: the existing workflow forced a choice between `plan-ready` stopping locally and `plan-to-pr` starting implementation, leaving no hosted-review lane for planning artifacts.
- RED: thread `019eb3d7-d078-7d23-ba4e-d6e296a83ffe` pushed an updated Fullscript GitLab planning MR, found Nitro notes only for stale heads, and finished with automatic Nitro pending instead of assigning Nitro or requesting a fresh review for the new head.
- GREEN: this skill validates a planning-review request, publishes a planning-only PR/MR, waits for routed automated feedback, and stops before implementation.
- GREEN: after creating or updating a Fullscript GitLab MR, the workflow must ensure Nitro is assigned or explicitly requested when latest-head Nitro feedback is absent or stale.
- REFACTOR: the workflow accepts `plan_ready_handoff` as publishable evidence but does not treat it as permission to implement.
- Validation evidence: `pnpm exec tsx skills/plan-to-review/scripts/plan-to-review.ts validate-request --file /private/tmp/plan-to-review-valid-request.yaml` returned `plan_review_request valid`; a valid `plan_ready_handoff` fixture returned `plan_ready_handoff valid`; unresolved blockers, ambiguous dual input, and non-`ship` scrutiny fixtures were rejected; `validate-ledger` accepted the final ledger fixture.
