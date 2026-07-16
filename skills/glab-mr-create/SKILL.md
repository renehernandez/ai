---
name: glab-mr-create
description: Use when creating GitLab merge requests for Fullscript Lab GitLab repos, opening MRs, preparing GitLab branches for review, or converting completed work into a draft GitLab MR.
allowed-tools: Bash(glab mr:*), Bash(git:*)
---

# GitLab MR Create

Create GitLab merge requests with `glab` after verifying branch, remote, and duplicate-MR state. Prefer draft MRs unless the user explicitly asks for a ready MR.

## Mode Boundary

This is a bounded Finish provider adapter. It performs mechanics only after
Finish supplies mutation authority, a native hook-clean commit, and a body
approved by `change-request-create`. Explicitly naming this adapter does not
bypass `change-request-create` or grant publication or merge authority.

This is the default MR creation workflow for repos hosted in the Fullscript Lab GitLab instance. Apply repo-local templates, labels, review-request routing, and merge policies when present.

For general GitLab CLI commands, use `glab-cli`.

## When to Use

- Feature work or a bug fix is ready for GitLab review.
- The user explicitly asks to create, open, draft, or prepare a GitLab MR.
- Finish resolves GitLab as the provider and needs the MR creation or update step.
- `change-request-create` selected GitLab as the provider adapter.
- The repo is hosted in the Fullscript Lab GitLab instance.

Do not use for GitHub pull requests; use the GitHub PR creation skill instead.
Always use `change-request-create` before this adapter, including when the user
explicitly names GitLab, `glab`, or this skill. This adapter consumes the body;
it does not approve it.

## Workflow

1. Verify GitLab context:
   ```bash
   glab auth status
   git remote -v
   git status --porcelain
   git branch --show-current
   ```
   Stop if the working tree is dirty, the current branch is the default branch, or the repo is not a GitLab repo. For Fullscript work, confirm the artifact remote points at the Lab GitLab instance before creating the MR.

2. Determine the target branch:
   ```bash
   git remote show origin
   ```
   Use the remote HEAD branch unless the user, branch config, or project docs name another target.

3. Check for an existing MR before creating a duplicate:
   ```bash
   glab mr list --source-branch "<current-branch>"
   ```
   If an MR exists, return it and ask whether to update it instead of creating another.

4. For local agent-authored work, confirm the final personal publication
   checkpoint is current for the branch diff and exact HEAD SHA before pushing
   or mutating an MR. Pause if the checkpoint is missing, stale, tied to another
   HEAD, or has unresolved blockers. Keep checkpoint evidence private unless
   the project workflow already requires reviewer-facing evidence.

5. Push the branch if needed:
   ```bash
   git rev-parse --abbrev-ref --symbolic-full-name @{u}
   git push -u origin HEAD
   ```
   If there is no upstream, push with `-u`. If multiple GitLab remotes exist, verify the intended artifact remote before pushing.

6. Analyze changes for title/body context:
   ```bash
   git log <target>...HEAD --oneline --no-merges
   git diff <target>...HEAD --stat
   ```

7. Consume the exact title and body approved by `change-request-create` plus
   its task-local Linear relationship expectations or explicit no-issue
   result. Do not rebuild, fill, template-expand, classify issues, or otherwise
   change either value in this adapter. For every expected Linear relationship,
   require the matching exact plain statement in `## Tracking`:
   - closing: `Closes PAD-123`;
   - contributing: `Related to PAD-123`.

   Reject Markdown-linked issue keys inside those statements, bare issue links
   without an expectation, missing statements, and mismatches between the body
   and handoff. Return to `change-request-create` before provider mutation. An
   explicit no-issue result requires no Linear relationship statement and adds
   no Tracking section, but preserves an existing template-owned or manual
   Tracking section unchanged.

8. Create a draft MR:
   ```bash
   glab mr create \
     --target-branch "<target>" \
     --source-branch "<current-branch>" \
     --title "<type>: <description>" \
     --description "<body>" \
     --draft \
     --squash-before-merge \
     --remove-source-branch \
     --assignee @me
   ```
   Add `--label` when requested or required by project convention. Do not use
   `--reviewer` for GitLab review requests; after the MR exists, request one or
   more reviewers with a new top-level MR note containing only the slash
   command, such as `/request_review @alice @bob`. A single reviewer note such
   as `/request_review @alice` is also valid.

9. Read the hosted title and body back after creation or update. Confirm the
   Linear relationship statements still match the task-local handoff and that
   manual content, links, checklist state, and protected sections remain
   intact. Restore the prior body when safe or block with the exact recovery
   gap; provider command success alone does not pass.

10. Return the created MR URL, target/source branch, draft/readiness state, and any verification gaps.

## Quick Reference

| Need | Command |
| --- | --- |
| Existing MR | `glab mr list --source-branch "<branch>"` |
| Current upstream | `git rev-parse --abbrev-ref --symbolic-full-name @{u}` |
| Create draft MR | `glab mr create --target-branch "<target>" --source-branch "<branch>" --title "<title>" --description "<body>" --draft` |
| Review current MR state | `glab mr view` |
| Update MR body | `glab mr update <iid> --description "<body>"` |

## GitLab Gotchas

