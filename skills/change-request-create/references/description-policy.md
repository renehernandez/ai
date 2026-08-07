# Reviewer-Facing Description Policy

Load this reference when composing or updating a PR/MR title or body. The main skill owns the approved content; provider references only retrieve and mutate the hosted artifact.

## Evidence Selection

Start with reviewer focus, then include only evidence that proves changed behavior,
answers a reviewer request, or exposes an actionable gap. Useful evidence may include
targeted regression fixtures, reproduction steps, browser routes or console checks,
migrations, deployment checks, and failed, pending,
missing, unavailable, or stale hosted checks.

Omit local skill or plan paths, subagent gates, fingerprints, ledgers, private
thread metadata, raw support artifacts, routine formatter/linter/typecheck or
hook commands, clean Nitro state, ordinary green CI, and operational
verification that does not assess a changed surface. When a support artifact is
relevant, use a summary, hash, thread reference, note/discussion ID, or stable
correlation ID instead of a local filesystem path.

Verification is reviewer-risk evidence, not a command inventory. A targeted
fixture command belongs when it proves the changed behavior; automatic hygiene
commands do not. Keep workflow completion evidence in the task-local ledger or
final report unless a reviewer needs it to evaluate this diff.

## Templates and Updates

Prefer the project template and preserve its structure. For GitHub inspect:

- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md`

For GitLab, use surfaced provider/project templates and repository conventions
under `.gitlab/merge_request_templates`. Ask when several templates match and
no accepted choice or repository convention resolves them.

A section reserved for the author, MR owner, or a human is not AI-owned. Leave
it untouched, including a Testing section that says AI-generated descriptions
cannot replace manual verification.

When updating, fetch the current title/body and preserve reviewer notes, links,
resolved checklist state, and manual sections. Replace only content bounded by
managed markers:

```markdown
<!-- change-request-create:start -->
...
<!-- change-request-create:end -->
```

Ask before replacing ambiguous ownership. Never use a direct CLI/API body
update to bypass description review. After creation or update, read the hosted
body back. Restore safely when protected content was damaged; otherwise return
the exact recovery blocker.

## OpenSpec POCs

Use the normal reviewer-facing template. Prefix the title with `POC:` and state
that the artifact is review-only and must close unmerged. Do not add local
Review results, pipeline IDs, automated-review state, or lifecycle-ledger
content merely because the artifact is disposable. The description never
authorizes closure; Finish's exact POC-disposal authority remains required.

## Linear Relationships in GitLab MRs

Classify every relevant issue before approving the body:

- `closing`: this MR independently satisfies the accepted issue scope; write `Closes PAD-123`.
- `contributing`: this MR advances but does not independently complete the scope, including POCs and incomplete stack units; write `Related to PAD-123`.

Put one plain statement per issue under `## Tracking`. Do not Markdown-link the
key in the statement. Classify mixed issues separately. A URL, branch, title,
or commit may identify a candidate issue but does not establish completion
intent. If a relevant issue exists and the relationship is unclear, block
publication for clarification. Do not promise a literal provider status name.

Carry the finalized policy-compliant title/body plus each task-local relationship expectation, or
an explicit no-issue result, to the GitLab adapter. The adapter validates but
does not choose the relationship. With no relevant issue, add no relationship
or new Tracking section and preserve existing human-owned Tracking content.
