# Git and review rules

These rules define native commits, exact-target Review evidence, Finish
publication, provider policy, and explicit terminal authority.

## Provider tools

- Use `gh` for GitHub PRs, issues, releases, and authenticated API calls.
- Use `glab` for GitLab MRs, discussions, pipelines, and authenticated API
  calls. Prefer a dedicated subcommand before `glab api`.
- Use provider-qualified commands when several repositories or hosts are
  available.
- Resolve provider behavior from direct user instruction, project policy, one
  workflow-policy profile, then remote inference. Ambiguous routing blocks
  provider writes without invalidating completed local work.
- For host-neutral PR/MR creation or description updates, Finish uses
  `change-request-create` before the selected provider adapter.

## Native commits and branch safety

- Use a native Git commit with repository hooks enabled. Never use `--no-verify`.
- Stage only the cohesive planning or implementation boundary owned by the
  current worktree. Fix and restage after a hook failure before retrying.
- Never commit or push a default branch without explicit user authorization.
- Do not force-push ordinary feedback, CI-fix, or follow-up commits. Force-push
  only for an explicitly authorized history rewrite or a necessary history
  repair such as rebase/conflict recovery.
- Before pushing a non-default branch, inspect matching hosted artifacts. Do not
  push when the only matching PR/MR is closed or merged; ask whether to create a
  new branch, reopen or explicitly reuse the artifact, or take another path.
- Select the provider before pushing. If a remote has multiple push URLs, push
  only to the selected provider URL or a provider-specific remote.

## Review and Finish boundary

Review is read-only. It inspects one planning artifact fingerprint or one exact
target-base diff and HEAD, covers every phase-specific review type, and
normalizes hosted findings retrieved by Finish. A small coherent change may use
one integrated inline pass; use subagents only when delegation is faster.

After a native hook-clean commit, Finish pushes and creates or updates the
draft PR/MR, requests configured hosted review, and starts local Review against
the same hosted head. Review and its subagents consume the pre-commit hook's
full-suite evidence instead of rerunning that suite.

For a delegated Finish lane, bind provider mutation to its immutable publication
packet. A changed source HEAD or resolved target-base SHA invalidates the packet
and every dependent hosted gate. The coordinator must refresh the packet before
that lane pushes, creates or updates an artifact, or requests review.

Review then emits a task-local `technical_readiness_checkpoint` containing:

- hosted artifact, target base, and exact HEAD;
- current target-base diff scope and repository-hook evidence;
- every phase-specific findings-only review outcome and affected-domain
  specialist;
- bounded closure for the enumerated repair findings and affected verification,
  when repairs occurred;
- confirmed patch equivalence, base-sensitive context, required coverage, and
  affected proof when discovery is reused after a rebase;
- resolved provider route;
- blocking findings.

If HEAD or the resolved target-base SHA changes, request refreshed hosted review
and emit a fresh exact-target checkpoint. Ordinary repairs receive one bounded
closure check for affected types; material contract or review-risk changes
receive one new discovery pass. A patch-
equivalent rebase may reuse discovery only with the evidence above. Missing
task-local evidence is recomputed; do not reconstruct or persist local gate
state through a repository or runtime tool.

Finish performs provider mutations and polling. Implementation or delivery
language alone authorizes publication and hosted feedback follow-through
without merge. An immediate `proceed` accepts a single explicit pending merge
action only when the immediately preceding agent turn identifies the exact
artifact scope and says that action awaits approval. Standalone or ambiguous
`proceed` grants no merge authority. Other merge authority requires explicit
action language or activated project policy. Deployment and cleanup require
explicit action language or activated project policy. Hosted findings do not
expand authority.

Finish remains active after publication. It monitors the newest effective
pipeline graph and every configured required reviewer, routes in-scope failures
to the current Execute lane owner, and repeats the Review/push/provider cycle
without another user prompt. MR creation, pending provider state, a green parent
pipeline, or a review request is not completion.

Required accessible jobs and downstream pipelines must pass. Allowed failures,
manual jobs, skipped jobs, and explicit no-pipeline state follow project policy.
Canceled or superseded older pipelines do not decide the current gate. Missing
credentials or inaccessible required provider state is a blocker; transient
provider delay remains under monitoring or a supported wakeup.

