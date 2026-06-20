## Context

The repo has a set of plan workflow skills with partially overlapping
responsibilities:

- `plan-ready` decides whether work is atomic or should become an OpenSpec
  blueprint.
- `plan-to-review` publishes planning-only PRs or MRs.
- `plan-orchestrator` currently sequences implementation units.
- `plan-unit-delivery` implements exactly one unit.

The desired workflow makes planning review mandatory before implementation and
uses `plan-orchestrator` as the end-to-end entrypoint. That requires renaming
the current sequencing role, adding a reviewed-planning handoff, and making
runtime installs remove stale skill names after renames.

## Goals / Non-Goals

**Goals:**

- Make `plan-orchestrator` the top-level workflow skill.
- Move implementation sequencing to `plan-unit-sequencer`.
- Rename `plan-to-review` to `plan-review`.
- Make `plan-review` emit the `planning_review` handoff consumed before
  implementation.
- Require planning-only hosted review before implementation for atomic plans and
  OpenSpec changes.
- Keep `plan-ready` as a readiness gate that stops before OpenSpec creation,
  hosted review, and implementation.
- Keep `plan-unit-delivery` scoped to one implementation unit.
- Prune stale installed old-name skills during runtime updates.

**Non-Goals:**

- Add a generic PR stack manager.
- Add a durable ledger outside OpenSpec.
- Reintroduce plan slices, followthrough ledgers, or tags.
- Change OpenSpec schema.
- Change normal repo direct-publish behavior outside plan workflow skills.

## Decisions

### Introduce Shared Planning Contract Helpers First

The plan skills currently validate related YAML contracts in separate scripts.
Before renaming skills or adding `planning_review`, extract shared helpers for
fenced YAML extraction, scalar/list/map parsing, legacy rejection, and common
handoff validation.

Alternative considered: add `planning_review` validation to each skill script
directly. That would create another duplicated parser and increase drift risk
during the rename.

### Use `planning_review` As The Single Review-To-Implementation Handoff

`plan-review` should emit the `planning_review` handoff directly. The existing
review ledger can remain internal evidence or be nested under
`planning_review.evidence`.

Alternative considered: keep `plan_review_gate_ledger` as the final output and
ask the sequencer to derive `planning_review`. That would require manual
transcription or duplicate inference across skills.

### Swap Orchestrator And Sequencer In One Delivery Unit

The existing `plan-orchestrator` name is being reused for the top-level
workflow. The current sequencing role must move to `plan-unit-sequencer`, and a
new top-level `plan-orchestrator` must exist in the same implementation unit.

Alternative considered: rename the current orchestrator first, then add the new
orchestrator later. That would temporarily break the entrypoint that
`plan-ready` tells users to run.

### Make Planning Review A Plan Workflow Exception To Direct Publish

This repo normally commits directly to `main` for ordinary changes. Plan
workflow skills need an explicit exception because review-first delivery
requires a planning-only PR or MR before implementation.

Alternative considered: keep direct-publish policy dominant and skip hosted
planning review in this repo. That conflicts with the desired universal
review-first plan workflow.

### Prune Stale Installed Skill Names

Renaming source skill directories is insufficient if old installed runtime
symlinks or directories remain callable. Runtime update must prune stale
installed old-name skills and tests must prove the cleanup.

Alternative considered: rely on status and validation output. Current status
only reports configured skill names, so stale unconfigured old names can remain
undetected.

## Risks / Trade-offs

- Broad rename surface can break entrypoints -> keep the orchestrator/sequencer
  swap atomic and test both old and new semantics.
- Review gate evidence can become too weak -> require explicit CI, automated
  feedback, developer review, mergeability, branch, and head SHA evidence in
  `planning_review`.
- Stack mode can start from the wrong base -> include `target_base_sha`,
  `planning_branch`, `reviewed_head`, `stack_base_ref`, stack relationship
  evidence, and task-state fingerprint.
- Runtime cleanup can remove the wrong paths -> prune only managed skill
  directories or symlinks and cover stale-name cleanup with fixture-backed
  integration tests.
- OpenSpec proposal automation can bypass repo conventions -> invoke the
  configured OpenSpec propose entrypoint and require strict validation before
  planning review.
