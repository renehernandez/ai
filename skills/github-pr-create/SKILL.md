---
name: github-pr-create
description: Use when creating GitHub pull requests, opening PRs, preparing GitHub branches for review, or converting completed work into a draft GitHub PR.
allowed-tools: Bash(gh pr:*), Bash(gh auth:*), Bash(git:*)
---

# GitHub PR Create

Create GitHub pull requests with `gh` after verifying branch, remote, and duplicate-PR state. Prefer draft PRs unless the user explicitly asks for a ready PR.

## Mode Boundary

This is a bounded Finish provider adapter. It performs mechanics only after
Finish supplies mutation authority, a current publication checkpoint, and a
body approved by `change-request-create`. Explicitly naming this adapter does
not bypass `change-request-create` or grant publication or merge authority.

## When to Use

- Feature work or a bug fix is ready for GitHub review.
- The user explicitly asks to create, open, draft, or prepare a GitHub PR.
- Finish resolves GitHub as the provider and needs the PR creation or update step.
- `change-request-create` selected GitHub as the provider adapter.

Do not use for GitLab merge requests; use the GitLab MR creation skill instead.
Always use `change-request-create` before this adapter, including when the user
explicitly names GitHub, `gh`, or this skill. This adapter consumes the body; it
does not approve it.

## Workflow

1. Verify GitHub context:
   ```bash
   gh auth status
   git remote -v
   git status --porcelain
   git branch --show-current
   ```
   Stop if the working tree is dirty, the current branch is the default branch, or the repo is not a GitHub repo.

2. Determine the base branch:
   ```bash
   git remote show origin
   ```
   Use the remote HEAD branch unless the user, branch config, or project docs name another base.

3. Check for an existing PR before creating a duplicate:
   ```bash
   gh pr list --head "<current-branch>" --state open
   ```
   If a PR exists, return it and ask whether to update it instead of creating another.

4. For local agent-authored work, confirm the final personal publication
   checkpoint is current for the branch diff and exact HEAD SHA before pushing
   or mutating a PR. Pause if the checkpoint is missing, stale, tied to another
   HEAD, or has unresolved blockers. Keep checkpoint evidence private unless
   the project workflow already requires reviewer-facing evidence.

5. Push the branch if needed:
   ```bash
   git rev-parse --abbrev-ref --symbolic-full-name @{u}
   git push -u origin HEAD
   ```
   If there is no upstream, push with `-u`. If the branch belongs to a fork or non-`origin` remote, use `gh pr create --head <owner>:<branch>` only after verifying the intended owner and branch.

6. Analyze changes for title/body context:
   ```bash
   git log <base>...HEAD --oneline --no-merges
   git diff <base>...HEAD --stat
   ```

7. Consume the exact title and body approved by `change-request-create`.
   Do not rebuild, fill, template-expand, or otherwise change either value in
   this adapter. If either value is absent or needs revision, return to
   `change-request-create` before provider mutation.

8. Create a draft PR:
   ```bash
   gh pr create \
     --base "<base>" \
     --head "<current-branch>" \
     --title "<type>: <description>" \
     --body "<body>" \
     --draft
   ```
   Add `--reviewer`, `--assignee @me`, or `--label` when requested or required
   by project convention. Do not add `--template` or `--fill` after description
   approval.

9. Return the created PR URL, base/head branch, draft/readiness state, and any verification gaps.

## Quick Reference

| Need | Command |
| --- | --- |
| Existing PR | `gh pr list --head "<branch>" --state open` |
| Current upstream | `git rev-parse --abbrev-ref --symbolic-full-name @{u}` |
| Create draft PR | `gh pr create --base "<base>" --head "<branch>" --title "<title>" --body "<body>" --draft` |
| Review current PR state | `gh pr status` |

## GitHub Gotchas

- `gh pr list --head` accepts a branch name, not `owner:branch`.
- `gh pr create --head` can use `owner:branch`, but GitHub CLI does not support an organization as the owner in that syntax.
- `--dry-run` may still push git changes; do not treat it as mutation-free.
- GitHub closes linked issues from PR body keywords such as `Fixes #123` or `Closes #123`; include them only when intended.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Using `glab mr create` for GitHub | Use `gh pr create` |
| Creating a duplicate PR | Check `gh pr list --head "<branch>" --state open` first |
| Opening a ready PR by default | Use `--draft` unless the user asks for ready review |
| Guessing base branch | Read remote HEAD, branch config, or project docs |
| Hiding verification gaps | Put behavior-specific proof or reviewer-facing gaps in the PR body, and keep routine gate state in workflow evidence |
| Exposing private plan-support paths | Use summaries, hashes, thread references, note IDs, discussion IDs, or stable correlation IDs |
| Treating passing checks or routine workflow gates as PR Testing content | Keep gate state in workflow evidence unless the PR changes that surface or exposes a reviewer-facing gap |
| Handling a neutral PR/MR request here | Use `change-request-create` before provider mutation |

## Validation Scenarios

- GitHub branch with an existing open PR: pass only if the agent checks `gh pr list --head` before creating a duplicate.
- GitHub side-project branch with no upstream: pass only if the agent pushes or verifies the intended fork/head before `gh pr create`.
- User asks for a ready PR: pass only if the agent does not force `--draft` and reports the readiness choice.
- User asks for a host-neutral change request: pass only if the agent routes through `change-request-create` instead of this provider adapter directly.
- User explicitly asks for a GitHub PR or `gh pr create`: pass only if
  `change-request-create` owns the exact final title and body and this adapter
  consumes them unchanged.
- Process-heavy change with local plans, pressure tests, internal review gates,
  or private plan support artifacts: pass only if the PR body includes
  self-contained reviewer evidence, omits references to excluded local
  artifacts, omits passing check and routine workflow-gate state from Testing
  unless the PR changes that surface or exposes a gap, and links directly to
  reviewer-needed upstream resources.

## Test Evidence

- RED scenario: under "create this GitHub PR quickly" pressure, a baseline flow that starts at `gh pr create` can skip duplicate detection, upstream/fork verification, and explicit draft/readiness state.
- RED scenario: thread `019eb763-9db7-73c2-bf96-d1cdbd88cbaf` showed an MR body leaking local verification/internal reviewer gates and naming upstream resources without links after the user excluded the plan artifact from the MR.
- RED scenario: thread `019edf9e-5cb2-74c3-a1ae-e606ca8e7613` showed stacked MR descriptions using the right headers while still filling Verification with routine command output and clean workflow gate state.
- GREEN: skill requires auth/remote/clean-branch checks, duplicate detection, explicit push/head handling, and draft-by-default behavior.
- GREEN: skill now requires reviewer-facing bodies that keep necessary evidence self-contained, omit excluded/local process artifacts and routine gate state, and use actual links for reviewer-needed upstream resources.
- GREEN: sub-agent `019eae16-e856-7ef1-bc27-9d739aeaf5ba` passed the PR creation pressure test and recommended adding explicit upstream inspection before push.
- REFACTOR: GitHub-specific PR mechanics remain separate from Finish, which
  owns provider authority and the publication lifecycle.
