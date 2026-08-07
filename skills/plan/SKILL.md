---
name: plan
description: Use when converging on design decisions, choosing an atomic plan or OpenSpec, reconciling POC findings, or preparing reviewed implementation work.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Write, Edit, Bash
---

# Plan

## Authority

Plan may write one planning artifact in one owned branch or worktree. It may
not write implementation code or publish a planning-only PR/MR. Announce Plan,
planning-artifact authority, and the goal once on non-trivial entry.

Remain conversational until scope, observable behavior, design, ownership,
delivery shape, risk, acceptance, proof, and policy choices are coherent. Write
no placeholder while a material decision remains. Once artifact authority is
accepted, apply wording, formatting, schema, and validator repairs that preserve
the contract. Ask again when a repair changes behavior, architecture, safety,
ownership, migration, delivery shape, objective proof, or authority.

Shared acceptance, sizing, sequencing, POC, and lifecycle mechanics are
canonical in `rules/investigation-and-implementation.md`. This skill owns the
planning decisions and artifact contract below.

## Select One Artifact

Use `scripts/plan-contract.ts` for the deterministic route check.

| Accepted contract | Artifact |
| --- | --- |
| One coherent implementation unit, one plan-plus-implementation change set, no durable cross-component contract or rehearsal | `.agents/plans/<slug>.md` |
| Independently reviewable units, durable cross-component behavior, migration design, or required rehearsal | one OpenSpec change |

Honor an explicit route when it is coherent; otherwise explain the conflicting
contract. Never create both artifacts. An atomic plan records the objective,
selected approach, material decisions, constraints, delivery shape, and first
visible proof. OpenSpec records the proposal, durable design, observable
requirements, and outcome-oriented delivery units.

## Durable Content

Keep a decision durable when implementation must not reinvent it: observable
behavior, architecture or canonical ownership, safety or rollout policy,
migration, delivery-unit boundaries, and end-to-end acceptance. Keep file and
symbol inventories, exact commands, exhaustive cases, provider receipts,
review history, and other implementation mechanics task-local.

Every non-trivial artifact includes a concise reuse and deviation contract:

- inspected precedents and canonical owners;
- owners reused, extended, or deliberately separated;
- any new mechanism and why no current owner can absorb it;
- evidence-backed material deviations; and
- end-to-end proof for the selected ownership path.

`No applicable precedent found` requires repository evidence. Do not create a
separate ledger or sidecar.

## OpenSpec Delivery Decisions

Derive top-level delivery units from behavior, ownership, deployment, security,
migration, rollback, verification, and repository seams before mapping tasks.
Each unit needs one reviewable outcome, a safe merged intermediate state, local
proof, a coherent reviewer/risk/rollback boundary, predecessor output, and a
reason its nested work belongs in one PR/MR.

Apply the canonical delivery budgets and semantic-split rules from the shared
workflow rule. Prefer objective proof in unit 1; at most two independently
valuable groundwork units may precede it when they safely simplify or enable a
named successor. Record multi-unit shape, kind, dependency, local proof, and
total Git order in the proposal. One top-level heading maps to one final MR;
nested checkboxes remain cohesive work inside it.

After OpenSpec exists, invoke `openspec-tasks`. Its deterministic audit owns
native task shape, identity, lifecycle-only groups, manual/external work,
sizing, and objective-proof position. `needs_spec_redesign` and
`needs_human_action` block Execute. Plan may repair an unambiguous
contract-preserving failure and rerun the audit; a material correction returns
to conversation.

## Planning Review and Handoff

Run one read-only planning Review against the exact artifact fingerprint. Cover
all required planning lenses and retain a distinct `code-simplifier` result.
Resolve one deduplicated findings batch. Durable findings return to Plan;
evidenced implementation considerations remain task-local for Execute.

Before handoff, the runnable planning checkpoint must pass for the current
fingerprint and lifecycle context. Stale evidence, blockers, unresolved repairs,
or a material topology change prevents handoff. Pass Execute the reviewed
artifact, branch/worktree identity, target base, dependencies, total Git order,
integration hotspots, and task-local considerations.
For multiple units, classify each as independent, contract-dependent, or
implementation-dependent and record the stable output that makes it eligible.

## Full Disposable POC

Every OpenSpec requires one production-complete disposable POC. It implements
the whole accepted change, rehearses completion and archival only in a copy,
receives exact-head local and hosted review, and remains a draft review artifact
until explicit closure or contextual authority to proceed. POC commits,
patches, ancestry, and branches never seed final implementation.

Bind personal acceptance to the exact POC head. Capture durable learnings, then
reconcile one consolidated batch into the OpenSpec. Materially new behavior
requires direction instead of another automatic POC.

Post-POC planning Review is the authoritative final-topology gate. It binds
every final unit and material footprint entry to the accepted POC head and
reconciled OpenSpec fingerprint, challenges split and merge alternatives, and
emits the current planning checkpoint. Missing, stale, unassigned, or
non-cohesive evidence blocks the execution seed.
