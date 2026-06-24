---
name: openspec-tasks
description: Use when OpenSpec tasks.md needs audit before delivery, especially broad tasks, unclear dependency order, manual tasks, stale task state, or unclear delivery fit.
---

# OpenSpec Tasks

## Overview

Audit OpenSpec `tasks.md` as the delivery queue. This skill does not create a
parallel slice plan, maintain a ledger, or implement code.

## When To Use

Use after an OpenSpec change exists and before `plan-unit-sequencer` delivers the
next task. Use for broad OpenSpec tasks, unclear dependency order, manual or
external tasks, stale task lists, or any change where the next checkbox may not
fit one delivery loop.

## Task Rules

Each checkbox task maps to one minor deliverable inside the feature milestone or
project. Sub-bullets can describe files, acceptance notes, or verification, but
they are not separate delivery units.

Task groups represent deliverable implementation areas. Do not use
lifecycle-only groups anywhere in the file that only run documentation, linting,
testing, review, validation, or verification. Those activities belong inside the
related deliverable task unless the task changes docs, tests, validation, CI,
reviewer tooling, runtime validation tooling, or reusable AI workflow machinery
as its feature. Deliverable-scoped proof subchecks are valid only as sub-bullets
inside the related deliverable task, not as OpenSpec task checkboxes or
independent delivery units.

When an existing `tasks.md` has lifecycle-only groups, proof-only task
checkboxes, or manual-looking tasks that only capture validation evidence,
return `needs_spec_redesign`. Ask the user whether to redo the spec, brainstorm
a better breakdown, narrow the change, or choose another planning route. Do not
rewrite `tasks.md` automatically.

Existing `tasks.md` files must also identify earliest objective proof. The first
deliverable should prove the named capability by default. If the first
deliverable is setup-only, the second deliverable must contain explicit
`Proof location:` or `First real confirmation:` wording. The marker can appear
in the checkbox text or nested task-local bullets, but it must name the real
entrypoint and visible success or failure evidence. Missing proof, proof first
appearing after the second deliverable, deferred proof markers,
setup/config/metadata-only markers, and marker text without visible outcome
evidence return `needs_spec_redesign`.

OpenSpec tasks must use the native checkbox format:

```md
## 1. Group

- [ ] 1.1 Add the smallest deliverable
- [ ] 1.2 Add focused tests for that deliverable
```

No tags, schema extensions, or hidden state are added.

## Workflow

1. Read `openspec/changes/<change-id>/tasks.md`.
2. Run `scripts/openspec-tasks.ts parse <tasks.md>` when a structured task list
   is useful.
3. Run `scripts/openspec-tasks.ts audit <tasks.md>`.
4. Block when a checkbox is too broad, lacks a heading, duplicates an ID, or
   hides multiple reviewable deliverables.
5. If the audit returns `status: needs_spec_redesign`, stop and ask the user
   whether to redo the spec, brainstorm a better breakdown, narrow the change,
   or choose another planning route. Do not rewrite `tasks.md` automatically.
6. Classify manual, deployment, monitoring, and external-prerequisite tasks so
   `plan-unit-sequencer` pauses with `needs_human_action` instead of sending them
   to `plan-unit-delivery`.

## Output

The audit command emits:

```json
{
  "status": "pass",
  "next_deliverable": {
    "id": "1.1",
    "title": "Add the smallest deliverable",
    "checked": false,
    "line": 3,
    "heading": "1. Group",
    "kind": "deliverable"
  },
  "manual_pending": []
}
```

For lifecycle-only, validation-only, proof-only, or manual-looking proof task
lists, failed audits also emit structured output before exiting non-zero:

```json
{
  "status": "needs_spec_redesign",
  "errors": ["needs_spec_redesign: task 2.1 is lifecycle_phase_group"],
  "invalid_tasks": [
    {
      "id": "2.1",
      "title": "Update user-facing docs",
      "line": 8,
      "heading": "2. Documentation Updates",
      "reason": "lifecycle_phase_group"
    }
  ],
  "next_action": "ask_user_for_redesign_direction"
}
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Adding tags to tasks | Use checkbox order and task text |
| Creating a parallel slice review | Edit or audit OpenSpec tasks instead |
| Treating a whole phase as one task | Split the phase into minor deliverables |
| Accepting documentation, testing, or validation phase groups anywhere | Return `needs_spec_redesign` unless that area is the feature being changed |
| Accepting a deliverable-shaped task list where first real confirmation is task 3 or later | Return `needs_spec_redesign` and ask for redesign direction |
| Sending manual tasks to `plan-unit-delivery` | Return `needs_human_action` |

## Test Evidence

- RED: previous `plan-slices` workflow created `slice_plan_review` as duplicate
  planning state.
- GREEN: OpenSpec checkbox parsing now provides the task identity, line,
  heading, and manual/deliverable classification needed by `plan-unit-sequencer`.
