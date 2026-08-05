---
name: change-request-create
description: Use when creating or updating any GitHub pull request or GitLab merge request, including provider-explicit requests, mixed-host repositories, existing PR/MR URLs, or review-routing policy.
---

# Change Request Create

Create or update a hosted change request while keeping route selection
host-neutral and descriptions reviewer-facing. This skill is the only
selectable creation owner; its internal references define provider-specific
mutation mechanics.

## Mode Boundary

This is a bounded Finish specialist. It does not independently grant provider
mutation, merge, deployment, or cleanup authority. Finish supplies hook-clean
commit evidence and authority; this skill produces the policy-compliant body
and executes the selected internal provider mechanics.

## When To Use

Use this skill whenever the user asks to create, open, update, or prepare a PR,
pull request, MR, merge request, change request, review artifact, or draft
review. Explicit GitHub, GitLab, `gh`, or `glab` wording selects internal
provider mechanics; it does not bypass this description-policy owner.

| Provider | Internal mechanics |
| --- | --- |
| GitHub pull request | [GitHub provider mechanics](references/github-provider.md) |
| GitLab merge request | [GitLab provider mechanics](references/gitlab-provider.md) |

## Route Selection

Select exactly one hosted artifact provider in this order:

1. Existing artifact URL named by the user or current context.
2. Explicit user host choice, such as "GitHub PR" or "GitLab MR".
3. Project or workflow-policy profile.
4. Target push remote for the branch.
5. Ask a blocking routing question or report blocked.

Do not guess from the first remote by position when multiple hosts remain
plausible. After Finish resolves the route and authority, read and execute the
matching internal provider reference. Provider-explicit wording never bypasses
this owner.

## Draft Publication Gate

When creating or updating a hosted change request would publish local
agent-authored work, first require a native hook-clean commit for the branch
diff and exact HEAD SHA. Pause when hook evidence is missing, stale, tied to
another HEAD, or the provider route is unresolved. Local Review and the
technical-readiness checkpoint follow draft publication and the hosted review
request; they do not gate creation of the draft. Keep workflow evidence private
unless the selected project policy already requires reviewer-facing evidence.

PR/MR titles and descriptions are hosted artifact metadata and do not require
the destination-bound confirmation used for covered GitLab and Linear
conversational messages. Once Finish supplies publication authority and this
skill resolves the route, template, relationship semantics, and hook-clean
head, create or update the draft without previewing the title or body for a new
permission prompt.

## Description Policy

Write the hosted description for reviewers, not for the author workflow. It
should answer:

- what changed;
- why it changed;
- where reviewers should focus;
- what behavior-specific evidence, reviewer-requested proof, or explicit gap
  changes review confidence.

Choose verification content after writing the review focus. Every Testing or
Verification item must map to one of those focus areas, answer a reviewer
request, or explain an actionable gap. If evidence is true but does not help a
developer reviewer evaluate the current diff, keep it in workflow evidence or
the final thread report instead of the hosted body.

Omit unnecessary internal process and tooling references anywhere in the body,
including local skill paths, temporary planning files, subagent gates, internal
review labels, verification ledgers, automation-routing details, and routine
local commands already represented by CI or standard repo hooks.

Do not expose local private support artifact paths, raw private support
artifacts, or private thread metadata by default. When support-artifact evidence
is relevant to reviewers, use summaries, hashes, thread references, note IDs,
discussion IDs, or stable correlation IDs instead of local filesystem paths.

For plan workflow artifacts, do not present local reviewer evidence or local
review-gate state as hosted review, CI, approval, or Nitro evidence. Convert
only reviewer-relevant risk facts into plain description text, or omit the
local process details.

Keep evidence when it helps a developer reviewer assess changed behavior or a
specific risk:

- targeted regression commands or fixtures;
- reproduction checks;
- browser route, console, viewport, migration, or deployment checks that prove
  a changed behavior;
- reviewer-requested proof;
- failed, pending, missing, unavailable, or stale hosted checks;
- required reviewer, approval, or merge status that needs reviewer attention.

Do not restate routine green hosted checks, clean Nitro review state, operational
verification state, or routine local typecheck, lint, format, pre-commit,
pre-push, or diff-hygiene commands when the artifact host, CI, repository
hooks, or workflow ledger already show them. Mention a pipeline, Nitro, or
operational-verification result only when the change adds or changes that
surface, a reviewer asked for that proof, or there is an actionable gap or
failure.

Verification sections are for reviewer-risk evidence, not an audit log of every
command. Do not list commands just because they were run. Include commands that
prove changed behavior, expose a risk-specific fixture, or explain a gap. For
example, `bash scripts/cleanup-nitro-resources.test.sh` is targeted evidence for
a cleanup-policy change; omit `bunx prettier --check`, `git diff --check`, and
`shellcheck` when an automatic local gate or CI job already owns that routine
hygiene.

Do not include a broad proof inventory merely because each item is legitimate.
For example, after a duplicate-work messaging change, a concise reviewer focus
plus the targeted note-rendering proof may belong in Verification; incidental
pipeline-fix context, broad handler coverage, note IDs, pod names, and
review-environment setup details belong in workflow evidence unless reviewers
need one of those facts to assess the diff.

