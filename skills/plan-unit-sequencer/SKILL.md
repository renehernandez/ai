---
name: plan-unit-sequencer
description: Use when coordinating atomic plan delivery, OpenSpec task delivery, or multi-commit/PR/MR plan sequences from reviewed planning evidence.
---

# Plan Unit Sequencer

## Overview

Coordinate approved stacked delivery through one or more delivery units. This
skill does not keep a ledger. For multi-step work, OpenSpec `tasks.md` at the
current stack tip is the durable state for unmerged work.

## When To Use

Use after `plan-review` emits a valid `planning_review`, or when the user asks
to continue, sequence, finish, or ship an already reviewed OpenSpec change. Do
not use for fuzzy ideas, unreviewed plans, or plan authoring.

Before selecting any implementation unit, validate `planning_review` with
`scripts/plan-unit-sequencer.ts validate-planning-review`. If it is missing or
invalid, return `needs_reviewed_planning` and do not call
`plan-unit-delivery`.

## Routes

### Atomic Plan

Validate `planning_review`, derive one `plan_delivery_handoff` stacked on the
reviewed planning artifact, pass the single approved unit to
`plan-unit-delivery`, report the result, and stop after the implementation MR
passes its latest-head Nitro gate.

`plan-unit-delivery` owns the implementation reviewer gate for each unit,
including launching internal subagents. Plan Unit Sequencer only sequences units
and reports their delivery state.

### OpenSpec Change

Normalize the delivery goal before selecting work:

| Goal | Trigger | Completion target |
| --- | --- | --- |
| `next_task` | User asks to continue, do the next task, or gives no broader completion target | One unchecked deliverable task |
| `complete_change` | User asks to finish, ship, complete, or push the whole OpenSpec change | All deliverable tasks checked on target branch |
| `bounded_sequence` | User asks for the next N tasks or to continue until blocked | Requested bound or first blocking condition |

Direct sequencer invocation may use `next_task`. When the caller is
`plan_orchestrator`, the effective goal is always `complete_change`; the
orchestrator cannot use a one-task selection as terminal success for an
OpenSpec change.

1. Validate the OpenSpec change:

   ```bash
   openspec validate <change-id> --strict --no-interactive
   ```

2. Resolve the repo policy target branch and publishing remote.
3. Inspect the reviewed planning stack base and current stack tip.
4. Record the stack-tip commit used for task selection.
5. Read `openspec/changes/<change-id>/tasks.md` from stack-tip state.
6. Run `openspec-tasks` if task deliverability is uncertain. A lifecycle-only
   documentation, testing, linting, review, validation, or verification group
   anywhere in `tasks.md` is not a deliverable implementation unit, unless that
   area is the feature being changed. Deliverable-scoped proof subchecks are
   valid only as sub-bullets inside the related deliverable task, not as
   OpenSpec task checkboxes or independent delivery units. Block with
   `needs_spec_redesign` instead of selecting a lifecycle phase.
7. Select the first unchecked deliverable task in document order with
   `select-next-task --caller plan_orchestrator --goal complete_change` for
   orchestrator-driven runs.
8. Pass that task to `plan-unit-delivery`.
9. Require `plan-unit-delivery` to mark exactly one additional selected task
   checkbox complete in one separate implementation PR/MR for that task.
10. Advance only after the current implementation MR passes its latest-head
    Nitro gate.

For `next_task`, stop after one successful delivery unit. For
`complete_change` and `bounded_sequence`, repeat the selection and
`plan-unit-delivery` handoff loop until the completion target is reached or a blocking
condition is found.

Plan Unit Sequencer advances from the current stack tip branch after the
current implementation MR passes latest-head Nitro feedback closure.

## Multi-Unit Delivery

Plan Unit Sequencer may coordinate multiple commits, PRs, or MRs when the user
asks for a full OpenSpec change or bounded sequence. Each selected unit still
uses `plan-unit-delivery`; the orchestrator owns sequencing, target-branch refreshes,
and final state reporting.

Before starting a multi-unit sequence, report the normalized delivery goal,
stacked delivery mode, selection base, and current `tasks.md` state: checked tasks,
unchecked deliverable tasks, and manual or external tasks.

When reporting selected work, handoffs, blocked states, stack-ready states, or
completion, include a concise `## Readable Summary` before any YAML or JSON
contract. Keep it to 3-6 bullets with delivery goal, landing mode, selection
base, selected task or completion state, artifact, and blocker or next action.
Do not replace machine-readable handoffs or validation output.

Wait until the current PR/MR passes the latest-head Nitro gate before stacking
the next unit. The stack tip `tasks.md` is cumulative: a stack tip for tasks
`1.1`, `1.2`, and `1.3` has all three tasks checked. The target branch remains
the source of truth for landed work; the stack tip branch is the source of
truth for unmerged stacked work.

