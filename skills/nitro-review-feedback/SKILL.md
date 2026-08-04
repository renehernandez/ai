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
2. From this skill directory, collect the MR, notes, discussions, and MR
   versions into the validator envelope:
   ```bash
   pnpm exec tsx scripts/gitlab-evidence-collect.ts \
     <iid> <artifact-lifecycle> <artifact-classification> \
     > /tmp/nitro-gitlab-evidence.json
   ```
   The collector calls `glab api --include` page by page, preserving each raw
   `X-Page` and `X-Next-Page` value through the empty terminal value.
3. Run
   `scripts/nitro-feedback-gate.ts validate-gitlab-evidence --file
   /tmp/nitro-gitlab-evidence.json`
   so readiness is derived from raw provider identities, chronology, current
   head transition from MR versions, diff count, actual request event,
   completion note, and unresolved discussions. The raw validator derives the
   required command and treats GitLab's capped `1000+` count as above the
   50-file route without claiming an exact count. For a larger POC or
   removal-only MR it requires the non-system authored `@nitro review` note with
   a nonempty requesting username rather than trusting task context or the
   generic reviewer-assignment event.
4. Identify every Nitro-authored response after the request by author, bot
   identity, command response, or org convention visible in the payload. The
   latest completion owns receipt identity, but feedback in any completion that
   requires an MR change keeps the gate blocked. Advice to get human review is
   nonblocking unless another authority independently requires it.
5. Classify feedback as pending, no issues, findings, unavailable, or stale.
6. Normalize actionable findings to the shared contract.
7. Convert Nitro status into `nitro_feedback_gate` with
   `scripts/nitro-feedback-gate.ts normalize-feedback`, then validate it with
   `scripts/nitro-feedback-gate.ts validate`. Run those commands from this
   skill directory.

Do not request Nitro from this read-only specialist. When
latest-effective-diff feedback is absent and policy requires Nitro, return the
pending request state to Finish. The selected Fullscript Nitro rule is the
canonical owner for request timing, command selection, duplicate suppression,
source-head classification, and acknowledgement timeout. This specialist
records that evidence without restating or mutating the policy.

## Output Contract

```markdown
reviewer: nitro
artifact: <MR URL>
head_sha: <sha-or-unknown>
head_evidence:
  - <provider MR-head readback>
artifact_lifecycle: poc | final_implementation
artifact_classification: standard | poc | removal-only
classification_evidence:
  - <accepted OpenSpec POC or final delivery checkpoint>
effective_diff_files: <non-negative integer>
effective_diff_head_sha: <latest MR head sha>
effective_diff_evidence:
  - <provider diff-stat readback>
request_note_id: <GitLab note id>
request_note_url: <GitLab note URL>
request_author: <requesting user>
request_body: <exact command-only note body>
request_observed_head_sha: <MR head read back immediately after request>
request_evidence:
  - <provider note and post-note head readback>
feedback_kind: <inline | summary | discussion | review>
status: <pending | no issues | findings | unavailable | stale>
findings: <normalized diff-review findings or none>
stale_against_head: <yes | no | unknown>
verification_gaps: <none | list>
```

## Shared Gate Contract

Return this normalized gate for downstream reviewers. Its YAML validation checks
shape and internal consistency; only `validate-gitlab-evidence` over raw GitLab
payloads can satisfy hosted readiness:

```yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab MR URL>
  artifact_lifecycle: poc | final_implementation
  artifact_classification: standard | poc | removal-only
  classification_evidence:
    - <accepted OpenSpec POC or final delivery checkpoint>
  head:
    sha: <latest MR head sha>
    evidence:
      - <provider MR-head readback>
  effective_diff:
    head_sha: <latest MR head sha>
    files: <non-negative integer>
    evidence:
      - <provider diff-stat readback for that head>
  request:
    required: true
    note_id: <GitLab note id>
    note_url: <GitLab note URL>
    author: <requesting user>
    body: <exact command-only note body>
    observed_head_sha: <MR head read back immediately after request>
    evidence:
      - <provider note and post-note head readback>
  start:
    status: started | blocked | pending
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro pending review, acknowledgement, or start evidence>
  completion:
    status: clean | findings | stale | unavailable | pending
    head_sha: <reviewed MR head sha, when Nitro responded>
    author: <Nitro provider identity, when Nitro responded>
    note_id: <Nitro note or discussion id, when Nitro responded>
    note_url: <Nitro note or discussion URL, when Nitro responded>
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
| Reimplementing request mechanics in Review | Return the pending state to Finish and apply the canonical Fullscript Nitro rule |
| Requesting Nitro repeatedly when a latest-head review is already in flight | Record the pending state, head SHA, and request evidence |
| Passing old Nitro comments as clean | Compare feedback to the latest MR head SHA |
| Hiding missing Nitro access | Return `unavailable` with evidence |
| Assuming a push starts Nitro | Return an explicit request requirement to Finish |
| Stopping after a Nitro repair push | Re-request Nitro and monitor the new source head |

## Validation Scenarios

- Explicit Nitro MR: pass only if the normalized evidence preserves the
  accepted lifecycle classification, provider-bound effective diff, actual
  request note plus its post-note head readback, and Nitro-authored response
  bound to the latest source head. The normalizer never invents acknowledgement
  or completion evidence.
- Raw provider gate: pass only when GitLab MR metadata supplies the current head
  and diff count, a provider request event follows the latest source push, an
  exact `nitro`-authored completion follows that request, and no resolvable,
  unresolved Nitro-authored discussion thread remains. Older resolvable,
  unresolved threads carry forward; non-resolvable historical
  `individual_note` summaries do not independently masquerade as unresolved
  threads. The deterministic receipt does not classify Nitro prose because its
  wording is not a stable machine-readable API. It reports whether an exact-head
  completion was received and whether unresolved Nitro discussions remain. The
  raw `gate_outcome: passed` therefore means the receipt is structurally
  complete, not that Finish found the response semantically clean. The
  provider envelope, exact-head chronology, identity, pagination, substantive
  completion, and unresolved-discussion requirements remain fail-closed.
  Finish must read every complete response and unresolved discussion. That
  semantic read is the sole owner for deciding whether Nitro raised feedback
  requiring an MR change; human-review advice alone is nonblocking. Feedback to
  address anywhere remains blocking even when the receipt itself was received.
  Technical readiness must carry Finish's exact-head semantic-review evidence;
  a passing raw receipt alone cannot satisfy readiness.
- Missing Nitro feedback: pass only if status is `pending` or `unavailable`, not clean.
- Stale Nitro feedback: pass only if stale feedback does not satisfy the review gate.
- Actionable feedback loop: pass only if every repair push receives a new
  request until the latest head is clean or a human decision blocks that MR.

## Test Evidence

- RED scenario: baseline GitLab review can conflate MR discussions with Nitro feedback or assume automatic feedback has completed.
- GREEN: this skill requires Nitro identity, latest-head staleness checks, and normalized feedback status.
- RED scenario: thread `019eb821-3bda-7db2-b40d-12c90f93b4cb` treated `request_review: false` as authoritative and blocked after no automatic Nitro feedback appeared.
- GREEN: the skill now directs agents to request Nitro when routing is explicit and to treat the request/pending state as evidence without re-requesting repeatedly.
