# Delegate Ready MR Publication

## Objective

Reduce stacked-delivery latency by requiring every hook-clean, frozen MR unit
to receive its own provider-only Finish subagent while the primary Execute
coordinator continues eligible descendant implementation. The workflow must
make each lane visible, preserve exact Git and provider ordering, and route
hosted findings back to the correct repository writer without adding durable
orchestration state. [confidence: 0.99 - certain | reason: this is the accepted
subagent-first outcome]

## Context

The current workflow already prioritizes user-visible throughput, maintains a
task-local ready queue, permits concurrent lifecycle lanes, and assigns Finish
draft publication and hosted follow-through. It does not define a hook-clean
unit commit as an explicit delegation boundary. An Execute coordinator can
therefore continue editing a descendant after freezing an ancestor even though
MR publication and monitoring are safe, authorized, useful ready work.
[confidence: 0.98 - certain | reason: current rules describe both sides of the
boundary but do not require the handoff]

The observed PAD-1949 delivery exposed that gap: the foundation and risk-
scoring units reached hook-clean commits while descendant implementation
continued without MR-specific Finish subagents. This plan uses that sequence as
behavioral regression evidence, not as a repository ledger or provider receipt.
[confidence: 0.97 - certain | reason: the inspected task showed the serial
behavior directly]

## Decisions

- Treat lifecycle authority as lane-scoped within one task. The primary agent
  may remain the Execute coordinator while independent subagents operate in
  Finish against frozen branch heads. [confidence: 0.98 - certain]
- A hook-clean, frozen delivery-unit branch is `publication-ready`.
  Publication authority, provider routing, credentials, and a stable target-base
  identity are launch prerequisites, not readiness conditions. This creates a
  task-wide dispatch barrier before any agent begins another repository
  mutation. An Execute mutation already in flight may finish, but its owner
  pauses at the next safe tool boundary. A concrete blocker keeps repository
  mutation stopped. Only explicit withdrawal or supersession may release the
  barrier without starting the lane. Starting the lane releases the barrier;
  Execute does not wait for MR creation, CI, or hosted review to finish.
  [confidence: 0.99 - certain]
- Give each ready MR its own Finish subagent so creation, CI, and hosted review
  can progress independently. Provider mutations still respect Git order: a
  descendant lane may start immediately but waits to publish until its target
  branch is remotely available and its expected target-base identity is stable.
  [confidence: 0.96 - certain]
- Hand Finish an immutable publication packet containing the unit, provider
  route, source branch and exact SHA, target branch and expected target-base
  identity, draft title and incremental scope, issue-link semantics,
  reviewer policy, and explicit mutation limits. The packet is task-local and
  is not a committed file, hosted description section, or workflow database.
  [confidence: 0.98 - certain]
- A Finish subagent may inspect Git and provider state, push the handed-off
  exact ref, apply the existing change-request description policy, create or
  update the draft MR, verify live state, request configured hosted review,
  and monitor its current gates. It may not edit files, change commits, switch
  the coordinator's worktree, rebase, restack, resolve implementation findings,
  mark ready, merge, deploy, or clean up. [confidence: 0.99 - certain]
- Keep the primary coordinator responsible for dependency scheduling, total
  Git order, restack decisions, immutable handoffs, and one deduplicated route
  from hosted findings to the applicable Execute owner. An MR-specific Finish
  subagent returns evidence and findings; it never becomes a second repository
  writer. [confidence: 0.98 - certain]
- Make delegation inspectable with one concise task-commentary update when the
  Finish lane starts or when a concrete blocker prevents it from starting.
  Subsequent state comes from the MR-specific subagent and live Git/provider
  inspection. Do not add a parallel status representation, durable ledger,
  sidecar, scheduler, or telemetry service. [confidence: 0.98 - certain]
- Keep each MR-specific Finish lane active, or replace it from the current
  delivery fields in a refreshed immutable publication packet after a failure,
  until draft technical readiness. Revoke the prior provider-ownership
  generation before replacement mutation. Actionable Nitro and pipeline issues
  that require no user decision return automatically to the current Execute
  owner for repair. [confidence: 0.99 - certain]
