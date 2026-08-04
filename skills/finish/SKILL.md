---
name: finish
description: Use when publishing implementation, creating or updating a PR or MR, following hosted feedback, reporting merge readiness, or performing explicitly authorized merge, deployment, or cleanup.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Finish

## Authority

Finish owns provider writes within granted scope. Entering Finish, asking to
"finish," or completing implementation does not grant merge, deployment, or
cleanup authority. For non-trivial entry, announce `Finish`, current provider or
terminal authority, and the goal once.

Apply the accepted-proposal contract in
[`investigation-and-implementation.md`](../../rules/investigation-and-implementation.md).
Finish uses these local ceilings:

| Accepted proposal | Maximum authority |
| --- | --- |
| Standard delivery or an exact publication request | Publish and follow hosted feedback; no terminal action |
| One exact merge action and artifact | Merge or queue after current gates |
| User-authored aggregate or sequential merge scope | Merge only the named sequence while its effective diffs remain patch-equivalent |
| One exact deployment action and target | Deploy after required delivery state |
| One exact cleanup action and target | Clean up only that scope |
| One exact POC-disposal action and artifact | Close only that POC unmerged |
| One exact PR/MR-disposal action and artifact | Close, cancel, supersede, or abandon only that artifact |

Any unambiguous contextual acceptance of an exact terminal proposal grants only
that action; no confirmation word has special meaning. Generic assent to an
agent-proposed multi-MR sequence does not create aggregate scope. Ambiguous
terminal intent grants no terminal authority. Local-only, Execute-only,
Review-only, or status-only limits stop at that boundary, and hosted feedback
never expands it.

Replacement or consolidation authority does not dispose of existing review
artifacts. Closing, canceling, superseding, or abandoning a PR/MR requires its
own exact artifact-scoped proposal and acceptance.

## Human-Readable Provider Messages

Before Finish submits any human-readable GitLab or Linear message through the
user's identity, it MUST apply the destination-bound confirmation contract in
`rules/git-and-review.md#agent-authored-provider-messages`. General
implementation, delivery, Finish, or prior provider-write authority never
bypasses that checkpoint. Keep command-only review requests on their exact
command path.

## Provider And Publication

Resolve host and reviewer policy in this order: direct user instruction,
project policy, workflow-policy profile, remote inference. Ambiguity blocks
provider mutation without invalidating local work. GitHub, generic GitLab, and
Fullscript GitLab/Nitro use their configured CI, approval, and reviewer gates.

After a native hook-clean commit, push and create or update the draft PR/MR
without waiting for local Review. Request configured hosted review, then start
local Review against that same exact hosted head so both can proceed
concurrently. The hook evidence is the full local-suite proof for the commit;
local Review and review subagents do not rerun that suite.

For Fullscript GitLab policy that selects Nitro, apply the installed Fullscript
Nitro rule as the canonical owner for request timing, command selection,
duplicate suppression, and latest-head closure. Finish executes that policy;
it does not redefine it here.

Before publication and every hosted-review request, measure the complete
effective diff. Non-removal final implementations target at most 10 changed
files and 500 additions plus deletions and cap at 15 files or 1,000 changed
lines without an approved semantic exception. The exception binds to the named
artifact, accepted outcome, and unsafe-to-split rationale and survives
contract-preserving identity, count, and repair changes. Renew it only for a
material outcome, ownership, behavior, deployment, review-boundary, or
practical split change. A non-removal final MR may never exceed 50 files. A
removal-only MR has no numeric file or line cap when it adds no replacement
behavior, dependency, migration, or unrelated refactoring. The complete
disposable POC is exempt.

Technical readiness consumes a current Review
`technical_readiness_checkpoint` bound to the hosted artifact, target base, and
HEAD. It carries every required phase review type, selected affected-domain
specialists, and successful bounded closure for any repair batch. A changed
target identity requires a fresh checkpoint, but patch-equivalent rebase
evidence may preserve discovery when Review confirms unchanged base-sensitive
context, required coverage, and affected verification. Material changes require
one new bounded discovery pass.

For Fullscript GitLab/Nitro, a passing deterministic raw receipt is necessary
but insufficient. Finish must read the complete Nitro response and every
unresolved Nitro-authored discussion, record an exact-head
`hostedFeedbackSemanticReview` with its evidence and any actionable feedback,
and block readiness unless that semantic review passes with no actionable
feedback.

