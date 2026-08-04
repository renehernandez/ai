---
name: github-adapter-review
description: Use when reviewing GitHub pull requests, PR diffs, GitHub reviews or comments, GitHub Actions checks, or GitHub-hosted review feedback.
allowed-tools: Bash(gh pr:*), Bash(gh api:*), Bash(gh auth:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep, AskUserQuestion
---

# GitHub Adapter Review

## Authority and Route

This bounded Review adapter is read-only. It retrieves GitHub artifact state;
`diff-review` owns findings. Never post, approve, request review, resolve
threads, publish, or merge. Missing `gh` access returns an evidenced hosted gap,
not a guessed pass.

Use for a GitHub PR/URL, an open GitHub PR for the current branch, or a request
to inspect GitHub reviews, comments, threads, or Actions. Use
`gitlab-adapter-review` for GitLab and `diff-review` for local-only diffs. Do not
request, poll, normalize, or gate on Codex-authored PR feedback;
`codex-review-feedback` remains retired.

## Retrieval Decisions

1. Resolve the PR with `gh pr view` and capture number/URL, title/body, author,
   labels, draft state, base/head branches and OIDs, review decision/requests,
   latest reviews, and check rollup.
2. Preserve dirty user work. Verify or safely checkout the PR head before
   reading files; otherwise report the checkout gap.
3. Retrieve patch and changed-file scope with `gh pr diff`.
4. Retrieve issue comments and inline review comments through paginated REST.
   Use GraphQL `pullRequest.reviewThreads` when resolved/unresolved and outdated
   thread state matters; then load
   [review-thread retrieval](references/review-thread-retrieval.md). If GraphQL
   is unavailable, report thread state as unknown.
5. Retrieve Actions through `gh pr checks`. Exit code 8 means pending, not
   failure. Bind checks, reviews, and comments to the current head when the host
   exposes chronology; stale evidence does not prove the latest diff.
6. Apply `diff-review` to introduced or worsened issues and run
   `docs-alignment-review` when the diff changes behavior, workflow,
   architecture, tests, CI, deployment, auth, data contracts, or agent
   expectations.

## Output

Return artifact host/URL, base and head branches/OIDs, diff source and changed
files, check state/evidence, review decision, every unresolved thread or the
retrieval gap, stale feedback disposition, normalized findings, docs-alignment
state, and verification gaps. Keep output local unless a separately authorized
Finish scope permits a host write.
