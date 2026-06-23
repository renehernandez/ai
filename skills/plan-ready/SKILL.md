---
name: plan-ready
description: Use when an idea, feature request, plan file, OpenSpec change, Linear ticket, or fuzzy implementation goal must become implementation-ready before coding begins.
---

# Plan Ready

## Overview

Route planning input to the right delivery path before implementation starts.
`plan-ready` decides whether the work is atomic enough for one delivery loop or
needs a reviewed OpenSpec Blueprint.

## When To Use

Use for ideas, feature requests, implementation plans, OpenSpec changes before
delivery, Linear tickets, and any request that needs readiness validation before
`plan-orchestrator` continues into planning review and implementation
sequencing.

Do not use after implementation has started. Do not create synthetic slices,
slice reviews, followthrough ledgers, or OpenSpec files directly.

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
5. Run reviewer selection, plan reviewers, and final scrutiny.
6. If the work is atomic, emit a validated `plan_delivery_handoff`.
7. If the work is multi-deliverable, emit a validated `openspec_blueprint`.
8. If missing decisions make either output unsafe, emit `blocked_readiness`.
9. Stop. Do not invoke `plan-orchestrator`, `plan-unit-sequencer`, `plan-unit-delivery`, create branches, push,
   open PRs/MRs, request hosted review, or write OpenSpec files directly.

Readiness is not terminal completion. It is not terminal success for
`plan-orchestrator`. When `plan-ready` is invoked as part of
`plan-orchestrator`, a successful `plan_delivery_handoff` or
`openspec_blueprint` only authorizes planning review and later sequencing. The
orchestrator terminal states remain `stack_ready` for a fully reviewed
implementation stack and `delivery_blocked` when required evidence or routing
is missing.

## Reviewer Selection

Baseline reviewers always run:

- `implementation-readiness`
- `edge-cases-and-risks`
- `simplification-and-scope-control`
- `refactoring-opportunities`

Optional reviewers must come from the bundled reviewer catalog. Select
`docs-and-agent-alignment` for workflow, docs, skills, rules, automation prompt,
review rubric, or PR/MR description contract changes. Select
`ax-and-skill-compatibility` for skill metadata, scripts, adapter
prompts, install/update behavior, or runtime compatibility changes.

Use `scripts/plan-ready.ts reviewer-template` and validate the judge output with
`scripts/plan-ready.ts validate-selection`.

Reviewer execution is part of the `plan-ready` workflow. Once this skill is
invoked, launch the selected reviewers as internal subagents in the current
harness; do not ask for separate confirmation. If internal subagents are
unavailable, emit `blocked_readiness` with the specific missing capability.

## Atomic Handoff Contract

Use `scripts/plan-ready.ts handoff-template` and validate with
`scripts/plan-ready.ts validate-handoff`.

```yaml
plan_delivery_handoff:
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
    expected_host: github_pr | gitlab_mr
    completion_updates: []
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
    reviewer_evidence:
      artifact_fingerprint: <sha256 of artifact ref or current commit sha>
      completed_at: <ISO-8601 timestamp>
      gate_outcome: passed
      baseline_reviewers:
        - implementation-readiness
        - edge-cases-and-risks
        - simplification-and-scope-control
        - refactoring-opportunities
      selected_dynamic_reviewers: []
      per_reviewer_status:
        implementation-readiness: passed
        edge-cases-and-risks: passed
        simplification-and-scope-control: passed
        refactoring-opportunities: passed
      skipped_reviewers: []
      skipped_rationale: []
      blocking_findings: []
  blockers: []
```

## OpenSpec Blueprint Contract

Use `scripts/plan-ready.ts blueprint-template` and validate with
`scripts/plan-ready.ts validate-blueprint`.

