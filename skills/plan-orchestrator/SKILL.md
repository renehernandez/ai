---
name: plan-orchestrator
description: Use when coordinating a plan workflow end to end from fuzzy request, plan artifact, OpenSpec blueprint, or OpenSpec change through reviewed planning and implementation sequencing.
---

# Plan Orchestrator

## Overview

`plan-orchestrator` is the top-level plan workflow entrypoint. It turns a fuzzy
request or reviewed planning artifact into the next required workflow step and
continues until delivery is complete or a blocker must be reported.

## Core Contract

All work goes through planning review before implementation:

1. Use brainstorming when the request is still fuzzy.
2. Write or update plans under `.agents/plans/`.
3. Run `plan-ready`.
4. If `plan-ready` emits `plan_delivery_handoff`, create a
   `plan_review_request` and run `plan-review`.
5. If `plan-ready` emits `openspec_blueprint`, create the OpenSpec proposal with
   the configured OpenSpec propose entrypoint, run strict OpenSpec validation,
   create a `plan_review_request`, and run `plan-review`.
6. Consume only a validated `planning_review` handoff before implementation.
7. Run `plan-unit-sequencer` for unit selection.
8. Let `plan-unit-delivery` implement exactly one selected unit at a time.

## Stacked Delivery Mode

The only implementation mode is `stacked_delivery`.

Implementation may start only when `plan-review` emits a validated
`planning_review` with:

- `mode: stacked_delivery`;
- `gate_outcome: ready_for_stack`;
- a passed latest-head `nitro_feedback_gate`;
- `stack_base_ref`, `stack_base_evidence`, and `stack_identity`.

Do not accept `ship_then_continue` or `stack_when_ready`. Treat them as legacy
inputs and return `needs_plan_ready`.

## OpenSpec Proposal Flow

For `openspec_blueprint` outputs:

1. Create the OpenSpec change from the blueprint using the repo's configured
   OpenSpec propose entrypoint.
2. Run `openspec validate <change-id> --strict --no-interactive`.
3. Run the repo-local OpenSpec scaffolding validation when available.
4. Run `plan-review` against the OpenSpec change.
5. Do not start implementation until `plan-review` emits valid
   `planning_review`.

## Resume Flow

Before continuing existing work, inspect and validate resume state with
`scripts/plan-orchestrator.ts resume-template` and `validate-resume`.

The resume state must account for:

- intake kind: ready plan, OpenSpec blueprint, existing OpenSpec, or
  continue/resume;
- planning MR and latest Nitro gate state;
- implementation stack order;
- current stack tip;
- latest head SHA and Nitro gate state for every MR;
- stack-tip `tasks.md` fingerprint;
- restack requirements and evidence.

If an earlier MR changed after descendants exist, restack affected descendants
and rerun Nitro gates for every changed head before continuing.

## Completion

Finish with `stack_ready` only after:

- the planning MR and every implementation MR have latest-head Nitro gate
  outcome `passed`;
- stack base/head relationships are valid;
- stack-tip task state has all deliverable tasks checked;
- `restack_required` is `false`.

Validate the final result with `scripts/plan-orchestrator.ts
validate-stack-ready`.

## Scripts

- `scripts/plan-orchestrator.ts detect`
- `scripts/plan-orchestrator.ts plan-review-request-template`
- `scripts/plan-orchestrator.ts validate-planning-review --file <path>`
- `scripts/plan-orchestrator.ts validate-openspec-change <change-id>`
- `scripts/plan-orchestrator.ts resume-template`
- `scripts/plan-orchestrator.ts validate-resume --file <path>`
- `scripts/plan-orchestrator.ts stack-ready-template`
- `scripts/plan-orchestrator.ts validate-stack-ready --file <path>`

## Rejections

| Input | Action |
| --- | --- |
| Legacy slice, followthrough ledger, or coordinate handoff | Return `needs_plan_ready`. |
| No `planning_review` before sequencing | Return `needs_reviewed_planning`. |
| OpenSpec validation failure | Return `openspec_proposal_blocked`. |
| Pending planning review | Return `planning_review_blocked`. |

## Output Rule

Before any YAML or JSON contract, write a concise `## Readable Summary` so the
thread remains readable on mobile.
