---
name: plan-review
description: Use when a reviewed plan, OpenSpec change, or planning-only branch should be published as a PR or MR for Nitro and developer feedback before implementation.
---

# Plan Review

## Overview

Publish a planning artifact as a planning-only hosted review. This skill
creates or updates the PR/MR for plan feedback, waits for routed hosted
feedback, and emits the `planning_review` handoff consumed before
implementation.

## When To Use

Use when the user wants to publish a plan, OpenSpec change, or planning-only
branch for Nitro or developer review before coding starts.

Use `plan-ready` first when the plan still needs scope hardening. Use
`plan-unit-sequencer` only after this skill emits a validated
`planning_review`.

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
  readiness_reviewer_evidence:
    artifact_fingerprint: <plan-ready reviewer evidence fingerprint>
    completed_at: <plan-ready reviewer evidence completion timestamp>
    gate_outcome: passed
    baseline_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    selected_dynamic_reviewers: []
    per_reviewer_status:
      implementation-readiness: passed
      edge-cases-and-risks: passed
      simplification-and-scope-control: passed
      refactoring-opportunities: passed
    skipped_reviewers: []
    skipped_rationale: []
    blocking_findings: []
  unresolved_blockers: []
```

A `plan_delivery_handoff` is also valid when the plan-ready artifact should be
published for review before implementation.

Legacy `plan_ready_handoff`, `reviewed_slices`, `slice_plan_review`,
`plan_followthrough_slice_handoff`, and followthrough-ledger inputs are
unsupported. Return `needs_plan_ready` so the thread reruns `plan-ready`.

Run `scripts/plan-review.ts validate-request` from this skill directory
before publishing anything. If input is missing, ambiguous, stale, or has
unresolved blockers, stop and ask for `plan-ready` or a valid
`plan_review_request`. For `plan_review_request`, validation must pass only
when `readiness_reviewer_evidence` is present, every baseline and selected
dynamic reviewer has a passing status, and no readiness blocking findings
remain.

## Progress Output

Announce each helper before it starts:

- `Using $session-start to inspect live repo, branch, remotes, and planning-artifact state.`
- `Using $review-feedback-routing to select the hosted review artifact and feedback route.`
- `Using $github-pr-create to open or update the planning-only GitHub draft PR.`
- `Using the GitLab MR creation path to open or update the planning-only GitLab draft MR.`
- `Using $nitro-review-feedback to wait for Nitro feedback on the latest MR head.`
- `Using the Fullscript GitLab review-request path to request Nitro review for the updated MR head.`

After each gate, report one line with the gate, artifact or head SHA, verdict,
and next action.

## Workflow

1. Validate the input with `scripts/plan-review.ts validate-request`, including
   the readiness reviewer evidence copied from the validated `plan-ready`
   output.
2. Run `scripts/plan-review.ts detect` and start from live state with
   `session-start`: repo rules, branch/worktree, dirty state, remotes, existing
   PRs/MRs, CI, and the referenced planning artifact.
3. Confirm the referenced plan/OpenSpec/Linear planning artifact exists or is
   reachable. If unavailable, block with evidence.
4. Inspect the branch diff against the target branch before committing or
   publishing. The diff must be planning-only: plans, OpenSpec files, docs that
   explain the plan, skill/rule workflow docs, or review metadata. If
   implementation files are present, stop and ask whether to split them out.
   Validate the path boundary before commit with `scripts/plan-review.ts
   validate-planning-diff --artifact-type <type> --base <target>`, which
   includes dirty working-tree changes. For committed ranges, pass `--head
   <ref>`.
   For `artifact_type: openspec`, `.agents/plans/**` files are scratch intake
   only and must not appear in the planning diff as added, modified, deleted,
   renamed, copied, or type-changed paths. For `artifact_type: plan`, atomic
   plan review may still publish `.agents/plans/**` as the reviewed artifact.
5. Run artifact-specific validation:
   - OpenSpec: `openspec validate <change-id> --strict --no-interactive`.
   - Markdown plan: check links or render only when the repo has an established
     doc validation command.
   - Linear-only plan: verify the linked ticket is reachable; do not mirror
     ticket text into the repo unless asked.
6. Run `review-feedback-routing` before PR/MR creation. Detect artifact host
   from remotes and route reviewer feedback separately from artifact creation.
7. Bind the validated readiness reviewer evidence to the current staged
   planning diff with `scripts/plan-review.ts review-gate-input --diff-hash
   <current-staged-diff-hash> --file <plan-review-request>`. This prepares the
   shared review-gate input for the planning commit boundary; do not recompute
   reviewer lists.
8. Commit and push the planning-only branch when the hosted-review creation path
   requires a clean pushed branch. Do not include implementation changes in the
   commit.
9. Create or update the routed draft PR/MR with a title and description that
   makes the planning-only state explicit:
   - state that implementation has not started;
   - name the plan/OpenSpec artifact;
   - name the requested feedback, such as Nitro and developer review;
   - include exact planning validation performed.
10. Run the artifact-host inspection adapter (`gitlab-adapter-review` or
   `github-adapter-review`) only for host metadata, discussions, and CI/review
   state. Do not run implementation code review against a planning-only diff.
11. Wait for routed automated feedback on the latest head:
    - Fullscript GitLab/Nitro: use `nitro-review-feedback` first. If latest-head
      Nitro feedback is missing or stale after create/update, post the standard
      Nitro review request for the current head, then wait again.
    - Unsupported artifact hosts: return `nitro_route_unsupported`; do not
      substitute Codex or another reviewer for this first cut.
    - Developer review: keep the PR/MR open and report pending human review; do
      not fabricate approval.
12. Apply only plan/documentation feedback. If feedback asks for implementation,
    record it as a follow-up or blocker; do not start coding.
13. If the branch head changes after feedback fixes, rerun artifact validation,
    push, and wait for latest-head automated feedback again.
14. Before finishing, enumerate all Nitro-authored planning comments and
    discussions on the planning PR/MR across every review round. Record each
    note ID, discussion ID when present, whether the discussion is resolvable
    and currently resolved, and disposition: `fixed_in_planning`,
    `deferred_to_task`, `non_actionable`, or `blocked`. Unresolved actionable
    planning feedback blocks implementation sequencing unless it is explicitly
    deferred to a specific implementation task or marked non-actionable with
    rationale.
15. Generate `scripts/plan-review.ts gate-template`, fill it, and validate it
    with `validate-ledger` as internal evidence.
16. Emit `planning_review` with `scripts/plan-review.ts
    planning-review-template`, fill it with the hosted review evidence and a
    passed `nitro_feedback_gate` plus `planning_feedback_disposition`, and
    validate it with `validate-planning-review`.
17. Finish only when the planning MR has latest-head Nitro feedback completed
    cleanly, every prior Nitro planning item has explicit disposition, and the
    reviewed head is recorded as the implementation stack base.

Planning review is not terminal success for `plan-orchestrator`. In a
`plan-orchestrator` run, the emitted `planning_review` is the reviewed stack
base for `plan-unit-sequencer`; the orchestrator must keep sequencing
implementation units until it can report `stack_ready`, or report
`delivery_blocked` with evidence when it cannot continue.

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Request validation | Exactly one valid `plan_review_request` or `plan_delivery_handoff` is available |
| Session start | Live repo, branch, remotes, existing artifacts, and planning artifact are inspected |
| Planning-only diff | Diff contains no implementation changes, or implementation changes are explicitly split out |
| OpenSpec source-plan boundary | OpenSpec review diffs contain no `.agents/plans/**`; atomic plan artifacts may keep them |
| Artifact validation | OpenSpec/doc/ticket validation passes or a precise gap is reported |
| Review feedback routing | Artifact and feedback adapters are selected, or ambiguity is blocked |
| Artifact creation/update | Draft PR/MR exists for the latest planning-only branch |
| Artifact-host inspection | Host metadata, discussions, and check state are inspected |
| Planning feedback disposition | Every Nitro planning comment or discussion is enumerated by note/discussion ID with explicit disposition |
| Automated feedback | Routed automated feedback is resolved, pending, unavailable, or waived with evidence |
| Developer review | Human developer review is requested or pending on the hosted artifact |
| No implementation | No implementation work starts in this workflow |

## Final Planning Review Handoff

The final response must include a concise `## Readable Summary` followed by
`nitro_feedback_gate` and `planning_review` YAML. The detailed gate ledger may
be included as supporting evidence, but downstream skills must not infer
readiness from `plan_review_gate_ledger`.

The readable summary is for thread scanning, especially on mobile. Keep it to
3-6 bullets with artifact, review route, validation state, automatic feedback
state, blockers, and next action. Do not replace the YAML; the YAML remains the
machine-readable review ledger.

```yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab planning MR URL>
  head_sha: <planning artifact head sha>
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - <request command, note URL, or discussion evidence>
  start:
    status: started
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro acknowledgement or review-start evidence>
  completion:
    status: clean
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed

planning_review:
  status: reviewed
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_artifact: <planning PR or MR URL>
  mode: stacked_delivery
  gate_outcome: ready_for_stack
  target_branch: main
  target_base_sha: <target branch sha reviewed by planning artifact>
  planning_branch: <planning branch name>
  reviewed_head: <planning artifact head sha>
  stack_base_ref: <planning PR or MR branch/ref>
  stack_base_evidence: <latest-head Nitro feedback and stack-base evidence>
  stack_identity:
    expected_base_ref: <planning PR or MR branch/ref>
    expected_base_sha: <planning artifact head sha>
    predecessor_artifact:
    restack_required: false
  task_state_fingerprint: <sha256 of reviewed plan or task state>
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning MR latest-head Nitro feedback completed cleanly
  planning_feedback_disposition:
    status: complete
    evidence:
      - every Nitro planning item was enumerated and dispositioned by note ID
    items:
      - note_id: <Nitro note id>
        discussion_id: <discussion id when present>
        resolvable: true
        resolved: true
        disposition: fixed_in_planning
        evidence: <planning commit, deferred task id, non-actionable rationale, or blocked reason>
  blockers: []
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Implementing after the plan is published | Stop and emit `planning_review` for `plan-unit-sequencer` |
| Accepting legacy handoffs | Return `needs_plan_ready` |
| Publishing implementation files in the review branch | Split them out before creating the planning review |
| Treating routing metadata as sufficient after pushing a new head to an existing Fullscript MR | Request a fresh Nitro review for the current head, then wait for latest-head feedback or pending state |
| Requesting Nitro repeatedly when a fresh latest-head Nitro review is already pending | Stop polling after recording the pending review state, MR head, and request evidence |
| Calling pending developer review a pass | Report it as published and pending with the PR/MR URL |
| Applying code changes from review feedback | Convert implementation requests into plan changes or follow-ups |
| Treating latest-head Nitro clean as enough when prior planning comments exist | Enumerate prior Nitro planning comments and record explicit disposition before emitting `planning_review` |
| Returning gate YAML instead of `planning_review` | Emit and validate `planning_review` before handing off |
| Treating `planning_review` as terminal success | Hand off to sequencing; only `stack_ready` or `delivery_blocked` can finish orchestrator delivery |
| Returning YAML without a readable thread summary | Add `## Readable Summary` before the YAML |

## Test Evidence

- RED: previous workflow accepted `plan_ready_handoff` as hosted-review input.
- GREEN: the validator now accepts `plan_review_request` and
  `plan_delivery_handoff`, and rejects legacy slice/followthrough shapes.
- GREEN: `planning_review` validates as the only review-to-implementation
  handoff.
