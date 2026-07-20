# Allow Groundwork Before Objective Proof

## Goal

Let an OpenSpec stack begin with one or two independently valuable groundwork
MRs when forcing the stack's first end-to-end outcome into MR 1 would create an
oversized or cross-cutting review unit.

The first observable outcome is that a delivery shape like Stat MR !101 is
replanned instead of concentrating discovery, UI, API, routing, contracts, CLI,
CI verification, documentation, and reconciled OpenSpec state in the root MR.
The resulting plan may put the stack's first real end-to-end confirmation in MR
3, provided MRs 1 and 2 each prove a locally complete groundwork outcome.

Proof location: run the `openspec-tasks audit` CLI entrypoint against focused
fixtures and observe a passing result for two groundwork delivery-unit headings
followed by objective proof in unit 3, plus `needs_spec_redesign` results for
proof after unit 3 and nested work items that impersonate final MRs.

## Motivation

The current workflow treats early stack-level objective proof as the primary
defense against speculative foundation work. In practice, that can make the
root MR absorb every layer needed to exercise the real path. The deterministic
OpenSpec audit also still evaluates objective-proof position across nested
checkboxes even though current policy maps top-level headings, not checkboxes,
to final MRs.

Stat MR !101 exposed both failures: its root diff carried most of the stack's
review surface, while its reconciled `tasks.md` described four final MRs as
nested work items under one delivery-unit heading. Task count and a proof marker
in the first checkbox did not represent the actual MR topology.

## Decisions

### Separate local unit proof from stack objective proof

Every final MR must own a locally complete, independently reviewable outcome
and proof. The stack-level objective proof is the first unit that exercises the
named capability through its real entrypoint and produces visible success or
failure evidence. Groundwork units do not claim that stack-level proof.

The preferred delivery shape still proves the stack objective in unit 1. Plan
may place one or two groundwork units first when each one:

- leaves the target branch safe and coherent if the remaining stack stops;
- simplifies or refactors a canonical owner, or adds only a required contract
  or boundary that a named successor directly consumes;
- has one local proof and a coherent reviewer, risk, rollback, and deployment
  boundary;
- reduces the size, coupling, or review risk of the first outcome MR; and
- avoids speculative abstractions, unused plumbing, activation, and unrelated
  product behavior.

The first stack-level objective proof must appear by top-level delivery unit 3.
A third pre-outcome groundwork unit blocks readiness and returns to Plan for
decomposition review.

### Make proposal delivery shape explicit

For multi-unit OpenSpec work, the proposal records a concise delivery-shape
table. Each unit identifies its kind (`groundwork`, `outcome`, or `hardening`),
local outcome, predecessor or enabled successor, local proof, and whether it
owns stack objective proof. When a POC, prior implementation, MR, or incident
provides real footprint evidence, the table also records affected ownership or
review domains and the evidence-backed split rationale. Size remains semantic
evidence rather than a universal threshold.

`tasks.md` must express the same topology: every final MR is one numbered
top-level heading and nested checkboxes remain cohesive work items. Proposal
count, task headings, tracker units when required, and intended stack order may
not contradict one another.

### Audit delivery units rather than nested work items

The deterministic objective-proof audit operates on parsed top-level delivery
units and their complete task-local text. It accepts objective proof in unit 1,
2, or 3 and rejects later or missing proof. Plan and `delivery-shape` Review,
using the proposal delivery table and repository evidence, decide whether any
preceding units are valid groundwork; the parser does not infer architecture
from keywords or add a task-tag schema. The audit keeps the explicit `Proof
location:` or `First real confirmation:` requirement for the stack objective
and continues to require a real entrypoint plus visible success or failure
evidence.

The audit rejects nested work items that declare themselves final PRs/MRs or
otherwise conflict with the top-level delivery-unit mapping. It returns a
structured `needs_spec_redesign` result to Plan instead of allowing execution
or publication to infer a different stack shape.

### Stress-test the root unit without adding a line cap

Plan and the `delivery-shape` planning reviewer inspect first-unit skew using
available implementation or POC evidence. A root unit that dominates the stack
or crosses materially different ownership, security, deployment, rollback, or
review seams is a semantic replanning trigger even when it contains valid early
objective proof. The reviewer also blocks groundwork that is speculative,
unsafe without successors, or broader than the outcome MR it is meant to
simplify.

### Keep POC checkpoints aligned with the accepted stack order

A complete disposable OpenSpec POC follows the reviewed delivery order. Its
first-objective-proof checkpoint may occur in unit 1, 2, or 3 after no more than
two valid groundwork units. The checkpoint behavior and targeted real-entrypoint
verification remain otherwise unchanged.

## Reuse And Deviation Contract

- Extend the existing delivery decomposition owner in `skills/plan`, the
  `delivery-shape` planning review lane, and the shared OpenSpec rules.