Keep workflow completion evidence, including green CI, Nitro feedback,
technical-readiness checkpoints, operational-verification runs, and private review-gate
state, in the delivery ledger or final thread report unless it meets the
reviewer-facing criteria above.

### Linear Relationships In GitLab MRs

When the selected provider is GitLab and the accepted delivery context
identifies one or more Linear issues, classify each issue before approving the
body:

| Delivery relationship | Required Tracking statement |
| --- | --- |
| This MR independently satisfies the issue's accepted scope | `Closes PAD-123` |
| This MR advances the issue but does not independently satisfy it | `Related to PAD-123` |

Use a `## Tracking` section with one exact plain statement per issue. Do not
wrap the issue key in a Markdown link inside the statement. Multiple or mixed
issues are classified separately; one completed issue does not make every
referenced issue closing.

The common case is one issue completed by one MR, so use `Closes` when the MR
independently delivers that issue. Use `Related to` for partial delivery, POCs,
or stack units that require another MR to complete the issue. If a clearly
relevant issue exists but the accepted context does not establish which
relationship applies, pause publication and ask for clarification. If no
relevant Linear issue exists, add no Linear relationship statement or new
Tracking section. Preserve an existing template-owned or manual Tracking
section under the normal update-safety rules.

A Linear URL, bare issue key, branch name, MR title, or commit message may
identify a candidate issue but does not establish completion intent. A plain
link also does not replace the required relationship statement. Linear team
and target-branch automation decides the resulting status; do not promise that
the status is literally named `Done`.

Carry the finalized policy-compliant title and body into the internal provider
mechanics together with the task-local
relationship expectation for each relevant issue, or an explicit no-issue
result. This handoff is private workflow evidence, not a persisted schema. The
provider mechanics validate that the body matches the expectation; they never
select or change the relationship.

## Template And Update Safety

Prefer project templates and preserve their structure. Fill placeholders with
concise reviewer-facing content instead of replacing the template shape.

Treat explicit ownership instructions inside a template as authoritative. A
section that says it must be completed by the author, MR owner, or a human is
not an AI-owned placeholder: preserve the instruction and leave the section
unfilled. In particular, never auto-fill a Testing section whose template says
AI-generated descriptions cannot replace manual verification.

For GitHub, inspect the usual template locations:

- `.github/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/PULL_REQUEST_TEMPLATE/*.md`

For GitLab, use provider/project templates when surfaced by the internal
provider mechanics and
repo-local `.gitlab/merge_request_templates` conventions when present.

If multiple templates match and no user choice or repo convention identifies
one, ask which template to use.

When updating an existing PR or MR, fetch the current title and body through the
selected internal provider mechanics. Preserve reviewer notes, links, resolved
checklist state, and manual sections. Replace only sections clearly bounded by managed HTML comments
such as:

```markdown
<!-- change-request-create:start -->
...
<!-- change-request-create:end -->
```

Ask before replacing any section whose ownership is ambiguous.
Do not bypass this policy with a direct provider CLI body update. Raw provider updates are mutation mechanics, not description-policy review; apply this policy first, then delegate or execute the provider update.

After creation or update, read the hosted body back. If manual content,
checklist state, links, or protected sections were damaged, restore the prior
body when safe or block with the exact recovery gap. Command success without
readback does not pass the description-policy gate.

For OpenSpec POCs, keep the normal reviewer-facing structure. Prefix the title
with `POC:` and state that the artifact is review-only and must close unmerged,
but do not add local Review results, pipeline IDs, automated-review status, or
other lifecycle-ledger content merely because the artifact is disposable. That
description does not authorize closure: keep the POC open until the user
explicitly requests closure or says the work is ready to proceed to stack
breakdown.

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
6. Read and execute the matching internal provider reference with the finalized
   policy-compliant title and body unchanged:
   - GitHub: [GitHub provider mechanics](references/github-provider.md).
   - GitLab: [GitLab provider mechanics](references/gitlab-provider.md).
7. Return the artifact URL, source and target branches, draft/readiness state,
   routed provider, targeted evidence included, and any reviewer-facing hosted
   gaps.

Use a body file when the provider CLI supports one and the description contains
multi-line Markdown, checkboxes, or content that is brittle to pass through shell
flags.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Choosing the first remote in a mixed-host repo | Apply route precedence and ask when ambiguous |
| Treating explicit `gh`, `glab`, GitHub, or GitLab wording as a policy bypass | Apply this skill, then execute its selected internal mechanics |
| Duplicating provider CLI mechanics in the main workflow | Keep mechanics in the provider references owned by this skill |
| Replacing a whole existing description | Preserve manual content and update only managed sections |
| Updating a PR/MR body directly through `gh`, `glab`, or an API call | Apply this description policy first, then use the provider command only for mutation |
| Listing routine format/lint/typecheck commands | Mention only targeted evidence or gaps that change reviewer confidence |
| Listing commands just because they ran locally | Keep only reviewer-risk evidence or gaps |
| Putting Nitro, green pipeline, or operational-verification status in Verification because the workflow ran them | Keep gate state in workflow evidence unless the change modifies that surface or there is an actionable gap |
| Referring to local plans, skills, or subagents | Convert useful facts into reviewer-facing evidence or omit them |
| Exposing private plan-support paths | Use summaries, hashes, thread references, note IDs, discussion IDs, or stable correlation IDs |
| Ignoring project templates | Preserve template shape and fill placeholders |
| Filling a human-owned Testing section | Preserve its instruction and leave it for the owner |
| Treating provider command success as proof of a safe update | Read the body back and restore or block on damage |
| Linking a Linear issue without completion semantics | Classify it and use exact plain `Closes PAD-123` or `Related to PAD-123` in `## Tracking` |
| Closing every Linear issue mentioned by the work | Close only issues independently satisfied by the MR; relate partial, POC, and stacked delivery |
| Guessing whether an ambiguous MR completes a Linear issue | Pause publication and ask for clarification |