- Preserve the small-task exception only when no descendant implementation or
  other useful work can overlap publication. An MR in a multi-unit stack is not
  small coherent inline work merely because creation itself is quick.
  [confidence: 0.96 - certain]
- One MR per unit is an artifact boundary, not a user approval checkpoint.
  Accepted eligible work continues unless the user explicitly requests a staged
  pause. [confidence: 0.99 - certain]

## Domain Terms

| Term | Meaning |
| --- | --- |
| Publication-ready | A hook-clean, frozen source branch awaiting provider-only Finish dispatch; launch prerequisites may still be blocked. |
| Finish subagent | One task-local, MR-scoped provider owner that performs publication and hosted follow-through without repository writes. |
| Immutable publication packet | Exact source SHA, expected target-base identity, and reviewer-facing intent handed from the coordinator to Finish; any bound identity change requires a refreshed handoff. |
| Lane-scoped authority | Execute and Finish may operate concurrently in separate agents while each remains inside its lifecycle mutation boundary. |
| Dispatch barrier | The brief task-wide pause between a publication-ready transition and successful Finish-subagent start. |

## Reuse And Deviation Contract

Extend the existing canonical owners:

- portable and repository agent instructions own user-throughput priority and
  the five lifecycle authorities;
- investigation and implementation rules own ready-queue scheduling,
  serialization reasons, worktree ownership, and the publication boundary;
- Execute owns the hook-clean commit transition and immutable handoff to a
  provider-only lane;
- Finish owns provider mutation, MR-specific monitoring, and routing hosted
  findings back to Execute;
- Git and review rules own exact source SHA and target-base identity, draft
  invariants, provider ordering, and hosted-gate freshness;
- handoff and resume guidance owns task-local identity transfer and live-state
  reconstruction;
- existing lifecycle and agent-instruction tests own deterministic contract
  coverage; `writing-skills` owns behavior-under-pressure validation.

Reuse `change-request-create` and the selected provider adapter for MR title and
description policy and mechanics. Reuse `glab-stacked-diffs` only when the live
branches are a managed GitLab stack; ordinary explicit branch stacks continue
through the existing GitLab MR adapter. Introduce no new provider abstraction,
publisher script, scheduler, workflow service, persistent queue, or durable
handoff format. [confidence: 0.98 - certain]

The material deviation from current behavior is mandatory subagent delegation
at the publication-ready transition. Current guidance permits overlapping
Finish work but leaves inline execution available; this change makes an
MR-specific Finish subagent the default whenever descendant or other useful
work can overlap it. [confidence: 0.99 - certain]

## Atomic Delivery Shape

Deliver one plan-plus-implementation MR. The instruction, skill, handoff,
launch-visibility, and regression changes implement one lifecycle transition
with one rollback and review boundary. Splitting them would leave either unenforced
prose, an undocumented handoff, or tests without the accepted behavior. The
change requires no durable cross-component product specification, migration,
or disposable POC. [confidence: 0.97 - certain]

## Acceptance

- After a hook-clean unit commit in a multi-MR delivery, the coordinator starts
  an MR-specific Finish subagent before any agent begins another repository
  mutation. An already-running mutation finishes and pauses at its next safe
  tool boundary.
- A capacity, credential, authority, target-base identity, or provider blocker does
  not release the dispatch barrier. Repository mutation resumes only after the
  Finish lane starts. Only explicit withdrawal or supersession releases the
  barrier without the lane. This intentional task-wide hold prioritizes
  publication correctness and progressive MR visibility over temporary
  throughput; it ends immediately when the lane starts or the unit is withdrawn
  or superseded.
- Descendant Execute work continues after the Finish lane starts; it does not
  wait for MR creation, CI, or hosted review.
- Multiple ready MRs may have independent Finish subagents monitoring them
  concurrently while their provider mutations preserve target-branch and Git
  order.
- Every Finish handoff binds source branch, source SHA, target branch, expected
  target-base identity, draft intent, tracking semantics, provider route,
  reviewer policy, and prohibited repository mutations.