- `glab mr list` does not support `--state`, `--status`, or `--open`; use `--draft`, `--closed`, `--merged`, or `--all`.
- Do not use `glab mr create --fill`; it replaces the centrally approved title
  and body.
- Passing long descriptions through shell flags can be brittle. Use a temp file plus command substitution only when the harness allows it safely, or use the simplest supported `glab` path for the current shell.
- Host-qualified commands are safer in Fullscript repos when multiple GitLab hosts are configured.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Using `gh pr create` for GitLab | Use `glab mr create` |
| Creating a duplicate MR | Check `glab mr list --source-branch "<branch>"` first |
| Opening a ready MR by default | Use `--draft` unless the user asks for ready review |
| Guessing target branch | Read remote HEAD, branch config, or project docs |
| Leaking local process into the MR body | Keep reviewer evidence self-contained and omit local-only artifacts |
| Exposing private plan-support paths | Use summaries, hashes, thread references, note IDs, discussion IDs, or stable correlation IDs |
| Treating local review-gate evidence as hosted review | Keep local gate evidence private and continue through the hosted review workflow |
| Treating clean Nitro, green pipelines, or operational-verification runs as MR Verification content | Keep gate state in workflow evidence unless the MR changes that surface or exposes a reviewer-facing gap |
| Requesting GitLab reviewers during MR creation | Create or update the MR first, then post a new top-level MR note such as `/request_review @alice @bob` |
| Naming upstream resources without links | Include actual URLs for reviewer-needed references |
| Handling a neutral PR/MR request here | Use `change-request-create` before provider mutation |
| Selecting `Closes` or `Related to` in this adapter | Consume and validate the relationship selected by `change-request-create` |
| Treating a Linear link or issue key as completion intent | Require the task-local expectation and exact plain Tracking statement |
| Publishing when Linear completion intent is ambiguous | Return to `change-request-create` for clarification before mutation |

## Validation Scenarios

- GitLab branch with an existing open MR: pass only if the agent checks `glab mr list --source-branch` before creating a duplicate.
- GitLab repo with multiple remotes or hosts: pass only if the agent verifies the intended artifact remote before pushing or creating the MR.
- User asks for a ready MR: pass only if the agent does not force `--draft` and reports the readiness choice.
- GitLab review request is required: pass only if the agent avoids `--reviewer`
  and requests all reviewers through a new top-level MR note such as
  `/request_review @alice @bob` after creation.
- User asks for a host-neutral change request: pass only if the agent routes through `change-request-create` instead of this provider adapter directly.
- User explicitly asks for a GitLab MR or `glab mr create`: pass only if
  `change-request-create` owns the exact final title and body and this adapter
  consumes them unchanged.
- Process-heavy change with local plans, pressure tests, internal review gates,
  or private plan support artifacts: pass only if the MR body includes
  self-contained reviewer evidence, omits references to excluded local
  artifacts, does not treat local gates as hosted review, omits clean Nitro,
  passing pipeline, and operational-verification gate state from Verification
  unless the MR changes that surface or exposes a gap, and links directly to
  reviewer-needed upstream resources.
- Approved GitLab body and handoff classify PAD-123 as closing: pass only if
  the adapter requires exact plain `Closes PAD-123` in `## Tracking` before
  mutation and confirms the same statement during hosted-body readback.
- Approved GitLab body and handoff classify PAD-123 as contributing: pass only
  if the adapter requires exact plain `Related to PAD-123` in `## Tracking`
  before mutation and confirms the same statement during hosted-body readback.
- Approved body contains `Closes [PAD-123](https://linear.app/example)` or only
  a Linear URL: pass only if the adapter rejects it and returns to
  `change-request-create` without mutating the provider.
- Handoff explicitly records no relevant Linear issue: pass only if the
  adapter adds no Linear relationship statement or Tracking section while
  preserving existing template-owned or manual Tracking content.

## Test Evidence

- RED scenario: thread `019eb763-9db7-73c2-bf96-d1cdbd88cbaf` showed an MR body leaking local verification/internal reviewer gates and naming upstream resources without links after the user excluded the plan artifact from the MR.
- RED scenario: thread `019edf9e-5cb2-74c3-a1ae-e606ca8e7613` showed stacked MR descriptions using the right headers while still filling Verification with routine command output, clean Nitro review state, passing pipeline state, and operational-verification state.
- GREEN: skill requires reviewer-facing MR bodies that keep necessary evidence self-contained, omit excluded/local process artifacts and routine gate state, and use actual links for reviewer-needed upstream resources.
- REFACTOR: repo-local `skills/glab-mr-create` is the canonical MR creation workflow for Fullscript Lab repos; shared GitLab helpers remain available through `glab-cli`.
- RED: Linear relationship baselines supplied a Markdown-linked closing
  statement, non-magic explanatory prose for partial delivery, or an ambiguous
  bare link that the prior adapter would publish unchanged.
- GREEN: the adapter now accepts exact plain closing and contributing
  statements only when they match the task-local handoff, blocks ambiguity
  before mutation, and verifies the same relationship during hosted readback.
- RED: an explicit no-issue handoff conflicted with a preserved human-owned
  Tracking section because the earlier adapter required the section to be
  absent.
- GREEN: the adapter now treats no-issue as the absence of added Linear
  semantics and preserves template-owned or manual Tracking content.
