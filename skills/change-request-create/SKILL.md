---
name: change-request-create
description: Use when creating or updating a GitHub pull request or GitLab merge request from a host-neutral request, mixed-host repository, existing PR/MR URL, or review-routing policy.
---

# Change Request Create

Create or update a hosted change request while keeping route selection
host-neutral and descriptions reviewer-facing. This skill owns routing and body
policy; provider adapters own provider-specific mutation mechanics.

## When To Use

Use this skill when the user asks to create, open, update, or prepare a PR, pull
request, MR, merge request, change request, review artifact, or draft review
without explicitly requiring a provider-only workflow.

Use the provider adapter directly when the user explicitly asks for the GitHub
or GitLab workflow and routing is already clear:

| Provider | Adapter |
| --- | --- |
| GitHub pull request | `github-pr-create` |
| GitLab merge request | `glab-mr-create` |

## Route Selection

Select exactly one hosted artifact provider in this order:

1. Existing artifact URL named by the user or current context.
2. Explicit user host choice, such as "GitHub PR" or "GitLab MR".
3. `review-feedback-routing` artifact route, especially
   `artifact.create_adapter`.
4. Target push remote for the branch.
5. Ask a blocking routing question or report blocked.

Do not guess from the first remote by position when multiple hosts remain
plausible. Do not configure `change-request-create` as an
`artifact.create_adapter`; delegate to `github-pr-create` or `glab-mr-create`.

## Description Policy

Write the hosted description for reviewers, not for the author workflow. It
should answer:

- what changed;
- why it changed;
- where reviewers should focus;
- what targeted evidence or hosted status changes review or merge confidence.

Omit unnecessary internal process and tooling references anywhere in the body,
including local skill paths, temporary planning files, subagent gates, internal
review labels, verification ledgers, automation-routing details, and routine
local commands already represented by CI or standard repo hooks.

Do not expose local private support artifact paths such as `~/.ax/plans/...`,
raw private support artifacts, or private thread metadata by default. When
support-artifact evidence is relevant to reviewers, use summaries, hashes,
thread references, note IDs, discussion IDs, or stable correlation IDs instead
of local filesystem paths.

Keep evidence when it helps a reviewer assess risk:

- targeted regression commands or fixtures;
- reproduction checks;
- browser route, console, viewport, migration, or operational verification;
- reviewer-requested proof;
- failed, pending, missing, unavailable, or stale hosted checks;
- required reviewer, approval, or merge status that needs attention.

Do not restate routine green hosted checks or routine local typecheck, lint,
format, pre-commit, pre-push, or diff-hygiene commands when the artifact host,
CI, or repository hooks already show them.

## Template And Update Safety

Prefer project templates and preserve their structure. Fill placeholders with
concise reviewer-facing content instead of replacing the template shape.

For GitHub, inspect the usual template locations:

- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md`

For GitLab, use provider/project templates when surfaced by the adapter and
repo-local `.gitlab/merge_request_templates` conventions when present.

If multiple templates match and no user choice or repo convention identifies
one, ask which template to use.

When updating an existing PR or MR, fetch the current title and body through the
provider adapter. Preserve reviewer notes, links, resolved checklist state, and
manual sections. Replace only sections clearly bounded by managed HTML comments
such as:

```markdown
<!-- change-request-create:start -->
...
<!-- change-request-create:end -->
```

Ask before replacing any section whose ownership is ambiguous.

## Workflow

1. Inspect the current branch, remotes, status, existing artifact URL, and any
   repo-local routing policy relevant to artifact creation.
2. Select the provider with the route precedence above.
3. Check whether an open PR or MR already exists for the source branch or named
   artifact. Return or update it instead of creating a duplicate.
4. Inspect commits and diff against the target branch for title and body
   context.
5. Build or update the description using the description policy and template
   preservation rules above.
6. Delegate provider-specific mutation:
   - GitHub: use `github-pr-create`.
   - GitLab: use `glab-mr-create`.
7. Return the artifact URL, source and target branches, draft/readiness state,
   routed provider, targeted evidence included, and any hosted status or
   verification gap reviewers need.

Use a body file when the provider CLI supports one and the description contains
multi-line Markdown, checkboxes, or content that is brittle to pass through shell
flags.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Choosing the first remote in a mixed-host repo | Apply route precedence and ask when ambiguous |
| Duplicating provider CLI mechanics here | Delegate mutation to `github-pr-create` or `glab-mr-create` |
| Replacing a whole existing description | Preserve manual content and update only managed sections |
| Listing routine format/lint/typecheck commands | Mention only targeted evidence or hosted status that changes reviewer confidence |
| Referring to local plans, skills, or subagents | Convert useful facts into reviewer-facing evidence or omit them |
| Exposing private AX plan artifact paths | Use summaries, hashes, thread references, note IDs, discussion IDs, or stable correlation IDs |
| Ignoring project templates | Preserve template shape and fill placeholders |

## Validation Scenarios

- Mixed GitHub/GitLab remotes with no explicit host: pass only if routing uses
  review policy or asks instead of choosing the first remote.
- Existing PR/MR URL: pass only if that provider controls the update route.
- Existing open artifact for the branch: pass only if no duplicate is created.
- Existing body with manual reviewer notes and managed HTML comments: pass only
  if manual content is preserved and managed content is updated.
- Description evidence includes local skill paths, planning gates, routine
  formatter output, targeted regression proof, and a pending hosted check: pass
  only if internal/routine references are omitted while targeted proof and
  hosted status are retained.
- Description evidence includes private plan support artifacts under
  `~/.ax/plans/...`: pass only if local paths and raw private artifacts are
  omitted while reviewer-useful summaries, hashes, thread references, note IDs,
  discussion IDs, or stable correlation IDs are retained.