```yaml
openspec_blueprint:
  status: ready_for_openspec
  source_plan:
    ref: .agents/plans/example.md
    change_id: <verb-noun-change-id>
  change:
    suggested_id: <verb-noun-change-id>
    title: <OpenSpec change title>
    objective: <one paragraph objective>
  scope:
    in:
      - <included outcome>
    out:
      - <explicit non-goal>
  specs:
    affected_or_new:
      - <existing capability or new spec area>
    proposed_requirements:
      - <requirement summary for OpenSpec spec delta>
  tasks:
    - id: "1.1"
      title: <minor deliverable title>
      deliverable: <PR/MR-sized outcome>
      acceptance:
        - <observable result>
      verification:
        - <required command, check, or manual proof>
      dependencies: []
  recommended_first_task: "1.1"
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
    reviewers_used:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    reviewer_evidence:
      artifact_fingerprint: <sha256 of source plan or reviewed artifact>
      completed_at: <ISO-8601 timestamp>
      gate_outcome: passed
      baseline_reviewers:
        - implementation-readiness
        - edge-cases-and-risks
        - simplification-and-scope-control
        - refactoring-opportunities
      selected_dynamic_reviewers: []
      per_reviewer_status:
        implementation-readiness: passed
        edge-cases-and-risks: passed
        simplification-and-scope-control: passed
        refactoring-opportunities: passed
      skipped_reviewers: []
      skipped_rationale: []
      blocking_findings: []
    findings:
      - <review finding that shaped the blueprint>
  risks:
    - <risk or rollout concern>
  blockers: []
  next_action: create_openspec_change
```

The blueprint is the successful complex-plan output. It should make OpenSpec
creation mostly mechanical: `proposal.md` takes the objective and scope,
`tasks.md` takes the reviewed deliverables, spec deltas take proposed
requirements, and `design.md` captures tradeoffs when needed. When the
blueprint comes from a `.agents/plans/**` artifact, `source_plan.ref` and
`source_plan.change_id` are the machine-readable cleanup authority that
`plan-orchestrator` must pass as `--expected-source-plan` and
`--expected-change-id` during source-plan cleanup.

For `openspec_blueprint.review`, keep `required_reviewers` as the baseline
reviewers required for readiness, put selected catalog reviewers in
`optional_reviewers`, mirror selected catalog reviewers in
`reviewer_evidence.selected_dynamic_reviewers`, and preserve `reviewers_used`
plus `findings` as the review execution summary. The `reviewer_evidence`
object is mandatory for both atomic handoffs and OpenSpec blueprints: it records
baseline reviewers, selected dynamic reviewers, per-reviewer status, artifact
fingerprint, skipped reviewer rationale, blocking findings, completion
timestamp, and gate outcome. Downstream skills must consume this evidence
explicitly instead of recomputing reviewer lists.

Legacy `slice_plan_review`, `reviewed_slices`,
`plan_ready_handoff`, `plan_followthrough_slice_handoff`, and
followthrough-ledger inputs are unsupported. Return `needs_plan_ready` and ask
the user to rerun `plan-ready`.

## Result Shape

For atomic work, emit a concise `## Readable Summary` followed by the
validated `plan_delivery_handoff` YAML. For complex work, emit a concise
`## Readable Summary` followed by the validated `openspec_blueprint` YAML.
For blocked work, emit a concise `## Readable Summary` followed by
`blocked_readiness` YAML.

The readable summary is for thread scanning, especially on mobile. Keep it to
3-6 bullets with status, route, artifact, approved unit or first task, next
action, and blockers if any. Do not replace the YAML; the YAML remains the
machine-readable contract.

```yaml
blocked_readiness:
  status: blocked
  reason: <missing decision or unsafe ambiguity>
  required_input:
    - <specific answer needed>
```

Do not write readiness YAML into committed plan files, OpenSpec files, or
Linear comments by default.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Failing hard for complex work | Produce a reviewed `openspec_blueprint` |
| Writing OpenSpec files in PlanReady | Stop at `openspec_blueprint` |
| Maintaining a followthrough ledger | Use OpenSpec `tasks.md` for multi-step state |
| Accepting old handoff shapes | Return `needs_plan_ready` |
| Starting implementation after readiness | Stop and wait for `plan-orchestrator` |
| Treating readiness as orchestrator completion | Continue through planning review and stacked delivery until `stack_ready` or `delivery_blocked` |
| Skipping baseline reviewers | Run all baseline reviewers before ready |
| Returning YAML without a readable thread summary | Add `## Readable Summary` before the YAML |

## Test Evidence

- RED: previous workflow duplicated OpenSpec through `slice_plan_review`,
  `reviewed_slices`, and followthrough ledgers.
- GREEN: new workflow routes atomic work to `plan_delivery_handoff` and
  multi-deliverable work to a validated `openspec_blueprint`.
