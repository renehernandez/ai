---
name: finish
description: Use when publishing implementation, creating or updating a PR or MR, following hosted feedback, reporting merge readiness, or performing explicitly authorized merge, deployment, or cleanup.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Finish

## Authority

Finish owns provider writes within granted scope. Announce non-trivial authority
and goal. Shared policy is canonical in
`rules/investigation-and-implementation.md`; provider selection and terminal
authority live in `scripts/finish-contract.ts`.

Ordinary implementation or delivery authority permits draft publication and
hosted follow-through, never merge, deployment, cleanup, artifact disposal, or
ready-state mutation. They require an accepted proposal or activated policy
naming the exact action and artifact. Unambiguous acceptance authorizes only the
pending exact terminal action.
A user-authored aggregate or sequential merge scope covers its named sequence;
generic assent does not. Material effective-diff change renews authority for
affected artifacts. Single-MR merge authority is consumed after that MR merges.

An exact POC-disposal action and artifact may close only that POC unmerged.
Replacement or consolidation does not dispose of existing review artifacts.
Narrower limits remain binding; hosted feedback cannot expand authority.

Before posting human-readable GitLab or Linear comments, discussion replies,
notes, issue comments, or project updates through the user's identity, MUST apply
the destination-bound confirmation contract in
`rules/git-and-review.md#agent-authored-provider-messages`. General provider
authority never bypasses it. The checkpoint does not apply to command-only
review requests, service-generated output through a distinct service identity,
commits, PR/MR titles or descriptions, issue bodies, or historical messages.

## Publish and Follow Through

Resolve provider and reviewer policy in this order: direct user instruction,
project policy, workflow-policy profile, remote inference. Ambiguity blocks
provider mutation without invalidating local work.

After a native hook-clean commit:

1. Publish a new exact source head as a draft PR/MR, or update an existing MR
   without changing its current draft or ready state.
2. Invoke `change-request-create` as the only selectable description and
   publication owner. It preserves human-owned sections, delegates provider
   mechanics to its references, and verifies hosted readback.
3. Request configured hosted review, then let local Review inspect the same
   hosted head concurrently. The pre-commit hook owns the full local suite;
   Review does not rerun it.
4. Monitor the newest effective pipeline graph and every configured reviewer.
   Diagnose failures and return one in-scope repair batch to the current
   Execute owner. After a repair push, refresh source-head review and affected
   Review closure. Continue until draft technical readiness or a genuine
   contract, authority, credential, ownership, or provider blocker.

Requests to monitor GitLab feedback use one monitor owner for each MR and the
shared cooldown and single recovery probe in `rules/git-and-review.md`.

Reuse an open branch artifact and preserve human-owned body sections.
Descriptions include review scope, decisions, dependencies, verification, and
actionable gaps; omit private evidence and routine green narration. Create every
final MR as draft and verify live state after each mutation. Readiness never
authorizes marking it ready.

For Nitro-selected Fullscript GitLab work, `rules/fullscript/nitro-review.md`
owns request timing, size routing, duplicate suppression, and latest-head
closure. A passing raw receipt is necessary but insufficient: read the complete
Nitro response and all unresolved Nitro-authored discussions. Record exact-head
`hostedFeedbackSemanticReview` evidence and block readiness on any actionable
feedback, including findings labeled nonblocking. Target-only movement on an
unpromoted descendant neither requests Nitro nor permits a restack.

Apply project policy to allowed, manual, skipped, or absent jobs. Superseded
pipelines do not prove the newest effective diff.

## Delivery Shapes

An atomic plan and implementation publish together in one final PR/MR, with no
planning-only or POC artifact. An OpenSpec POC publishes as one draft
review-only `POC: ...` artifact against the normal target and closes unmerged
only after durable learnings are reconciled and exact disposal is accepted.
A completed hook-clean POC follows the publication sequence above: publish its
draft, request hosted review, then run completed-code Review on that head.
Consume the completed-POC Review checkpoint for technical readiness, not
initial draft publication; first-objective review, CI, hosted review, or
operational proof cannot substitute for it. This is a phase barrier, not a
renewed user-permission checkpoint. Final OpenSpec delivery creates one
mergeable draft PR/MR per top-level unit.

For a completed OpenSpec, the last reviewed head must contain completed tasks,
synchronized canonical specs, removal from active discovery, and the dated
archive. Missing state returns to Execute; Finish does not create it as cleanup.

## Provider-Only Delegated Lanes

An MR-scoped Finish subagent is a provider-only delegated lane. Its immutable
packet must satisfy the canonical Immutable Publication Packet in
`rules/handoff-and-resume.md`. Before each mutation, validate source SHA,
target identity, lane identity, and provider-ownership generation against live
state. Any mismatch invalidates the packet.

The lane may inspect Git and provider state, push only the handed-off exact ref,
create or reuse its draft through `change-request-create`, request hosted
review, verify state, and monitor gates. It may not edit files, change commits,
switch the coordinator worktree, rebase, restack, repair findings, mark ready,
merge, deploy, clean up, comment, or mutate tracker state. This mutation
ceiling overrides broader task authority. Return provider evidence and findings
to the current Execute owner; never accept repository-write ownership.

Keep the lane active through draft technical readiness. Replacement and
revocation follow the scheduling rule in
`rules/investigation-and-implementation.md`; a revoked generation becomes
read-only and returns status. A descendant lane may wait for its target branch
to appear, but must verify the packet's expected target identity before its
first mutation.

## Readiness

Technical readiness consumes Review's current
`technical_readiness_checkpoint` for the exact hosted identity, resolved target
base, HEAD, and target-base diff. It must include hook evidence, delivery-budget
assessment, every required phase and domain result, repair closure, applicable
rebase proof, provider route, and hosted semantic evidence. A changed target
identity requires a fresh checkpoint; Review may preserve discovery only with
patch-equivalence and base-sensitive proof. Material change requires new
discovery.

Report `draft_stack_ready` only when every final artifact has current local and
provider gates, valid predecessor identity, complete task/spec state, and
required tracker mapping. Every MR remains draft until marked ready; only the
exact-user rule in `rules/git-and-review.md` may reverse that state. Current HEAD
gates and merge authority still apply.

## Terminal Actions

Merge only within exact accepted artifact scope after current checks and
approvals. Mark only the authorized MR ready and wait for policy-triggered
review. After merge, verify the remote commit, then retarget and restack only
the immediate child with an exact expected remote-head lease. Refresh its gates,
preserve its current draft or ready state, and leave deeper descendants
untouched. Continue bottom-to-top only under aggregate or sequential authority
and patch-equivalent effective diffs. A lease rejection stops for inspection of
external commits and ownership; a material diff stops the sequence for renewed
authority.

Deployment and local or remote branch/worktree cleanup require their own exact
authority or activated policy. Verify remote merged state before cleanup; do
not force-delete as routine follow-through.
