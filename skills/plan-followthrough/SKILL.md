---
name: plan-followthrough
description: Use when a reviewed implementation plan, plan_ready_handoff, or approved plan needs to continue through one or more implementation slices, including single-slice plans, resumed plan work, compacted threads, stacked diffs, followthrough ledgers, or repeated plan-to-pr runs.
---

# Plan Followthrough

## Overview

Run an approved plan through one or more slice deliveries without losing continuity. This skill owns the followthrough ledger, next-slice selection, carry-forward context, and reconciliation around repeated `plan-to-pr` runs.

## When To Use

Use after `plan-ready` emits a valid `plan_ready_handoff`, including single-slice plans. Use when the user says to continue a plan, run a plan, finish a plan, continue a campaign, resume after compaction, or implement multiple slices.

Do not use for fuzzy ideas, unreviewed plans, or plan authoring. Run `plan-ready` first.

## Core Rules

- Always create or update one Markdown followthrough ledger beside the plan artifact: `<plan>.followthrough.md`.
- Always mirror the latest compact ledger snapshot in-session.
- Require `slice_advancement.mode` before implementation starts:
  - `ship_then_continue`: advance only after the current slice is shipped/landed through the delivery workflow.
  - `stack_then_continue`: advance after implementation and automated feedback are resolved, while tracking the dependency stack.
- If the mode is not explicit from the user or an existing ledger, ask one question and stop before implementation.
- Route every implementation slice through `plan-to-pr`; do not implement directly inside `plan-followthrough`.
- Do not spawn implementation subagents directly. `plan-to-pr` owns implementation and its reviewer subagents.
- Reconcile every `plan-to-pr` result before selecting another slice.
- Aggregate every nonblocking `significant_refactor_suggestions` entry from
  `plan-to-pr` into the followthrough ledger and surface the full list when the
  plan finishes, blocks, or needs replanning.
- Stop on `blocked`, `needs_replan`, missing mode, missing ledger, missing next slice, or invalid delivery output.

## Workflow

1. Validate the `plan_ready_handoff` and read the plan artifact.
2. Create or load `<plan>.followthrough.md`.
3. If resuming a vague or compacted thread, recover live state before choosing a slice: inspect repo status, recent commits, existing PRs/MRs when available, the reviewed plan, and what prior delivery actually completed.
4. Record `slice_advancement.mode`. Ask and stop if absent.
5. Select the next pending slice. Use `slice-01`, `slice-02`, etc. when the plan has no stable IDs.
6. Run `scripts/plan-followthrough.ts slice-handoff-template`, fill it, validate it, and pass it to `plan-to-pr`.
7. When `plan-to-pr` finishes, require `plan_followthrough_delivery`, validate it, and append a slice reconciliation to the ledger.
8. Copy any `significant_refactor_suggestions` into `carry_forward.significant_refactor_suggestions`; keep them nonblocking unless the delivery status is `needs_replan` or `blocked`.
9. Continue to the next slice when the mode allows it. Otherwise close as `complete`, `blocked`, or `needs_replan`.

## Resume Recovery

When the user says "continue the campaign", "continue the plan", or resumes after compaction and the thread summary is vague:

1. Do not trust the compacted summary as the source of truth.
2. Locate the reviewed plan and any existing `<plan>.followthrough.md`.
3. If no ledger exists, create it beside the plan before implementation.
4. Recover prior slice state from live repo/provider evidence where available: branch, commits, PR/MR status, checks, review feedback, and files changed.
5. Map prior delivery back to the reviewed slice list. Mark slices as `shipped`, `stacked_pending_merge`, `delivered`, `blocked`, `needs_replan`, or `pending`.
6. If `slice_advancement.mode` is missing, ask exactly one question and stop before implementation: "Should followthrough use `ship_then_continue` or `stack_then_continue` for the remaining slices?"
7. Proceed autonomously only after the ledger exists, mode is known, and recovery identifies exactly one valid next slice with satisfied prerequisites.

Do not start the next slice merely because the user said "continue" when mode is absent or prior slice state is ambiguous.

## Required Ledger Shape

```yaml
plan_followthrough_ledger:
  status: active | complete | blocked | needs_replan
  ledger_ref: docs/plans/example.followthrough.md
  plan:
    artifact_ref: docs/plans/example.md
  slice_advancement:
    mode: ship_then_continue | stack_then_continue
    source: user_statement | existing_ledger
  current_slice:
    id: slice-01
    title: <slice title>
  slices:
    - id: slice-01
      title: <slice title>
      status: pending | active | delivered | shipped | stacked_pending_merge | reconciled | skipped
  carry_forward:
    refactoring_reuse: []
    significant_refactor_suggestions: []
    review_findings: []
    verification_gaps: []
    changed_assumptions: []
  next_action: run_plan_to_pr | reconcile_slice | run_merge_followthrough | continue_stack | return_to_plan_ready | stop
  blockers: []
  warnings: []
```

