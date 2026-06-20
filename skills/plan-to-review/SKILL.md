---
name: plan-to-review
description: Use when a reviewed plan, OpenSpec change, or planning-only branch should be published as a PR or MR for Nitro, Codex, and developer feedback before implementation.
---

# Plan To Review

## Overview

Publish a planning artifact as a planning-only hosted review. This skill is
parallel to `plan-unit-delivery`: it creates or updates the PR/MR for plan feedback,
waits for routed hosted feedback, and stops before implementation.

## When To Use

Use when the user wants to publish a plan, OpenSpec change, or planning-only
branch for Nitro, Codex, or developer review before coding starts.

Use `plan-ready` first when the plan still needs scope hardening. Use
`plan-unit-delivery` when the user is ready to implement a validated
`plan_delivery_handoff`.

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

A `plan_delivery_handoff` is also valid when the plan-ready artifact should be
published for review before implementation.

Legacy `plan_ready_handoff`, `reviewed_slices`, `slice_plan_review`,
`plan_followthrough_slice_handoff`, and followthrough-ledger inputs are
unsupported. Return `needs_plan_ready` so the thread reruns `plan-ready`.

Run `scripts/plan-to-review.ts validate-request` from this skill directory
before publishing anything. If input is missing, ambiguous, stale, or has
unresolved blockers, stop and ask for `plan-ready` or a valid
`plan_review_request`.

## Progress Output

Announce each helper before it starts:

- `Using $session-start to inspect live repo, branch, remotes, and planning-artifact state.`
- `Using $review-feedback-routing to select the hosted review artifact and feedback route.`
- `Using $github-pr-create to open or update the planning-only GitHub draft PR.`
- `Using the GitLab MR creation path to open or update the planning-only GitLab draft MR.`
- `Using $nitro-review-feedback to wait for Nitro feedback on the latest MR head.`
- `Using the Fullscript GitLab review-request path to request Nitro review for the updated MR head.`
- `Using $codex-review-feedback to wait for Codex feedback on the latest PR head.`

After each gate, report one line with the gate, artifact or head SHA, verdict,
and next action.

## Workflow

1. Validate the input with `scripts/plan-to-review.ts validate-request`.
2. Run `scripts/plan-to-review.ts detect` and start from live state with
   `session-start`: repo rules, branch/worktree, dirty state, remotes, existing
   PRs/MRs, CI, and the referenced planning artifact.
3. Confirm the referenced plan/OpenSpec/Linear planning artifact exists or is
   reachable. If unavailable, block with evidence.
4. Inspect the branch diff against the target branch before committing or
   publishing. The diff must be planning-only: plans, OpenSpec files, docs that
   explain the plan, skill/rule workflow docs, or review metadata. If
   implementation files are present, stop and ask whether to split them out.
5. Run artifact-specific validation:
   - OpenSpec: `openspec validate <change-id> --strict --no-interactive`.
   - Markdown plan: check links or render only when the repo has an established
     doc validation command.
   - Linear-only plan: verify the linked ticket is reachable; do not mirror
     ticket text into the repo unless asked.
6. Run `review-feedback-routing` before PR/MR creation. Detect artifact host
   from remotes and route reviewer feedback separately from artifact creation.
7. Commit and push the planning-only branch when the hosted-review creation path
   requires a clean pushed branch. Do not include implementation changes in the
   commit.
8. Create or update the routed draft PR/MR with a title and description that
   makes the planning-only state explicit:
   - state that implementation has not started;
   - name the plan/OpenSpec artifact;
   - name the requested feedback, such as Nitro and developer review;
   - include exact planning validation performed.
9. Run the artifact-host inspection adapter (`gitlab-adapter-review` or
   `github-adapter-review`) only for host metadata, discussions, and CI/review
   state. Do not run implementation code review against a planning-only diff.
10. Wait for routed automated feedback on the latest head:
    - Fullscript GitLab/Nitro: use `nitro-review-feedback` first. If latest-head
      Nitro feedback is missing or stale after create/update, post the standard
      Nitro review request for the current head, then wait again.
    - GitHub/Codex: use `codex-review-feedback` when routing selects Codex.
    - Developer review: keep the PR/MR open and report pending human review; do
      not fabricate approval.
11. Apply only plan/documentation feedback. If feedback asks for implementation,
    record it as a follow-up or blocker; do not start coding.
12. If the branch head changes after feedback fixes, rerun artifact validation,
    push, and wait for latest-head automated feedback again.
13. Before finishing, generate `scripts/plan-to-review.ts gate-template`, fill
    it, and validate it with `validate-ledger`.
14. Finish when the planning-only artifact is published and automated feedback
    is resolved, pending with evidence, unavailable with evidence, or explicitly
    waived. Developer review may remain pending when the goal is to publish for
    review.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Request validation | Exactly one valid `plan_review_request` or `plan_delivery_handoff` is available |
| Session start | Live repo, branch, remotes, existing artifacts, and planning artifact are inspected |
| Planning-only diff | Diff contains no implementation changes, or implementation changes are explicitly split out |
| Artifact validation | OpenSpec/doc/ticket validation passes or a precise gap is reported |
| Review feedback routing | Artifact and feedback adapters are selected, or ambiguity is blocked |
| Artifact creation/update | Draft PR/MR exists for the latest planning-only branch |
| Artifact-host inspection | Host metadata, discussions, and check state are inspected |
| Automated feedback | Routed automated feedback is resolved, pending, unavailable, or waived with evidence |
| Developer review | Human developer review is requested or pending on the hosted artifact |
| No implementation | No implementation work starts in this workflow |

## Final Review Ledger

The final response must include a concise `## Readable Summary` followed by
every gate in YAML. Use `passed` or `blocked`; use `not_applicable` only for
conditional gates accepted by `validate-ledger`.

The readable summary is for thread scanning, especially on mobile. Keep it to
3-6 bullets with artifact, review route, validation state, automatic feedback
state, blockers, and next action. Do not replace the YAML; the YAML remains the
machine-readable review ledger.

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
    evidence: "Nitro latest-head feedback resolved or pending with evidence"
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
| Implementing after the plan is published | Stop and ask the user to invoke `plan-unit-delivery` after review |
| Accepting legacy handoffs | Return `needs_plan_ready` |
| Publishing implementation files in the review branch | Split them out before creating the planning review |
| Treating routing metadata as sufficient after pushing a new head to an existing Fullscript MR | Request a fresh Nitro review for the current head, then wait for latest-head feedback or pending state |
| Requesting Nitro repeatedly when a fresh latest-head Nitro review is already pending | Stop polling after recording the pending review state, MR head, and request evidence |
| Calling pending developer review a pass | Report it as published and pending with the PR/MR URL |
| Applying code changes from review feedback | Convert implementation requests into plan changes or follow-ups |
| Returning gate YAML without a readable thread summary | Add `## Readable Summary` before the YAML |

## Test Evidence

- RED: previous workflow accepted `plan_ready_handoff` as hosted-review input.
- GREEN: the validator now accepts `plan_review_request` and
  `plan_delivery_handoff`, and rejects legacy slice/followthrough shapes.
