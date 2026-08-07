---
name: openspec-tasks
description: Use when OpenSpec tasks.md needs audit before delivery, especially broad tasks, unclear dependency order, manual tasks, stale task state, or unclear delivery fit.
---

# OpenSpec Tasks

## Boundary

This is a bounded Plan specialist. It reads and audits an existing OpenSpec but
does not rewrite `tasks.md`, implement code, publish, or expand Plan authority.
Plan owns any accepted contract-preserving artifact repair.

Use it after an OpenSpec exists and before Execute receives a delivery unit.
It audits the delivery queue; it does not create a parallel slice plan, ledger,
implementation recipe, or review transcript.

## Delivery Contract

Each `##` heading is one delivery unit and normally one final PR/MR. Checkbox
tasks are nested work items for that same outcome, not a second stack topology.
Proposal unit count, headings, required tracker units, and predecessor order
must agree.

Keep headings and work items outcome-oriented. Requirements own observable
behavior; design owns durable decisions. Exact files, symbols, commands,
exhaustive cases, and test matrices stay task-local. Proof belongs with the
work it validates, unless reusable proof machinery is itself the feature.

Reject lifecycle-only documentation, testing, validation, review, or
verification groups when they merely follow unrelated implementation. Allow a
similarly named unit only when it changes that machinery as the reviewable
product outcome.

Apply the delivery budgets from the canonical workflow rule. Target 2-6 nested
work items. Seven or eight require an attached boundary justification; more
than eight requires redesign. A one-item unit is a merge smell unless ownership,
risk, deployment, or reviewability makes it independently valuable.

The earliest real objective proof should be unit 1 and must appear by unit 3.
Up to two groundwork units are valid only when each is safe, locally proved,
independently useful, and enables a named successor. The proof marker must name
the real entrypoint and visible success or failure evidence; setup-only or
deferred confirmation fails.

Use native checkbox syntax only:

```md
## 1. Delivery Unit

- [ ] 1.1 Add an outcome-oriented work item
- [ ] 1.2 Prove that work item locally
```

## Audit

1. Read `openspec/changes/<change-id>/tasks.md`.
2. Run `scripts/openspec-tasks.ts parse <tasks.md>` when structured inventory is
   useful, then run `scripts/openspec-tasks.ts audit <tasks.md>`.
3. Verify heading and checkbox identity, unique IDs, semantic cohesion, sizing,
   predecessor order, objective-proof position, and manual/external work.
4. Return the script's structured disposition without rewriting the file.

`pass` returns the next delivery unit with its nested work items and pending
manual work. `needs_spec_redesign` returns invalid tasks and
`next_action: return_to_plan`; it covers malformed topology, lifecycle-only or
proof-only groups, missing objective proof, unsafe size, and multiple outcomes
hidden in one unit. `needs_human_action` identifies deployment, monitoring,
manual, or external prerequisites that cannot be handed to Execute.

The script and its tests own parsing, schema shape, error codes, and regression
examples. Plan owns the semantic redesign decision.