## Slice Handoff To Plan To PR

`plan-to-pr` still receives a valid `plan_ready_handoff`; followthrough context is extra.
`reviewed_slices` records the upfront-reviewed slice plan; `approved_slice`
remains the one slice prepared for the next `plan-to-pr` run.

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
    approved_slice: <one slice only>
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
    slice_advancement_mode: ship_then_continue | stack_then_continue
    slice_id: slice-01
    slice_name: <slice title>
    prior_slices: []
    carry_forward:
      refactoring_reuse: []
      significant_refactor_suggestions: []
      review_findings: []
      verification_gaps: []
      changed_assumptions: []
    stop_conditions: []
```

## Delivery From Plan To PR

When invoked from `plan-followthrough`, `plan-to-pr` must include:

```yaml
plan_followthrough_delivery:
  slice_id: slice-01
  slice_name: <slice title>
  status: delivered | shipped | stacked_pending_merge | blocked | needs_replan
  artifact:
    pr_or_mr:
    commit:
    branch:
  delivery_ledger_ref:
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
  significant_refactor_suggestions:
    - title: <short suggested refactoring slice or none>
      discovered_during: implementation | local_review | hosted_review | ci_fix
      why_not_in_scope: <why this changes slice scope, sequencing, boundary, contract, or acceptance criteria>
      suggested_planning_action: add_refactor_slice | revisit_sequence | reject_later
      affected_slices: []
  changed_assumptions: []
  recommended_next_action:
```

## Blocking Rules

Block only when continuing would corrupt continuity:

- no valid `plan_ready_handoff`;
- no ledger can be created or loaded;
- no `slice_advancement.mode`;
- no next slice can be identified;
- previous slice has no valid `plan_followthrough_delivery`;
- previous slice is blocked and unresolved;
- next slice depends on an earlier slice that did not complete or become a valid stack base;
- directly relevant carry-forward refactoring/reuse context is missing from the next handoff;
- remaining plan needs `plan-ready` again.

Warnings do not block: rough slice names, optional historical gaps, plausible
future reuse with no active consumer, significant refactor suggestions that do
not invalidate the approved slice, or verification improvements when current
gates passed.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Going straight from `plan-ready` to `plan-to-pr` | Start or update the followthrough ledger first |
| Treating single-slice plans as exempt | Use followthrough for single-slice plans too |
| Continuing without advancement mode | Ask whether to use `ship_then_continue` or `stack_then_continue` |
| Reconstructing only a response ledger after compaction | Write or update `<plan>.followthrough.md` |
| Implementing directly | Emit a slice handoff and run `plan-to-pr` |
| Parsing prose from `plan-to-pr` | Require `plan_followthrough_delivery` |
| Using captain terminology | Use followthrough, continuity, slice handoff, and reconciliation |
| Treating "continue the campaign" as permission to skip recovery | Recover live state, write the ledger, then select the next slice |
| Inferring advancement mode from momentum | Ask for `ship_then_continue` or `stack_then_continue` |
| Dropping significant refactor suggestions between slices | Append them to `carry_forward.significant_refactor_suggestions` and surface them at the end |
| Stopping a multi-slice run only because a significant refactor was suggested | Continue unless the current delivery is `blocked` or `needs_replan` with evidence |

## Test Evidence

- RED: subagent `019ec436-aba2-77e2-9764-aad7765f8108` would continue to slice 2 after writing a ledger, but would not ask for the required advancement mode.
- RED: subagent `019ec436-c027-7381-bee0-8e3aef663b46` would route a single-slice `plan_ready_handoff` directly to `plan-to-pr` with no followthrough ledger.
- RED: subagent `019ec436-cdd5-7a72-bb92-4df1da35d1cb` would reconstruct only a temporary response ledger after compaction when no ledger file existed.
- RED: thread `019ec3c6-27cd-7962-9c30-313332a857d0` showed why significant refactor ideas need durable followthrough carry-forward instead of being worked into the active slice.
- GREEN: subagent `019ec43c-5192-7741-bbc7-15932daaac8d` used `plan-followthrough`, created `<plan>.followthrough.md`, reconciled Slice 1, and stopped to ask for missing advancement mode before Slice 2.
- GREEN: subagent `019ec43c-640f-7cb2-aa40-a6bcda0d80dd` routed direct `plan-to-pr` pressure back through followthrough, created the durable ledger, and asked for `ship_then_continue` or `stack_then_continue`.
- GREEN/REFACTOR: followthrough ledgers now aggregate `significant_refactor_suggestions` across slice deliveries and surface them for a later planning review without blocking the current delivery sequence.
