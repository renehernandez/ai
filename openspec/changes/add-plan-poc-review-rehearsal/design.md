## Context

The existing review-first plan workflow treats `plan-orchestrator` as the
shipping path. It requires reviewed planning, stacked implementation artifacts,
latest-head Nitro feedback, and `stack_ready` evidence before delivery is
ready for merge follow-through.

The new workflow is different on purpose. `plan-poc` is a review rehearsal that
lets Rene and reviewers inspect a complete implementation shape against the
OpenSpec before final delivery begins. The POC artifact closes unmerged and
feeds learnings back into a later OpenSpec revision.

## Goals / Non-Goals

**Goals:**

- Add a dedicated `plan-poc` skill for review-only OpenSpec implementation
  rehearsals.
- Keep POC artifacts visibly draft, non-mergeable, and marked with a `POC:`
  title prefix.
- Include the rehearsed OpenSpec files and implementation diff in the same
  hosted artifact so reviewers can compare intent against implementation.
- Capture POC learnings privately and use them to revise the OpenSpec before
  normal delivery.
- Preserve `plan-orchestrator` as the final delivery path.

**Non-Goals:**

- Merge POC artifacts.
- Reuse POC commits for final delivery.
- Replace stacked delivery or loosen `plan-orchestrator` completion gates.
- Build a generic reviewer platform.
- Commit private learning summaries or support ledgers to the repository by
  default.

## Decisions

### `plan-poc` Is A Sibling Workflow

`plan-poc` should live as a dedicated skill rather than as a hidden
`plan-orchestrator` mode.

Alternative considered: add a single-MR option to `plan-orchestrator`. That
would blur the distinction between rehearsal and delivery, and it would make
the normal stack-ready contract easier for agents to misuse.

### Draft Artifact Carries Spec And Implementation

The POC branch includes the OpenSpec files and implementation diff. The hosted
artifact body must explain that the OpenSpec files are comparison context, POC
task checkbox state is contextual, and the artifact is not intended to merge.

Alternative considered: keep the OpenSpec outside the POC artifact and link to
it. That gives reviewers less direct context and makes spec-versus-code drift
harder to review.

### Learning Summary Is Private Evidence

`poc_learning_summary` remains in the thread or private support storage. It
captures spec corrections, phase-shape changes, implementation notes, reviewer
dispositions, and final delivery constraints.

Alternative considered: commit a final POC notes document into the branch. That
would make a review-only artifact look more durable than intended and could
leak support evidence into the repo.

### Final Delivery Reimplements From Revised OpenSpec

After the POC closes, the final path is: revise OpenSpec from POC learnings,
then run normal `plan-orchestrator`. POC commits are never delivery lineage.

Alternative considered: cherry-pick clean POC commits into delivery branches.
That creates confusing provenance and makes it too easy for agents to skip the
revised spec as the source of truth.

## Risks / Trade-offs

- POC artifacts may be mistaken for mergeable work. Mitigation: require draft
  state, `POC:` title prefix, non-merge body language, unmerged closure, and
  summary fields that reject commit reuse.
- Contextual POC task checkboxes may be mistaken for durable task state.
  Mitigation: mark POC task state as non-authoritative in the skill, hosted
  body, and learning summary.
- Personal project reviewer routes may not be configured. Mitigation: use
  `review-feedback-routing`; ask or block with routing evidence when no route
  exists.
- POC implementation can diverge from the original OpenSpec. Mitigation:
  capture mismatches privately, then revise the real OpenSpec before final
  delivery.

## Migration Plan

1. Add the `plan-poc` skill contract and minimal validation helpers.
2. Add phase-loop and routed-feedback guidance.
3. Add learning-summary and closure validation.
4. Align runtime-facing prompts, rules, and tests.
5. Run `writing-skills` and installed-surface validation before publishing
   runtime-facing changes.

## Open Questions

None. The accepted direction is a review-only, draft, unmerged POC artifact
that informs but never supplies final delivery lineage.
