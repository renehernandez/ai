# Reuse-First POC Architecture Gates

## Goal

Make repository precedent discovery and reuse the default for every non-trivial
change, then add a mandatory early architecture checkpoint and strict
structural Review for disposable OpenSpec POCs so a behaviorally correct POC
cannot spread parallel implementations before its design is challenged.

The first real confirmation is a paired workflow regression derived from the
automatic risk-scoring POC:

- a non-trivial feature request that never says "reuse" still discovers and
  records the closest existing event, orchestration, rendering, and
  verification owners before Plan or Execute proposes a new mechanism; and
- a POC first slice that adds a parallel parser, service, helper, or
  action-specific shared-infrastructure branch cannot expand or publish until
  exact-diff architecture-fit and code-quality review either passes or returns
  the work to Plan.

## Context

The restored five-mode runtime now has the right extension points:

- `brainstorming` owns map-first design discovery;
- Plan owns one durable atomic plan or OpenSpec and already runs
  simplification and refactoring reviewers;
- Execute owns one worktree and currently reviews only after completing a
  cohesive implementation boundary;
- Review has a validated reviewer catalog and exact-target publication
  checkpoint; and
- Finish consumes that checkpoint before provider mutation.

Those contracts still leave a gap exposed by the disposable automatic
risk-scoring POC. The POC proved behavior, failure paths, CI, hosted review,
and operational scenarios, while repeated user steering was needed to find
existing equivalents and unwind duplicated helpers and parallel architectural
paths. Reuse depended too much on prompt wording and late inspection. POC and
final implementations also share one generic implementation baseline, so the
rehearsal has no earlier or stricter architecture-fit boundary despite its
broad production-complete mandate.

The desired correction is workflow behavior, not a Nitro refactor. The old
risk-scoring POC is evidence and a source for anonymized regression scenarios;
this change does not edit Nitro, update or close `ai/nitro!848`, reconcile its
OpenSpec, or implement another risk-scoring POC.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Precedent scan | Read-only inspection of the closest existing implementations, canonical owners, shared modules, and repository conventions before proposing or writing a new mechanism. |
| Reuse and deviation contract | The planning decision that identifies what is reused, extended, replaced, or newly introduced, and gives evidence for every intentional deviation from repository precedent. |
| First vertical slice | The smallest end-to-end POC implementation that exercises the real entrypoint, operation, and visible success or failure result before breadth work expands the diff. |
| Architecture checkpoint | Exact-diff Review of the first vertical slice against repository precedent and the reuse and deviation contract before Execute continues the complete POC. |
| Semantic tripwire | Evidence that a change may be creating a parallel owner, such as a new sibling parser, handler, service, renderer, policy, resource-identity path, or concrete feature branch in shared infrastructure. |

## Decisions

### Make precedent discovery the default

Every non-trivial design and implementation performs a precedent scan whether
or not the user says "same approach," "similar to," "follow the existing
flow," or "there should already be an implementation." Such wording narrows
the scan but does not trigger it.

The scan follows this preference order:

1. Reuse an existing implementation directly.
2. Extend its canonical abstraction or owner.
3. Extract a genuinely shared boundary when multiple consumers need it.
4. Introduce a new mechanism only with explicit evidence that the first three
   paths are unsuitable.

`No applicable precedent found` is valid only after relevant repository code,
docs, plans, and tests were inspected. Reuse does not mean forcing unrelated
behavior into an unsuitable abstraction; the workflow preserves an evidence-
backed new-boundary option.

### Put the precedent map in brainstorming

Extend the restored `brainstorming` specialist instead of duplicating its
detailed behavior in Explore. Its context inspection and orientation map must
surface:

- the closest existing implementations and canonical owners;
- what the recommended approach reuses or extends;
- intended new concepts and why they are necessary; and
- unresolved deviations that change architecture, ownership, safety, or
  visible behavior.

The map stays lightweight for ordinary work. It becomes a hard stop only when
the available precedent and the proposed approach imply materially different
architecture or ownership.

Explore continues to own read-only authority and routes matching work through
`brainstorming`; it does not independently maintain a second precedent-map
format.

### Make reuse durable in Plan

Every non-trivial atomic plan and OpenSpec records a concise reuse and
deviation contract. It names:

- inspected precedents;
- canonical owners for affected invariants;
- elements reused directly or extended;
- genuinely new mechanisms;
- intentional deviations and supporting evidence; and
- proof that will show the delivered shape did not create a conflicting owner.

