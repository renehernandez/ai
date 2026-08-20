---
name: finish
description: Use when publishing implementation, creating or updating a PR or MR, following hosted feedback, reporting merge readiness, or performing explicitly authorized merge, deployment, or cleanup.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Finish

## Authority

Finish owns provider writes within granted scope. Shared policy is canonical in
`rules/investigation-and-implementation.md`; provider and terminal authority
live in `scripts/finish-contract.ts`.

Ordinary Standard implementation or delivery authority permits
draft publication and hosted follow-through, never merge, deployment, cleanup,
artifact disposal, or ready-state mutation. A clear eligible Fast selection is
activated profile authority to create or update its one MR as Ready, not merge
authority. Terminal actions require accepted authority naming the action and
artifact.
A user-authored aggregate or sequential merge scope covers its named sequence;
generic assent does not. Material effective-diff change renews authority for
affected artifacts. Single-MR merge authority is consumed after that MR merges.

An exact POC-disposal action and artifact closes only that POC unmerged.
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

Under Standard delivery, after a native hook-clean commit:

1. Publish the exact source head as a draft PR/MR, or preserve an existing MR's
   current draft or ready state.
2. Invoke `change-request-create` as the only selectable description and
   publication owner. It delegates provider mechanics to its references;
   preserve human-owned sections and verify hosted readback.
3. Request configured hosted review, then let local Review inspect the same
   hosted head concurrently. The pre-commit hook owns the full local suite;
   Review does not rerun it.
4. Monitor the newest effective pipeline graph and every configured reviewer.
   Diagnose failures and return one in-scope repair batch to the
   current Execute owner. After repair, refresh source-head review and affected
   closure. Continue until draft technical readiness or a genuine blocker.

Under explicit Fast delivery, replace that sequence with:

1. Invoke `change-request-create` to create or update the eligible Fullscript
   GitLab MR as Ready on the first published head.
2. Do not dispatch completed-code local Review or reviewer subagents.
3. Explicitly request Nitro after initial publication and every repair push.
4. Monitor the newest required pipeline graph and the complete exact-head Nitro
   response and unresolved discussions. Return actionable findings to Execute,
   publish each native-hook-clean repair, and repeat until both gates pass on
   the current Ready head.

Missing Nitro evidence blocks Fast completion. Ready publication never grants
merge, deployment, cleanup, artifact disposal, or force-push authority.

Requests to monitor GitLab feedback use one monitor owner for each MR and the
shared cooldown and single recovery probe in `rules/git-and-review.md`.

Reuse open artifacts and preserve human-owned body sections. Descriptions cover
scope, decisions, dependencies, verification, and actionable gaps. Create each
Standard final MR as draft; explicit eligible Fast creates or
updates Ready. Verify live state. For Standard, Readiness never authorizes marking it ready.

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

An atomic plan and implementation publish in one final PR/MR. An OpenSpec POC
publishes as one draft review-only `POC: ...` artifact and closes unmerged only
after durable learnings are reconciled and disposal is accepted. For a completed hook-clean POC,
publish its draft, request hosted review, and run completed-code Review. Its
completed-POC Review checkpoint establishes technical readiness, not initial draft publication
or other proof. This phase barrier is not a renewed user-permission checkpoint.
Final OpenSpec delivery creates one draft MR per unit.

The last completed-OpenSpec head contains completed tasks, synchronized specs,
and its dated archive. Missing state returns to Execute; Finish does not create it as cleanup.

## Provider-Only Delegated Lanes

An MR-scoped Finish subagent is a provider-only delegated lane. Its Immutable Publication Packet must
satisfy `rules/handoff-and-resume.md`. Before each mutation, validate source SHA,
target identity, lane identity, and provider-ownership generation against
live state; any mismatch invalidates it.

The lane may inspect state, push only its handed-off ref, use
`change-request-create`, request review, verify state, and monitor gates. It may not edit files,
change commits, switch worktrees, rebase, restack, repair, mark
ready, merge, deploy, clean up, comment, or mutate trackers. Return findings and
evidence to the current Execute owner.
Never accept repository-write ownership. This mutation
ceiling overrides broader task authority.

Keep it active through draft technical readiness. Replacement and revocation
follow the scheduling rule in `rules/investigation-and-implementation.md`; a
revoked generation becomes read-only and returns status. Verify expected target
identity before first mutation.

## Readiness

Technical readiness consumes Review's current
`technical_readiness_checkpoint` for the exact host, target, HEAD, and diff,
including hooks, required review results, repairs, rebase proof, provider route,
and semantic evidence. A changed target identity requires a fresh checkpoint;
patch-equivalence plus base-sensitive proof may preserve discovery.

Report `draft_stack_ready` for Standard only when every final artifact has current local and
provider gates, valid predecessor identity, complete task/spec state, and
required tracker mapping. Every MR remains draft until marked ready; only the
exact-user rule in `rules/git-and-review.md` may reverse that state. Current HEAD
gates and merge authority still apply.

For Fast, report current-head Ready delivery only after required CI and the
complete Nitro feedback surface are clean. Current HEAD gates and merge
authority still apply; the report never implies merge authorization.

## Terminal Actions

Merge only the accepted artifact after current checks. Mark only the authorized
MR ready. After merge, verify it, then retarget and restack only the immediate
child with an exact remote-head lease. Refresh its gates, preserve its current
draft or ready state, and leave deeper descendants untouched. Continue only
under aggregate or sequential authority and patch-equivalent diffs. Lease
rejection or material change stops the sequence.

Deployment and local or remote branch/worktree cleanup require their own exact
authority or activated policy. Verify remote merged state before cleanup; do
not force-delete as routine follow-through.