## Validation Scenarios

- Mixed GitHub/GitLab remotes with no explicit host: pass only if routing uses
  review policy or asks instead of choosing the first remote.
- Explicit GitHub, GitLab, `gh`, or `glab` creation request: pass only if this
  skill still owns the title, body, and provider mutation while its internal
  provider mechanics consume the finalized policy-compliant values unchanged.
- Existing PR/MR URL: pass only if that provider controls the update route.
- Existing open artifact for the branch: pass only if no duplicate is created.
- Accepted publication with a hook-clean head, unambiguous route, and
  template-safe title/body: pass only if the draft is created or updated without
  a destination-bound confirmation prompt.
- Existing body with manual reviewer notes and managed HTML comments: pass only
  if manual content is preserved and managed content is updated.
- Existing PR/MR body update after a reviewer reports description-policy drift:
  pass only if the policy is applied before the provider CLI or API mutates the
  body; direct `gh`, `glab`, or API updates are not enough by themselves.
- Template says its Testing section must be filled by the MR owner and that
  AI-generated descriptions cannot replace manual verification: pass only if
  the section remains unfilled by the agent.
- POC evidence contains focused tests plus routine formatter/typecheck output,
  pipeline IDs, local Review state, and clean Nitro state: pass only if the body
  keeps reviewer-relevant changed-behavior proof, marks the POC review-only and
  close-unmerged, and omits routine gate narration.
- Description evidence includes local skill paths, planning gates, routine
  formatter output, targeted regression proof, a clean Nitro review, a passing
  hosted pipeline, an operational-verification run, and a pending hosted check:
  pass only if internal/routine references, clean Nitro state, passing pipeline
  state, and operational-verification state are omitted while targeted proof and
  the pending check gap are retained.
- Description evidence includes one targeted fixture command plus routine
  formatter, shell lint, and diff-hygiene commands covered by hooks or CI: pass
  only if the description keeps the fixture evidence and omits the automatic
  hygiene commands.
- Description evidence includes private plan support artifacts: pass only if
  local paths and raw private artifacts are omitted while reviewer-useful
  summaries, hashes, thread references, note IDs, discussion IDs, or stable
  correlation IDs are retained.
- GitLab MR context identifies one Linear issue that the MR independently
  satisfies: pass only if the finalized policy-compliant body contains `## Tracking` with the
  exact plain statement `Closes PAD-123` and the handoff records a closing
  relationship.
- GitLab MR context identifies a Linear issue that needs a later stack unit:
  pass only if the finalized policy-compliant body contains `## Tracking` with the exact plain
  statement `Related to PAD-123` and the handoff records a contributing
  relationship.
- GitLab MR context contains a Linear URL but does not establish whether the MR
  completes the issue: pass only if publication pauses for clarification
  instead of publishing a bare link, guessing `Closes`, or silently choosing
  `Related to`.
- GitLab MR context has no relevant Linear issue: pass only if the handoff
  records the explicit no-issue result, adds no Linear relationship statement
  or new Tracking section, and preserves existing template-owned or manual
  Tracking content.

## Test Evidence

- RED: the full-scope baseline used Markdown-linked
  `Closes [PAD-1909](...)` outside a Tracking section, while the partial-stack
  baseline used explanatory prose without Linear's supported `Related to`
  statement.
- RED: under deadline and publication pressure, the ambiguous-scope baseline
  published a neutral Linear link because the prior skill did not require a
  completion decision.
- GREEN: the same scenarios produced exact plain `Closes PAD-1909` and
  `Related to PAD-1909` Tracking statements, while ambiguous scope blocked
  publication and returned for clarification.
- RED: an explicit no-issue result plus a human-owned template Tracking section
  had no compliant path because the earlier adapter wording required the
  section to be absent while update safety required it to be preserved.
- GREEN: explicit no-issue handling now forbids invented Linear statements and
  sections while preserving existing template-owned or manual Tracking content.
- RED: task `019fcd53-a12d-7171-94c0-a8979b46e333` treated a finalized POC MR
  title and description as another destination-bound message awaiting approval.
- GREEN: a template-safe change-request description proceeds under existing
  Finish publication authority without weakening the separate confirmation
  checkpoint for conversational provider messages.
