---
name: plan-unit-delivery
description: Use when one validated plan_delivery_handoff approved unit should be implemented through local verification, review gates, automatic feedback, CI, and PR, MR, or direct-publish delivery.
---

# Plan Unit Delivery

## Overview

Implement exactly one approved unit. The unit is either an atomic plan or one
OpenSpec checkbox task selected by `plan-orchestrator`.

This skill does not brainstorm, author plans, manage OpenSpec sequences, or keep
a followthrough ledger.

## When To Use

Use when the user provides a valid `plan_delivery_handoff`, or when
`plan-orchestrator` passes one approved atomic unit or OpenSpec task.

Do not use for fuzzy ideas, unreviewed plans, OpenSpec proposal creation, Linear
tickets that still need planning, or legacy handoff shapes.

## Handoff Rules

Run `scripts/plan-unit-delivery.ts validate-handoff --file <handoff>` before editing.

Legacy `plan_ready_handoff`, `plan_followthrough_slice_handoff`,
`reviewed_slices`, `slice_plan_review`, and followthrough-ledger inputs are
unsupported. Return `needs_plan_ready`.

For OpenSpec tasks, the implementation PR/MR or direct-publish commit must
change the selected checkbox from `[ ]` to `[x]` in the same branch that
implements the task. Do not create a follow-up bookkeeping commit for task
completion.

Before finishing an OpenSpec task unit, validate the task delta:

```bash
scripts/plan-unit-delivery.ts validate-task-delta --base <base-tasks.md> --head <unit-tasks.md> --task <task-id>
```

The delta is valid only when exactly one expected deliverable task changes from
unchecked to checked relative to the base branch.

Reviewer execution is a required delivery gate. A valid handoff authorizes
launching implementation reviewers as internal subagents in the current
harness; do not ask for separate confirmation. If internal subagents are
unavailable, block with evidence instead of substituting a different review
path.

## Workflow

1. Validate the `plan_delivery_handoff`.
2. Inspect live repo, branch, remotes, and artifact-host routing.
3. Implement only `approved_unit`.
4. If the approved unit is an OpenSpec task, check off only that task in
   `tasks.md`.
5. Run local verification named in the handoff, plus the narrowest useful tests
   for touched code.
6. For OpenSpec tasks, validate the one-checkbox delta against the unit base.
7. Launch implementation reviewers through internal subagents.
8. Reconcile reviewer outcomes.
9. Run review-feedback routing.
10. Open or update the routed PR/MR, or direct publish only when repo policy
   explicitly allows it.
11. Run artifact-host review.
12. Monitor artifact-host pipelines for the latest head until they pass, fail,
    block, or are unavailable with evidence. Include child or downstream
    pipeline state when the host exposes it.
13. Wait for routed automatic review feedback on the latest head until feedback
    is resolved, no automatic feedback is present after the chosen timeout, or
    the review system is unavailable with evidence. The timeout window must be
    explicit in the delivery gate evidence.
14. Finish only when landed, direct-published, stack-ready, or blocked with
    evidence.

Block with `implementation_scope_escape` when the selected unit requires
unrelated task edits, new OpenSpec tasks, or broadening the approved scope.

## Delivery Gate Ledger

`delivery_gate_ledger` remains a session-only evidence ledger for this delivery
loop. It is not durable sequence state and must not replace OpenSpec `tasks.md`.

When writing `delivery_gate_ledger`, `reviewer_subagent_launch`,
`reviewer_subagent_report`, `refactoring_execution`, or the final delivery
state back to the thread, include a concise `## Readable Summary` first. Keep
it to 3-6 bullets with approved unit, artifact, verification result, reviewer
state, pipeline or feedback state, and finish state. Do not replace the YAML;
the YAML remains the auditable delivery contract.

Use:

```bash
scripts/plan-unit-delivery.ts gate-template
scripts/plan-unit-delivery.ts validate-ledger --file <ledger>
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Implementing without `plan_delivery_handoff` | Return `needs_plan_ready` |
| Accepting legacy slice/followthrough handoffs | Return `needs_plan_ready` |
| Checking OpenSpec tasks in a follow-up commit | Check the task in the implementation PR/MR or direct-publish commit |
| Implementing multiple OpenSpec tasks at once | Return to OpenSpec or `plan-orchestrator` |
| Finishing without proving the task delta | Run `validate-task-delta` against base and unit `tasks.md` |
| Treating delivery gate evidence as durable state | Keep sequence state in OpenSpec |
| Treating an open PR/MR as done before pipelines settle | Keep monitoring latest-head pipelines |
| Assuming automatic review feedback is absent immediately after push | Wait until feedback resolves or the timeout proves nothing posted |
| Returning gate YAML without a readable thread summary | Add `## Readable Summary` before the YAML |

## Test Evidence

- RED: previous workflow accepted direct `plan_ready_handoff` and
  `plan_followthrough_slice_handoff`.
- GREEN: the validator now accepts only `plan_delivery_handoff` and rejects
  legacy shapes.
