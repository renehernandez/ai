# Git and Review Rules

These rules cover Git, GitHub, GitLab, Linear, review routing, and external comments.

## GitHub CLI

- Always use `gh` CLI when interacting with GitHub PRs, issues, releases, repositories, or API calls.
- Never use `curl` with the GitHub API directly. Use `gh api` for authenticated requests.
- Examples: `gh pr view 123 --repo owner/repo`, `gh issue list`, `gh api repos/owner/repo/releases`.

## Linear Issue Management

- Never assign `nitro` or any other agent as delegate when creating Linear issues without explicit user confirmation.
- Always ask before delegating issues to automated agents.
- Always create Linear issues with status `Todo`, never `Triage`.

## Comment Attribution

- When posting a human-readable comment directly on the user's behalf to GitLab, GitHub, Linear, or another external system, append this final line: `Co-Authored by: <harness>`.
- Replace `<harness>` with the actual harness name, such as `Codex`, `Claude Code`, or the specific agent posting the comment.
- Do not add this attribution to commit messages, MR or PR descriptions, generated comment bodies that another service posts, or command-only comments such as `/request_review @nitro`.

## Semantic Commit and MR Title Prefixes

- Always evaluate the impact of a change before choosing a semantic prefix. Do not default to `chore:` for routine-looking changes.
- Check the repository CI/CD pipeline config, such as `.gitlab-ci.yml`, `release.config.js`, or semantic-release config, to understand how prefixes affect versioning, releases, and deployments.
- Review recent `git log` to match repository conventions and see which prefixes trigger releases.
- Choose the prefix based on what the change does, not what it looks like.
- If a change triggers a new release or version, such as a dependency bump that publishes a package, use a release-triggering prefix such as `fix:` or `feat:`.
- If a change is truly invisible to consumers, such as docs, CI tweaks, or non-published files, `chore:` is appropriate.
- When unsure whether a change triggers a release, check the pipeline config before committing.

## Git Commits

- Agents must use `ax commit` for commits instead of invoking `git commit` manually. `ax commit` validates local review-gate state before delegating to Git and preserves the user's manual terminal escape hatch.
- Legacy slash commit helpers may still shape commit messages or host-specific publish flow when explicitly available, but they must not bypass `ax commit` for agent-authored commits.
- Never use `--no-verify` when committing.
- Do not force push for ordinary follow-up work, review feedback, or CI fixes. Use subsequent commits because the user's hosted diffs are squash-merged. Force push only when it is necessary to resolve a Git history change, rebase, conflict, stale remote update, or when the user explicitly asks for a history rewrite.
- If a commit fails due to pre-commit hooks, fix branch-caused failures and retry; ask the user how to proceed only when the failure is unrelated, external, or requires a product decision.
- Always ask before committing or pushing to default branches such as `main` or `master`.
- In this `ai` repo, completed work should be delivered through a GitLab `origin` merge request targeting `main` with Nitro review by default. Do not commit directly to `main` or push `main` unless the user explicitly asks for direct publication.
- For this repo, treat GitLab `origin` as the primary hosted-review and publishing remote. The `github` remote remains a mirror path; use it only when the user explicitly asks or GitLab is unavailable.
- A hosted delivery for this repo is complete only after the GitLab MR exists, CI or no-pipeline state is inspected, Nitro review is requested with `/request_review @nitro`, and latest-head Nitro feedback is clean or fully resolved.
- For feature work, run the pre-commit quality gate, commit the feature branch, push it, create or update the artifact-host PR/MR, monitor CI, and fix branch-caused failures.
- For host-neutral work, choose the hosted-review provider from project
  instructions, existing artifact URLs, or `change-request-create`; pause when
  provider routing remains ambiguous.
- Select the hosted-review provider before pushing a branch. If a remote has
  multiple push URLs, push only to the selected provider URL or a
  provider-specific remote, not to every configured mirror.
- Never include `Co-Authored-By: Claude` or similar co-author attribution lines in MR or PR descriptions.

## MR and PR Description Maintenance

- For host-neutral requests to create or update a PR, MR, pull request, merge request, change request, or review artifact, use `change-request-create` first. Let it select the artifact provider and description policy, then delegate provider-specific mutation to `github-pr-create` or `glab-mr-create`.
- Use provider-specific creation skills directly only when the user explicitly asks for GitHub or GitLab, an existing artifact URL fixes the host, or a higher-level workflow has already selected the provider adapter.
- After any commit that changes an MR or PR's scope, behavior, approach, deployment requirements, or reviewer-facing content, update the description proactively. Do not wait for the user to ask.
- Reviewers only see the final diff. Keep the description aligned to the current branch, not intermediate approaches or reverted work.
- Do not narrate intermediate decisions, reverted approaches, or scoped-out work in the description unless there is a lasting consequence a reviewer needs to know, such as a follow-up issue or deliberate coverage gap.
- The `Summary`, `Testing`, `Deployment Notes`, and `Review Notes` sections must describe the MR or PR as it currently stands.
- Do not expose local private support artifact paths such as `~/.ax/plans/...`,
  raw private support artifacts, or private thread metadata in MR or PR
  descriptions by default. When support-artifact evidence is relevant, use
  summaries, hashes, thread references, note IDs, discussion IDs, or stable
  correlation IDs instead of local filesystem paths.
