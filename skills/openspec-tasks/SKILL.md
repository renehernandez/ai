---
name: openspec-tasks
description: Use when OpenSpec tasks.md needs audit before delivery, especially broad tasks, unclear dependency order, manual tasks, stale task state, or unclear delivery fit.
---

# OpenSpec Tasks

## Mode Boundary

This is a bounded Plan specialist. It reads and audits an existing OpenSpec but
does not rewrite `tasks.md`, implement code, publish, or expand Plan's current
artifact-write authority.
The no-rewrite boundary applies to this read-only specialist, not to Plan's
authorized ownership of contract-preserving artifact repairs.

## Overview

Audit OpenSpec `tasks.md` as the delivery queue. This skill does not create a
parallel slice plan, maintain a ledger, or implement code.

## When To Use

Use within Plan after an OpenSpec change exists and before Execute receives the
next delivery unit. Use for broad OpenSpec units, unclear dependency order,
manual or external work, stale task lists, or any change where a heading may not
fit one delivery loop.

## Task Rules

Each `##` heading maps to one delivery unit inside the feature milestone or
project, and one delivery unit normally maps to one implementation PR/MR. The
checkbox tasks under that heading are nested work items for the same PR/MR,
usually one commit each. Keep headings and checkboxes outcome-oriented. Use a
sub-bullet only for delivery-boundary justification, boundary-defining
acceptance, or end-to-end proof; exact files, symbols, commands, exhaustive
edge cases, and test matrices remain task-local implementation considerations.

Nested work items must never declare themselves final PRs/MRs or encode a
second stack topology. Proposal delivery count, `tasks.md` headings, tracker
units when required, and intended predecessor order must agree. A contradiction
returns `needs_spec_redesign` even when work-item count and proof markers pass.

Task groups represent deliverable implementation areas. Do not use
lifecycle-only groups anywhere in the file that only run documentation, linting,
testing, review, validation, or verification. Those activities belong inside the
related delivery unit or nested work item unless the unit changes docs, tests,
validation, CI, reviewer tooling, runtime validation tooling, or reusable AI
workflow machinery as its feature. Deliverable-scoped proof subchecks belong as
sub-bullets inside the related work item, not as OpenSpec task checkboxes or
independent delivery units.

Workflow-machinery exceptions are valid when the lifecycle-looking area is the
feature being changed. For example, a delivery unit named `Readiness Gates` may
contain work items for validation scripts and fixtures when the change is about
runtime validation tooling. A final `Validation` unit that only runs commands
after unrelated feature work remains invalid.

`tasks.md` is a high-level delivery queue, not an implementation recipe or test
log. Requirements and scenarios own observable behavior. Design owns durable
technical decisions and boundaries. Do not repeat either as step-by-step task
prose merely to make the handoff self-contained.

Plan and delivery-shape Review forecast each final unit against its planned
predecessor. Target at most 10 changed files and 500 additions plus deletions;
more than 15 files or 1,000 changed lines blocks the forecast. After an
effective diff exists, only an artifact-bound explicit user exception can
exceed the cap. Create more top-level tasks and final MRs when needed. The
complete disposable POC is exempt. These budgets do not permit checkbox-only
or unsafe semantic splits.

Target 2-6 nested work items per delivery unit. More than 6 and at most 8 work
items is a split smell and requires an explicit `Justification:` note attached
to the delivery unit before the first checkbox. More than 8 work items returns
`needs_spec_redesign`. A one-item unit is a merge smell unless risk,
deployment, reviewability, or ownership boundaries justify a separate PR/MR.

When an existing `tasks.md` has lifecycle-only groups, proof-only task
checkboxes, or manual-looking tasks that only capture validation evidence,
return `needs_spec_redesign` to Plan. Do not rewrite `tasks.md` automatically or
ask the user directly. Plan applies an unambiguous contract-preserving repair
under its existing authority, or asks one focused question when the correction
would change a material contract boundary.

Existing `tasks.md` files must also identify earliest stack objective proof.
The first delivery unit should prove the named capability by default. Plan may
place one or two independently valuable groundwork units first when each unit
is safely mergeable, locally proved, and directly simplifies or enables a named
successor. Planning Review owns that semantic judgment; this audit enforces the
position and topology that can be checked deterministically.

