---
name: github-pr-create
description: Use when creating GitHub pull requests, opening PRs, preparing GitHub branches for review, or converting completed work into a draft GitHub PR.
allowed-tools: Bash(gh pr:*), Bash(gh auth:*), Bash(git:*)
---

# GitHub PR Create

Create GitHub pull requests with `gh` after verifying branch, remote, and duplicate-PR state. Prefer draft PRs unless the user explicitly asks for a ready PR.

## When to Use

- Feature work or a bug fix is ready for GitHub review.
- The user explicitly asks to create, open, draft, or prepare a GitHub PR.
- `plan-unit-delivery` or `plan-review` detects a GitHub remote and needs the PR creation step.
- `change-request-create` selected GitHub as the provider adapter.

Do not use for GitLab merge requests; use the GitLab MR creation skill instead.
For host-neutral PR/MR/change request wording, use `change-request-create`
first so routing and full description policy stay in one place.

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

4. Push the branch if needed:
   ```bash
   git rev-parse --abbrev-ref --symbolic-full-name @{u}
   git push -u origin HEAD
   ```
   If there is no upstream, push with `-u`. If the branch belongs to a fork or non-`origin` remote, use `gh pr create --head <owner>:<branch>` only after verifying the intended owner and branch.

5. Analyze changes for title/body context:
   ```bash
   git log <base>...HEAD --oneline --no-merges
   git diff <base>...HEAD --stat
   ```

6. Build the PR body. Prefer project templates when available:
   - `.github/pull_request_template.md`
   - `.github/PULL_REQUEST_TEMPLATE.md`
   - `.github/PULL_REQUEST_TEMPLATE/*.md`

   Keep the body reviewer-facing. For neutral or mixed-host requests, apply
   `change-request-create` before this adapter. For direct GitHub use:
   - Preserve the selected template shape and fill placeholders concisely.
   - Include targeted evidence or hosted status only when it helps reviewers understand risk.
   - Omit unnecessary author-workflow references and routine validation already represented by CI or repository hooks.
   - Do not expose local private support artifact paths, raw private support
     artifacts, or private thread metadata. Use summaries, hashes, thread
     references, note IDs, discussion IDs, or stable correlation IDs when
     support-artifact evidence matters.
   - Link directly to reviewer-needed issues, related PRs, or upstream resources.

   Fallback body:
   ```markdown
   ## Summary
   [One sentence describing the change]

   ## Testing
   [Exact verification performed]
   ```

7. Create a draft PR:
   ```bash
   gh pr create \
     --base "<base>" \
     --head "<current-branch>" \
     --title "<type>: <description>" \
     --body "<body>" \
     --draft
   ```
   Add `--reviewer`, `--assignee @me`, `--label`, or `--template` when requested or required by project convention.

8. Return the created PR URL, base/head branch, draft/readiness state, and any verification gaps.

## Quick Reference

| Need | Command |
| --- | --- |
| Existing PR | `gh pr list --head "<branch>" --state open` |
| Current upstream | `git rev-parse --abbrev-ref --symbolic-full-name @{u}` |
| Create draft PR | `gh pr create --base "<base>" --head "<branch>" --title "<title>" --body "<body>" --draft` |
| Use a template | `gh pr create --template ".github/pull_request_template.md"` |
| Let commits fill title/body | `gh pr create --fill --draft` |
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
| Hiding verification gaps | Put exact checks in the PR body or report what was not run |
| Exposing private plan-support paths | Use summaries, hashes, thread references, note IDs, discussion IDs, or stable correlation IDs |
| Handling a neutral PR/MR request here | Use `change-request-create` before provider mutation |

## Validation Scenarios

- GitHub branch with an existing open PR: pass only if the agent checks `gh pr list --head` before creating a duplicate.
- GitHub side-project branch with no upstream: pass only if the agent pushes or verifies the intended fork/head before `gh pr create`.
- User asks for a ready PR: pass only if the agent does not force `--draft` and reports the readiness choice.
- User asks for a host-neutral change request: pass only if the agent routes through `change-request-create` instead of this provider adapter directly.
- Process-heavy change with local plans, pressure tests, internal review gates,
  or private plan support artifacts: pass only if the PR body includes
  self-contained reviewer evidence, omits references to excluded local
  artifacts, and links directly to reviewer-needed upstream resources.

## Test Evidence

- RED scenario: under "create this GitHub PR quickly" pressure, a baseline flow that starts at `gh pr create` can skip duplicate detection, upstream/fork verification, and explicit draft/readiness state.
- RED scenario: thread `019eb763-9db7-73c2-bf96-d1cdbd88cbaf` showed an MR body leaking local verification/internal reviewer gates and naming upstream resources without links after the user excluded the plan artifact from the MR.
- GREEN: skill requires auth/remote/clean-branch checks, duplicate detection, explicit push/head handling, and draft-by-default behavior.
- GREEN: skill now requires reviewer-facing bodies that keep necessary evidence self-contained, omit excluded/local process artifacts, and use actual links for reviewer-needed upstream resources.
- GREEN: sub-agent `019eae16-e856-7ef1-bc27-9d739aeaf5ba` passed the PR creation pressure test and recommended adding explicit upstream inspection before push.
- REFACTOR: GitHub-specific PR creation is separated from `plan-unit-delivery`, which only schedules the provider creation gate.