## Hosted artifact maintenance

- Before mutating an existing PR/MR, read its current head, target, state,
  description, discussions, approvals, and CI state needed by the action.
- After a commit changes scope, behavior, approach, deployment requirements, or
  reviewer-facing content, align the PR/MR description before requesting review.
- Describe the final diff. Do not narrate reverted approaches, local reviewer
  identities, private paths, fingerprints, ledgers, or author-only process.
- Verification sections contain behavior-specific reviewer evidence,
  reviewer-requested proof, or actionable gaps. Omit routine command logs,
  passing CI, and clean automated-review state unless they are the subject of
  the change or expose a gap.
- Preserve template instructions and human-owned sections. A Testing section
  that explicitly requires owner or human input is never auto-filled.
- Read the hosted body back after creation or update; restore or block when
  manual content, links, checklist state, or protected sections were damaged.

### Agent-authored provider messages

Before submitting a human-readable GitLab or Linear comment, discussion reply,
note, issue comment, or project update through the user's identity:

1. Show the exact provider destination and exact rendered draft, including this
   notice:

   > Automatically generated by `<active harness>`. Approved for submission by Rene Hernandez.

   Replace `<active harness>` with the actual generating harness name. For
   Codex, the rendered notice is `Automatically generated by Codex. Approved for submission by Rene Hernandez.` Never claim a different generator.

2. Ask for explicit confirmation of that destination-bound draft. Do not submit
   it until the user confirms it.
3. Submit only the unchanged confirmed draft to the confirmed destination.

Implementation, delivery, Finish, or prior provider-write authority does not
replace this message-specific confirmation. Contract-preserving wording from an
approved outline is still an unconfirmed draft. If content or destination
changes, obtain a new confirmation for the new destination-bound draft before
submission.

This checkpoint does not apply to command-only review notes such as
`/request_review @nitro` or service-generated output posted through a distinct
service identity. Do not add the notice to commits, PR/MR descriptions, issue
bodies, or historical messages.

For a human-readable provider comment outside this GitLab and Linear
checkpoint, such as a GitHub comment, retain `Co-Authored by: <harness>`. Do
not use the GitLab/Linear approval notice there. Replace `<harness>` with the
active agent harness name. Do not add that footer to commits, PR/MR
descriptions, issue bodies, service-generated output, command-only review
notes, or historical
messages.

## GitLab review requests

Request or re-request GitLab review through a new top-level MR note containing
only the slash command:

```text
/request_review @alice @bob
```

Use one note for all reviewers in that request. Do not edit an old note, reply
inside a discussion, modify the MR description, or change the reviewer field as
a substitute.

When active Fullscript project policy selects Nitro, Finish posts
`/request_review @nitro` after initial publication and every effective-diff
change: either the source HEAD or resolved target-base SHA. Latest-effective-diff
Nitro feedback must complete without unresolved actionable findings. Feedback
tied to an earlier source HEAD or target-base SHA is stale.

Before publishing or requesting hosted review for a final implementation,
measure its complete effective diff. Target at most 10 changed files and 500
additions plus deletions. More than 15 files or 1,000 changed lines returns to
Plan unless the user approved an exception bound to the exact artifact, source
HEAD, target-base SHA, counts, rationale, consequences, and task-local approval
evidence. Any artifact, HEAD, or target-base change invalidates it. The complete
disposable POC is exempt.

GitHub PR review does not request, poll, normalize, or gate on Codex-authored
review feedback. `codex-review-feedback` remains retired.

## AI repository delivery

- This repository publishes through GitLab `origin`. A single or root MR targets
  `main`; each stacked descendant targets its immediate predecessor branch until
  that predecessor merges and the child is retargeted.
- The GitHub remote is a mirror and is used only under explicit direction or a
  documented GitLab outage path.
- Finish inspects CI or explicit no-pipeline state and latest-effective-diff
  Nitro before reporting readiness.
