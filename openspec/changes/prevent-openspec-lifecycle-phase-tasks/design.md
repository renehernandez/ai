## Context

The plan workflow already uses OpenSpec `tasks.md` as the durable delivery
queue. The failure is not that OpenSpec lacks structure; it is that agents can
fill that structure with lifecycle phases such as documentation, validation, and
review instead of deliverable work.

The existing implementation has a useful center of gravity:
`skills/openspec-tasks/scripts/openspec-tasks.ts` owns OpenSpec task parsing and
is already imported by stack-state and sequencing helpers. This change should
extend that surface or move task-shape logic into one shared planning module
imported by that surface. It should not copy separate heuristic tables into each
workflow skill.

## Goals / Non-Goals

**Goals:**

- Treat every OpenSpec checkbox as a deliverable unit unless it is a genuine
  manual or external operational task.
- Block validation-only, proof-only, and lifecycle-phase task shapes before
  planning review and before implementation sequencing.
- Prevent `plan-ready` from generating bad task shape in new blueprints.
- Keep local workflow artifacts out of work-project repositories.
- Preserve valid exceptions when documentation, testing, validation, CI,
  reviewer tooling, runtime validation tooling, or reusable AI workflow
  machinery is the feature being changed.

**Non-Goals:**

- Changing upstream OpenSpec schema.
- Adding tags, hidden state, or a second ledger to `tasks.md`.
- Automatically rewriting existing OpenSpec task lists.
- Committing private support artifacts or public pointers to private storage.
- Adding AI workflow regression fixtures to work-project repositories.

## Decisions

### One Canonical Task-Shape Classifier

All task-shape decisions use one shared classifier. It accepts normalized task
text plus relevant change context, so a plan-ready blueprint task and an
OpenSpec checkbox task classify the same way for the same case.

The classifier distinguishes:

- `deliverable`: changes code, docs, runtime behavior, workflow behavior, config,
  or reusable AI workflow machinery;
- `manual`: requires genuine human or external operational action;
- `validation_only`: runs checks, captures evidence, or records proof;
- `lifecycle_phase`: groups work by process stage instead of deliverable area;
- `too_broad`: bundles multiple reviewable deliverables into one task.

Classification precedence is explicit: `validation_only`, proof-only, and
`lifecycle_phase` beat `manual` when a task looks external but only captures
proof, review, CI inspection, or validation evidence. Genuine external
operational tasks keep the manual route.

### Block, Do Not Rewrite Existing Specs

Existing bad OpenSpec task lists return `needs_spec_redesign`. Diagnostics list
the offending groups and tasks and ask the user to choose whether to redo the
spec, brainstorm a better breakdown, narrow the change, or use another planning
route. The audit does not mutate `tasks.md`.

### Align Scripted And Prompted Behavior

The scripted gates and adapter prompts must change together. The affected prompt
surfaces are `plan-ready`, `openspec-tasks`, `plan-review`,
`plan-orchestrator`, and `plan-unit-sequencer`.

### Runtime Refresh Is An Activation Gate

This change updates shared skills, rules, adapter prompts, and reusable scripts
that are installed into runtime profiles. Runtime refresh is therefore in scope
as the activation gate for the prevention behavior, not as a standalone
verification phase in `tasks.md`. Each implementation task that changes an
installed shared surface owns the matching package-managed update and validation
for the affected profiles before the behavior is treated as live.

### Existing In-Flight Specs Must Be Reassessed

Specs created before this guard can already contain lifecycle-shaped groups, even
inside the stack this change builds on. The new classifier does not grandfather
those specs and does not rewrite them automatically. When an in-flight spec has a
final testing, documentation, validation, or runtime-refresh group, the audit
must either classify it under a real feature exception such as validation
tooling, runtime validation tooling, or reusable AI workflow machinery, or return
`needs_spec_redesign` and ask the user how to proceed.

### Keep Private Workflow Artifacts Private

Detailed task-shape analysis, reviewer scratch, validation evidence, rejected
generated shapes, and command proof belong in the thread plus private
plan-support storage. Public OpenSpec artifacts do not reference that private
storage. Work-project repos receive project artifacts only; reusable prevention
machinery belongs in the AI repo.

## Risks / Trade-offs

- Over-broad heuristics could block valid workflow-area changes. Mitigation:
  include GREEN fixtures for documentation, testing, validation, CI, reviewer
  tooling, runtime validation tooling, and reusable AI workflow machinery as the
  feature.
- Manual-looking proof tasks could be ignored as manual work. Mitigation:
  precedence rules and RED fixtures force `needs_spec_redesign` for proof-only
  tasks.
- Prompt surfaces can drift from script behavior. Mitigation: add prompt checks
  for lifecycle/validation-only blocking and `needs_spec_redesign`.
- Existing planning stacks can contain the same shape this change rejects.
  Mitigation: require reassessment under the feature-exception rules and block
  with `needs_spec_redesign` when the exception does not apply.
- Runtime profile refresh can be missed after shared skill or instruction
  changes. Mitigation: treat refresh as a per-task activation gate for changed
  installed behavior, not as an end-of-spec lifecycle group.