For `complete_change`, report `stack_ready` only after the final stack tip has
no unchecked deliverable tasks, every stack artifact has a passed latest-head
Nitro gate, and stack integrity evidence is present. Do not imply target-branch
completion until the stack lands. If only manual or external tasks remain, stop
with `manual_task_pending` and include the evidence.

## Stack Gates

Before selecting another task, verify:

- current PR/MR is open and usable as the next branch base;
- local verification, hosted pipeline, reviewer outcomes, and latest-head Nitro
  feedback gates have passed;
- no unresolved blocking comments remain;
- stack tip `tasks.md` is valid and cumulative;
- no future task is checked early.

Every new stacked unit must add exactly one checked deliverable task relative to
its base branch, and each selected task must remain its own PR/MR in the stack.

## Failure Routing

| Status | Meaning | Next step |
| --- | --- | --- |
| `needs_plan_ready` | Input is stale, fuzzy, or legacy-shaped | Rerun `plan-ready` |
| `needs_openspec` | Work is multi-deliverable but not in OpenSpec | Create or update OpenSpec |
| `openspec_invalid` | OpenSpec validation fails | Repair OpenSpec |
| `needs_openspec_tasks` | `tasks.md` is not deliverable | Run `openspec-tasks` |
| `needs_spec_redesign` | OpenSpec tasks are lifecycle phases instead of deliverables | Ask the user whether to redo, brainstorm, narrow, or choose another route |
| `ambiguous_delivery_goal` | User intent conflicts with available task state | Ask for the completion target |
| `scope_mismatch` | User asks for full delivery but tasks are too broad or not deliverable | Run `openspec-tasks` |
| `selected_task_stale` | Target task state changed | Rerun `plan-unit-sequencer` |
| `delivery_blocked` | A selected unit failed delivery gates | Pause with the failed unit and evidence |
| `stack_mode_not_supported` | Repo route cannot represent stacked PRs/MRs | Stop with route evidence |
| `stack_base_not_ready` | Current PR/MR is not ready enough to stack on | Continue inside the current unit |
| `stack_base_changed` | Stack base changed after task selection | Refresh and reselect |
| `stack_relationship_missing` | Cannot prove the next artifact is based on the current stack tip | Repair stack relationship |
| `stack_task_state_invalid` | Stack tip task state is non-cumulative or checks future tasks | Repair the stack branch |
| `stack_incomplete` | Stack artifacts are not all latest-head Nitro clean | Continue current blocked artifact |
| `manual_task_pending` | Only manual or external unchecked tasks remain | Pause with required human action |
| `openspec_complete` | No unchecked deliverable tasks remain | Report final delivery state |
| `needs_human_action` | Manual or external task blocks progress | Pause with evidence |

## Scripts

- `scripts/plan-unit-sequencer.ts detect`
- `scripts/plan-unit-sequencer.ts planning-review-template`
- `scripts/plan-unit-sequencer.ts validate-planning-review --file <path>`
- `scripts/plan-unit-sequencer.ts handoff-template`
- `scripts/plan-unit-sequencer.ts validate-handoff --file <path>`
- `scripts/plan-unit-sequencer.ts select-next-task <tasks.md> [--caller direct|plan_orchestrator] [--goal next_task|complete_change|bounded_sequence]`

Legacy `plan_ready_handoff`, `plan_followthrough_slice_handoff`,
`plan_coordinate_handoff`, `reviewed_slices`, `slice_plan_review`, and
followthrough-ledger inputs are unsupported. Return `needs_plan_ready`.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Sequencing from an unreviewed plan or OpenSpec change | Stop with `needs_reviewed_planning` |
| Creating a followthrough ledger | Read OpenSpec `tasks.md` from target branch |
| Treating a full-change request as one task | Set `delivery_goal: complete_change` and loop until no unchecked deliverable tasks remain |
| Letting plan-orchestrator use `next_task` as terminal success | Invoke selection with `--caller plan_orchestrator`, which normalizes to `complete_change` |
| Saying done without rereading `tasks.md` | Base completion only on stack-tip state before `stack_ready` |
| Batching tasks inside `plan-unit-delivery` | Keep `plan-unit-delivery` to one unit; sequence units here |
| Combining multiple OpenSpec tasks in one PR/MR | Split delivery so each task has its own PR/MR |
| Selecting a testing, documentation, or validation phase as a unit | Block with `needs_spec_redesign` unless that area is the feature being changed |
| Selecting from a detached or stale checkout | Refresh target branch and record the target commit |
| Advancing after a requested but incomplete Nitro review | Wait for latest-head Nitro completion |
| Treating stacked work as landed | Report stack-ready state until the stack lands on target |
| Implementing directly | Pass each approved unit to `plan-unit-delivery` |
| Reporting YAML or JSON without a readable thread summary | Add `## Readable Summary` first |

## Test Evidence

- RED: previous followthrough workflow maintained a separate ledger.
- GREEN: delivery selection now depends on target-branch OpenSpec task state.
- GREEN: sequencer validation requires reviewed planning before implementation
  unit selection.
