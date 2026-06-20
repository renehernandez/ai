---
name: plan-orchestrator
description: Use when coordinating atomic plan delivery, OpenSpec task delivery, or multi-commit/PR/MR plan sequences from an approved plan_delivery_handoff or OpenSpec change.
---

# Plan Orchestrator

## Overview

Coordinate approved delivery through one or more delivery units. This skill
does not keep a ledger. For multi-step work, OpenSpec `tasks.md` is the durable
state.

## When To Use

Use after `plan-ready` emits a valid atomic `plan_delivery_handoff`, or when
the user asks to continue, sequence, finish, or ship an OpenSpec change. Do not
use for fuzzy ideas, unreviewed plans, or plan authoring.

## Routes

### Atomic Plan

Validate `plan_delivery_handoff`, pass the single approved unit to
`plan-to-pr`, report the result, and stop.

### OpenSpec Change

Normalize the delivery goal before selecting work:

| Goal | Trigger | Completion target |
| --- | --- | --- |
| `next_task` | User asks to continue, do the next task, or gives no broader completion target | One unchecked deliverable task |
| `complete_change` | User asks to finish, ship, complete, or push the whole OpenSpec change | All deliverable tasks checked on target branch |
| `bounded_sequence` | User asks for the next N tasks or to continue until blocked | Requested bound or first blocking condition |

1. Validate the OpenSpec change:

   ```bash
   openspec validate <change-id> --strict --no-interactive
   ```

2. Resolve the repo policy target branch and publishing remote.
3. Refresh the target branch.
4. Record the target commit used for task selection.
5. Read `openspec/changes/<change-id>/tasks.md` from the refreshed target state.
6. Run `openspec-tasks` if task deliverability is uncertain.
7. Select the first unchecked deliverable task in document order.
8. Pass that task to `plan-to-pr`.
9. Require `plan-to-pr` to mark the selected task checkbox complete in the
   same commit, PR, or MR as the implementation.
10. After merge or direct publish, refresh the target branch and reread
    `tasks.md` before selecting more work.

For `next_task`, stop after one successful delivery unit. For
`complete_change` and `bounded_sequence`, repeat the selection and
`plan-to-pr` handoff loop until the completion target is reached or a blocking
condition is found.

Plan Orchestrator advances only from target-branch state. A checked task on an
open PR/MR branch is not complete until merged or directly published according
to repo policy.

## Multi-Unit Delivery

Plan Orchestrator may coordinate multiple commits, PRs, or MRs when the user
asks for a full OpenSpec change or bounded sequence. Each selected unit still
uses `plan-to-pr`; the orchestrator owns sequencing, target-branch refreshes,
and final state reporting.

Before starting a multi-unit sequence, report the normalized delivery goal and
the current `tasks.md` state: checked tasks, unchecked deliverable tasks, and
manual or external tasks. After each unit lands, refresh from the target branch
and select from the refreshed `tasks.md`.

For `complete_change`, do not report success until a final target-branch scan
shows no unchecked deliverable tasks. If only manual or external tasks remain,
stop with `manual_task_pending` and include the evidence.

## Failure Routing

| Status | Meaning | Next step |
| --- | --- | --- |
| `needs_plan_ready` | Input is stale, fuzzy, or legacy-shaped | Rerun `plan-ready` |
| `needs_openspec` | Work is multi-deliverable but not in OpenSpec | Create or update OpenSpec |
| `openspec_invalid` | OpenSpec validation fails | Repair OpenSpec |
| `needs_openspec_tasks` | `tasks.md` is not deliverable | Run `openspec-tasks` |
| `ambiguous_delivery_goal` | User intent conflicts with available task state | Ask for the completion target |
| `scope_mismatch` | User asks for full delivery but tasks are too broad or not deliverable | Run `openspec-tasks` |
| `selected_task_stale` | Target task state changed | Rerun `plan-orchestrator` |
| `delivery_blocked` | A selected unit failed delivery gates | Pause with the failed unit and evidence |
| `manual_task_pending` | Only manual or external unchecked tasks remain | Pause with required human action |
| `openspec_complete` | No unchecked deliverable tasks remain | Report final delivery state |
| `needs_human_action` | Manual or external task blocks progress | Pause with evidence |

## Scripts

- `scripts/plan-orchestrator.ts detect`
- `scripts/plan-orchestrator.ts handoff-template`
- `scripts/plan-orchestrator.ts validate-handoff --file <path>`
- `scripts/plan-orchestrator.ts select-next-task <tasks.md>`

Legacy `plan_ready_handoff`, `plan_followthrough_slice_handoff`,
`plan_coordinate_handoff`, `reviewed_slices`, `slice_plan_review`, and
followthrough-ledger inputs are unsupported. Return `needs_plan_ready`.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Creating a followthrough ledger | Read OpenSpec `tasks.md` from target branch |
| Treating a full-change request as one task | Set `delivery_goal: complete_change` and loop until no unchecked deliverable tasks remain |
| Saying done without rereading `tasks.md` | Base completion only on target-branch state after final merge or direct publish |
| Batching tasks inside `plan-to-pr` | Keep `plan-to-pr` to one unit; sequence units here |
| Selecting from a detached or stale checkout | Refresh target branch and record the target commit |
| Advancing from an open PR branch checkbox | Wait for merge or direct publish |
| Implementing directly | Pass each approved unit to `plan-to-pr` |

## Test Evidence

- RED: previous followthrough workflow maintained a separate ledger.
- GREEN: delivery selection now depends on target-branch OpenSpec task state.
