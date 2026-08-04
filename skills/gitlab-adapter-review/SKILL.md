---
name: gitlab-adapter-review
description: Use when reviewing GitLab merge requests, MR diffs, GitLab discussions, GitLab CI state, or GitLab review feedback.
allowed-tools: Bash(glab:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep, AskUserQuestion
---

# GitLab Adapter Review

## Authority and Route

This bounded Review adapter is read-only. It retrieves GitLab artifact state;
`diff-review` owns findings. Never post, approve, request review, resolve
discussions, publish, or merge. Missing `glab` access returns an evidenced
hosted gap, not a guessed pass.

Use for a GitLab MR/URL, an open MR for the current branch, or a request to
inspect GitLab discussions or CI. Use `github-adapter-review` for GitHub and
`diff-review` for local-only diffs. Local reviewer ledgers and readiness state
are private provenance, not hosted artifact context.

## Retrieval Decisions

1. Resolve project and MR through `glab mr view` plus the MR API. Capture IID,
   URL, title/description, author, labels, source/target, diff refs, head SHA,
   linked issues, draft state, and `head_pipeline` coordinates.
2. Preserve dirty user work. Review from a detached checkout or separate
   worktree bound to the hosted source head; report any identity or checkout
   gap.
3. Retrieve the host diff and changed files through `glab mr diff` and the
   changes API.
4. Retrieve all discussions. Include every unresolved thread; inspect position
   metadata when stale or resolved context affects readiness. Never resolve or
   dismiss a thread.
5. Retrieve the MR/head pipeline. When needed, use MR pipeline, jobs, trace, and
   bridge APIs. For failures, collect failed/blocked job traces when accessible.
   Inspect child/downstream state or report it unknown with evidence. Do not
   infer the MR pipeline from an unrelated branch pipeline.
6. Apply `diff-review` only to introduced or worsened issues and run
   `docs-alignment-review` when relevant behavior or contracts changed.

## Output

Return artifact/project identity; worktree guard; source/target SHAs and diff
scope; every unresolved discussion plus stale/resolved disposition; MR/head
pipeline ID, SHA, state, jobs/traces, and child/downstream state; docs and test
coverage state; exact retrieval performed; normalized findings; merge-readiness
assessment; and verification gaps. Unknown pipeline, thread, or checkout state
must stay explicit. Keep output local unless a separately authorized Finish
scope permits a host write.
