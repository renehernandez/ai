## Context

The current review-first plan workflow made planning review mandatory before
implementation, but kept two implementation continuation modes:
`ship_then_continue` and `stack_when_ready`. The split adds branching behavior
to the top-level workflow and makes resumed work harder to reason about.

The desired long-term model is one deterministic stack:

```text
single plan:
  planning MR -> implementation MR

OpenSpec:
  planning MR -> task 1 MR -> task 2 MR -> ... -> task N MR
```

Every MR must have latest-head Nitro feedback completed with no unresolved
actionable findings before the next MR starts.

## Goals / Non-Goals

**Goals:**

- Use stacked PRs or MRs as the only implementation path for plan workflow
  delivery.
- Replace planning review modes with `planning_review.mode: stacked_delivery`.
- Keep `planning_review.gate_outcome: ready_for_stack`.
- Require Fullscript GitLab MRs when Nitro feedback is required.
- Add a reusable `nitro_feedback_gate` contract and validation path.
- Require fresh Nitro feedback after every material head-changing push.
- Resume from existing planning and implementation stack state.
- Report completion as `stack_ready` after every MR in the stack passes Nitro
  feedback closure.
- Keep merge follow-through outside `plan-orchestrator`.

**Non-Goals:**

- Merge the ready stack.
- Create a generic stack manager.
- Support direct publish inside orchestrated plan delivery.
- Support GitHub/Codex feedback as a required gate in the first cut.
- Support multiple automated feedback providers in the first cut.

## Decisions

### Use One Stacked Delivery Mode

Replace `PLANNING_REVIEW_MODES = ["ship_then_continue", "stack_when_ready"]`
with `["stacked_delivery"]`. Keeping `mode` as a required field avoids a larger
schema migration while removing the branch that caused agents to choose between
target-branch and stack-tip sequencing.

`gate_outcome` remains `ready_for_stack`. `stack_base_ref` and
`stack_base_evidence` become required for every reviewed planning handoff.

### Reject Direct Publish In Plan Orchestration

This repo still allows direct-main publication for ordinary work, but
`plan-orchestrator` stacked delivery is an explicit exception. The workflow
must reject `direct_publish` before planning review or implementation delivery.

If lower-level helpers keep `direct_publish` for non-orchestrated use, the
contract must prove the current route is outside `plan-orchestrator`.

### Require Fullscript GitLab For Nitro

Nitro is the required automated feedback provider for the first cut and is
available only on Fullscript GitLab MRs. GitHub, non-Fullscript GitLab, or
ambiguous routes return `nitro_route_unsupported`. The workflow must not
substitute Codex feedback.

### Normalize Nitro Feedback Once

Introduce one shared `nitro_feedback_gate` template and validator consumed by
`planning_review`, `plan-unit-delivery`, and final `stack_ready` reporting.

The gate maps existing `nitro-review-feedback` statuses:

| Nitro status | Gate meaning |
| --- | --- |
| `pending` | latest-head review has started or is in flight; not complete |
| `no issues` | latest-head review completed cleanly |
| `findings` | latest-head review completed with findings |
| `unavailable` | Nitro could not be reached or verified |
| `stale` | feedback belongs to an older head |

The 10-minute timeout applies only to acknowledgement or start. If Nitro starts
but does not complete, the workflow returns a resumable
`nitro_review_completion_pending` state.

### Prove Stack Identity Explicitly

Handoffs and ledgers need enough data to prove the stack relationship:

- expected stack base ref and SHA;
- predecessor MR URL or ref;
- selected task base SHA;
- implementation MR URL and head SHA;
- restack-required evidence.

This data is required before implementing resume, restack, or `stack_ready`
validation.

## Risks / Trade-offs

- Restricting the first cut to Fullscript GitLab blocks GitHub plan workflow
  delivery, but avoids silently replacing Nitro with a different reviewer.
- Keeping `mode` with a single allowed value is less invasive than removing it,
  but the field remains semantically redundant.
- Waiting for Nitro completion can pause long-running threads. The explicit
  pending state makes this resumable without treating incomplete review as a
  pass.
- Restack recovery can become a stack manager if overbuilt. The implementation
  should detect and report required restacks using existing Git/GitLab stack
  mechanics.
