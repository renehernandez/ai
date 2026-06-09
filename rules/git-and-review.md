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

- Always use the `/glab-commit` skill when committing and pushing changes.
- Never use `--no-verify` when committing.
- If a commit fails due to pre-commit hooks, fix branch-caused failures and retry; ask the user how to proceed only when the failure is unrelated, external, or requires a product decision.
- Always ask before committing or pushing to default branches such as `main` or `master`.
- For feature work, follow [feature-delivery.md](feature-delivery.md): run the pre-commit quality gate, commit the feature branch, push it, create or update the artifact-host PR/MR, monitor CI, and fix branch-caused failures.
- Never include `Co-Authored-By: Claude` or similar co-author attribution lines in MR or PR descriptions.

## Local Code Review

- When the user asks to review local changes, review their changes, review the working tree, or self-review, delegate to the `local-review` agent.
- Local review is distinct from hosted PR/MR review.

## Hosted Provider Reviews

- When the user asks to review a merge request, such as `review MR !123` or a `git.fullscript.io` merge request URL, delegate to the `gitlab-review` agent.
- When the user asks to review a GitHub pull request, such as `review PR #123` or a `github.com/.../pull/123` URL, delegate to the `github-review` agent.
- Do not use the `glab-cli` skill for MR reviews.
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