Planning Review treats missing precedent evidence as an implementation-
readiness finding. `simplification-and-scope` and
`refactoring-opportunities` validate the contract against live repository
context instead of accepting its assertions at face value.

The contract remains part of the primary planning artifact. Do not create a
reuse ledger, YAML sidecar, reviewer report, or second durable representation.

### Add a POC-only early checkpoint in Execute

Every OpenSpec POC implements its smallest real first vertical slice, then
pauses before broadening into the remainder of the production-complete POC.
The checkpoint occurs at the first objective proof in slice 1 or, when one
setup-only slice is concretely required, in slice 2 when that setup is first
consumed by a real end-to-end path. Execute invokes Review against the exact
target-base diff with:

- the reviewed OpenSpec reuse and deviation contract;
- the current first-slice diff fingerprint;
- the repository precedents inspected by the implementer; and
- any semantic tripwires encountered.

Execute may continue the POC only when the architecture checkpoint passes.
Scoped implementation findings return to the same Execute owner. A finding
that changes canonical ownership, the accepted reuse boundary, or another
material architectural decision freezes writes and returns to Plan.

The checkpoint is mandatory for every POC. When no applicable precedent
exists, Review records that evidence and may pass without inventing an
abstraction. Any later change to canonical ownership, action boundaries,
shared infrastructure, or planned deviations invalidates the checkpoint and
requires it to run again before further expansion. Direct work, atomic-plan
delivery, and final OpenSpec units keep their existing smallest-cohesive-
boundary loop, but their normal Review still applies the reuse-first rubric.

Semantic tripwires require immediate inspection and may move the checkpoint
earlier. They include:

- adding a sibling helper, parser, handler, service, renderer, policy, or
  workflow surface for an established concern;
- repeating a constant, schema, identity rule, formatting rule, routing rule,
  or lifecycle invariant in another package or layer;
- branching shared infrastructure on one concrete action, feature, provider,
  or product name;
- creating a second source of truth or canonical owner; and
- discovering that the planned precedent cannot support the proposed path.

These are semantic signals, not line-count, file-count, or clone-percentage
thresholds.

### Give POCs a distinct structural Review baseline

Keep the existing correctness, regression-risk, maintainability, and
verification-quality reviewers. Add a validated
`architecture-fit-and-reuse` reviewer contract and make it mandatory for POC
and final implementation Review. Its evidence questions must inspect unchanged
repository context and ask whether the diff:

- extends the planned canonical owners;
- introduces an avoidable parallel path;
- creates scattered special cases or repeated invariants;
- honors every planned deviation; and
- would require another copied vertical slice for the next similar feature.

Register `code-quality-review` as a validated specialist reviewer/pass ID that
delegates to the existing strict skill contract. POCs require that pass at the
first-slice architecture checkpoint and again on the complete exact HEAD. The
specialist remains read-only and reports high-conviction structural findings;
it does not become a lifecycle mode or fix its own findings. Its complete-HEAD
result is part of the deterministic POC baseline consumed by publication
validation, rather than an untracked optional specialist invocation.

Strengthen `scrutinize` for POC targets so its simpler-path challenge asks
whether the rehearsal reused the planned precedent or merely reproduced its
external behavior through a parallel architecture. A working end-to-end path
does not clear that concern by itself.

Review's exact-diff publication checkpoint must require every target-specific
baseline pass. Finish therefore cannot publish or update a POC whose current
HEAD lacks architecture-fit evidence. CI, hosted review, and operational proof
remain separate gates and cannot substitute for local structural Review.

### Keep enforcement inside current mode contracts

Extend the existing reviewer catalog, target-specific baseline selection,
publication-checkpoint validator, and Execute contract tests. Do not implement
`ax commit`, private review-gate state, hooks, or a new orchestration database
in this change.

The separately planned review-gate foundation may consume the stable
`architecture-fit-and-reuse` and `code-quality-review` pass IDs later. This
atomic change must be independently useful through the current Review and
Finish publication boundary.

### Preserve independent clean risk-scoring rehearsal

After this workflow change merges and the live runtime is synced, Nitro Plan
will separately reconcile the risk-scoring OpenSpec using the old POC's
durable findings. A replacement POC starts from the normal Nitro target base
and reviewed OpenSpec without reusing commits, ancestry, patches, or code from
the old POC. That future Nitro work is explicitly outside this AI-repo change.

