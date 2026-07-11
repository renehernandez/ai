# Improve OpenSpec Delivery Breakdown

## Goal

Make Plan challenge an OpenSpec's top-level delivery units before artifact
creation and again after the disposable POC, so a nested task list cannot hide
an implementation that is too broad to review and merge safely.

The first observable outcome is that the risk-scoring shape from thread
`019f530e-cf0b-7602-96a3-f4e8e474cc8c` is rejected as one delivery unit. The
planning process must separate shared runtime safety, feature dispatch,
operational-verification support, and activation because they have distinct
risk, review, rollback, and proof boundaries.

## Motivation

The current workflow defines a top-level `tasks.md` heading as one final MR and
limits the number and lifecycle shape of nested work items. It does not require
Plan to prove that the parent unit is independently mergeable. In the source
thread, Plan initially accepted five nested work items as one cohesive unit even
though the prior implementation changed 137 files across shared runtime,
feature behavior, operational verification, and activation. The delivery shape
was corrected only after user steering.

Task-count limits cannot detect this failure. A sensible split is a semantic
judgment informed by architecture and, when available, earlier implementation
or POC evidence.

## Decisions

### Require a decomposition challenge before writing

Before Plan creates or materially revises an OpenSpec, it inventories the
change's behavior, ownership, deployment, security, migration, rollback,
verification, and repository boundaries. Existing implementations, POCs, MRs,
or incident evidence are mandatory inputs when available. Existing top-level
headings are hypotheses, not accepted delivery boundaries: Plan derives units
from the inventory first, then maps the existing tasks onto that candidate
shape.

For every proposed top-level unit, Plan must establish:

- one reviewable implementation outcome;
- a safe merged intermediate state that does not depend on an unmerged future
  unit for correctness;
- objective proof owned by the unit;
- a coherent reviewer, risk, rollback, and deployment boundary;
- declared predecessor output and integration hotspots; and
- why its nested work belongs in one MR.

Plan splits when one unit combines materially different shared prerequisites,
feature behavior, proof infrastructure, activation, repositories, owners,
security boundaries, rollback paths, or deployment mechanisms. Plan combines
candidate units when a split would create unused plumbing, an unverifiable
intermediate state, or checkbox-only MRs with the same review and rollback
boundary.

### Make delivery shape a planning review lane

Add `delivery-shape` to the deterministic planning-review baseline. The lane
adversarially checks both under-splitting and over-splitting using the criteria
above. A finding that changes top-level units returns to Plan and blocks
readiness until the delivery shape is resolved with the user.

### Re-run decomposition after the POC

POC reconciliation must compare the planned units with the actual
implementation footprint, affected owners, review findings, operational proof,
rollback needs, and deployment seams. A unit that proved broader than planned
must be split before final implementation. A proposed split that materially
changes the accepted delivery contract returns to the user; it is not rewritten
silently.

### Keep semantic judgment in the workflow

Do not add a second machine-readable artifact or heuristic file-count gate.
Executable coverage verifies that the required lane and instructions remain
wired, while Plan and Review make the architecture-dependent judgment. File
count and diff size are evidence, not thresholds.

## Scope

### In Scope

- Update `skills/plan/SKILL.md` with the pre-artifact decomposition challenge,
  split/combine criteria, evidence requirements, and post-POC recheck.
- Update `skills/review/SKILL.md` and
  `skills/review/scripts/review-contract.ts`, plus its adapter metadata, with
  the `delivery-shape` planning baseline lane.
- Align `rules/docs-and-specs.md` and
  `rules/investigation-and-implementation.md`, plus shared verification rules,
  with the delivery-unit contract.
- Add focused integration and instruction tests that preserve the new baseline
  and the thread-derived RED behavior.
- Apply `writing-skills` and AI-readiness review to the changed shared behavior.

### Out Of Scope

- Replanning the risk-scoring OpenSpec itself.
- Adding OpenSpec schema fields, sidecars, task tags, file-count limits, or an
  automatic task splitter.
- Changing Execute or Finish beyond any wording strictly required to consume
  the reviewed delivery shape.
- Refreshing the live AX runtime from this feature branch; live sync remains a
  post-merge action from a clean default-branch source.

## Implementation Tasks

### 1. Decomposition Contract

- [ ] 1.1 Update Plan and shared OpenSpec rules so delivery-unit decomposition
      is a required conversational gate before artifact creation and after POC
      reconciliation.

  Acceptance:

- Existing implementation and POC evidence is inspected when available.
- Existing headings are challenged against a bottom-up boundary inventory
  instead of being accepted as the starting delivery shape.
  - Every unit records its outcome, safe intermediate state, proof, dependency,
    integration hotspots, and cohesion reason.
  - Split triggers cover shared prerequisites, feature behavior, proof
    infrastructure, activation, repository/owner, risk, rollback, security, and
    deployment seams.
  - Combine triggers prevent unused-foundation, unverifiable, and checkbox-only
    MRs.
  - Material top-level-unit changes return to the user instead of being silently
    rewritten.

### 2. Delivery-Shape Review Gate

- [ ] 2.1 Add `delivery-shape` to the planning Review baseline and teach Review
      to challenge both under-splitting and over-splitting against the exact
      artifact fingerprint.

  Acceptance:

  - `baselineFor("planning")` includes `delivery-shape`.
  - POC and final-implementation baselines are unchanged.
  - Plan invokes the same five-lane planning baseline after every material
    artifact write.
  - Delivery-shape findings block readiness and return to Plan.

### 3. Regression Coverage And Alignment

- [ ] 3.1 Add focused tests for the planning baseline and required
      decomposition language, using the thread's oversized single-unit shape as
      anonymized RED evidence.

  Acceptance:

  - Tests fail if the decomposition challenge, post-POC recheck, split/combine
    criteria, or `delivery-shape` lane is removed.
  - Tests preserve the implementation-review baseline unchanged.
  - AI-readiness review finds no missing cheap deterministic enforcement.
  - `writing-skills` verification uses the observed thread failure as RED
    evidence and confirms the revised instructions address it. Because this
    session is not authorized to delegate, repo-native regression tests provide
    the executable GREEN check instead of subagent pressure runs.

## Verification

- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm ax skills validate`
- `pnpm ax validate`
- `git diff --check`

After merge, verify a clean local `main` source and run live `pnpm ax sync`.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Plan over-splits every concern into a separate MR | Require an independently useful or safely enabling outcome and combine unused or unverifiable intermediates. |
| Plan preserves an oversized parent because nested tasks look tidy | Require the parent-level decomposition challenge and a dedicated review lane. |
| File count becomes an accidental workflow selector | State that size is evidence only and test semantic split criteria. |
| POC evidence arrives too late to affect delivery shape | Re-run decomposition during reconciliation before final implementation. |
| The new lane exists only in prose | Add it to the deterministic review baseline and integration tests. |

## Recommended Delivery

Implement this atomic plan and its shared workflow changes in one final draft
MR. The plan file and implementation remain one change set; no OpenSpec or POC
is needed for this bounded planning-contract correction.
