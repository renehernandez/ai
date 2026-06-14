---
name: plan-ready
description: Use when an idea, feature request, plan file, OpenSpec change, Linear ticket, or fuzzy implementation goal must become an implementation-ready plan before coding begins.
---

# Plan Ready

## Overview

Turn planning input into a reviewed implementation handoff. This skill owns brainstorming, plan hardening, same-harness subagent review, and final plan scrutiny. It stops before implementation so the user can verify the plan.

## When To Use

Use for ideas, feature requests, implementation plans that still need review, OpenSpec changes before apply, Linear tickets that need implementation planning, or any request that should be validated before `plan-followthrough`.

Do not use for implementation after the handoff is ready. Use `plan-followthrough` for the followthrough phase; it will route each implementation slice through `plan-to-pr`.

## Progress Output

Announce each helper step before it starts:

- `Using $session-start to inspect live repo and planning-artifact context.`
- `Using $brainstorming to settle scope before plan review.`
- `Using $plan-slices to create or audit implementation slices before readiness.`
- `Using the plan-ready reviewer-selection judge to choose optional reviewer lenses.`
- `Using internal Codex subagents to run required plan reviewers.`
- `Using $scrutinize on the final plan before handoff.`

After each gate, report one line with the gate, verdict, artifact, and next action.

## Workflow

1. Run the bundled script `scripts/plan-ready.ts detect <artifact-ref-if-known>` from this skill directory to inspect repo and planning-artifact hints.
2. Use `session-start` to verify live repo, branch, dirty state, and relevant planning files.
3. Clarify scope with `brainstorming` when the request is not already implementation-ready.
4. Create or update the authoritative planning artifact:
   - plan file in the project's established plan location;
   - OpenSpec change through the project's OpenSpec workflow;
   - Linear ticket or linked plan context.
5. Run `plan-slices` against the authoritative artifact before reviewer selection:
   - use `mode: create` when slices are missing;
   - use `mode: audit` when slices already exist, including single-slice plans;
   - use a local plan file artifact for the mandatory fingerprinted v1 gate;
   - validate the emitted `slice_plan_review` with `scripts/plan-slices.ts validate-review`.
6. Run the bundled script `scripts/plan-ready.ts reviewer-template`, make the reviewer-selection judge decision from that exact catalog, and validate the judge output with `scripts/plan-ready.ts validate-selection`.
7. Run all baseline reviewers plus judge-selected optional reviewers as internal subagents in the current harness.
   - In Codex, use the internal Codex subagent tool exposed by the current harness and omit model overrides unless the user explicitly asks for one.
   - Do not invoke the `dispatch` skill, Claude Code `Task`, or any external Claude harness for plan reviewers from Codex.
   - Give each reviewer one bounded prompt, the reviewer name, the planning artifact, and the Reviewer Output Contract below.
8. Resolve every blocking finding:
   - `agent_fixable`: update the planning artifact and rerun affected reviewers.
   - `user_decision`: ask one focused question and incorporate the answer.
   - `external_blocker`: record the blocker and do not emit `status: ready` unless the blocker is resolved or the user explicitly accepts the risk.
9. Rerun `plan-slices` after any planning-artifact edit from reviewer feedback or `scrutinize`; stale artifact fingerprints must not pass.
10. Run `scrutinize` on the final plan. The handoff requires `Scrutinize verdict: ship`.
11. Generate the handoff with `scripts/plan-ready.ts handoff-template`, fill it with the current passing `slice_plan_review`, and validate it with `validate-handoff`.
12. Stop. Do not invoke `plan-followthrough` or `plan-to-pr`, start implementation, create branches, push, open PRs/MRs, or request hosted review.

## Reviewer Selection

Baseline reviewers always run:

- `implementation-readiness`
- `edge-cases-and-risks`
- `simplification-and-scope-control`
- `refactoring-opportunities`

### Refactoring Opportunities Reviewer

`refactoring-opportunities` is a required baseline reviewer. It must look for
the small structural moves that make the current slice easier and later slices
cheaper, following the rule: make the change easy, then make the easy change.