## Scope

### In Scope

- Extend `brainstorming` with default precedent discovery, orientation-map
  reuse evidence, and relevant pressure tests.
- Extend Plan with the reuse and deviation contract and planning-review
  expectations.
- Extend Execute with reuse preflight, semantic tripwires, and the mandatory
  first-vertical-slice POC architecture checkpoint.
- Add `architecture-fit-and-reuse` to the validated Review catalog and
  target-specific implementation baselines.
- Register and require strict `code-quality-review` at the POC first-slice and
  complete-HEAD boundaries.
- Strengthen POC scrutiny to distinguish reused architecture from duplicated
  external behavior.
- Make Finish's POC publication path consume the current target-specific
  baseline through the existing publication checkpoint.
- Align repo and portable instructions plus investigation, planning, review,
  and verification rules with the reuse-first contract.
- Add executable regression fixtures and contract tests derived from the
  automatic risk-scoring POC without embedding private transcripts or Nitro
  implementation code.
- Run `writing-skills` and AI-readiness upkeep because shared agent behavior,
  reviewer rubrics, validation helpers, and runtime-managed skills change.

### Out Of Scope

- Refactoring Nitro or implementing automatic risk scoring.
- Editing, updating, closing, merging, or otherwise mutating `ai/nitro!848`.
- Reconciling the Nitro automatic-risk-scoring OpenSpec or building its
  replacement POC.
- Implementing the older `ax commit` or Git-private review-gate foundation.
- Adding repository hooks, CI clone-detection gates, generic duplication
  scanners, or line/file-count thresholds.
- Adding durable reviewer ledgers, reuse sidecars, fingerprints, or workflow
  state to Git.
- Creating a sixth lifecycle mode or restoring retired plan orchestration
  skills.

## Implementation Tasks

### 1. Establish reuse-first discovery and planning

- [x] 1.1 Extend `brainstorming` so every non-trivial design performs a
      precedent scan and exposes reuse, extensions, new concepts, and material
      deviations in its orientation map without waiting for user phrasing.
- [x] 1.2 Extend Plan and the relevant shared rules so every non-trivial atomic
      plan or OpenSpec carries one concise reuse and deviation contract inside
      its primary artifact.
- [x] 1.3 Strengthen planning reviewer rubrics so claimed precedents and
      deviations are checked against repository evidence.

Acceptance:

- A prompt with no reuse language still causes repository precedent
  inspection before approaches or slices are recommended.
- `No applicable precedent found` requires inspected evidence.
- Planning Review returns a finding when a non-trivial artifact lacks reuse
  ownership, deviation, or proof decisions.
- The workflow creates no second planning artifact or reuse ledger.

### 2. Gate POC expansion at the first vertical slice

- [x] 2.1 Add Execute's reuse preflight and semantic tripwire contract.
- [x] 2.2 Add the mandatory task-local first-vertical-slice architecture
      checkpoint for every POC, bound to the current target base and diff and
      aligned with the earliest-objective-proof boundary.
- [x] 2.3 Define pass, scoped-finding, and return-to-Plan behavior without
      adding persisted workflow state.

Acceptance:

- A POC cannot expand beyond its first real slice without current
  architecture-fit and strict code-quality evidence.
- At most one concretely required setup-only slice may precede the checkpoint;
  the next slice must consume it through the real entrypoint and visible
  outcome.
- A new sibling parser/service/helper or concrete feature branch in shared
  infrastructure triggers precedent inspection even when tests pass.
- Scoped findings return to Execute; a changed canonical owner or accepted
  reuse boundary returns to Plan.
- A genuinely novel POC can pass with evidence that no applicable precedent
  exists.

### 3. Enforce structural Review through existing gates

- [x] 3.1 Add and validate the `architecture-fit-and-reuse` reviewer contract.
- [x] 3.2 Split target-specific implementation baselines so POC and final
      targets both require architecture fit, while POCs additionally require
      a catalog-backed `code-quality-review` pass at first-slice and
      complete-HEAD boundaries.
- [x] 3.3 Strengthen POC scrutiny and Finish publication guidance so green CI,
      hosted review, and operational proof cannot replace structural evidence.
- [x] 3.4 Update publication-checkpoint validation tests for missing, stale,
      finding, and passing POC structural evidence.

Acceptance:

