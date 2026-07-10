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

An atomic plan records context, decisions, scope, acceptance, verification,
risks, first real confirmation, and implementation handoff. An OpenSpec records
the complete proposal, design, specification deltas, and top-level delivery
units. Local review evidence and handoffs remain task-local; no YAML or JSON
sidecars belong beside the artifact.

## Planning Review

After every material artifact write, invoke Review read-only against the exact
artifact fingerprint with these baseline lanes:

1. `implementation-readiness`
2. `edge-cases-and-risk`
3. `simplification-and-scope`
4. `refactoring-opportunities`

Add affected-domain specialists. Plan repairs findings that preserve the
accepted contract. Return material scope, architecture, safety, or delivery
changes to the user. Publish no planning-only or reconciliation-only PR/MR.

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
for that authorized cycle and rerun planning Review. Do not start another POC automatically; ask if reconciliation introduces materially unproved behavior.

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
| Temporary atomic plan before OpenSpec | Create only the semantically selected OpenSpec. |
| Adding a POC to an atomic plan | Select OpenSpec when rehearsal is part of the accepted contract. |
| Treating the POC as optional or partial | Build and review the complete disposable implementation. |
| Publishing a planning MR | Keep planning local and include it in the owning final unit. |
| Automatically rerunning POC after reconciliation | Present materially unproved deltas for explicit direction. |