The stack objective proof must appear by top-level delivery unit 3 with explicit
`Proof location:` or `First real confirmation:` wording. The marker can appear
in the heading, checkbox text, or nested task-local bullets, but it must name
the real entrypoint and visible success or failure evidence. Missing proof,
proof first appearing after the third delivery unit, deferred proof markers,
setup/config/metadata-only markers, and marker text without visible outcome
evidence return `needs_spec_redesign`. Objective-proof position is evaluated
across top-level headings, not flattened checkboxes.

OpenSpec tasks must use the native checkbox format:

```md
## 1. Delivery Unit

- [ ] 1.1 Add the smallest nested work item
- [ ] 1.2 Add focused tests for that work item
```

No tags, schema extensions, or hidden state are added.

## Workflow

1. Read `openspec/changes/<change-id>/tasks.md`.
2. Run `scripts/openspec-tasks.ts parse <tasks.md>` when a structured delivery
   unit list is useful.
3. Run `scripts/openspec-tasks.ts audit <tasks.md>`.
4. Block when a delivery-unit heading is too broad, a checkbox lacks a heading,
   a work-item ID is duplicated, sizing is invalid, a nested work item declares
   a final PR/MR, or the unit hides multiple reviewable outcomes that should
   split.
5. If the audit returns `status: needs_spec_redesign`, stop and return the
   structured blocker to Plan. Do not rewrite `tasks.md` automatically. Plan
   decides whether the accepted contract supplies a mechanical repair or a
   material redesign decision is required.
6. Classify manual, deployment, monitoring, and external-prerequisite tasks so
   Plan returns `needs_human_action` instead of handing them to Execute.

## Output

The audit command emits:

The shape below is the delivery-unit target schema for this change. Until Phase
2 updates `scripts/openspec-tasks.ts`, the current runtime may still emit the
legacy `next_deliverable` flat shape.

```json
{
  "status": "pass",
  "next_delivery_unit": {
    "id": "1",
    "title": "Delivery Unit",
    "checked": false,
    "line": 1,
    "kind": "delivery_unit",
    "work_items": [
      {
        "id": "1.1",
        "title": "Add the smallest nested work item",
        "checked": false
      }
    ]
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
  "next_action": "return_to_plan"
}
```

## Mistakes

| Mistake | Fix |
| --- | --- |
| Adding tags to tasks | Use checkbox order and task text |
| Creating a parallel slice review | Edit or audit OpenSpec tasks instead |
| Treating a whole phase as one checkbox | Use the phase as the delivery-unit heading and list nested work items under it |
| Treating every checkbox as its own MR | Deliver one checked heading per implementation MR, with nested work-item commits inside that MR |
| Accepting documentation, testing, or validation phase groups anywhere | Return `needs_spec_redesign` unless that area is the feature being changed |
| Treating nested checkboxes as separate final MRs | Return `needs_spec_redesign`; every final MR needs its own top-level heading. |
| Accepting a task list where first real confirmation is unit 4 or later | Return `needs_spec_redesign` to Plan for a material redesign decision. |
| Rejecting all groundwork because it is not end to end | Permit up to two locally proved, safely mergeable groundwork units when Plan and Review establish their standalone value and named successor. |
| Asking the user about validator-compatible wording | Return the structured failure to Plan for automatic contract-preserving repair |
| Expanding tasks with file lists, commands, and exhaustive cases | Keep the outcome and end-to-end proof in `tasks.md`; hand mechanics to Execute task-locally |
| Sending manual tasks to Execute | Return `needs_human_action` |

## Test Evidence

- RED: previous `plan-slices` workflow created `slice_plan_review` as duplicate
  planning state.
- GREEN: OpenSpec parsing provides the delivery-unit heading, nested work-item
  identity, line, and manual/deliverable classification needed by Plan and
  Execute.
- RED: the objective-proof audit flattened nested work items, so a proof marker
  in checkbox 1.1 could pass even when four final MRs were encoded under one
  heading; written guidance simultaneously rejected valid two-MR groundwork.
- GREEN: proof position is evaluated across top-level units, unit 3 proof
  passes, unit 4 proof fails, and nested final-MR declarations return
  `needs_spec_redesign`.
