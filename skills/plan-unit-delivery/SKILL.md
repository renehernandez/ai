---
name: plan-unit-delivery
description: Use when one validated plan_delivery_handoff approved unit should be implemented through local verification, review gates, Nitro feedback, CI, and stacked PR/MR delivery.
---

# Plan Unit Delivery

## Overview

Implement exactly one approved unit. The unit is either an atomic plan or one
OpenSpec checkbox task selected by `plan-unit-sequencer`.

This skill does not brainstorm, author plans, manage OpenSpec sequences, or keep
a followthrough ledger.

## When To Use

Use when the user provides a valid `plan_delivery_handoff`, or when
`plan-unit-sequencer` passes one approved atomic unit or OpenSpec task.

Do not use for fuzzy ideas, unreviewed plans, OpenSpec proposal creation, Linear
tickets that still need planning, or legacy handoff shapes.

## Handoff Rules

Run `scripts/plan-unit-delivery.ts validate-handoff --file <handoff>` before editing.

Legacy `plan_ready_handoff`, `plan_followthrough_slice_handoff`,
`reviewed_slices`, `slice_plan_review`, and followthrough-ledger inputs are
unsupported. Return `needs_plan_ready`.

For OpenSpec tasks, the implementation PR/MR must change the selected checkbox
from `[ ]` to `[x]` in the same branch that implements the task. Do not create
a follow-up bookkeeping commit for task completion.

Each OpenSpec task must be delivered in its own PR/MR. A task may require
multiple commits inside that PR/MR. Do not combine multiple OpenSpec tasks in
one PR/MR.

Before finishing an OpenSpec task unit, validate the task delta:

```bash
scripts/plan-unit-delivery.ts validate-task-delta --base <base-tasks.md> --head <unit-tasks.md> --task <task-id>
```

The delta is valid only when exactly one expected deliverable task changes from
unchecked to checked relative to the base branch.

Record the task-delta command and output in the final `delivery_gate_ledger`.
The same ledger must also record the selected task ID, selected task base SHA,
predecessor artifact, implementation artifact URL/ref, implementation head SHA,
CI evidence, Nitro evidence, and whether restacking was required.

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
   `tasks.md` in the same commit as the implementation for that task.
5. Confirm the approved task is delivered as one separate PR/MR. If the diff
   includes another task's implementation or checkbox update, split it into a
   separate PR/MR before continuing. Multiple commits inside the selected
   task's PR/MR are allowed.
6. Run local verification named in the handoff, plus the narrowest useful tests
   for touched code.
7. For OpenSpec tasks, validate the one-checkbox delta against the unit base.
8. Launch implementation reviewers through internal subagents.
9. Reconcile reviewer outcomes.
10. Validate `reviewer_launch` and `reviewer_report`; the report must include
    the staged diff hash reviewed by the implementation reviewers.
11. Before any material implementation commit, activate the local review gate
    for the staged diff:

    ```bash
    scripts/plan-unit-delivery.ts activate-review-gate --file <delivery-evidence> --source-ref <handoff-or-report-ref>
    ```

    If activation is blocked, gate writing fails, validation fails, reviewer
    evidence is missing or stale, or blocking findings remain, do not run
    `ax commit`; resolve the blocker and rerun reviewers or activation.
12. Run review-feedback routing.
13. Open or update one routed implementation PR/MR stacked on the expected
    stack tip from the handoff.
14. Prove the implementation artifact is separate from the planning-review
    PR/MR. If the same hosted artifact would be reused, block and split the
    implementation to a separate PR/MR.
15. Run artifact-host review.
16. Monitor artifact-host pipelines for the latest head until they pass, fail,
    block, or are unavailable with evidence. Include child or downstream
    pipeline state when the host exposes it.
17. Request Nitro feedback after MR creation and after every material
    head-changing push, including feedback fixes, restacks, conflict fixes,
    pipeline fixes, user edits, rebases, and plan or documentation feedback
    fixes.
18. Wait for the shared latest-head `nitro_feedback_gate` to pass. A requested,
    pending, stale, unavailable, or findings gate is blocking.
19. Finish only when the unit implementation MR is stack-ready with a passed
    Nitro gate, or blocked with evidence.

Block with `implementation_scope_escape` when the selected unit requires
unrelated task edits, new OpenSpec tasks, or broadening the approved scope.

## Delivery Gate Ledger

`nitro_feedback_gate` and `delivery_gate_ledger` remain session-only evidence
for this delivery loop. They are not durable sequence state and must not
replace OpenSpec `tasks.md`.

When writing `delivery_gate_ledger`, `reviewer_launch`,
`reviewer_report`, `refactoring_execution`, or the final delivery
state back to the thread, include a concise `## Readable Summary` first. Keep
it to 3-6 bullets with approved unit, artifact, verification result, reviewer
state, pipeline or feedback state, and finish state. Do not replace the YAML;
the YAML remains the auditable delivery contract.

Use:

```bash
scripts/plan-unit-delivery.ts gate-template
scripts/plan-unit-delivery.ts validate-ledger --file <ledger>
```

The final ledger must include a passed `nitro_feedback_gate`. `validate-ledger`
rejects missing, pending, stale, unavailable, findings, or unresolved Nitro
feedback gates. It also rejects ledgers that omit one-unit delivery evidence:
selected task identity, selected task base SHA, predecessor artifact,
implementation artifact, implementation head SHA, `validate-task-delta` command,
validator output containing `unit_task_delta_valid`, pipeline evidence, Nitro
evidence, and restack state.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Implementing without `plan_delivery_handoff` | Return `needs_plan_ready` |
| Accepting legacy slice/followthrough handoffs | Return `needs_plan_ready` |
| Combining multiple OpenSpec tasks in one PR/MR | Split into one PR/MR per task |
| Checking OpenSpec tasks in a follow-up commit | Check the task in the implementation PR/MR |
| Reusing the planning-review PR/MR for implementation | Create a separate implementation artifact and record separation evidence |
| Implementing multiple OpenSpec tasks at once | Return to OpenSpec or `plan-unit-sequencer` |
| Finishing without proving the task delta | Run `validate-task-delta` against base and unit `tasks.md` |
| Recording task-delta proof only in chat prose | Put the command and `unit_task_delta_valid` output in `delivery_gate_ledger.unit_task_delta` |
| Committing before activating the local review gate | Run `activate-review-gate` for the staged diff before `ax commit` |
| Reusing reviewer reports after staging new changes | Rerun reviewers and update `reviewer_report.reviewed_diff_hash` |
| Treating delivery gate evidence as durable state | Keep sequence state in OpenSpec |
| Treating an open PR/MR as done before pipelines settle | Keep monitoring latest-head pipelines |
| Assuming Nitro feedback is absent immediately after push | Request Nitro for the latest head, wait up to 10 minutes for review start, then wait for completion |
| Moving on after restacking descendants | Rerun the full Nitro gate for every changed descendant head |
| Returning gate YAML without a readable thread summary | Add `## Readable Summary` before the YAML |

## Test Evidence

- RED: previous workflow accepted direct `plan_ready_handoff` and
  `plan_followthrough_slice_handoff`.
- GREEN: the validator now accepts only `plan_delivery_handoff` and rejects
  legacy shapes.