This reviewer is constructive, not only defensive. It should identify
preparatory refactors, reusable components, helpers, services, policies, schema
helpers, or test utilities that should be extracted in an earlier slice and
consumed by the current or later named slices. It must reject speculative
abstractions that do not have a named consumer.

It may block readiness when either:

- the current slice is harder or riskier because a small preparatory refactor is
  missing;
- a later named slice clearly needs the same surface, and extraction is cheaper
  now because the current slice already touches the right boundary;
- the plan proposes a reusable abstraction without naming current or later
  consumers;
- a required extraction lacks behavior-preserving verification.

It should treat plausible but unnamed future reuse, style-only cleanup, broad
platform work, or extractions that cross unrelated ownership boundaries as
nonblocking or deferred.

### Refactor Scope Gate

Refactoring suggestions must be classified before readiness can pass:

- **Minor in-slice refactor:** local, behavior-preserving, already inside the
  approved files or boundary, and does not change acceptance criteria,
  sequencing, ownership, or verification scope. Keep it inside the current
  slice.
- **Significant refactor:** adds or reorders a slice, creates a new package or
  module boundary, changes a public contract or data model, establishes a shared
  abstraction for future slices, rewires broad existing callers, or changes
  ownership boundaries. Extract it as a proposed refactoring slice.

When `refactoring-opportunities` finds a significant refactor, it must return a
blocking finding and add a `significant_refactor_suggestions` entry. Plan
readiness stays blocked after adding or moving that refactoring slice until
brainstorming and plan review run again to confirm value, placement, acceptance
criteria, and verification. The significant refactor must not be absorbed into
the same product slice just because plan review discovered it.

The reviewer-selection judge may select optional reviewers only from this catalog:

- `security-and-auth`: auth, authorization, secrets, token handling, sensitive data, webhooks, dependency trust.
- `data-migration-and-backfill`: schema changes, data corrections, reprocessing, idempotency, rollback, irreversible writes.
- `ci-and-release-impact`: CI config, package publishing, deployment, release automation, branch protection, required checks.
- `frontend-ux-accessibility`: UI flows, responsive layout, accessibility, visual verification, interaction states.
- `infra-and-cloud`: Terraform, Kubernetes, Cloudflare, AWS, DNS, queues, storage, environment config.
- `docs-and-agent-alignment`: docs, agent instructions, skill/rule updates, automation prompts, background-review rubrics, PR description expectations.
- `performance-and-scale`: hot paths, concurrency, caching, queues, rate limits, batch behavior, operational limits.
- `agent-runtime-and-skill-compatibility`: Codex skill structure, `SKILL.md` conventions, `agents/openai.yaml`, install/update paths, bundled scripts, same-harness subagent routing, runtime compatibility.

Selection rules:

- Select `docs-and-agent-alignment` for changes to reusable workflows, docs, skills, rules, automation prompts, background review expectations, or PR/MR description contracts.
- Select `agent-runtime-and-skill-compatibility` for changes to skill folder structure, skill metadata, bundled scripts, Codex adapter files, same-harness subagent routing, install/update behavior, or agent runtime behavior.
- Select only from the optional catalog. Do not invent reviewer names.
- Return `baseline_sufficient` only after explaining why no optional catalog reviewer is needed.

The main agent may not remove baseline reviewers or judge-selected reviewers. It may add another optional reviewer only when it records a reason.

## Reviewer Output Contract

Each reviewer must return:

```yaml
reviewer: <name>
verdict: pass | findings | blocked
blocking_findings:
  - title: <short title>
    class: agent_fixable | user_decision | external_blocker
    evidence: <concrete evidence>
    required_change: <change required before readiness>
nonblocking_findings:
  - title: <short title>
    evidence: <concrete evidence>
    suggestion: <optional change>
summary: <one paragraph>
```

`refactoring-opportunities` must also include:

```yaml
make_change_easy:
  - opportunity: <preparatory refactor>
    why_now: <current slice risk or later-slice dependency>
    first_consumer: <current slice or named later slice>
    later_consumers:
      - <named slice or workflow>
    verification: <fastest behavior-preserving verification>
reuse_across_slices:
  - reusable_surface: <component, helper, service, policy, schema helper, or test utility>
    extract_in_slice: <slice name>
    consumed_by:
      - <named slice or workflow>
    avoid_if: <condition where this becomes premature>
refactor_scope_gate:
  minor_in_slice_allowed:
    - <local behavior-preserving refactor that does not change slice scope>
  significant_refactor_suggestions:
    - title: <separate refactoring slice or none>
      placement: before_slice | after_slice | later_backlog
      relative_to_slice: <slice id or title>
      why_significant: <boundary, contract, data model, broad caller, or sequencing impact>
      readiness_effect: blocks_plan_ready
      required_next_step: rerun_brainstorming_and_plan_review
```

Plan readiness requires no unresolved blocking findings.

## Implementation Slice Plan Shape

For implementation-slice plans, every slice should include a short
`Refactoring / Reuse` subsection:

```md
### Refactoring / Reuse

- Preparatory refactor:
- Reusable surface:
- First consumer:
- Later consumers:
- Behavior-preserving verification:
- Why this is not premature:
```

The section can explicitly say `None` when no refactoring opportunity is
justified. It should not be omitted.

## Handoff Contract

The final response must include one fenced YAML block:

```yaml
slice_plan_review:
  status: pass
  artifact_ref: docs/plans/example.md
  artifact_fingerprint: <sha256 of artifact_ref>
  mode: audit
  slices:
    - id: slice-01
      title: Example slice
      observable_outcome: pass
      bounded_scope: pass
      sequencing: pass
      verification: pass
      refactoring_reuse: pass
      delivery_fit: pass
  blocking_findings: []
  warnings: []

plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: docs/plans/example.md
  reviewed_slices:
    - slice-01
  approved_slice: "Implement the first reviewed slice."
  required_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
    - refactoring-opportunities
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
```

Do not write this handoff into committed plan files, OpenSpec files, or Linear comments by default. It is session handoff state, not reviewable product documentation.

`reviewed_slices` records every slice that passed upfront slice-plan review.
`approved_slice` names the next implementation slice selected for delivery.
Do not use `reviewed_slices` as permission to implement every slice in one
delivery loop.

`validate-handoff` requires `slice_plan_review.status: pass`, matching
`artifact_ref`, `reviewed_slices` that exactly match the reviewed slice IDs, no
blocking findings, and an artifact fingerprint that matches the current file
content. The v1 machine-checkable slice gate supports local plan file artifacts;
OpenSpec and Linear inputs must be represented by a local plan artifact before
this handoff validator can pass.

## Artifact Modes

| Mode | Requirement |
| --- | --- |
| Plan file | Update the plan file, but keep readiness state out of the file |
| OpenSpec | Use OpenSpec proposal/spec/design/tasks workflow and run `openspec validate <change-id> --strict --no-interactive`; mirror the ready implementation plan into a local plan artifact before `slice_plan_review` validation |
| Linear | Use the ticket as planning input; do not post the full handoff as a comment unless the user asks; mirror the ready implementation plan into a local plan artifact before `slice_plan_review` validation |

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Artifact intake | Planning artifact is identified or created |
| Brainstorming | Scope, constraints, and success criteria are clear |
| Slice plan review | `plan-slices` emits a current passing `slice_plan_review` for the artifact |
| Reviewer selection | Judge output validates and uses only the fixed optional reviewer catalog |
| Internal subagent review | Baseline reviewers and selected optional reviewers return verdicts |
| Feedback resolution | No blocking reviewer findings remain unresolved |
| Plan scrutiny | `scrutinize` verdict is `ship` |
| Handoff validation | `validate-handoff` passes |

## Mistakes

