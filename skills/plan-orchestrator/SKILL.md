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
`plan-unit-delivery`, report the result, and stop.

`plan-unit-delivery` owns the implementation reviewer gate for each unit,
including launching internal subagents. Plan Orchestrator only sequences units
and reports their delivery state.

### OpenSpec Change

Normalize the delivery goal before selecting work:

| Goal | Trigger | Completion target |
| --- | --- | --- |
| `next_task` | User asks to continue, do the next task, or gives no broader completion target | One unchecked deliverable task |
| `complete_change` | User asks to finish, ship, complete, or push the whole OpenSpec change | All deliverable tasks checked on target branch |
| `bounded_sequence` | User asks for the next N tasks or to continue until blocked | Requested bound or first blocking condition |

Normalize the landing mode for PR/MR sequences:

| Mode | Trigger | Selection base |
| --- | --- | --- |
| `ship_then_continue` | User wants each unit landed before continuing, or route is direct publish | Target branch |
| `stack_when_ready` | User wants the next unit stacked after the current PR/MR is ready for merge | Target branch for the first unit, then stack tip branch |

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
8. Pass that task to `plan-unit-delivery`.
9. Require `plan-unit-delivery` to mark exactly one additional selected task
   checkbox complete in the same commit, PR, or MR as the implementation.
10. Advance according to `landing_mode`.

For `next_task`, stop after one successful delivery unit. For
`complete_change` and `bounded_sequence`, repeat the selection and
`plan-unit-delivery` handoff loop until the completion target is reached or a blocking
condition is found.

In `ship_then_continue`, Plan Orchestrator advances only from target-branch
state after merge or direct publish. In `stack_when_ready`, it advances from
the current stack tip branch after the current PR/MR is ready for merge.

## Multi-Unit Delivery

Plan Orchestrator may coordinate multiple commits, PRs, or MRs when the user
asks for a full OpenSpec change or bounded sequence. Each selected unit still
uses `plan-unit-delivery`; the orchestrator owns sequencing, target-branch refreshes,
and final state reporting.

Before starting a multi-unit sequence, report the normalized delivery goal,
landing mode, selection base, and current `tasks.md` state: checked tasks,
unchecked deliverable tasks, and manual or external tasks.

In `ship_then_continue`, refresh from the target branch after each unit lands
and select from the refreshed `tasks.md`.

In `stack_when_ready`, wait until the current PR/MR is ready for merge before
stacking the next unit. The stack tip `tasks.md` is cumulative: a stack tip for
tasks `1.1`, `1.2`, and `1.3` has all three tasks checked. The target branch
remains the source of truth for landed work; the stack tip branch is the source
of truth for unmerged stacked work.

For `complete_change`, do not report target-branch success until a final
target-branch scan shows no unchecked deliverable tasks. For `stack_when_ready`,
report ready stacked artifacts and the final stack tip task state, and do not
imply target-branch completion until the stack lands. If only manual or
external tasks remain, stop with `manual_task_pending` and include the evidence.

## Stack Gates

Before selecting another task in `stack_when_ready`, verify:

- current PR/MR is open and usable as the next branch base;
- local verification, hosted pipeline, reviewer outcomes, and automatic review
  feedback gates have passed or have explicit acceptable unavailability
  evidence;
- no unresolved blocking comments remain;
- stack tip `tasks.md` is valid and cumulative;
- no future task is checked early.

Every new stacked unit must add exactly one checked deliverable task relative to
its base branch.

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
| `stack_mode_not_supported` | Repo route is direct publish or cannot represent stacked PRs/MRs | Use `ship_then_continue` |
| `stack_base_not_ready` | Current PR/MR is not ready enough to stack on | Continue inside the current unit |
| `stack_base_changed` | Stack base changed after task selection | Refresh and reselect |
| `stack_relationship_missing` | Cannot prove the next artifact is based on the current stack tip | Repair stack relationship |
| `stack_task_state_invalid` | Stack tip task state is non-cumulative or checks future tasks | Repair the stack branch |
| `stack_incomplete` | Stack artifacts are ready but not landed on target | Report ready stack state |
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
| Batching tasks inside `plan-unit-delivery` | Keep `plan-unit-delivery` to one unit; sequence units here |
| Selecting from a detached or stale checkout | Refresh target branch and record the target commit |
| Advancing from an open PR branch checkbox in `ship_then_continue` | Wait for merge or direct publish |
| Treating stacked work as landed | Report stack-ready state until the stack lands on target |
| Implementing directly | Pass each approved unit to `plan-unit-delivery` |

## Test Evidence

- RED: previous followthrough workflow maintained a separate ledger.
- GREEN: delivery selection now depends on target-branch OpenSpec task state.