- No planning-only MR is created. A POC is draft and closes unmerged. An atomic
  plan and its implementation form one change set in one final MR, with no POC
  phase; OpenSpec produces one final MR per top-level delivery unit.
- Every final MR is created as draft and verified live as draft. Local Review,
  CI, approvals, hosted review, and technical readiness never remove draft
  status.
- Final implementation never uses POC commits or ancestry.

## Multi-unit final delivery

- Top-level delivery-unit order defines one total Git predecessor chain.
- Logical dependencies control semantic eligibility; the total chain controls
  branch ancestry and merge order.
- Seed every branch/worktree before implementation. The root MR targets the
  normal target branch; each descendant MR targets its immediate predecessor
  source branch and restacks onto the predecessor's current published head
  before first publication.
- Implement semantically eligible units concurrently in singly owned
  worktrees. Keep publication and restack propagation ordered, and coalesce
  superseded upstream heads into one restack onto the newest reviewed
  predecessor.
- A descendant Finish lane may start as soon as its immutable packet is known,
  while provider mutation waits for the target branch to exist remotely and
  match the packet's expected target-base identity. CI and hosted review for
  already published units continue independently of that ordered mutation.
- Set formal GitLab blocking dependencies when the provider supports them.
- Merge explicitly authorized final units from the bottom of the chain to the
  top. Use each live source HEAD as the merge guard.
- After a predecessor squash-merges, refresh the child, verify its target
  changed to the default branch, and restack it with the verified merged commit
  and old predecessor head so predecessor commits are not replayed.
- Restack pushes use an exact expected remote-head lease. On lease rejection,
  inspect external commits and re-establish ownership before integrating them;
  never retry by blindly accepting the new remote SHA.
- Every changed descendant effective diff reruns its delivery budget, local
  Review, CI, approvals, and configured hosted automated review before merge.
- Stop before the next merge when default-branch CI for the landed predecessor
  is failed, blocked, or unavailable under project policy.
- Technical stack readiness leaves every MR draft. Explicit merge authority
  starts a frozen bottom-to-top sequence: mark only the current MR ready, wait
  for any required review triggered by that transition, merge it, then restack
  and revalidate the next draft MR.

## Commit and artifact titles

- Choose semantic prefixes from consumer impact and release behavior, not from
  the apparent file type.
- Inspect repository release configuration and recent history before choosing a
  prefix that may publish or version an artifact.
- Do not add AI co-author attribution to commit or PR/MR titles and
  descriptions.

## Linear

- Before repository implementation begins for a Linear-tracked issue, route one
  pre-implementation ownership step through Finish. Finish re-reads the issue
  and, when present, its project through `linearis`, then resolves the
  authenticated Linear user. An issue without a project skips only the
  project-lead branch. This invokes Finish as the sole provider-write owner,
  not as a transition into terminal Finish work.
- If the issue is unassigned, assign it to the authenticated Linear user. If it
  is already assigned to the authenticated Linear user, continue. If it is
  assigned to another user, stop before repository or provider mutation and ask
  the user for instructions.
- When the issue's project has no lead and its verified creator is the
  authenticated Linear user, assign that user as the project lead. Never infer
  project creation identity, and preserve an existing project lead. When
  project lead or creator metadata is unavailable, skip and report the
  project-lead update; do not block an otherwise verified issue assignment.
- Once start-work authority exists and no assignee conflict remains, apply the
  eligible start-work ownership mutations without another prompt. Change only
  the eligible assignee and project-lead fields, then verify the changed fields
  by readback before implementation starts. The accepted start-work policy is
  confirmation for these eligible scalar writes, including the conditional
  project-lead update; it does not confirm any other provider action.
- Block implementation and report the concrete failure when a required
  ownership read, authenticated-user resolution, write, or readback is
  unavailable, fails, or does not match. This pre-implementation Finish step
  grants no publication, merge, deployment, cleanup, or unrelated provider
  authority.
- Never assign an automated agent as a Linear delegate without explicit user
  confirmation.
- Create issues in the project's delivery-ready status required by active
  policy; never invent a fallback status.
- Scope, acceptance, and verification remain canonical in the Plan artifact.
  Linear remains canonical for assignment, priority, scheduling, and status.
