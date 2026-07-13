---
name: glab-mr-create
description: Use when creating GitLab merge requests for Fullscript Lab GitLab repos, opening MRs, preparing GitLab branches for review, or converting completed work into a draft GitLab MR.
allowed-tools: Bash(glab mr:*), Bash(git:*)
---

# GitLab MR Create

Create GitLab merge requests with `glab` after verifying branch, remote, and duplicate-MR state. Prefer draft MRs unless the user explicitly asks for a ready MR.

## Mode Boundary

This is a bounded Finish provider adapter. It performs mechanics only after
Finish supplies mutation authority, a current publication checkpoint, and a
body approved by `change-request-create`. Explicitly naming this adapter does
not grant publication or merge authority.

This is the default MR creation workflow for repos hosted in the Fullscript Lab GitLab instance. Apply repo-local templates, labels, review-request routing, and merge policies when present.

For general GitLab CLI commands, use `glab-cli`.

## When to Use

- Feature work or a bug fix is ready for GitLab review.
- The user explicitly asks to create, open, draft, or prepare a GitLab MR.
- Finish resolves GitLab as the provider and needs the MR creation or update step.
- `change-request-create` selected GitLab as the provider adapter.
- The repo is hosted in the Fullscript Lab GitLab instance.

Do not use for GitHub pull requests; use the GitHub PR creation skill instead.
For host-neutral PR/MR/change request wording, use `change-request-create`
first so routing and full description policy stay in one place.

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

7. Build the MR body. Prefer project templates when available.

   Keep the body reviewer-facing. For neutral or mixed-host requests, apply
   `change-request-create` before this adapter. For direct GitLab use:
   - Explain why the change exists and where reviewers should focus.
   - Preserve project template sections and required checklist semantics.
   - Include only behavior-specific proof, reviewer-requested evidence, or
     explicit gaps that help reviewers understand changed behavior or risk.
   - Write the review focus before the Verification section, then include only
     evidence that maps to that focus, answers a reviewer request, or explains
     an actionable gap.
   - Omit unnecessary author-workflow references and routine validation already
     represented by CI, repository hooks, or workflow ledgers.
   - Treat Verification sections as reviewer-risk evidence, not a command log
     or gate summary. Do not list routine checks merely because they ran.
   - Do not include a broad proof inventory merely because each item is true;
     omit incidental pipeline fixes, broad handler coverage, note IDs, pod
     names, and review-environment setup unless reviewers need that detail to
     assess the current diff.
   - Do not put clean Nitro review state, passing pipeline state, or
     operational-verification state in Verification unless this MR changes that
     surface, a reviewer asked for the proof, or there is an actionable gap or
     failure.
   - Do not expose local private support artifact paths, raw private support
     artifacts, or private thread metadata. Use summaries, hashes, thread
     references, note IDs, discussion IDs, or stable correlation IDs when
     support-artifact evidence matters.
   - Omit raw local reviewer evidence, local review-gate state, and private plan
     support artifacts; do not present them as hosted review or Nitro evidence.
   - Link directly to reviewer-needed issues, related MRs, or upstream resources.

   Fallback body:
   ```markdown
   ## Why
   [Purpose and intent]

   ## How it works
   [Reviewer-oriented explanation of the approach]

   ## How to review
   [Files, flows, or decisions worth close attention]

   ## Verification
   [Behavior-specific proof or explicit reviewer-facing gaps]
   ```

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

9. Return the created MR URL, target/source branch, draft/readiness state, and any verification gaps.

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
- `glab mr create --fill` can hide important reviewer context; use it only when commit messages already contain the needed body.
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

## Validation Scenarios

- GitLab branch with an existing open MR: pass only if the agent checks `glab mr list --source-branch` before creating a duplicate.
- GitLab repo with multiple remotes or hosts: pass only if the agent verifies the intended artifact remote before pushing or creating the MR.
- User asks for a ready MR: pass only if the agent does not force `--draft` and reports the readiness choice.
- GitLab review request is required: pass only if the agent avoids `--reviewer`
  and requests all reviewers through a new top-level MR note such as
  `/request_review @alice @bob` after creation.
- User asks for a host-neutral change request: pass only if the agent routes through `change-request-create` instead of this provider adapter directly.
- Process-heavy change with local plans, pressure tests, internal review gates,
  or private plan support artifacts: pass only if the MR body includes
  self-contained reviewer evidence, omits references to excluded local
  artifacts, does not treat local gates as hosted review, omits clean Nitro,
  passing pipeline, and operational-verification gate state from Verification
  unless the MR changes that surface or exposes a gap, and links directly to
  reviewer-needed upstream resources.

## Test Evidence

- RED scenario: thread `019eb763-9db7-73c2-bf96-d1cdbd88cbaf` showed an MR body leaking local verification/internal reviewer gates and naming upstream resources without links after the user excluded the plan artifact from the MR.
- RED scenario: thread `019edf9e-5cb2-74c3-a1ae-e606ca8e7613` showed stacked MR descriptions using the right headers while still filling Verification with routine command output, clean Nitro review state, passing pipeline state, and operational-verification state.
- GREEN: skill requires reviewer-facing MR bodies that keep necessary evidence self-contained, omit excluded/local process artifacts and routine gate state, and use actual links for reviewer-needed upstream resources.
- REFACTOR: repo-local `skills/glab-mr-create` is the canonical MR creation workflow for Fullscript Lab repos; shared GitLab helpers remain available through `glab-cli`.
