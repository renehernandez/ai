---
name: plan-coordinate
description: Use as the single coordinator entry point for atomic plan delivery or the next OpenSpec task delivery.
---

# Plan Coordinate

## Overview

Coordinate one approved delivery unit. This skill does not keep a ledger. For
multi-step work, OpenSpec `tasks.md` is the durable state.

## When To Use

Use after `plan-ready` emits a valid atomic `plan_coordinate_handoff`, or when
the user asks to continue an OpenSpec change. Do not use for fuzzy ideas,
unreviewed plans, or plan authoring.

## Routes

### Atomic Plan

Validate `plan_coordinate_handoff`, pass the single approved unit to
`plan-to-pr`, report the result, and stop.

### OpenSpec Change

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

The coordinator advances only from target-branch state. A checked task on an
open PR/MR branch is not complete until merged or directly published according
to repo policy.

## Failure Routing

| Status | Meaning | Next step |
| --- | --- | --- |
| `needs_plan_ready` | Input is stale, fuzzy, or legacy-shaped | Rerun `plan-ready` |
| `needs_openspec` | Work is multi-deliverable but not in OpenSpec | Create or update OpenSpec |
| `openspec_invalid` | OpenSpec validation fails | Repair OpenSpec |
| `needs_openspec_tasks` | `tasks.md` is not deliverable | Run `openspec-tasks` |
| `selected_task_stale` | Target task state changed | Rerun `plan-coordinate` |
| `needs_human_action` | Manual or external task blocks progress | Pause with evidence |

## Scripts

- `scripts/plan-coordinate.ts detect`
- `scripts/plan-coordinate.ts handoff-template`
- `scripts/plan-coordinate.ts validate-handoff --file <path>`
- `scripts/plan-coordinate.ts select-next-task <tasks.md>`

Legacy `plan_ready_handoff`, `plan_followthrough_slice_handoff`,
`reviewed_slices`, `slice_plan_review`, and followthrough-ledger inputs are
unsupported. Return `needs_plan_ready`.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Creating a followthrough ledger | Read OpenSpec `tasks.md` from target branch |
| Selecting from a detached or stale checkout | Refresh target branch and record the target commit |
| Advancing from an open PR branch checkbox | Wait for merge or direct publish |
| Implementing directly | Pass one approved unit to `plan-to-pr` |

## Test Evidence

- RED: previous followthrough workflow maintained a separate ledger.
- GREEN: coordinator selection now depends on target-branch OpenSpec task state.
