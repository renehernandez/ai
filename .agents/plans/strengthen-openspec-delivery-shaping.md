# Strengthen OpenSpec Delivery Shaping

## Goal

Prevent provisional OpenSpec delivery units from becoming the final execution
seed until post-POC planning review proves that every unit matches the accepted
POC's actual ownership, review, activation, security, rollback, deployment, and
proof boundaries. Preserve the existing user-throughput contract by performing
this work inside the existing post-POC reconciliation and planning-review
barrier rather than adding a new serial phase. [confidence: 0.99 - certain |
reason: Rene accepted this problem framing and enforcement direction]

## Problem

The current workflow describes strong semantic delivery-shape criteria, but its
enforced planning checkpoint accepts a generic `delivery-shape` pass without
unit-level evidence. `openspec-tasks` correctly validates structural task shape,
topology, and objective-proof position, but it cannot establish semantic MR
cohesion. A structurally valid breakdown can therefore freeze into the final
execution seed even when the completed POC shows that later units cross
independent ownership, security, activation, rollback, deployment, or reviewer
boundaries. [confidence: 0.98 - certain | reason: current Plan, Review,
review-contract, and openspec-tasks behavior was inspected directly]

This creates false readiness. Final implementation can efficiently schedule
the wrong units, after which the user must identify oversized or cross-domain
MRs and the workflow must rebuild branches, restack descendants, and repeat
validation and review. That reduces accepted correct changes per unit of human
attention and increases both time to the first useful checkpoint and total
user-visible completion latency. [confidence: 0.98 - certain | reason: the Stat
CLI bootstrap stack reproduced this failure after two shaping passes]

## Accepted Decisions

- Treat the pre-POC OpenSpec topology as provisional and the post-POC
  reconciliation as the authoritative final-topology gate. [confidence: 0.99 -
  certain]
- Run the stronger delivery-shape assessment concurrently with the existing
  planning reviewers at the existing post-POC review barrier. Add no lifecycle
  phase, persistent ledger, or recurring user approval. [confidence: 0.99 -
  certain]
- Extend the existing `delivery-shape` planning-review result with structured,
  fingerprint-bound evidence rather than introducing a new reviewer or
  workflow owner. [confidence: 0.98 - certain]
- Assess every proposed final unit, not only the root unit. Require complete
  coverage of the accepted POC footprint and reject unassigned material work.
  [confidence: 0.99 - certain]
- Keep `openspec-tasks` structural. It continues to expose and validate unit
  identity, task shape, topology, and proof position without attempting to
  infer architecture from filenames or prose. [confidence: 0.98 - certain]
- Return to the user only when post-POC reconciliation materially changes the
  accepted top-level topology or introduces unproved behavior. Contract-
  preserving evidence and validator repairs remain automatic. [confidence:
  0.98 - certain]
- Preserve the fast path for atomic plans and small coherent work. This gate
  applies to OpenSpec post-POC reconciliation, where actual implementation
  evidence exists. [confidence: 0.99 - certain]

## Reuse And Deviation Contract

Reuse the current lifecycle owners:

- `skills/plan/SKILL.md` owns provisional topology, POC reconciliation, final
  delivery decomposition, and the execution seed.
- `skills/review/SKILL.md` and the existing `delivery-shape` catalog entry own
  semantic cohesion review.
- `skills/review/scripts/review-contract.ts` owns the fingerprint-bound
  planning checkpoint and implementation-handoff validation.
- `skills/openspec-tasks` owns structural task and topology auditing.
- `rules/investigation-and-implementation.md`, `rules/docs-and-specs.md`, and
  `rules/testing-and-verification.md` remain the canonical portable policy
  surfaces.

Extend these owners directly. Do not add a POC classifier, delivery-shape
sidecar, committed evidence ledger, persistent scheduler, new lifecycle mode,
or second planning representation. The material deviation from current
behavior is that a generic empty `delivery-shape` pass is no longer sufficient
after a POC; it must carry complete per-unit evidence tied to the accepted POC
and reviewed OpenSpec. [confidence: 0.97 - certain]

## Structured Delivery-Shape Evidence

Keep the existing planning-checkpoint owner and fast path. Require its expected
context to discriminate `post_poc` from `atomic_or_pre_poc`. The `post_poc`
variant contains an accepted-POC snapshot with its head, authoritative material
footprint IDs and fingerprint, provisional and final unit IDs, an explicit
material-change determination independent of unit IDs, and whether the user
accepted that change. The `atomic_or_pre_poc` variant is the only path without
delivery-shape evidence. The result's existing `artifactFingerprint` remains
the sole reconciled-OpenSpec fingerprint owner. [confidence: 0.97 - certain]

The existing planning Review barrier serializes the checkpoint and expected
lifecycle context task-locally and runs Review's portable validation command.
Only a passing command may hand the execution seed to Execute; this adds no
phase or durable evidence artifact. [confidence: 0.97 - certain]