- Every selected reviewer ID resolves to a complete validated rubric.
- The POC baseline differs intentionally from final implementation and is
  selected deterministically.
- Publication validation rejects a POC missing the current architecture-fit
  or code-quality passes.
- An end-to-end working POC that copied an existing vertical path receives a
  finding instead of `ship`.

### 4. Add incident-derived regressions and align shared behavior

- [x] 4.1 Add anonymized RED/GREEN fixtures for unprompted precedent
      discovery, justified novelty, semantic tripwires, first-slice expansion,
      and exact-HEAD publication.
- [x] 4.2 Update focused mode, brainstorming, Review-catalog, instruction, and
      runtime-copy tests.
- [x] 4.3 Run `writing-skills` pressure tests and AI-readiness upkeep; repair
      any prose-only or unenforced contract finding before delivery.

Acceptance:

- The risk-scoring-derived RED fixture fails when the agent creates parallel
  event, dispatch, rendering, or verification owners without justification.
- The GREEN fixture passes when the existing path is reused or a new boundary
  has concrete evidence and Review approval.
- Source and generated managed-target fixtures remain byte-aligned through
  isolated AX sync and validation; the live runtime remains untouched before
  merge.
- The five modes remain the only lifecycle authority owners.

## Verification

- Focused unit tests for `brainstorming`, mode lifecycle, reviewer catalog,
  Execute checkpoint helpers, publication checkpoint validation, and portable
  instructions.
- `pnpm run skills:validate`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm ax status`
- `pnpm ax validate`
- `pnpm exec biome check <changed TypeScript and JSON paths>`
- `git diff --check`
- `writing-skills` pressure tests against the incident-derived RED/GREEN
  scenarios.
- AI-readiness upkeep review of executable contracts, tests, instructions,
  runtime-managed copies, and deferred review-gate integration.

After merge, verify a clean local `main` source and run live `pnpm ax sync`.
Do not sync the live runtime from this feature branch or worktree.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Reuse-first becomes a ritualized inventory | Keep the precedent map proportional and require deeper evidence only for non-trivial ownership or architecture decisions. |
| Existing abstractions are stretched beyond their purpose | Preserve justified novelty and require Review to assess abstraction fit, not reuse count. |
| The first-slice checkpoint makes every POC slow | Run it once at the smallest real end-to-end boundary and only restart it when architecture-affecting changes invalidate the evidence. |
| Maintainability and architecture reviewers duplicate each other | Keep maintainability focused on local change cost and architecture fit focused on precedent, canonical ownership, deviations, and parallel paths. |
| POC and final baselines drift without validation | Make target-specific baseline selection and complete reviewer contracts deterministic and unit-tested. |
| Prose claims pass without enforcement | Bind POC publication to required reviewer IDs and exact-diff checkpoint validation; pressure-test the skills. |
| Incident fixtures leak private implementation detail | Use anonymized semantic scenarios rather than Nitro source, transcripts, URLs, or provider notes. |
| The change recreates old orchestration machinery | Keep checkpoints task-local and reuse current Review/Finish contracts; defer `ax commit` and private state. |

## Implementation Handoff

- Artifact: `.agents/plans/reuse-first-poc-architecture-gates.md`
- Branch: `codex/reuse-first-poc-architecture-gates`
- Worktree:
  `/Users/rene.hernandez/.codex/worktrees/63629038-d002-4f52-97aa-bd0f19ffa4b3/ai`
- Planning base: `6b0aabcbb140d06acdc93f19778d1348330137d8`
- Target: `main`
- Delivery: one atomic plan-plus-implementation change set in one final draft MR
- Linear policy: disabled; this repo has no accepted tracker requirement for
  this workflow change
- Logical order: reuse-first discovery and planning, POC expansion checkpoint,
  target-specific structural Review, regression and runtime alignment
- Integration hotspots: `skills/brainstorming`, `skills/plan`,
  `skills/execute`, `skills/review`, `skills/finish`,
  `skills/code-quality-review`, `skills/scrutinize`, their executable contract
  helpers and focused tests, `AGENTS.md`, `instructions/AGENTS.md`, shared
  investigation/review/verification rules, and AX-managed runtime-copy tests
- First real confirmation: the unprompted-precedent and parallel-POC-path
  fixtures enforce reuse before POC expansion and publication
- Publication: include this plan and implementation together; create no
  planning-only MR and no POC