Reuse an open artifact for the branch instead of creating a duplicate. Preserve
provider templates and user-owned body sections. Descriptions contain
team-relevant scope, decisions, dependency links, verification that helps assess
the changed behavior, and actionable gaps. Omit local reviewer identities,
fingerprints, ledgers, gate mechanics, and routine green checks.

Before every PR/MR creation or description update, including a
provider-explicit request, invoke `change-request-create` as the only selectable
description and publication owner. It reads the current template/body,
protects human-owned sections, filters routine workflow narration, executes its
internal GitHub or GitLab mechanics, and requires hosted readback. A direct
provider CLI/API body update never bypasses this owner.

For OpenSpec POC publication, create one draft PR/MR titled `POC: ...` against
the normal target and state that it is review-only and must close unmerged.
Technical readiness and personal acceptance leave it open. Close it only after
Plan reconciles durable learnings against the accepted head and the user
accepts an exact closure proposal or a presented stack-breakdown proposal whose
first action is closing that named POC.
Consume the completed-POC Review checkpoint; the narrower
first-objective-proof checkpoint cannot authorize publication. CI, hosted
review, and operational proof cannot substitute for local Review. For atomic-
plan delivery, publish the plan and implementation together as one change set
in one final PR/MR, with no planning-only or POC artifact. For final OpenSpec
delivery, create one mergeable PR/MR per top-level delivery unit and no planning
or reconciliation-only artifact.

Create every final MR as draft and verify its live provider state after
creation or update. Local Review, CI, approvals, hosted review, and technical
readiness never authorize changing it from draft to ready.

## Provider-Only Delegated Lanes

An MR-specific Finish subagent is a provider-only delegated lane. Its immutable
publication packet must match the canonical Immutable Publication Packet in
`rules/handoff-and-resume.md`; do not replace it with a partial field list.
Before every provider mutation, validate the exact source SHA, expected
target-base identity, Finish lane identity, and provider-ownership generation
against live state and the coordinator's current task-local designation;
invalidate the packet when any changes.

The lane may inspect Git/provider state, push only the handed-off exact ref,
reuse or create the draft artifact through `change-request-create`, verify live
state, request hosted review, and monitor current
gates. It may not edit files, change commits, switch the coordinator's worktree,
rebase, restack, resolve implementation findings, mark ready, merge, deploy, or
clean up. Its mutation ceiling overrides any broader task-level terminal
authority. It returns provider evidence and findings to the current Execute
owner and never accepts repository-write ownership.

The lane must remain active through draft technical readiness. The coordinator
replaces an exited, errored, or stalled lane only through the canonical
scheduling rule in `rules/investigation-and-implementation.md`. A lane holding a
revoked provider-ownership generation remains read-only and returns status. A
replacement inherits no broader mutation authority.

A descendant delegated lane may start before its target branch exists remotely.
It waits inside Finish before provider mutation until that branch exists and
matches the packet's expected target-base identity. Unrelated published lanes
keep monitoring concurrently.

## Hosted Feedback Loop

Perform configured provider review requests and polling, then hand provider,
artifact URL, target base, exact target-base SHA, source head, status, and the
complete available feedback to Review for normalization. Route actionable
implementation findings that require no user decision or authority expansion to
the current Execute lane owner as one automatic repair batch. An actionable
Nitro finding remains actionable when labeled nonblocking. Diagnose each
pipeline failure and route its in-scope repair to the current Execute owner
without another user prompt. After every repair push, request refreshed hosted
review for the new source head as defined by the canonical Nitro rule, then Review runs bounded
closure only for affected types and verification. Continue the request,
monitor, repair, push, and re-request loop until the latest head has no
actionable feedback or a material decision needs human follow-up. A
human-blocked MR does not stop unrelated authorized work. New discovery starts
only for a material contract or review-risk change. Target-only movement on an
unpromoted descendant does not request Nitro or restack it; its gates remain
provisional.

Do not stop at publication, a pending pipeline, a green parent pipeline, a
review request, or reassuring summary language. Continue monitoring the newest
effective pipeline graph and every configured required reviewer. Diagnose and
route in-scope failures to the current Execute owner for fixes, publish the
reviewed head, request fresh review, and repeat without another user prompt.
Use a supported wait or wakeup while
external state is pending. Stop only for technical draft-stack readiness or a
genuine contract, authority, credential, ownership, or provider blocker.

