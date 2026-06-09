---
name: nitro-review-feedback
description: Use when collecting Nitro review feedback from Fullscript GitLab merge requests, Nitro comments, automatic MR review feedback, or GitLab discussions produced by Nitro.
allowed-tools: Bash(glab:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep
---

# Nitro Review Feedback

Collect Nitro feedback from Fullscript GitLab MRs and normalize it for `pull-request-review`. Nitro is a reviewer, not the GitLab artifact host.

## When to Use

- `review-feedback-routing` selects reviewer `nitro`.
- A Fullscript GitLab MR expects automatic Nitro feedback.
- `plan-to-pr` needs to wait for Nitro before treating review feedback as complete.

## Workflow

1. Confirm the MR is on Fullscript GitLab:
   ```bash
   glab mr view "<iid-or-url>" --output json
   glab api "projects/<project>/merge_requests/<iid>"
   ```
2. Capture latest MR head SHA from MR metadata.
3. Read discussions and notes:
   ```bash
   glab api "projects/<project>/merge_requests/<iid>/discussions?per_page=100"
   glab api "projects/<project>/merge_requests/<iid>/notes?per_page=100"
   ```
4. Identify Nitro-authored feedback by author, bot identity, command response, or org convention visible in the payload.
5. Classify feedback as pending, no issues, findings, unavailable, or stale.
6. Normalize actionable findings to the shared contract.

Do not request Nitro by default. Fullscript routing treats Nitro as automatic; only post `/request_review @nitro` when the user explicitly asks or routing says an explicit request is required.

## Output Contract

```markdown
reviewer: nitro
artifact: <MR URL>
head_sha: <sha-or-unknown>
feedback_kind: <inline | summary | discussion | review>
status: <pending | no issues | findings | unavailable | stale>
findings: <normalized pull-request-review findings or none>
stale_against_head: <yes | no | unknown>
verification_gaps: <none | list>
```

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating all GitLab feedback as Nitro | Identify Nitro-authored feedback explicitly |
| Requesting Nitro when routing says automatic | Wait and poll unless explicit request is configured |
| Passing old Nitro comments as clean | Compare feedback to the latest MR head SHA |
| Hiding missing Nitro access | Return `unavailable` with evidence |

## Validation Scenarios

- Automatic Nitro MR: pass only if the agent waits for Nitro-authored discussions/notes and ties them to the latest head.
- Missing Nitro feedback: pass only if status is `pending` or `unavailable`, not clean.
- Stale Nitro feedback: pass only if stale feedback does not satisfy the review gate.

## Test Evidence

- RED scenario: baseline GitLab review can conflate MR discussions with Nitro feedback or assume automatic feedback has completed.
- GREEN: this skill requires Nitro identity, latest-head staleness checks, and normalized feedback status.
