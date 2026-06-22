## Context

`plan-ready` uses `.agents/plans/**` files as planning intake and emits an
`openspec_blueprint` for multi-deliverable work. `plan-orchestrator` then
materializes the blueprint into `openspec/changes/<change-id>/**` and
`plan-review` publishes that planning artifact for review.

The missing boundary is source-plan cleanup. A `.agents/plans/**` file is
useful before OpenSpec exists, but once OpenSpec creation and validation pass,
the source plan becomes stale duplicate planning state. If it appears in the
OpenSpec planning diff, reviewers and future agents can treat the scratch plan
as durable evidence.

## Goals / Non-Goals

**Goals:**

- Make the source plan a scratch-only input for plan-to-OpenSpec conversion.
- Delete the primary source plan only after OpenSpec creation and strict
  validation pass.
- Reject any `artifact_type: openspec` planning diff that contains a
  `.agents/plans/**` path.
- Preserve atomic plan behavior for `artifact_type: plan`.
- Prove updated installed planning skills and prompts use the same contract.

**Non-Goals:**

- Moving OpenSpec materialization into `plan-ready`.
- Changing the OpenSpec schema.
- Supporting deletion of already committed source plans in the OpenSpec
  planning diff.
- Inferring and deleting multiple source plans without an explicit source list.
- Starting implementation before reviewed planning exists.

## Decisions

### Enforce cleanup in `plan-orchestrator`

`plan-orchestrator` owns OpenSpec materialization, so it owns cleanup of the
primary source plan. The source plan is deleted only after:

1. the OpenSpec change exists;
2. `openspec validate <change-id> --strict --no-interactive` passes;
3. repo-local OpenSpec scaffolding validation passes when available.

If validation fails, the source plan remains available for repair. This avoids
losing the only editable intake artifact when OpenSpec creation produces an
invalid proposal, design, spec delta, or task list.

If repo-local OpenSpec scaffolding validation is unavailable in a target repo,
strict OpenSpec validation remains the required cleanup gate and the workflow
records that the repo-local validation surface was absent. In this AI repo,
`pnpm ax openspec validate` is available and must be run before cleanup.

Alternative considered: delete the source plan immediately after writing
OpenSpec files. Rejected because failed validation would turn a repairable
conversion into a context-recovery problem.

### Enforce the planning diff invariant in `plan-review`

`plan-review` is the durable guard before hosted planning review. For
`artifact_type: openspec`, it must reject any `.agents/plans/**` path in the
planning diff, including deletion-only entries. This catches missed cleanup,
accidental staging, and attempts to publish source-plan deletion as part of the
OpenSpec planning artifact.

Atomic plan review remains unchanged. When `artifact_type: plan`, a
`.agents/plans/**` artifact is the reviewed artifact.

Alternative considered: allow deletion-only plan diffs. Rejected because the
user-level invariant is stronger: plans must not be committed in the
plan-to-OpenSpec path in the first place.

### Block already committed source plans

If the primary source plan is already committed before the OpenSpec planning
diff is published, the workflow reports an invalid precondition. The workflow
does not include a deletion in the OpenSpec planning diff.

Alternative considered: remove the committed plan in the same planning branch.
Rejected because that still makes the source plan part of the planning diff and
teaches future agents that committed source plans are a supported state.

### Keep V1 to one primary source plan

V1 deletes only the primary source plan associated with the conversion. If a
blueprint was synthesized from multiple plans, additional deletions require an
explicit recorded list of superseded paths.

Alternative considered: scan `.agents/plans/**` for related files and delete
matches heuristically. Rejected because the false-positive cost is too high for
planning artifacts.

### Prove installed runtime agreement through an independent `ax-cli` delta

The source-plan cleanup contract changes shared planning skill behavior and
adapter prompts, so this change adds an `ax-cli` requirement for runtime
validation of that contract. The requirement is independent of
`require-plan-orchestrator-full-stack-completion`; it only covers the personal
and work runtime checks needed for this source-plan cleanup behavior.

## Risks / Trade-offs

- Diff-state parsing can miss rename, copy, or type-change cases -> tests must
  cover the exact git status or diff formats consumed by the helper.
- Runtime skill refresh can rewrite lock data -> delivery must review and
  account for those generated changes.
- A committed source plan blocks conversion instead of self-healing -> this is
  intentional so the invariant remains clean and visible.
