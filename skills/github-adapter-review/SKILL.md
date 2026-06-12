---
name: github-adapter-review
description: Use when reviewing GitHub pull requests, PR diffs, GitHub reviews or comments, GitHub Actions checks, or GitHub-hosted review feedback.
allowed-tools: Bash(gh pr:*), Bash(gh api:*), Bash(gh auth:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep, AskUserQuestion
---

# GitHub Adapter Review

Use GitHub as the artifact-host adapter, then apply `diff-review` to the verified PR diff. Keep review output in the conversation unless the user explicitly asks to post, approve, request changes, merge, or resolve conversations.

## When to Use

- The user asks to review a GitHub pull request or PR URL.
- The current branch has an open GitHub PR.
- `plan-to-pr` or `plan-to-review` detects a GitHub remote and needs the hosted review gate.
- The user asks to inspect GitHub reviews, comments, or Actions checks for a PR.

Use `diff-review` directly for local-only diffs. Use `gitlab-adapter-review` for GitLab MRs.

## Adapter Workflow

1. Resolve the PR:
   ```bash
   gh pr view "<number-url-or-branch>" --json number,url,title,body,author,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,isDraft,labels,reviewDecision,latestReviews,reviewRequests,statusCheckRollup
   ```
   With no argument, `gh pr view` selects the PR for the current branch.

2. Capture artifact-host context:
   - PR number and URL
   - title, body, author, labels, draft state
   - base/head branches and SHAs
   - review decision, latest reviews, requested reviewers
   - issue comments, review comments, review threads, and unresolved feedback when available
   - GitHub Actions/check state and links

3. Checkout or verify the PR branch before reading files:
   ```bash
   gh pr checkout "<number-url-or-branch>"
   ```
   Preserve dirty user work; stop before checkout if the working tree is not clean.

4. Get the verified diff:
   ```bash
   gh pr diff "<number-url-or-branch>" --patch --color never
   gh pr diff "<number-url-or-branch>" --name-only
   ```

5. Fetch comments, review threads, and checks:
   ```bash
   gh pr view "<number-url-or-branch>" --comments
   gh api "repos/<owner>/<repo>/issues/<number>/comments" --paginate
   gh api "repos/<owner>/<repo>/pulls/<number>/comments" --paginate
   gh api graphql -f owner="<owner>" -f repo="<repo>" -F number="<number>" -f query='<query below>'
   gh pr checks "<number-url-or-branch>" --json name,state,bucket,link,workflow
   ```
   Use REST comments for issue and inline review comments. Use GraphQL review threads when unresolved/resolved thread state matters. If GraphQL access is unavailable, report unresolved thread state as a verification gap.
   Treat `gh pr checks` exit code 8 as pending checks, not a command failure.

   GraphQL review-thread query:
   ```graphql
   query($owner: String!, $repo: String!, $number: Int!) {
     repository(owner: $owner, name: $repo) {
       pullRequest(number: $number) {
         reviewThreads(first: 100) {
           nodes {
             isResolved
             isOutdated
             path
             line
             originalLine
             comments(first: 100) {
               nodes {
                 author { login }
                 body
                 createdAt
                 updatedAt
                 outdated
                 url
               }
             }
           }
         }
       }
     }
   }
   ```

6. Apply `diff-review`:
   - review only issues introduced or materially worsened by the PR diff;
   - read full changed files and relevant usages/tests;
   - include GitHub reviews, comments, review threads, and checks as artifact-host context;
   - run `docs-alignment-review` when behavior, workflow, architecture, tests, CI, deployment, auth, data contracts, or agent expectations changed.

## Output Contract

Return this shape so `plan-to-pr` or `plan-to-review` can consume the gate consistently:

```markdown
Artifact host: GitHub
Artifact: #<number> <url>
Base/Head: <base>@<sha-or-unknown>...<head>@<sha-or-unknown>
Diff source: gh pr diff <number-or-url> --patch --color never
Checks: <green | failing | pending | unknown> — <evidence>
Unresolved feedback: <none | count and summary>
Findings: <diff-review findings or no issues>
Docs alignment: <clean | updates needed | not applicable | not run>
Verification gaps: <none | list>
```

## Quick Reference

| Need | Command |
| --- | --- |
| View PR metadata | `gh pr view "<pr>" --json number,url,title,baseRefName,baseRefOid,headRefName,headRefOid,reviewDecision,statusCheckRollup` |
| Checkout PR | `gh pr checkout "<pr>"` |
| Diff | `gh pr diff "<pr>" --patch --color never` |
| Changed files | `gh pr diff "<pr>" --name-only` |
| Comments | `gh pr view "<pr>" --comments` |
| Issue comments | `gh api "repos/<owner>/<repo>/issues/<number>/comments" --paginate` |
| Inline review comments | `gh api "repos/<owner>/<repo>/pulls/<number>/comments" --paginate` |
| Review threads | `gh api graphql -f owner="<owner>" -f repo="<repo>" -F number="<number>" -f query='<pullRequest.reviewThreads query>'` |
| Checks | `gh pr checks "<pr>" --json name,state,bucket,link,workflow` |

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating GitHub mechanics as review judgment | Use GitHub only to gather host context; apply `diff-review` for findings |
| Ignoring stale review state | Compare base/head SHAs and say when comments or reviews predate the latest head |
| Claiming unresolved threads were checked without GraphQL | Use `gh api graphql` for review threads or report the gap |
| Treating pending checks as pass/fail | `gh pr checks` exit code 8 means pending; report that state |
| Posting review comments by default | Keep output local unless the user explicitly asks for a host write |
| Using GitLab commands for GitHub | Use `gh` and GitHub PR terminology |

## Validation Scenarios

- GitHub PR with inline comments and a newer head SHA: pass only if review comments/threads are fetched or the GraphQL gap is reported.
- GitHub PR with pending Actions checks: pass only if pending checks are reported distinctly from failure.
- Clean GitHub PR review: pass only if residual host-context gaps and docs alignment state are still named.

## Test Evidence

- RED: sub-agent `019eae14-2d96-7831-b165-48b04425c034` listed standard `gh pr view`, `gh pr diff`, `gh pr checks`, REST comments, and a GraphQL review-thread query under pressure, but still named stale comments, hidden comments, external checks, and local reproduction as residual unknowns.
- GREEN: this skill makes REST comments, GraphQL review threads, pending checks, and verification gaps mandatory parts of the adapter workflow and output contract.
- GREEN: sub-agent `019eae16-5bfa-75b2-8e9d-cfa8468b855f` passed the GitHub PR pressure test with REST comments, GraphQL review threads, pending-check handling, stale-review awareness, docs alignment, and verification gaps.
- REFACTOR: adapter output contract keeps artifact-host context separate from `diff-review` findings so `plan-to-pr` can consume the gate.
