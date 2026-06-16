---
name: plan-slices
description: Use when a plan needs implementation slices or when existing slices need audit before plan-ready, especially broad plans, foundation-heavy slices, stale slice reviews, missing verification, or unclear delivery fit.
---

# Plan Slices

## Overview

Turn plans into deliverable implementation slices before `plan-ready` emits a
handoff. This skill owns slice creation, slice audit, and the
`slice_plan_review` gate; it does not implement code or manage delivery state.

## When To Use

Use after a plan artifact exists and before `plan-ready` reviewer selection.
Use for large plans, existing sliced plans, single-slice plans, resumed plans
with changed content, or any plan where slice size, sequencing, verification, or
delivery fit is uncertain.

The v1 validator fingerprints local plan files. When planning starts from
OpenSpec, Linear, or a URL, first mirror the implementation plan into a local
plan artifact before emitting `slice_plan_review`.

Do not use for implementation, PR/MR creation, followthrough ledgers, hosted
review, or CI watching. `plan-followthrough` and `plan-to-pr` own delivery.

## Slice Gates

Every implementation slice must pass six gates:

| Gate | Requirement |
| --- | --- |
| Observable outcome | Names the real entrypoint, operation, and visible result. |
| Bounded scope | Has one primary ownership area and excludes unrelated cleanup. |
| Sequencing | Names prerequisites, dependencies, and later consumers. |
| Verification | Names the fastest durable verification layer and accepted gaps. |
| Refactoring / Reuse | Includes the `plan-ready` refactoring subsection or says `None`. |
| Delivery fit | Fits one `plan-to-pr` delivery loop without absorbing follow-up work. |

The first implementation slice has an extra pressure: it should be the first
end-to-end proof of the desired outcome. It may be manual, advisory,
fixture-backed, or happy-path-only, but it must run through the real entrypoint,
perform the real operation, and show a visible result. A foundation-only first
slice is blocked unless safety, data migration, compliance, or operational risk
makes a consumed foundation prerequisite unavoidable.

If a plan starts with package scaffolding, schemas, adapters, registries, config,
secret wiring, or runtime plumbing, fold the minimum version into the same slice
that consumes it for the first visible workflow. Otherwise move it after the
first proof or make it a later refactoring slice with a named consumer.

Single-slice plans are not exempt. Audit them in `mode: audit` and synthesize
`slice-01` when no stable slice ID exists.

## Workflow

1. Read the plan artifact.
2. Decide `mode: create` for unsliced plans or `mode: audit` for existing
   slices.
3. Create or revise slices so each one has a real outcome and bounded delivery
   surface.
   - For `slice-01`, explicitly verify that the first PR-sized delivery produces
     a narrow end-to-end sliver of the target outcome.
   - Do not pass `slice-01` when its result is only "foundation ready",
     "adapter ready", "runtime ready", or "configuration in place" and the
     first real workflow is deferred to another slice.
   - Feature flags, rollout variables, and optional enablement gates belong in a
     slice only when the plan names the safety, cost, compliance, or operational
     risk they mitigate.
4. Run `scripts/plan-slices.ts fingerprint <artifact-ref>`.
5. Emit `slice_plan_review` using `scripts/plan-slices.ts review-template`.
6. Validate it with `scripts/plan-slices.ts validate-review --file <file>`.
7. If validation fails or `status: blocked`, revise the plan and rerun the
   review.

Rerun this skill after any plan artifact edit from reviewer feedback or
`scrutinize`; stale fingerprints must not pass into `plan-ready`.

## Review Contract

```yaml
slice_plan_review:
  status: pass | blocked
  artifact_ref: docs/plans/example.md
  artifact_fingerprint: <sha256 of artifact_ref>
  mode: create | audit
  slices:
    - id: slice-01
      title: Example slice
      observable_outcome: pass | blocked
      bounded_scope: pass | blocked
      sequencing: pass | blocked
      verification: pass | blocked
      refactoring_reuse: pass | blocked
      delivery_fit: pass | blocked
  blocking_findings: []
  warnings: []
```

`status: pass` requires every slice gate to be `pass` and
`blocking_findings: []`. `status: blocked` requires concrete blocking findings
or at least one blocked slice gate.

When `plan-ready` consumes a passing review, every reviewed slice ID becomes
`plan_ready_handoff.reviewed_slices`; only `approved_slice` is selected for the
next delivery loop.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating a schema, adapter, or framework as the first slice outcome | Rewrite around the first real operation and visible result. |
| Passing a first slice whose only visible state is a new package, runtime, config variable, or generated artifact | Require the same PR to consume it in the smallest end-to-end workflow. |
| Deferring the first real user/system workflow to Slice 2 because Slice 1 feels like safe setup | Pull a manual, advisory, fixture-backed, or happy-path sliver into Slice 1. |
| Adding feature flags or rollout variables by default | Require a named safety, cost, compliance, or operational risk; otherwise use eligibility checks only. |
| Letting one slice include validation, runtime sync, docs, dashboard, hosted review, and future adapters | Split by current delivery outcome and defer future surfaces. |
| Reusing an older slice review after plan edits | Recompute the artifact fingerprint and emit a new review. |
| Exempting single-slice plans | Audit as `mode: audit` with `slice-01`. |
| Turning every future reuse idea into Slice 1 | Require a named current or later consumer. |

## Test Evidence

- RED: baseline subagent `019ec7a4-ba8d-7aa1-83c1-8e5b477353e1` turned a software-factory idea into foundation slices for artifact schemas, provider boundaries, dashboard exports, and metadata before proving the mandatory slice gate.
- RED: thread `019ec851-0d15-74e0-ab86-1f105de1c358` showed a first PR-review slice centered on runtime/package foundations while real hosted review behavior and enablement came later, so the first-slice gate now requires an early end-to-end sliver.
- GREEN control: baseline subagent `019ec7a5-1498-7732-bdf1-fd128bd5757a` rejected an obviously broad provider/dashboard slice using existing `plan-ready` and `scrutinize` rules, showing those rules help but do not provide the mandatory machine-checkable `slice_plan_review`.
- GREEN control: baseline subagent `019ec7a5-1540-78e1-bab2-e5f9920d15ba` rejected stale slice-review reuse when the changed slice bundled validator, runtime install, docs, dashboard, hosted review, and future adapters.
- REFACTOR: this skill codifies the missing mandatory review block, artifact fingerprint, single-slice audit rule, and six-gate rubric so `plan-ready` can enforce slice quality mechanically.
