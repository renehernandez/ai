---
name: worker-handoff
description: Use when an orchestrator or coordinator assigns one bounded task to an implementer, reviewer, or delegated Finish lane inside one workflow.
---

# Worker Handoff

A worker assignment tells one worker exactly what to do inside an orchestrated
workflow. The worker executes it without Explore, reports in the required
shape, and stops. Writing an assignment grants no authority beyond the owning
mode's; the assignment's own ceiling bounds the worker.

Do not use this skill to hand work to a new top-level session; use
`session-handoff`.

## Every Assignment

Write it directly from the reviewed plan, the artifact under review, or
triaged findings. Include everything the worker needs to act:

- objective and the exact scope it may change or inspect;
- repository, worktree, branch, target base, and exact head;
- dirty paths and unresolved risks;
- acceptance criteria and named verification layers;
- effective standing orders, verbatim;
- mutation ceiling and the required report shape.

Keep assignments task-local. A changed head, base, owner, or scope invalidates
an assignment; write a new one instead of amending it in place.

## Implementer and Repair Briefs

Carry the accepted objective, reviewed plan or triaged findings, constraints,
design rationale, original evidence references, acceptance criteria and named
verification layers. Include repository, worktree, branch, target base,
current head, dirty files, unresolved risks, publication host and automated
reviewer. A repair brief covers exactly one triaged findings batch. Preserve
the plan's durable content in the repository; do not commit private review
receipts.

## Reviewer Packets

Bind the packet to one exact artifact: the plan fingerprint, or the head and
target base with changed paths and verification evidence. Assign each lens to
exactly one reviewer. Reviewers read and report; they do not edit, dispatch,
or publish.

## Immutable Publication Packet

When a frozen MR unit becomes publication-ready, the coordinator gives its
provider-only Finish subagent one task-local immutable publication packet with:

- unit and current Execute owner;
- Finish lane identity and monotonically increasing provider-ownership
  generation;
- provider route;
- source branch and exact source SHA;
- target branch and expected target-base identity;
- draft title and incremental scope;
- issue relationship or completion semantics;
- configured reviewer policy; and
- the delegated lane's explicit mutation ceiling.

The packet transfers no repository-write ownership. Live Git and provider state
remain authoritative. A changed source SHA, target-base identity,
Finish lane identity, or provider-ownership generation invalidates the packet
and requires a refreshed handoff before further provider mutation.
Replacement permanently revokes the prior generation. A lane holding a revoked
generation is read-only and returns status unless the coordinator explicitly
reactivates it with a new generation. Keep the packet and the coordinator's
current generation designation task-local, out of commits, hosted
descriptions, and durable workflow state.
