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
2. Write or update primary atomic plan markdown under `.agents/plans/`.
   Supporting workflow artifacts are private evidence: keep review requests,
   reviewer selections, handoffs, blueprints, ledgers, reports, validation
   inputs, and validation outputs in the thread, and record file-backed copies
   with the AX plan artifact command when recovery or correlation is needed.
   Use `pnpm ax plans artifact list --plan <plan>` to recover prior private
   support artifacts. Do not commit `.agents/plans/**` support sidecars.
3. Run `plan-ready`.
4. If `plan-ready` emits `plan_delivery_handoff`, create a
   `plan_review_request` and run `plan-review`.
5. If `plan-ready` emits `openspec_blueprint`, create the OpenSpec proposal with
   the configured OpenSpec propose entrypoint, apply the source-plan cleanup
   rule below, create a `plan_review_request`, and run `plan-review`.
6. Consume only a validated `planning_review` handoff before implementation.
7. Run `plan-unit-sequencer` for unit selection.
8. Let `plan-unit-delivery` implement exactly one selected unit at a time.

Intermediate outputs such as `plan_delivery_handoff`, `openspec_blueprint`,
`planning_review`, or one delivered unit are not terminal success for
`plan-orchestrator`; continue until `stack_ready` or report `delivery_blocked`
with evidence.

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

Before sequencing, verify that the planning review and implementation stack can
use Nitro-reviewed Fullscript GitLab merge requests. Unsupported review or stack
hosts are not a fallback path; report `delivery_blocked` with routing evidence.

## OpenSpec Proposal Flow

For `openspec_blueprint` outputs:

1. Confirm the source `.agents/plans/**` intake file is not already committed.
   If it is already committed, block conversion and repair the branch; do not
   publish a deletion-only source-plan diff for an OpenSpec planning review.
2. Create the OpenSpec change from the blueprint using the repo's configured
   OpenSpec propose entrypoint.
3. Run `openspec validate <change-id> --strict --no-interactive`.
4. Run the repo-local OpenSpec scaffolding validation when available.
5. If OpenSpec creation and all applicable validation steps pass, run
   `scripts/plan-orchestrator.ts cleanup-source-plan --source-plan <path>
   --expected-source-plan <source_plan.ref> --expected-change-id
   <source_plan.change_id> --change-id <change-id>` before publishing review.
   The expected source plan and change id come from the current
   `openspec_blueprint.source_plan`; do not infer them by scanning
   `.agents/plans/**` or default them from `--source-plan` or `--change-id`.
   Applicable validation steps include strict OpenSpec validation and
   repo-local scaffolding validation when available. If creation or any
   applicable validation step fails, preserve the source plan for repair.
6. Run `plan-review` against the OpenSpec change. For `artifact_type:
   openspec`, the planning branch diff must contain the OpenSpec change and no
   `.agents/plans/**` files. Honor `plan-review` if it blocks lifecycle-only
   task shape with `needs_spec_redesign`; ask the user how to proceed instead
   of silently rewriting the OpenSpec change.
7. Do not start implementation until `plan-review` emits valid
   `planning_review`.

Atomic plan review is unchanged: when `plan-ready` emits
`plan_delivery_handoff` for `artifact_type: plan`, `.agents/plans/**` remains
the durable reviewed planning artifact and must not be deleted by this
OpenSpec cleanup rule. This exception applies only to the primary markdown plan
artifact, not support sidecars.

## Resume Flow

Before continuing existing work, inspect and validate resume state with
`scripts/plan-orchestrator.ts resume-template` and `validate-resume`. Continue
only from `resume_ready`; otherwise report `delivery_blocked`.

The resume state must account for:

- intake kind: ready plan, OpenSpec blueprint, existing OpenSpec, or
  continue/resume;
- planning MR and latest Nitro gate state;
- implementation stack order;
- current stack tip;
- latest head SHA and Nitro gate state for every MR;
- stack-tip `tasks.md` fingerprint;
- concrete stack-tip `tasks.md` content and task-to-artifact evidence for
  checked deliverables;
- no lifecycle-only, validation-only, proof-only, or manual-looking proof task
  shapes in stack-tip `tasks.md`; if validation reports `needs_spec_redesign`,
  stop and ask the user whether to redo the spec, brainstorm, narrow scope, or
  choose another route before continuing delivery;
- predecessor artifact, task-delta validation, and cumulative task-state
  evidence for every implementation artifact;
- restack requirements and evidence.

If an earlier MR changed after descendants exist, restack affected descendants
and rerun Nitro gates for every changed head before continuing.

## Completion

The only orchestrator-level terminal states after reviewed planning are:

- `stack_ready`: the full planning plus implementation stack is reviewed and
  ready for merge follow-through.
- `delivery_blocked`: the workflow cannot continue without a fix, external
  action, supported artifact host, or later retry from durable resume evidence.

Finish with `stack_ready` only after:

- the planning MR and every implementation MR have latest-head Nitro gate
  outcome `passed`;
- stack base/head relationships are valid;
- stack-tip task state has all deliverable tasks checked and no invalid
  lifecycle/proof-only task shapes;
- `restack_required` is `false`.

Validate the final result with `scripts/plan-orchestrator.ts
validate-stack-ready`.

## Scripts

- `scripts/plan-orchestrator.ts detect`
- `scripts/plan-orchestrator.ts plan-review-request-template`
- `scripts/plan-orchestrator.ts validate-planning-review --file <path>`
- `scripts/plan-orchestrator.ts validate-openspec-change <change-id>`
- `scripts/plan-orchestrator.ts cleanup-source-plan --source-plan <path> --expected-source-plan <path> --expected-change-id <change-id> --change-id <change-id>`
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
| Lifecycle-only OpenSpec task shape | Return `needs_spec_redesign` and ask how to proceed. |
| Pending planning review | Return `planning_review_blocked`. |
| Unsupported review or stack host | Return `delivery_blocked` with routing evidence. |

## Output Rule

Before any YAML or JSON contract, write a concise `## Readable Summary` so the
thread remains readable on mobile.
