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

Authority resolves as follows:

| User wording | Maximum default authority |
| --- | --- |
| `implement`, `deliver`, `proceed`, `publish`, `open/update the PR/MR`, `finish` | Publish and follow hosted feedback; no merge |
| `merge`, `ship`, `proceed to merge`, `merge when green`, `add to merge queue` | Merge or queue after current gates |
| `deploy` | Deployment after required delivery state |
| `clean up` | Only the named branch/worktree cleanup |

Ambiguous terminal language requires confirmation. Local-only, Execute-only,
Review-only, or status-only wording stops at that boundary. Hosted feedback
never expands authority.

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

Technical readiness consumes a current Review
`technical_readiness_checkpoint` bound to the hosted artifact, target base, and
HEAD. It carries every required phase review type, selected affected-domain
specialists, and successful bounded closure for any repair batch. A changed
target identity requires a fresh checkpoint, but patch-equivalent rebase
evidence may preserve discovery when Review confirms unchanged base-sensitive
context, required coverage, and affected verification. Material changes require
one new bounded discovery pass.

Reuse an open artifact for the branch instead of creating a duplicate. Preserve
provider templates and user-owned body sections. Descriptions contain
team-relevant scope, decisions, dependency links, verification that helps assess
the changed behavior, and actionable gaps. Omit local reviewer identities,
fingerprints, ledgers, gate mechanics, and routine green checks.

Before every PR/MR creation or description update, invoke
`change-request-create` as the host-neutral description-policy owner. It reads
the current template/body, protects human-owned sections and manual content,
filters routine workflow narration, and requires hosted readback after mutation.
After that policy pass, use `github-pr-create` or `glab-mr-create` only for the
selected provider's mechanics. A direct provider CLI/API body update never
bypasses this specialist pass.

For OpenSpec POC publication, create one draft PR/MR titled `POC: ...` against
the normal target and state that it is review-only and must close unmerged.
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

## Hosted Feedback Loop

Perform configured provider review requests and polling, then hand provider,
artifact URL, target base, exact target-base SHA, source head, status, and the
complete available feedback to Review for normalization. Route actionable
implementation findings to the current Execute lane owner as one batch. After
repairs, request refreshed hosted review for the new head, then Review runs
bounded closure only for affected types and verification. It starts new
discovery only for a material contract or review-risk change. Every changed
source head or resolved target-base SHA refreshes local readiness, CI, and
hosted gates.

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

Merge only under explicit merge language or activated project policy, after
current checks and approvals. Merge dependency chains bottom-to-top. Mark only
the current bottom MR ready immediately before its merge and wait for any
configured review triggered by that transition. After a squash merge, verify
the remote merged commit, retarget and restack the next draft child without
replaying predecessor commits, and refresh changed effective-diff gates before
marking that child ready.

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
| Marking a technically ready MR ready | Leave it draft until explicit merge authority starts its turn. |
| Stopping at MR creation or green parent CI | Monitor the full current pipeline/review cycle and route failures. |
| Trusting `No findings` without reading the note | Read the full response and applicable unresolved discussions. |
| Posting human-readable GitLab or Linear prose under general Finish authority | Show the exact destination-bound draft and obtain message-specific confirmation. |
| Waiting for local Review before creating the draft | Publish the hook-clean commit, request hosted review, then run local Review on the same head. |
| Reusing a stale checkpoint after repair or rebase | Refresh hosted review and run bounded closure or patch-equivalence validation on the new head. |
| Letting provider choice follow the first remote | Apply policy precedence and block ambiguity. |
| Writing a PR/MR body directly in Finish | Invoke `change-request-create`, then delegate provider mechanics. |
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
