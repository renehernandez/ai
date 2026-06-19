---
name: plan-ready
description: Use when an idea, feature request, plan file, OpenSpec change, Linear ticket, or fuzzy implementation goal must become implementation-ready before coding begins.
---

# Plan Ready

## Overview

Route planning input to the right delivery path before implementation starts.
`plan-ready` decides whether the work is atomic enough for one delivery loop or
must move into OpenSpec.

## When To Use

Use for ideas, feature requests, implementation plans, OpenSpec changes before
delivery, Linear tickets, and any request that needs readiness validation before
`plan-coordinate`.

Do not use after implementation has started. Do not create synthetic slices,
slice reviews, or followthrough ledgers.

## Plan Artifacts

When `plan-ready` or the user asks to write a plan artifact, write it under
`.agents/plans/`. Do not create new planning files under `docs/plans/`.

## Workflow

1. Run `scripts/plan-ready.ts detect <artifact-ref-if-known>`.
2. Inspect live repo state and the relevant planning artifact.
3. Clarify scope with brainstorming when the request is not ready.
4. Apply the atomicity gate:
   - one user or system outcome;
   - one primary ownership area;
   - no required sequencing across multiple PRs or MRs;
   - one verification story;
   - no hidden migration, deployment, or manual prerequisite chain.
5. If the work is multi-deliverable, return `needs_openspec` and stop.
6. If the work is atomic, run reviewer selection, plan reviewers, and final
   scrutiny.
7. Emit a validated `plan_coordinate_handoff`.
8. Stop. Do not invoke `plan-coordinate`, `plan-to-pr`, create branches, push,
   open PRs/MRs, or request hosted review.

## Reviewer Selection

Baseline reviewers always run:

- `implementation-readiness`
- `edge-cases-and-risks`
- `simplification-and-scope-control`
- `refactoring-opportunities`

Optional reviewers must come from the bundled reviewer catalog. Select
`docs-and-agent-alignment` for workflow, docs, skills, rules, automation prompt,
review rubric, or PR/MR description contract changes. Select
`agent-runtime-and-skill-compatibility` for skill metadata, scripts, adapter
prompts, install/update behavior, or runtime compatibility changes.

Use `scripts/plan-ready.ts reviewer-template` and validate the judge output with
`scripts/plan-ready.ts validate-selection`.

## Handoff Contract

Use `scripts/plan-ready.ts handoff-template` and validate with
`scripts/plan-ready.ts validate-handoff`.

```yaml
plan_coordinate_handoff:
  status: ready
  route: atomic_plan
  artifact:
    type: plan
    ref: .agents/plans/example.md
    fingerprint: <sha256 of artifact ref or current commit sha>
  approved_unit:
    id: atomic
    title: <short title>
    scope: <one paragraph>
    acceptance:
      - <observable result>
    verification:
      - <required command, check, or manual proof>
  constraints:
    files_or_areas:
      - <expected ownership area>
    out_of_scope:
      - <explicit non-goal>
  delivery:
    expected_host: github_pr | gitlab_mr | direct_publish
    completion_updates: []
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
  blockers: []
```

Legacy `slice_plan_review`, `reviewed_slices`,
`plan_ready_handoff`, `plan_followthrough_slice_handoff`, and
followthrough-ledger inputs are unsupported. Return `needs_plan_ready` and ask
the user to rerun `plan-ready`.

## Result Shape

For non-atomic work:

```yaml
plan_ready_result:
  status: needs_openspec
  artifact_type: plan | openspec | linear
  artifact_ref: <artifact>
  reason: <why this requires OpenSpec>
  recommended_next_action: Create or update an OpenSpec change.
```

For atomic work, emit `plan_coordinate_handoff` only in the final response. Do
not write readiness YAML into committed plan files, OpenSpec files, or Linear
comments by default.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Creating slices from an unsliced plan | Return `needs_openspec` |
| Maintaining a followthrough ledger | Use OpenSpec `tasks.md` for multi-step state |
| Accepting old handoff shapes | Return `needs_plan_ready` |
| Starting implementation after readiness | Stop and wait for `plan-coordinate` |
| Skipping baseline reviewers | Run all baseline reviewers before ready |

## Test Evidence

- RED: previous workflow duplicated OpenSpec through `slice_plan_review`,
  `reviewed_slices`, and followthrough ledgers.
- GREEN: new workflow routes atomic work to `plan_coordinate_handoff` and
  multi-deliverable work to OpenSpec.
