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
- Delete only source-plan paths explicitly recorded as expected inputs for the
  current conversion.
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
- Accepting an arbitrary `.agents/plans/**` path as safe to delete merely
  because it is untracked in the current worktree.
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

### Bind cleanup to the current conversion context

`cleanup-source-plan` must prove that the target path is the expected source
plan for the current plan-to-OpenSpec conversion. The path must match an
explicit source-plan reference supplied through the current reviewed blueprint
or conversion handoff for the same OpenSpec `change-id`. The helper must not
discover cleanup targets by scanning `.agents/plans/**` or infer authority from
filename similarity. Being under `.agents/plans/**`, untracked, or staged for
addition is necessary but insufficient.

The helper contract carries that reference separately from the deletion target:
`cleanup-source-plan --source-plan <delete-target> --expected-source-plan
<recorded-source-plan> --expected-change-id <recorded-change-id> --change-id
<change-id>`. The expected values are populated from the source plan context
that `plan-orchestrator` just converted into the OpenSpec change. They must not
default to `--source-plan` or `--change-id`, and the helper must fail when
either expected value is absent.

The machine-readable carrier is `openspec_blueprint.source_plan.ref` plus
`openspec_blueprint.source_plan.change_id`, emitted by `plan-ready` when the
blueprint originates from a `.agents/plans/**` file. `plan-ready` validation
requires these fields for plan-file-backed OpenSpec blueprints and requires
`source_plan.change_id` to match `change.suggested_id`. `plan-orchestrator`
reads those fields from the reviewed blueprint or conversion handoff and passes
them as `--expected-source-plan` and `--expected-change-id`; the subsequent
`plan_review_request` continues to point at the OpenSpec artifact and does not
publish the source plan.

Path comparison uses normalized repo-relative paths after rejecting paths that
escape the repo root or the `.agents/plans/**` subtree. Absolute paths,
`./`-prefixed paths, and equivalent normalized repo-relative paths may refer to
the same expected source plan; `..` traversal, symlink escapes, and paths in a
different worktree do not.

If the supplied cleanup target does not match the expected source-plan path, the
helper reports an invalid precondition and preserves the file. This prevents a
same-worktree unrelated plan from being deleted just because it shares the
scratch intake directory.

The expected source-plan record is bound to the same OpenSpec `change-id` that
is being validated. A stale expected-path record for another change, or the same
path supplied with the wrong `change-id`, is not valid cleanup authority and
must preserve the file.

Tracked source-plan files block conversion when the path is present in `HEAD`,
the target planning base, or the index as a tracked modification/deletion. The
cleanup path supports only untracked files and staged additions that have not
yet been committed. If a source plan is tracked on `main` or the current
planning branch, the workflow must repair that branch outside the OpenSpec
planning diff rather than publishing a deletion-only plan change.

For multiple explicit source plans, each path must be recorded in the same
conversion context for the same `change-id`, normalized independently, and
deleted only by exact expected-path match. V1 still does not infer extra
deletions; additional paths are allowed only when the conversion handoff
explicitly records them as superseded by the OpenSpec change.

Tests for cleanup behavior must create disposable source-plan fixtures inside
the test setup and pass those fixture paths as the expected source-plan
context. Regression tests must not use pre-existing `.agents/plans/**` files as
cleanup targets.

Alternative considered: rely on untracked status plus `.agents/plans/**`
containment. Rejected because unrelated thread or human planning artifacts can
exist in the same checkout as untracked files.

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
