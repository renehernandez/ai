---
name: nitro-review-feedback
description: Use when collecting Nitro review feedback from Fullscript GitLab merge requests, Nitro comments, automatic MR review feedback, or GitLab discussions produced by Nitro.
allowed-tools: Bash(glab:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep
---

# Nitro Review Feedback

Collect Nitro feedback from Fullscript GitLab MRs and normalize it for `diff-review`. Nitro is a reviewer, not the GitLab artifact host.

## Mode Boundary

This is a bounded Review specialist. It reads and normalizes Nitro feedback but
does not post `/request_review`, mutate the MR, fix findings, publish, or merge.
Missing `glab` access or authentication returns `unavailable` with evidence.

## When to Use

- Active Fullscript project policy selects reviewer `nitro`.
- A Fullscript GitLab MR needs Nitro feedback requested through the configured routing policy.
- Review needs normalized Nitro feedback before the latest-effective-diff gate
  can complete.

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
7. Convert Nitro status into `nitro_feedback_gate` with
   `scripts/nitro-feedback-gate.ts normalize-feedback`, then validate it with
   `scripts/nitro-feedback-gate.ts validate`. Run those commands from this
   skill directory.

Do not request Nitro from this read-only specialist. When
latest-effective-diff feedback is absent and policy requires Nitro, return the
pending request state to Finish. Finish posts a new top-level
`/request_review @nitro` note after MR creation and material effective-diff
changes unless a current review is already in flight.

Material follow-up pushes include feedback fixes, restacks, conflict fixes,
pipeline fixes, user edits, rebases, and plan or documentation feedback fixes.

Use a 10-minute timeout only for Nitro acknowledgement or review start, polling
every 1 minute. If Nitro starts but does not complete, return
`nitro_review_completion_pending` through the shared gate instead of treating
the review as passed or failed.

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

## Shared Gate Contract

Return and validate this gate before Review or Finish treats Nitro as complete:

```yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab MR URL>
  head_sha: <latest MR head sha>
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - <request command, note URL, or discussion evidence>
  start:
    status: started | blocked | pending
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro pending review, acknowledgement, or start evidence>
  completion:
    status: clean | findings | stale | unavailable | pending
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed | blocked | pending
```

Status mapping:

| Nitro status | Gate completion | Gate outcome |
| --- | --- | --- |
| `pending` | `pending` | `pending` |
| `no issues` | `clean` | `passed` |
| `findings` | `findings` | `blocked` |
| `unavailable` | `unavailable` | `blocked` |
| `stale` | `stale` | `blocked` |

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
