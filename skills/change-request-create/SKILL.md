---
name: change-request-create
description: Use when creating or updating any GitHub pull request or GitLab merge request, including provider-explicit requests, mixed-host repositories, existing PR/MR URLs, or review-routing policy.
---

# Change Request Create

## Authority

This bounded Finish specialist is the only selectable PR/MR creation,
description, and update owner. It does not grant provider, merge, deployment,
cleanup, ready-state, or disposal authority. Finish supplies the exact
hook-clean source head and authorized mutation scope; this skill owns the
reviewer-facing title/body and delegates only provider mechanics.

Use it for every request to create, open, prepare, or update a PR, MR, change
request, or draft review. Explicit GitHub, GitLab, `gh`, or `glab` wording
selects an internal adapter but never bypasses this owner.

## Route

Select exactly one provider in this order:

1. existing artifact URL in the accepted context;
2. explicit user host choice;
3. project or workflow-policy profile;
4. target push remote for the branch;
5. a blocking routing question.

Do not infer the host from the first remote when multiple routes remain
plausible. Reuse an open artifact for the source branch; never create a
duplicate. Load only the selected adapter:

- [GitHub provider mechanics](references/github-provider.md)
- [GitLab provider mechanics](references/gitlab-provider.md)

## Publication Gate

Require a native hook-clean commit for the exact branch HEAD before creating or
updating an artifact that publishes agent-authored work. Missing, stale, or
different-head evidence blocks publication. Local Review and technical
readiness follow draft publication and hosted review; they do not gate creation
of the draft.

PR/MR titles and descriptions are hosted artifact metadata and do not require
the destination-bound confirmation used for covered GitLab and Linear
conversational messages. Once Finish supplies publication authority and this
skill resolves the route, template, relationships, and hook-clean head, create
or update the draft without previewing the title or body for a new permission
prompt.

## Reviewer-Facing Description

Load [description policy](references/description-policy.md) before composing or
updating a body. Preserve project templates, human-owned content, checklist
state, and ambiguous sections. Update only clearly managed sections and read
the hosted title/body back after mutation. Command success without safe
readback does not pass.

Describe what changed, why, reviewer focus, and only evidence or gaps that
materially change review confidence. Keep private workflow state, local support
paths, routine green checks, and author-facing gate narration out of the body.
Provider adapters must consume the finalized policy-compliant title and body
unchanged.

For GitLab work with relevant Linear issues, classify each relationship before
mutation as closing or contributing. Ambiguous completion intent blocks for a
contract decision. An explicit no-issue result adds no relationship statement
and does not remove a human-owned Tracking section. Detailed body, template,
POC, and relationship rules live in the description-policy reference.

## Output

Return the artifact URL, provider, source and target branches, exact source
head, draft/readiness state, whether an existing artifact was reused, targeted
review evidence included, relationship disposition or explicit no-issue result,
hosted readback result, and any reviewer-facing or recovery gap.