The delivery-shape evidence records:

- the accepted POC head and footprint fingerprint;
- provisional and final delivery-unit IDs;
- one assessment for every final unit;
- observed ownership and reviewer domains;
- local outcome, safe-stop state, and local proof;
- security, activation, rollback, and deployment seams;
- strongest plausible split and why it was rejected;
- strongest plausible merge and why it was rejected;
- predecessor output and integration hotspots;
- domain-level POC footprint entries, each assigned to one owning unit or
  explicitly identified as a cross-unit integration hotspot; and
- an assessment status of `passed`, `split_required`, or `merge_required`.

The planning checkpoint blocks implementation handoff when evidence is absent
or stale, assessed unit IDs do not match the final topology, any unit requires a
split or merge, material POC footprint is unassigned, or a material topology
change lacks user acceptance. Evidence remains task-local; only durable final
topology decisions and concise split rationale belong in the reconciled
OpenSpec. [confidence: 0.96 - certain]

Coverage is complete only when every footprint entry names its evidence and
either one owning final unit or the final units participating in a declared
integration hotspot, every referenced unit exists in the final topology, the
evidence exactly covers the authoritative material footprint identifiers and
fingerprint from the accepted-POC context. Duplicate unit assessments,
duplicate unit IDs, empty required evidence, and unknown unit references also
block handoff. [confidence: 0.96 - certain]

## Delivery Shape

Deliver this workflow correction as one atomic plan-plus-implementation change
set in one final draft MR targeting `main`. It is one coherent owner extension:
the checkpoint type and validator establish the contract, Plan and Review
consume it, portable rules describe it, and regression fixtures prove it. No
POC or stacked MR is required for this AI-repo workflow change. [confidence:
0.98 - certain]

## Acceptance Criteria

- A post-POC planning checkpoint cannot pass `delivery-shape` without complete
  structured evidence for every final unit.
- Evidence is rejected when its POC head or OpenSpec fingerprint is stale.
- Evidence is rejected when assessed unit IDs do not match the final topology.
- Evidence is rejected when a unit reports `split_required` or
  `merge_required`.
- Evidence is rejected when material POC footprint remains unassigned.
- Evidence is rejected when final topology changed materially without recorded
  user acceptance.
- Evidence is rejected for duplicate assessments or unit IDs, empty required
  fields, unknown unit references, or footprint entries with neither one owner
  nor a declared cross-unit integration hotspot.
- A Stat-shaped fixture with aligned headings, acceptable task counts, and
  objective proof by unit 3 still fails when one root or later unit crosses
  independent semantic boundaries.
- A fully assessed cohesive multi-unit fixture passes.
- Atomic-plan and pre-POC planning checkpoints retain their existing fast path.
- Planning guidance, Review guidance, portable rules, reviewer contracts, and
  tests remain aligned.
- No new phase, reviewer identity, persistent artifact, or routine user prompt
  is introduced.

## Verification

- Type-level and unit tests for complete, unresolved-lifecycle, missing, stale,
  mismatched, split-required, merge-required, invalid-assignment, and
  unaccepted-topology evidence, including material changes with stable unit IDs.
- Review-workflow contract tests proving the `delivery-shape` reviewer inspects
  every final unit and actual POC evidence.
- Lifecycle integration tests proving post-POC reconciliation blocks final
  Execute handoff until the authoritative topology passes while atomic and
  pre-POC paths remain unchanged.
- Command-level proof that the runnable planning gate rejects a handoff without
  explicit lifecycle identity.
- Instruction and skill validation for every changed shared behavior surface.
- Native pre-commit verification on the final implementation head.

First real confirmation: the review checkpoint validator rejects the
Stat-shaped under-split post-POC fixture despite structurally valid task counts,
aligned topology, and objective proof by unit 3, while accepting a fully
assessed cohesive topology. [confidence: 0.98 - certain]

## Risks And Controls

- **Risk: reviewers fabricate empty evidence to satisfy the schema.** Require
  non-empty domain, proof, alternative, and footprint fields, bind them to the
  accepted POC head and existing result fingerprint, and exercise negative
  fixtures.
- **Risk: the gate adds latency.** Run it inside the existing parallel planning
  review barrier and require one pass after the accepted POC rather than a new
  phase or repeated audit.
- **Risk: exact file inventories leak into durable OpenSpec prose.** Keep exact
  footprint evidence task-local and retain only final unit decisions and
  concise rationale durably.
- **Risk: structural and semantic owners overlap.** Keep `openspec-tasks`
  structural and make planning Review the sole semantic cohesion owner.
- **Risk: every plan inherits OpenSpec overhead.** Gate only post-POC OpenSpec
  reconciliation; preserve atomic-plan and provisional pre-POC behavior.
