# Make Simplification A Core Planning And Execution Reviewer

## Goal

Require one explicit findings-only simplification result at every planning and
implementation review boundary so unnecessary scope and code complexity are
challenged even when the request does not specifically ask for simplification.

The first real confirmation is a paired workflow regression:

- a stable planning artifact cannot complete Planning Review without a
  `code-simplifier` result against its exact fingerprint; and
- an OpenSpec POC cannot expand beyond first objective proof, and completed POC
  or final implementation Review cannot reach technical readiness, without a
  `code-simplifier` result against the exact target-base diff.

## Context

The current workflow contains simplification coverage but does not consistently
run the specialist:

- Planning Review requires a generic `simplification-and-scope` review type,
  while the `code-simplifier` skill accepts only completed-code diffs.
- Small planning or implementation targets may combine every review type into
  one integrated inline pass, so simplification can survive only as an asserted
  lens rather than an explicit specialist result.
- The POC first-objective-proof checkpoint explicitly requires only
  `code-quality-review` and `scrutinize` and excludes the other completed-code
  reviewers until the POC is complete.
- Completed POC and final implementation technical readiness already require
  `code-simplifier`, which is the canonical contract to extend rather than
  introducing another reviewer package.

This leaves a gap between the catalog saying simplification is covered and the
workflow proving that the simplification specialist actually ran. The change
closes that gap without adding a lifecycle mode, another durable review ledger,
or a second simplification abstraction.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Core reviewer | A mandatory findings-only specialist with its own recorded `passed`, `finding`, or `blocked` result at the applicable phase barrier. |
| Planning simplification | Removing unnecessary scope, delivery units, machinery, abstractions, or duplicate contracts while preserving the accepted outcome and durable decisions. |
| Implementation simplification | Removing avoidable branches, wrappers, nesting, duplication, or concepts while preserving every accepted success and failure behavior. |
| Explicit result | A separately identifiable review outcome; other review types may share an execution, but cannot stand in for simplification evidence. |
| First objective proof | The earliest POC slice that exercises the real entrypoint and exposes visible success or failure before the POC broadens. |

## Decisions

### Reuse `code-simplifier` as the single simplification owner

Extend the existing `code-simplifier` skill and reviewer contract to support
both planning artifacts and implementation diffs. Do not create a parallel
`plan-simplifier`, generic reviewer framework, or second simplification rubric.

For a planning target, the specialist starts from the exact artifact and its
fingerprint, then inspects repository precedent needed to challenge:

- unnecessary scope or delivery units;
- proposed machinery that an existing owner can absorb;
- duplicated contracts or sources of truth;
- setup or abstraction that does not contribute to the earliest objective
  proof; and
- complexity deferred from the plan into an unsafe or incoherent delivery
  shape.

Its recommendations must preserve the accepted behavior, architecture,
ownership, safety, migration, delivery, and acceptance contract. A proposed
change to one of those boundaries is a material contract question, not an
automatic simplification repair.

For an implementation target, preserve the existing exact-diff and
behavior-preserving code lens. Keep the specialist findings-only and return
results to Plan or the single Execute owner.

### Use one reviewer identity across planning and implementation

Replace the planning catalog ID `simplification-and-scope` with
`code-simplifier`. Give the shared reviewer contract targets of `planning`,
`poc`, and `final_implementation`, with evidence questions and pass/finding
criteria that cover both artifact and diff forms.

Keep planning-specific scope pressure inside that shared contract rather than
dropping it. The change is a consolidation of canonical ownership, not a
reduction in planning coverage.

### Require an explicit simplification outcome at each phase boundary

Planning Review, first-objective-proof Review, completed POC Review, and final
implementation Review each require exactly one current `code-simplifier`
outcome bound to the same exact artifact or diff identity as the phase.

Other planning or completed-code review types may still use an integrated
inline execution for a small coherent target. The simplification outcome may
also execute inline, but it must remain separately recorded and evidenced; a
`code-quality-review`, `scrutinize`, or generic integrated-review result cannot
substitute for it.

At POC first objective proof, add `code-simplifier` to the current baseline
beside `code-quality-review` and `scrutinize`. Require its own reviewer-run
identity in the deterministic expansion checkpoint so intentionally incomplete
code is simplified before additional concepts accumulate. Scope that pass to
the implemented first-proof diff; do not require the remaining completed-code
review types until the POC is complete.

### Preserve phase ownership and bounded repair

Review remains read-only. Planning simplification findings return to Plan;
implementation simplification findings return to the one Execute writer.
Reviewers never edit the target.

Planning repairs only durable contract gaps. Task-local implementation
considerations move to Execute without bloating the planning artifact.
Implementation repairs preserve accepted behavior; a finding that changes a
material contract returns to Plan.

Closure remains limited to enumerated findings and affected proof. A materially
changed artifact, target base, HEAD, contract, or review risk invalidates the
relevant simplification result under the existing discovery rules.

### Make fallback preserve coverage