- Use `glab mr update <IID> --description "..."` for GitLab and `gh pr edit <number> --body "..."` for GitHub.

## Creating Hosted Reviews from a Dirty Working Tree

- When a hosted-review creation skill such as `/glab-mr-create` is invoked on a non-default branch with uncommitted changes, commit and push the relevant changes before creating the MR or PR. Do not ask first unless the diff includes unrelated user changes, secrets, generated noise, or a failed verification decision.
- Use `ax commit` or the equivalent review-gated commit workflow to author the commit. Standard rules still apply: no `--no-verify`, no default-branch push without confirmation, and no co-author attribution in commits.
- After committing and pushing, continue the hosted review creation workflow.

## Local Code Review

- When the user asks to review local changes, review their changes, review the working tree, or self-review, use the relevant local review skill in the current session.
- Implementation review of local changes is distinct from hosted PR/MR review.
- Skills may use available local, cloud, or custom subagents for independent review lanes when the diff is broad or high-risk.

## Hosted Provider Reviews

- When the user asks to review a merge request, such as `review MR !123` or a `git.fullscript.io` merge request URL, use the GitLab review skill or adapter in the current session.
- When the user asks to review a GitHub pull request, such as `review PR #123` or a `github.com/.../pull/123` URL, use the GitHub review skill or adapter in the current session.
- Do not use the `glab-cli` skill as the review rubric for MR reviews; it may still be used for authenticated GitLab data retrieval when the review skill requires GitLab CLI access.
- When requesting a review or re-review from a reviewer, use a GitLab slash command comment: `glab mr note <MR_IID> -m "/request_review @<reviewer>"`.
- Never use `glab mr update --reviewer` for review requests.

## GitLab CLI

- Always use the `/glab-cli` skill when performing GitLab CLI operations or interacting with `git.fullscript.io` URLs, except for MR reviews.
- Prefer `glab` subcommands such as `glab mr update` or `glab mr view` over raw `glab api` calls.
- Use `glab api` only when no suitable subcommand exists.

## GitLab MR Dependencies

- When an MR depends on other MRs being merged first, use the GitLab MR dependencies API to set formal blocking dependencies.
- Do not only mention dependencies in the MR description.
- The API endpoint is `POST /projects/:id/merge_requests/:merge_request_iid/blocks`.
- The endpoint requires the global `blocking_merge_request_id`, not the IID.
- To get the global ID, fetch the blocking MR first with `glab api projects/<project>/merge_requests/<iid>` and extract the `id` field.
- For cross-project dependencies, also pass `blocking_project_id`, the numeric project ID of the project containing the blocking MR.
- Same-project example: `glab api --method POST "projects/<project>/merge_requests/<iid>/blocks" -f blocking_merge_request_id=<global_id>`.
- Cross-project example: `glab api --method POST "projects/<project>/merge_requests/<iid>/blocks" -f blocking_merge_request_id=<global_id> -f blocking_project_id=<project_id>`.
- You may also mention dependencies in the MR description for human context, but the formal API dependency is authoritative.

## GitLab Stacked Diffs

- Before running `glab stack amend`, verify the current branch maps to the intended MR.
- First run `git branch --show-current` to confirm the current branch.
- Then run `glab mr list --source-branch <branch> --repo <repo>` to confirm which MR that branch maps to.
- `glab stack sync` always leaves the working tree on the last branch in the stack.
- Never assume you are on the correct branch after a stack sync.
- Never amend a diff without explicitly navigating to the correct branch first.

## Merging Stacked MRs

- When the user asks to merge MRs in a stack, merge from the bottom of the
  stack to the top: merge the first/base MR to `main` first, then the next MR,
  and continue until the last/top MR is merged last.
- Do not collapse the stack by merging the top MR first unless the user
  explicitly asks for that alternate landing shape.
- After each lower MR lands, refresh the next MR from live GitLab state before
  merging. GitLab may automatically retarget the next stacked MR to `main`.
- Expect conflicts to appear after retargeting. If the next MR is not
  mergeable, resolve the conflict on that MR's source branch, rerun the relevant
  verification, push the conflict fix, and re-check the MR before merging.
- Use the live MR head SHA as the merge guard for each MR and verify each merge
  with provider state before proceeding to the next MR.
