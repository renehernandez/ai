---
name: codex-review-feedback
description: Use when requesting, polling, or normalizing Codex review feedback on GitHub pull requests, GitHub PR comments, Codex connector reviews, or @codex review results.
allowed-tools: Bash(gh pr:*), Bash(gh api:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep
---

# Codex Review Feedback

Request and collect Codex review feedback from GitHub PRs, then normalize it for `diff-review`. Codex is a reviewer, not the GitHub artifact host.

## When to Use

- `review-feedback-routing` selects reviewer `codex`.
- A GitHub PR needs explicit Codex review feedback.
- `plan-unit-delivery` or `plan-to-review` must wait for Codex feedback on the latest PR head.

## Workflow

1. Resolve PR metadata and latest head SHA:
   ```bash
   gh pr view "<number-url-or-branch>" --json number,url,headRefOid,reviewDecision,statusCheckRollup
   ```
2. If feedback has not been requested and `request_mode` is `explicit`, request it using the project convention, such as an `@codex review` PR comment.
3. Poll PR reviews, review comments, issue comments, and reactions:
   ```bash
   gh pr view "<pr>" --comments
   gh api "repos/<owner>/<repo>/pulls/<number>/reviews" --paginate
   gh api "repos/<owner>/<repo>/pulls/<number>/comments" --paginate
   gh api "repos/<owner>/<repo>/issues/<number>/comments" --paginate
   ```
4. Identify Codex feedback from the configured Codex app, connector, bot author, comment marker, or request reaction.
5. Compare feedback to the latest head SHA when the payload includes commit or review metadata.
6. Normalize actionable findings to the shared contract.

Do not treat the request comment as the review result. The gate completes only when Codex feedback, a no-issues signal, or a clear timeout/blocker is observed for the latest head.

## Output Contract

```markdown
reviewer: codex
artifact: <PR URL>
head_sha: <sha-or-unknown>
feedback_kind: <inline | summary | discussion | review>
status: <pending | no issues | findings | unavailable | stale>
findings: <normalized diff-review findings or none>
stale_against_head: <yes | no | unknown>
verification_gaps: <none | list>
```

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating `@codex review` as completion | Poll until actual feedback, no-issues signal, or timeout |
| Mixing GitHub host checks with Codex feedback | Use `github-adapter-review` for host context, this skill for reviewer feedback |
| Passing stale Codex feedback | Compare with latest PR head SHA or mark staleness unknown |
| Inventing an unconfigured reviewer fallback | Use only configured reviewers |

## Validation Scenarios

- Requested Codex review with delayed response: pass only if the agent waits or reports timeout/blocker.
- Codex feedback on an older head: pass only if the gate remains stale or unknown.
- No configured Codex identity: pass only if feedback is `unavailable` with evidence.

## Test Evidence

- RED: prior `plan-unit-delivery` evidence recorded a PR where `@codex review` was requested but feedback arrived after completion.
- GREEN: this skill requires polling for actual latest-head Codex feedback and forbids treating the request comment as completion.
