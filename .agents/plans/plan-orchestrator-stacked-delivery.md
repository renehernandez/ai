# Plan Orchestrator Stacked Delivery

## Goal

Teach `plan-orchestrator` to coordinate OpenSpec task delivery in two PR/MR
advancement modes while preserving the invariant that each OpenSpec checkbox
task is delivered as exactly one unit.

## Decisions

- One OpenSpec checkbox task maps to one `plan_delivery_handoff`, one
  `plan-unit-delivery` run, and one delivery artifact.
- `plan-orchestrator` supports two PR/MR continuation modes:
  - `ship_then_continue`: land the current unit, refresh the target branch, and
    select the next task from target-branch `tasks.md`.
  - `stack_when_ready`: make the current PR/MR ready for merge, then start the
    next unit from the current stack tip branch.
- Direct publish uses `ship_then_continue`; stack mode applies only to PR/MR
  delivery.
- In stack mode, OpenSpec task state is cumulative from the viewpoint of the
  stack tip. If a stack delivers tasks `1.1`, `1.2`, and `1.3`, the third
  branch has all three tasks checked.
- The target branch remains the source of truth for landed work. The current
  stack tip branch is the source of truth for work already represented in the
  unmerged stack.

## Scope

In scope:

- Update `plan-orchestrator` documentation and adapter prompt to define
  `landing_mode`, `selection_base`, stack readiness, stack task-state
  validation, and final reporting.
- Update `plan-unit-delivery` documentation and adapter prompt to require a
  one-checkbox delta for OpenSpec task units.
- Add or update script support where it materially reduces ambiguity:
  - summarize task state for a base and candidate branch;
  - validate that exactly one additional deliverable task was checked;
  - represent stack-ready versus landed completion states in delivery evidence.
- Update tests for helper script behavior and old-name/current-name references.
- Refresh installed skill copies after source changes.

Out of scope:

- Reintroducing `plan-followthrough`, `plan-slices`, or any durable
  followthrough ledger.
- Implementing a generic stack manager that replaces GitHub, GitLab, or
  `glab stack` behavior.
- Changing the `plan_delivery_handoff` root key.
- Creating OpenSpec files for this skill update unless later requested.

## Required Behavior

### Plan Orchestrator

`plan-orchestrator` must normalize two independent concepts for OpenSpec work:

- `delivery_goal`: `next_task`, `complete_change`, or `bounded_sequence`.
- `landing_mode`: `ship_then_continue` or `stack_when_ready`.

Selection rules:

- For `ship_then_continue`, select from target-branch `tasks.md`.
- For the first task in `stack_when_ready`, select from target-branch
  `tasks.md`.
- For later tasks in `stack_when_ready`, select from the current stack tip
  branch `tasks.md`.

Stack readiness gate:

- Local verification for the current unit passed.
- Hosted pipeline is passed, blocked, failed, or unavailable with explicit
  evidence, and only passed or acceptable unavailable/blocked states can
  continue.
- Automatic review feedback is resolved or the timeout proves no feedback was
  posted.
- Required reviewer feedback is addressed.
- No unresolved blocking comments remain.
- The PR/MR is open and usable as the next branch base.

Stack task-state gate:

- The stack tip `tasks.md` is valid.
- Checked task state is cumulative.
- The current branch has exactly the expected completed tasks.
- No future task is checked early.
- The next unit must add exactly one checked deliverable task relative to its
  base.

Final reporting:

- `ship_then_continue` reports tasks landed on the target branch.
- `stack_when_ready` reports ready stacked artifacts and the final stack tip
  task state. It must not imply target-branch completion until the stack lands.

### Plan Unit Delivery

`plan-unit-delivery` must continue to implement exactly one approved unit.

For OpenSpec task units, it must validate before finishing that the diff from
its base branch to its unit branch checks exactly one additional deliverable
task in `tasks.md`.

Allowed task-state results:

- `unit_task_delta_valid`: exactly one expected deliverable task changed from
  unchecked to checked.
- `unit_task_delta_missing`: the selected task was not checked.
- `unit_task_delta_multiple`: more than one deliverable task was checked.
- `unit_task_delta_unexpected`: a different task was checked.
- `unit_task_delta_invalid_tasks`: `tasks.md` cannot be parsed or audited.

## Failure Routing

Add the following `plan-orchestrator` statuses:

| Status | Meaning | Next step |
| --- | --- | --- |
| `stack_mode_not_supported` | Repo route is direct publish or cannot represent stacked PRs/MRs | Use `ship_then_continue` |
| `stack_base_not_ready` | Current PR/MR is not ready enough to stack on | Continue inside the current unit |
| `stack_base_changed` | Stack base changed after task selection | Refresh and reselect |
| `stack_relationship_missing` | Cannot prove the next artifact is based on the current stack tip | Repair stack relationship |
| `stack_task_state_invalid` | Stack tip task state is non-cumulative or checks future tasks | Repair the stack branch |
| `stack_incomplete` | Stack artifacts are ready but not landed on target | Report ready stack state |

Add the following `plan-unit-delivery` statuses:

| Status | Meaning | Next step |
| --- | --- | --- |
| `unit_task_delta_missing` | Selected OpenSpec task was not checked | Fix the unit branch |
| `unit_task_delta_multiple` | Multiple deliverable tasks were checked | Split or revert extra task changes |
| `unit_task_delta_unexpected` | A different task was checked | Fix task selection or branch contents |
| `unit_task_delta_invalid_tasks` | `tasks.md` is invalid | Repair OpenSpec tasks |

## Acceptance Criteria

- `plan-orchestrator` clearly documents both landing modes and when each is
  selected.
- `plan-orchestrator` documents `selection_base` for target-branch and
  stack-tip selection.
- `plan-orchestrator` rejects batching multiple OpenSpec tasks into one unit.
- `plan-orchestrator` explains cumulative stack task state and final reporting
  differences between landed and stacked work.
- `plan-unit-delivery` requires exactly one additional OpenSpec deliverable
  checkbox per unit.
- Adapter prompts mention `plan-unit-delivery` and the new stack behavior.
- Tests cover one-checkbox delta validation and old-name regressions.

## Verification

- `pnpm run biome:check:all`
- `pnpm test`
- `pnpm agent-runtime skills update --profile personal`
- `pnpm agent-runtime skills update --profile work`
- `pnpm agent-runtime skills status --profile personal`
- `pnpm agent-runtime skills status --profile work`
- Search repo and installed runtime for retired delivery-skill names.

## Implementation Notes

This should be an atomic skill update if the implementation stays limited to
`plan-orchestrator`, `plan-unit-delivery`, their adapters/scripts/tests, and
nearby references. If script support expands into a larger stack-management
surface, stop and convert the plan into an OpenSpec change.