Reviewer-model or delegated-worker unavailability may change execution routing
from delegated to inline or to another available reviewer model. It must not
remove the required `code-simplifier` outcome or weaken its contract. Report a
true inability to inspect the artifact or diff as `blocked`.

### Align every workflow source and regression surface

Update the canonical reviewer catalog, Plan, Execute, Review, shared rules,
portable and repo instructions, skill metadata where necessary, and focused
unit/integration assertions. Remove stale references that describe planning
simplification as a separate reviewer identity.

Run `writing-skills` against the changed agent behavior before committing.
Validate that the runtime-managed skill inventory still contains
`code-simplifier`; no dependency or runtime profile change should be needed.

## Delivery Shape

Deliver one atomic plan plus implementation in one final draft GitLab MR
targeting `main`. The plan and implementation form one change set. There is no
planning-only MR, OpenSpec, POC, migration, deployment, or new dependency.

The implementation is one cohesive unit because the skill contract, reviewer
catalog, deterministic checkpoint, shared guidance, and regression tests must
change together to make the mandatory reviewer behavior truthful.

## Scope

### In Scope

- Extend `skills/code-simplifier` for planning artifacts and implementation
  diffs.
- Replace `simplification-and-scope` with `code-simplifier` in the planning
  reviewer catalog and guidance.
- Require a separately recorded simplification result for Planning Review.
- Add `code-simplifier` to the POC first-objective-proof baseline and expansion
  validator.
- Preserve the existing completed POC and final implementation requirement.
- Define available-model or inline fallback without reducing coverage.
- Update repo and portable instructions/rules that enumerate phase reviewers.
- Add focused unit and integration regressions for catalog selection, target
  compatibility, missing-result rejection, and first-proof expansion.
- Run repository-native skill, formatting, type, unit, integration, and AX
  validation selected by the changed surfaces and native pre-commit hook.
- Run `writing-skills` because shared skill and agent behavior changes.

### Out Of Scope

- Adding a sixth lifecycle mode or a generic review orchestration framework.
- Requiring distinct agents for every non-simplification review type.
- Changing accepted product behavior, implementation architecture, or delivery
  semantics outside the reviewer workflow.
- Reintroducing planning-only MRs, committed review ledgers, or sidecars.
- Changing hosted reviewer policy, merge authority, deployment, or cleanup.
- Editing the external MR whose status message exposed this workflow gap.
- Adding, updating, or removing dependencies.

## Acceptance And Proof

- `requiredReviewTypesFor("planning")` includes `code-simplifier` and no longer
  includes `simplification-and-scope`.
- The `code-simplifier` reviewer contract accepts `planning`, `poc`, and
  `final_implementation` targets and defines phase-appropriate evidence.
- Planning guidance and tests require one explicit simplification result bound
  to the exact artifact fingerprint.
- `firstObjectiveProofBaseline` and the POC expansion validator require
  `code-simplifier`, `code-quality-review`, and `scrutinize` with separate
  non-empty reviewer-run identities.
- Completed POC and final implementation readiness continue to reject a missing
  or stale `code-simplifier` result.
- Inline or model-fallback execution still emits the required simplification
  result instead of dropping the reviewer.
- No live runtime, provider, external MR, dependency, or unrelated workflow
  state changes before merge.
- Focused unit and integration tests pass, shared-skill validation passes,
  `writing-skills` reports no unresolved behavior-quality finding, and the
  native pre-commit suite is hook-clean before draft publication.

## Risks And Controls

- **Planning and code simplification become conflated.** Keep distinct target
  lenses under one canonical specialist and require behavior/contract
  preservation in both.
- **The extra first-proof reviewer slows POCs.** Run independent reviewers
  concurrently when capacity permits and preserve inline fallback; do not make
  coverage optional.
- **Renaming the planning review ID breaks stale consumers.** Search all source,
  tests, generated contracts, and managed runtime references; update the owning
  catalog and regression surfaces together.
- **Integrated review still masks the specialist.** Validate a separate result
  record even when execution routing is shared.
- **Planning findings inflate artifacts with implementation mechanics.** Keep
  the existing Planning Artifact Boundary and pass mechanics task-locally to
  Execute.

## Reuse And Deviation Contract

- Reuse `skills/code-simplifier/SKILL.md` as the findings-only simplification
  owner.
- Extend `skills/review/scripts/review-contract.ts` as the canonical reviewer
  catalog and target-selection owner.
- Extend `skills/execute/scripts/execution-contract.ts` as the canonical POC
  first-proof expansion gate.
- Reuse existing exact artifact/diff identity, phase-barrier, findings-batch,
  closure, and technical-readiness contracts.
- Deviate from the current integrated-review allowance only by requiring
  simplification to retain its own recorded outcome; do not require dedicated
  execution identities for every other type.
- Introduce no new persistent mechanism. The end-to-end proof is deterministic
  rejection of planning, POC expansion, and technical-readiness fixtures when
  the current simplification outcome is absent or stale.
