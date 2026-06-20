---
name: openspec-tasks
description: Use when OpenSpec tasks.md needs audit before delivery, especially broad tasks, unclear dependency order, manual tasks, stale task state, or unclear delivery fit.
---

# OpenSpec Tasks

## Overview

Audit OpenSpec `tasks.md` as the delivery queue. This skill does not create a
parallel slice plan, maintain a ledger, or implement code.

## When To Use

Use after an OpenSpec change exists and before `plan-orchestrator` delivers the
next task. Use for broad OpenSpec tasks, unclear dependency order, manual or
external tasks, stale task lists, or any change where the next checkbox may not
fit one delivery loop.

## Task Rules

Each checkbox task maps to one minor deliverable inside the feature milestone or
project. Sub-bullets can describe files, acceptance notes, or verification, but
they are not separate delivery units.

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
5. Classify manual, deployment, monitoring, and external-prerequisite tasks so
   `plan-orchestrator` pauses with `needs_human_action` instead of sending them
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

## Mistakes

| Mistake | Fix |
| --- | --- |
| Adding tags to tasks | Use checkbox order and task text |
| Creating a parallel slice review | Edit or audit OpenSpec tasks instead |
| Treating a whole phase as one task | Split the phase into minor deliverables |
| Sending manual tasks to `plan-unit-delivery` | Return `needs_human_action` |

## Test Evidence

- RED: previous `plan-slices` workflow created `slice_plan_review` as duplicate
  planning state.
- GREEN: OpenSpec checkbox parsing now provides the task identity, line,
  heading, and manual/deliverable classification needed by `plan-orchestrator`.