| Mistake | Fix |
| --- | --- |
| Starting implementation after a ready verdict | Stop and ask the user to invoke `plan-followthrough` |
| Treating reviewer subagents as optional | Always run baseline reviewers |
| Routing Codex plan reviewers through `dispatch` or Claude | Use the current harness's internal Codex subagent tool |
| Inventing optional reviewer names | Select only from the fixed catalog |
| Skipping `docs-and-agent-alignment` for skill/rule/workflow changes | Add that optional reviewer |
| Skipping `agent-runtime-and-skill-compatibility` for skill metadata, script, or runtime changes | Add that optional reviewer |
| Hiding blocking findings in summary prose | Classify each blocker as `agent_fixable`, `user_decision`, or `external_blocker` |
| Writing readiness YAML into committed artifacts | Emit the handoff in the final session response only |
| Treating refactoring as optional polish | Run `refactoring-opportunities` as a baseline reviewer and resolve blockers |
| Absorbing a significant refactor into the current product slice | Add it as a proposed refactoring slice, block readiness, and rerun brainstorming plus plan review |
| Treating single-slice plans as exempt from slice review | Run `plan-slices` in `mode: audit` and synthesize `slice-01` if needed |
| Reusing a slice review after plan edits | Recompute the artifact fingerprint and validate a new `slice_plan_review` |
| Passing a Linear key, URL, or OpenSpec ID as `slice_plan_review.artifact_ref` | Use a local plan file artifact for the v1 fingerprinted gate |
| Treating `reviewed_slices` as approval to implement every slice at once | Implement only `approved_slice`; use `reviewed_slices` as upfront slice-plan evidence |

## Test Evidence

- RED: prior `plan-to-pr` flow mixed brainstorming, plan review, implementation, hosted review, and CI into one workflow.
- GREEN: this skill creates a separate plan-readiness phase with required internal subagent review, final scrutiny, and a validated handoff.
- REFACTOR: the skill stops before implementation so the user can verify the ready plan before `plan-followthrough` runs.
- RED/GREEN: pressure testing found optional reviewer selection was too implicit for skill/runtime changes; selection rules and `validate-selection` now require fixed-catalog reviewer output.
- REFACTOR: `refactoring-opportunities` is now a required baseline reviewer so every slice is checked for make-the-change-easy prep work, cross-slice reuse opportunities, and premature abstractions.
- REFACTOR: ready plans now route to `plan-followthrough` before `plan-to-pr` so every single-slice or multi-slice plan has durable followthrough state.
- RED: baseline subagent `019eb39e-5890-76c0-a967-f287d449de7a` inspected committed pre-edit files and failed as expected. It cited `Using dispatch to run required plan reviewers.`, `Dispatch all baseline reviewers plus judge-selected optional reviewers as subagents.`, and adapter text `run required dispatch plan reviewers`, rationalizing that explicit `dispatch` would route Codex reviewer execution away from internal Codex subagents.
- GREEN/REFACTOR: subagent `019eb361-1adb-7771-a77a-388b11dc4b8b` passed after the first routing patch. The workflow now requires the current harness's internal Codex subagent tool and forbids `dispatch`, Claude Code `Task`, and external Claude harnesses.
- RED: thread `019ec3c6-27cd-7962-9c30-313332a857d0` showed slice delivery dragging when significant refactors, reviewer churn, docs, hardening, and implementation all stayed inside one in-flight slice.
- GREEN/REFACTOR: significant refactors found during plan-ready now become separate proposed slices and block readiness until brainstorming and plan review confirm their value and sequence.
- Validation evidence: `pnpm exec node --import tsx --test tests/unit/plan-ready-script.test.ts` returned passing tests for reviewer selection, handoff validation, and handoff template generation.
- RED/GREEN: `validate-handoff` now rejects missing, blocked, mismatched, or stale `slice_plan_review` blocks before emitting `status: ready`.
- REFACTOR: slice creation and audit live in `plan-slices`; `plan-ready` owns the readiness gate and validates the slice review against the same artifact.
- REFACTOR: `reviewed_slices` now records all upfront-reviewed slice IDs while `approved_slice` remains the single selected delivery slice.