Required accessible jobs and downstream pipelines must pass. Apply project
policy to allowed failures, manual or skipped jobs, and explicit no-pipeline
state. Ignore superseded pipeline results in favor of the newest effective
diff.

Report merge or stack readiness only when every declared final artifact has
current local/provider gates, valid predecessor identity, complete task/spec
state, and required tracker mapping. For completed OpenSpec delivery, the last
final-unit head must also contain synchronized canonical specs and the dated
archive while no completed change remains active. Missing or inconsistent
archive state returns to the same Execute owner; Finish does not create it.
Report `draft_stack_ready` while every MR remains draft. Readiness, ready state,
and review requests are not merge authority.

## Terminal Actions

Merge only when the accepted proposal contains one exact merge action and
artifact, a user-authored aggregate or sequential scope, or activated project
policy that enumerates its artifact scope, after current checks and approvals.
Single-MR authority is consumed
after that merge. Mark only that MR ready and wait for any configured review
triggered by the transition. After a squash merge, verify the remote merged
commit, retarget and restack only the immediate draft child without replaying
predecessor commits, and refresh its gates while leaving it draft. Continue a
dependency chain bottom-to-top only under aggregate or sequential authority and
only across patch-equivalent restacks. A material effective-diff change stops
the sequence before every affected MR and requires renewed authority. Leave
deeper descendants untouched until their predecessor merges.

Restack pushes use an exact expected remote-head lease. If it is rejected, stop
and inspect external commits and ownership; never retry by simply accepting the
new remote SHA.

Deployment and local/remote branch or worktree cleanup require their own
explicit authority or activated project policy. Verify remote merged state
before cleanup; never force-delete as ordinary follow-through.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Treating `finish` as permission to merge | Publish/follow gates, then report readiness. |
| Requiring magic wording after one exact terminal action is awaiting approval | Apply any unambiguous contextual acceptance only to that action and target. |
| Treating one MR's authority as authority for its child | Consume it after merge; repair the child and leave it draft. |
| Treating assent to an agent-proposed sequence as stack authority | Require the user's own aggregate or sequential merge scope. |
| Carrying sequence authority across a material diff change | Stop before affected MRs and require renewed authority after review. |
| Marking a technically ready MR ready | Leave it draft until explicit merge authority starts its turn. |
| Stopping at MR creation or green parent CI | Monitor the full current pipeline/review cycle and route failures. |
| Trusting `No findings` without reading the note | Read the full response and applicable unresolved discussions. |
| Posting human-readable GitLab or Linear prose under general Finish authority | Show the exact destination-bound draft and obtain message-specific confirmation. |
| Waiting for local Review before creating the draft | Publish the hook-clean commit, request hosted review, then run local Review on the same head. |
| Reusing a stale checkpoint after repair or rebase | Refresh hosted review and run bounded closure or patch-equivalence validation on the new head. |
| Letting provider choice follow the first remote | Apply policy precedence and block ambiguity. |
| Writing a PR/MR body directly in Finish | Invoke `change-request-create`, then delegate provider mechanics. |
| Applying task-level merge authority inside a provider-only delegated lane | The packet's narrower mutation ceiling controls; return terminal work to the coordinator. |
| Splitting an atomic plan from its implementation | Publish both as one change set in one final PR/MR. |
| Treating green POC CI as architecture approval | Require the current POC-specific local Review checkpoint for readiness. |
| Merging because all gates are green | Require explicit merge authority or activated policy. |
| Treating completed-change archival as terminal cleanup | Require the archive on the reviewed final-unit head and return missing state to Execute. |

## Test Evidence

- RED: baseline agents treated accepted Finish follow-through and an approved
  Linear outline as authority to publish unseen provider prose.
- GREEN: the canonical destination-bound contract forced the exact rendered
  draft, disclosure, and explicit confirmation before submission; changed
  content or destinations required confirmation again.
- REFACTOR: blanket prior approval did not bypass the message checkpoint, and
  mixed command-plus-prose output kept only the command-only note exempt.
- RED: the prior lifecycle left a fresh agent unable to distinguish final-unit
  repository archival from Finish cleanup or place it relative to exact-head
  publication and review.
- GREEN: a green reviewed draft plus a closing merge window does not bypass the
  archive gate; Finish returns the missing state to Execute and refreshes gates
  for the resulting head.
