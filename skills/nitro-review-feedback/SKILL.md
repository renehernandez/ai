---
name: nitro-review-feedback
description: Use when collecting Nitro review feedback from Fullscript GitLab merge requests, Nitro comments, automatic MR review feedback, or GitLab discussions produced by Nitro.
allowed-tools: Bash(glab:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep
---

# Nitro Review Feedback

Collect Nitro feedback from Fullscript GitLab MRs and normalize it for `diff-review`. Nitro is a reviewer, not the GitLab artifact host.

## When to Use

- `review-feedback-routing` selects reviewer `nitro`.
- A Fullscript GitLab MR needs Nitro feedback requested through the configured routing policy.
- `plan-unit-delivery` or `plan-to-review` needs to wait for Nitro before treating review feedback as complete.

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

Request Nitro only when routing says `request_mode: explicit` with `capabilities.request_review: true`, or when the user explicitly asks. For Fullscript GitLab, the configured route requires posting `glab mr note <MR_IID> -m "/request_review @nitro"` after MR creation and after material follow-up pushes unless a latest-head Nitro review is already in flight.

## Output Contract

```markdown
reviewer: nitro
artifact: <MR URL>
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
| Treating all GitLab feedback as Nitro | Identify Nitro-authored feedback explicitly |
| Waiting forever when routing requires an explicit Nitro request | Post `/request_review @nitro`, then poll for latest-head Nitro feedback |
| Requesting Nitro repeatedly when a latest-head review is already in flight | Record the pending state, head SHA, and request evidence |
| Passing old Nitro comments as clean | Compare feedback to the latest MR head SHA |
| Hiding missing Nitro access | Return `unavailable` with evidence |

## Validation Scenarios

- Explicit Nitro MR: pass only if the agent requests Nitro, waits for Nitro-authored discussions/notes, and ties them to the latest head.
- Missing Nitro feedback: pass only if status is `pending` or `unavailable`, not clean.
- Stale Nitro feedback: pass only if stale feedback does not satisfy the review gate.

## Test Evidence

- RED scenario: baseline GitLab review can conflate MR discussions with Nitro feedback or assume automatic feedback has completed.
- GREEN: this skill requires Nitro identity, latest-head staleness checks, and normalized feedback status.
- RED scenario: thread `019eb821-3bda-7db2-b40d-12c90f93b4cb` treated `request_review: false` as authoritative and blocked after no automatic Nitro feedback appeared.
- GREEN: the skill now directs agents to request Nitro when routing is explicit and to treat the request/pending state as evidence without re-requesting repeatedly.
