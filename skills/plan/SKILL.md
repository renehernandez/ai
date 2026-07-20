---
name: plan
description: Use when converging on design decisions, choosing an atomic plan or OpenSpec, reconciling POC findings, or preparing reviewed implementation work.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Write, Edit, Bash
---

# Plan

## Authority

Plan may write one planning artifact in one owned branch/worktree. It may not
write implementation code or publish a planning PR/MR. For non-trivial entry,
announce `Plan`, planning-artifact authority, and the goal once.

Remain conversational until scope, design, delivery shape, risks, acceptance,
verification, and policy choices are coherent. If any material behavior,
architecture, migration, safety, ownership, ordering, cross-component, or
verification decision remains, ask for that decision and write no placeholder.
After Plan gains artifact-write authority, apply contract-preserving wording,
formatting, schema, and validator-conformance repairs automatically. Ask again
only when a repair would change a durable contract boundary, require a
human-only action, or expand authority. A repair is contract-preserving only
when it leaves the requested behavior, work, outputs, acceptance, ownership,
and delivery boundaries unchanged; changing what an action or deliverable
means is a material repair even when expressed as a wording edit.

## Choose One Artifact Semantically

Use `scripts/plan-contract.ts` when a deterministic route check helps. Never use
file count, changed lines, or effort thresholds.

| Contract | Artifact |
| --- | --- |
| One coherent implementation unit delivered as one plan-plus-implementation change set in one final MR; no durable cross-component specification, migration design, or mandatory rehearsal | `.agents/plans/<slug>.md` |
| Several independently reviewable delivery units, a durable cross-component contract, migration design, or a required full POC | One OpenSpec change |

Follow an explicit user route when it represents the accepted contract. Reject
an incoherent route with the concrete contract reason. Never create both an
atomic plan and OpenSpec for the same work.

An atomic plan records the objective, selected high-level approach, material
decisions and constraints, delivery shape, and the earliest real entrypoint
with visible success or failure evidence. An OpenSpec records the proposal,
durable design decisions, observable behavior, and outcome-oriented delivery
units. Local review evidence and handoffs remain task-local; no YAML or JSON
sidecars belong beside the artifact.

## Durable Planning Boundary

Planning artifacts preserve decisions that future implementation must not
invent or change. Keep a detail durable only when it changes externally
observable behavior, architecture or canonical ownership, safety or rollout
policy, migration, a delivery-unit boundary, or end-to-end acceptance.

Keep implementation mechanics task-local, including step-by-step instructions,
file and symbol inventories, exact commands, exhaustive test or edge-case
matrices, provider receipts, review chronology, and intermediate findings.
Implementation readiness means no unresolved material decision; it does not
mean turning the artifact into a prose implementation log. Execute rediscovers
current mechanics from the repository and receives relevant implementation
considerations in its task-local handoff.

## Reuse And Deviation Contract

Every non-trivial atomic plan or OpenSpec records a concise reuse and deviation
contract in its primary artifact. At the ownership-boundary level, it names:

- the inspected precedents and their canonical owners;
- which owners will be reused, extended, or separated by a shared boundary;
- any genuinely new mechanism and why an existing owner cannot absorb it;
- material deviations from precedent and the evidence that requires them; and
- the end-to-end proof for the chosen ownership and reuse path.

`No applicable precedent found` is valid only with the inspected repository
evidence. User wording such as "similar to" may narrow the scan but is never a
prerequisite for it. Keep this contract in the main plan or OpenSpec rather than
creating a ledger, sidecar, or duplicate workflow artifact.

## Decompose OpenSpec Delivery Before Writing

Treat existing top-level headings as hypotheses, not accepted delivery
boundaries. Before creating or materially revising an OpenSpec, inventory the
change's behavior, ownership, deployment, security, migration, rollback,
verification, and repository boundaries. Inspect existing implementations,
POCs, PRs/MRs, and incident evidence when available. Derive candidate units
from that evidence before mapping existing tasks onto them.

Every proposed top-level unit must have:

- one reviewable implementation outcome;
- a safe merged intermediate state that does not rely on an unmerged future
  unit for correctness;
- local proof owned by the unit;
- one coherent reviewer, risk, rollback, and deployment boundary;
- declared predecessor output and integration hotspots; and
- a concrete reason its nested work belongs in one PR/MR.

Prefer stack objective proof in the first unit. When forcing that vertical slice
would combine materially distinct ownership, security, deployment, rollback, or
review seams, allow one or two groundwork units first. Each groundwork unit
must simplify or refactor a canonical owner, or establish a required boundary
that a named successor directly consumes. It must remain useful and safe if the
stack stops, own local proof, and reduce the size or risk of the first outcome
MR. The first stack objective proof must appear by unit 3; a third pre-outcome
unit returns to Plan for decomposition review.

For a multi-unit OpenSpec, record a concise proposal delivery-shape table with
each unit's kind (`groundwork`, `outcome`, or `hardening`), local outcome,
dependency or enabled successor, local proof, and stack-objective-proof
ownership. When prior implementation, POC, MR, or incident evidence exists,
also record the affected ownership or review domains and evidence-backed split
rationale. Proposal count, `tasks.md` headings, tracker units when required, and
intended predecessor order must agree; every final PR/MR maps to one top-level
heading, never a nested checkbox.

Split a candidate unit when it combines materially different shared
prerequisites, feature behavior, proof infrastructure, activation, repositories,
owners, security boundaries, rollback paths, or deployment mechanisms. Combine
candidate units when a split would create unused plumbing, an unverifiable or
unsafe intermediate state, or checkbox-only PRs/MRs with the same review and
rollback boundary. File count and diff size are evidence, never thresholds.
Stress-test the first unit separately when real footprint evidence shows that it
dominates the stack or crosses several independent review seams; valid early
objective proof does not excuse under-splitting.

