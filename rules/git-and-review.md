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
target-base diff and HEAD, runs the required local reviewer baseline, and
normalizes hosted findings retrieved by Finish.

Before any push, PR/MR creation, or PR/MR update, Review emits a task-local
`publication_checkpoint` containing:

- target base and exact HEAD;
- current target-base diff scope;
- repository-hook evidence;
- required local reviewer outcomes;
- resolved provider route;
- blocking findings.

If HEAD or target base changes, the checkpoint becomes stale. Missing task-local
evidence is recomputed; do not reconstruct or persist local gate state through a
repository or runtime tool.

Finish performs provider mutations and polling. Implementation or delivery
language authorizes publication and hosted feedback follow-through without
merge. Merge, deployment, and cleanup require explicit user language or an
activated project policy. Hosted findings do not expand authority.

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
- When posting a human-readable comment on the user's behalf, append
  `Co-Authored by: <harness>`. Do not add attribution to commits, PR/MR
  descriptions, service-generated bodies, or command-only review notes.

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
`/request_review @nitro` after initial publication and every head-changing
follow-up push. Latest-head Nitro feedback must complete without unresolved
actionable findings. Feedback tied to an earlier head is stale.

## AI repository delivery

- This repository publishes through GitLab `origin` MRs targeting `main`.
- The GitHub remote is a mirror and is used only under explicit direction or a
  documented GitLab outage path.
- Finish inspects CI or explicit no-pipeline state and latest-head Nitro before
  reporting readiness.
- No planning-only MR is created. A POC is draft and closes unmerged. An atomic
  plan produces one final MR; OpenSpec produces one final MR per top-level
  delivery unit.
- Final implementation never uses POC commits or ancestry.

## Multi-unit final delivery

- Top-level delivery-unit order defines one total Git predecessor chain.
- Logical dependencies control semantic eligibility; the total chain controls
  branch ancestry and merge order.
- Set formal GitLab blocking dependencies when the provider supports them.
- Merge explicitly authorized final units from the bottom of the chain to the
  top. Use each live source HEAD as the merge guard.
- After a predecessor squash-merges, refresh the child, verify its target
  changed to the default branch, and restack it onto the verified merged commit.
- Every changed descendant HEAD reruns local Review, CI, approvals, and
  configured hosted automated review before its merge.
- Stop before the next merge when default-branch CI for the landed predecessor
  is failed, blocked, or unavailable under project policy.

## Commit and artifact titles

- Choose semantic prefixes from consumer impact and release behavior, not from
  the apparent file type.
- Inspect repository release configuration and recent history before choosing a
  prefix that may publish or version an artifact.
- Do not add AI co-author attribution to commit or PR/MR titles and
  descriptions.

## Linear

- Never assign an automated agent as a Linear delegate without explicit user
  confirmation.
- Create issues in the project's delivery-ready status required by active
  policy; never invent a fallback status.
- Scope, acceptance, and verification remain canonical in the Plan artifact.
  Linear remains canonical for assignment, priority, scheduling, and status.