- Finish subagents never edit, commit, rebase, restack, mark ready, merge,
  deploy, or clean up. Hosted implementation findings return to the current
  Execute owner as one batch.
- The coordinator reports the Finish-subagent launch or its concrete blocker
  once in task commentary without maintaining a parallel status ledger.
- Every MR-specific Finish lane remains active or is replaced until draft
  technical readiness; replacement advances the provider-ownership generation,
  the prior provider owner is inactive and permanently read-only for its
  revoked generation before replacement mutation, and actionable Nitro and
  pipeline failures that need no user decision are repaired without another
  prompt.
- A changed source SHA or target-base identity invalidates the prior packet and
  hosted gates and requires a refreshed handoff.
- Atomic single-MR work with no useful overlap may remain inline; this exception
  cannot justify serializing a ready MR in a multi-unit stack.
- Accepted eligible units continue without waiting for `continue` between MR
  artifact boundaries.
- Merge, deployment, cleanup, and ready-state authority remain unchanged.

## First Real Confirmation

Run a behavior scenario based on the PAD-1949 sequence: a foundation unit
commits successfully, its descendant implementation is ready, provider policy
is resolved, and capacity exists. The expected next scheduling action is to
spawn an MR-scoped Finish subagent with an immutable publication packet before
any descendant file edit. An independently owned Execute mutation already in
flight finishes but pauses before its next mutation until the lane starts. The
foundation unit's Finish subagent publishes and monitors while the coordinator
edits the descendant. When the second unit commits, a second Finish subagent
starts; both hosted lanes remain active, and the second delays only provider
mutation that genuinely depends on the first target branch.
[confidence: 0.99 - certain]

A paired exception scenario has one small single-MR change and no useful
concurrent work. It may keep publication inline without manufacturing a
subagent. [confidence: 0.96 - certain]

## Verification

- Add focused instruction and lifecycle contract tests for lane-scoped modes,
  the publication-ready trigger, immutable publication packet fields, Finish
  mutation prohibitions, the task-wide dispatch barrier, launch/blocker
  commentary, and the bounded small-task exception.
- Add negative contract coverage that rejects treating Git predecessor order,
  one-writer ownership, a currently active second writer, unavailable capacity,
  or a later full-stack review as reasons to continue repository mutation before
  a ready Finish subagent starts.
- Run `writing-skills` RED, GREEN, and REFACTOR pressure scenarios using the
  observed commit-then-descendant-edit sequence, provider-ordering pressure,
  same-worktree rationalization, fast-inline pressure, unavailable-capacity
  handling, and a changed-head invalidation case.
- Run the focused lifecycle and agent-instruction test suites, shared-skill
  validation, repository lint and formatting validation, and the native
  hook-enabled commit suite.
- Publish the final atomic MR as draft, request configured hosted review, and
  complete exact-head local Review and hosted follow-through without merge.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Several subagents race provider mutations | Start lanes concurrently but gate each mutation on remote target-branch availability and expected target-base identity. |
| Finish accidentally becomes a second writer | Make repository mutation prohibitions part of the immutable publication packet, Finish contract, and pressure tests. |
| Stale packets publish the wrong head | Bind the source SHA and expected target-base identity, verify before mutation, and invalidate on either change. |
| Subagents create duplicate MRs or review requests | Require open-artifact discovery and live readback through existing Finish/provider adapters. |
| Commentary becomes a durable workflow ledger | Emit only the launch or blocker transition and rely on subagent plus live provider state afterward. |
| Small work creates coordination overhead | Retain the no-useful-overlap inline exception, while rejecting it for multi-unit stacks with ready descendant work. |
| Provider waits consume all capacity | Treat capacity as a concrete scheduler input and use supported task waits; keep the dispatch barrier closed when no slot exists. |

## Implementation Handoff

Implement from this branch and worktree after planning Review passes and the
plan is accepted. Preserve one repository writer for this worktree. Use
bounded read-only planning and implementation reviewers as required, keep all
review evidence task-local, and stop after draft publication, current CI and
hosted-review follow-through, and exact-head technical readiness. Merge,
deployment, cleanup, and live AX runtime synchronization are not authorized.