- Extend `skills/openspec-tasks` and its existing objective-proof analyzer
  rather than adding a second validator or planning artifact.
- Reuse the existing explicit proof-marker validation and structured
  `needs_spec_redesign` result.
- Deviate from the earlier proof-by-unit-2 rule because live Stat stack evidence
  shows that it can force several independent layers into the root MR.
- Add no OpenSpec schema extension, task tag system, universal diff threshold,
  automatic splitter, or planning-only MR.

End-to-end proof is a focused audit fixture with two groundwork headings
followed by an objective-proof heading. It passes, while proof after unit 3 and
nested final-MR declarations fail deterministically. Speculative groundwork and
an oversized first-unit planning fixture fail through their semantic Plan and
`delivery-shape` Review lanes.

## Scope

### In Scope

- Align brainstorming, Plan, Execute, Review, and shared OpenSpec rules with the
  accepted two-level proof model and maximum of two groundwork MRs.
- Move deterministic objective-proof position from nested work items to
  top-level delivery units.
- Add deterministic contradictory-topology detection for nested final-MR
  declarations.
- Strengthen proposal delivery-shape and first-unit stress-test guidance using
  actual POC or implementation footprint when available.
- Add focused regression coverage and apply `writing-skills` plus AI-readiness
  review to the changed shared behavior.

### Out Of Scope

- Replanning or modifying the active Stat stack.
- Adding hard file-count or changed-line limits.
- Automatically classifying or splitting arbitrary architecture from diff
  statistics.
- Adding OpenSpec schema fields, task tags, sidecars, or a second plan format.
- Refreshing the live AX runtime from this feature branch; live sync remains a
  post-merge action from the clean default-branch source.

## Implementation Tasks

### 1. Planning And Delivery Contract

- [ ] 1.1 Update shared planning and delivery guidance to distinguish local
      unit proof from stack objective proof, allow at most two justified
      groundwork units, require the proposal delivery-shape table, and
      stress-test root-unit concentration from real footprint evidence.

### 2. OpenSpec Audit Alignment

- [ ] 2.1 Make `openspec-tasks` analyze objective proof across top-level
      delivery units, accept proof by unit 3, and reject contradictory nested
      MR mappings while leaving groundwork validity to Plan and Review.

### 3. Regression And Readiness Coverage

- [ ] 3.1 Add focused fixtures and assertions for zero, one, and two groundwork
      units; late or invalid groundwork; unit-vs-checkbox proof position;
      contradictory topology; and the first-unit semantic stress test.

## Acceptance

- Planning may intentionally schedule one or two groundwork MRs before the
  first end-to-end stack outcome.
- Every groundwork MR is independently useful, locally proved, safely
  mergeable, and directly reduces or enables a named successor.
- The first stack objective proof appears no later than delivery unit 3.
- Objective proof after unit 3 or contradictory MR/task topology returns to
  Plan with deterministic `needs_spec_redesign`; speculative groundwork returns
  through the required semantic planning review.
- A valid proof marker in nested checkbox 1.1 cannot make a four-MR shape appear
  to prove the objective in MR 1.
- Planning Review uses real POC or implementation footprint to challenge an
  oversized first unit without applying a universal size threshold.
- The POC first-proof checkpoint follows the accepted delivery order through
  unit 3 while retaining its targeted exact-diff review requirements.

## Verification

- Focused OpenSpec task-audit unit tests cover the changed parser and objective
  proof behavior.
- Shared instruction and mode-lifecycle tests cover aligned Plan, Execute,
  Review, brainstorming, and rule contracts.
- First-objective-proof review retains the independently identified
  `code-simplifier`, `code-quality-review`, and `scrutinize` reviewer roles.
- Repository skill validation and the native pre-commit suite pass.
- `writing-skills` RED/GREEN evidence confirms current early-proof and topology
  loopholes fail before the change and the revised behavior closes them.
- AI-readiness review confirms every cheap deterministic portion of the new
  contract is enforced and leaves semantic architecture judgment in planning
  Review.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Groundwork becomes architecture-first busywork | Require current standalone value, local proof, a named consuming successor, and at most two pre-outcome units. |
| Objective proof drifts indefinitely | Block readiness when proof first appears after top-level unit 3. |
| A refactor silently changes behavior | Require a safe merged intermediate state and behavior-preservation proof for groundwork. |
| The audit confuses checkboxes with MRs | Analyze complete top-level units and reject nested final-MR declarations. |
| Diff statistics become a rigid workflow selector | Use footprint only as evidence in semantic Plan and Review decisions. |
| Shared prose drifts from executable behavior | Add focused parser, audit, instruction, and lifecycle regression tests. |

## Recommended Delivery

Deliver this atomic plan and its workflow implementation in one final draft MR.
It needs no OpenSpec or POC because it is one bounded correction to the shared
planning contract.