Keep resolving the delivery shape conversationally when these tests expose a
material choice. Do not write an artifact and leave its top-level split for a
later planning-review correction.

After an OpenSpec exists, invoke `openspec-tasks` before implementation handoff.
Its self-contained audit validates native checkbox structure, delivery-unit and
work-item identity, lifecycle-only groups, manual or external work, sizing
shape, and earliest objective proof. A `needs_spec_redesign` or
`needs_human_action` result blocks Execute handoff. Plan owns artifact repairs
that preserve the accepted contract; the specialist never rewrites `tasks.md`
automatically. A structured audit failure returns to Plan rather than directly
to the user. When
the accepted contract makes one correction unambiguous and the correction does
not change behavior, architecture, safety, ownership, migration, delivery
shape, objective proof, or another durable boundary, Plan repairs and reruns
the audit without renewed permission. Ask for one focused decision only when
those boundaries would change or the required intent is genuinely unknown.

## Planning Review

When the planning artifact is stable, invoke one read-only Review discovery pass
against its exact fingerprint. Cover every planning review type, including one
explicit `code-simplifier` outcome that cannot be replaced by another review
type. A small coherent plan may use one integrated inline execution, but the
simplification result remains separately recorded. Use subagents only when
separating concerns is expected to finish faster. Add affected-domain
specialists when the exact artifact exposes their domain. Hold edits until the
review phase barrier and deduplicate one task-local findings batch.

Before implementation handoff, validate the completed planning results with
Review's artifact-fingerprint-bound planning checkpoint. A missing result,
stale fingerprint, blocker, durable artifact finding, or unresolved repair
prevents handoff. Evidenced nonblocking `defer` findings classified as
task-local implementation considerations accompany the handoff to Execute.

Plan repairs only findings that change the durable planning contract. Pass
implementation considerations to Execute task-locally instead of expanding the
artifact, and defer optional improvements. After repairs, run one closure check
limited to the enumerated findings and affected proof. Start a new bounded
discovery pass only when the repair materially changes scope, behavior,
architecture, safety, ownership, migration, delivery, or the review-risk
coverage. Return those material changes to the user. Publish no
planning-only or reconciliation-only PR/MR. Planning reviewers verify the reuse
and deviation contract against the live repository rather than accepting its
claims at face value. Atomic plans and OpenSpec artifacts do not also run Doc
Smith reader personas.

## OpenSpec Requires a Full Disposable POC

Every OpenSpec, without exception, receives one production-complete POC before
clean final implementation. The POC:

- starts from the locally reviewed planning commit in a dedicated worktree;
- implements every task, requirement, scenario, acceptance criterion, and
  applicable production concern;
- exercises real or fidelity-equivalent decision boundaries;
- leaves source `tasks.md` unchecked and rehearses completion/archive only in a
  disposable repository copy;
- receives local implementation Review, configured CI and hosted automated
  review, and explicit personal acceptance of the latest exact head;
- is published by Finish as draft `POC: ...`, marked review-only, then closed
  unmerged; and
- never supplies commits, ancestry, patches, or a Git predecessor to final
  implementation.

Personal acceptance is exact-SHA task-local evidence. A changed POC head makes
it stale. After acceptance, reconcile durable findings into the OpenSpec once
for that authorized cycle and rerun planning Review. Do not start another POC
automatically; ask if reconciliation introduces materially unproved behavior.
During reconciliation, rerun the delivery decomposition against the actual POC
footprint, affected owners, review findings, operational proof, rollback needs,
and deployment seams. Split a unit that proved broader than planned before
final implementation. Return material top-level-unit changes to the user; do
not silently rewrite the accepted delivery contract.

## Delivery Shape And Policy

An atomic plan and its implementation are one change set in one final MR. It
has no planning-only MR, POC phase, or POC MR. If rehearsal is required, select
OpenSpec. OpenSpec yields one final MR per top-level delivery unit, with nested
work as cohesive commits.

Linear policy is exactly `required` or `disabled`, resolved by direct user
instruction, project policy, then one workflow-policy profile. Disabled means
no Linear work. Required means read-only discovery, an exact mutation preview,
and explicit approval before writes; map one outcome-centered issue to each
top-level delivery unit.

Hand Execute the reviewed artifact, branch/worktree identity, normal target
base, logical dependencies, and total Git order. For multiple final units,
classify each as independent, contract-dependent, or implementation-dependent;
record the stable contract or predecessor output that makes it eligible,
expected branch/worktree ownership, and integration hotspots. Keep reviewer
transcripts, fingerprints, and workflow state out of repository and hosted
artifacts.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Writing an artifact as soon as Plan starts | Keep resolving material decisions in chat. |
| Omitting reuse analysis because the request did not mention precedent | Record the mandatory reuse and deviation contract from repository evidence. |
| Temporary atomic plan before OpenSpec | Create only the semantically selected OpenSpec. |
| Adding a POC to an atomic plan | Select OpenSpec when rehearsal is part of the accepted contract. |
| Treating the POC as optional or partial | Build and review the complete disposable implementation. |
| Accepting tidy nested tasks as proof of one mergeable unit | Derive units from implementation and ownership boundaries, then map tasks onto them. |
| Handing an unaudited OpenSpec task list to Execute | Run `openspec-tasks` and resolve structured blockers first. |
| Asking before a wording-only validator repair | Apply the contract-preserving repair under existing Plan authority and rerun the audit. |
| Publishing a planning MR | Keep planning local and include it in the owning final unit. |
| Automatically rerunning POC after reconciliation | Present materially unproved deltas for explicit direction. |
