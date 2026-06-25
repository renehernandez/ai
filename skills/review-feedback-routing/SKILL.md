---
name: review-feedback-routing
description: Use when selecting machine-level review routing for GitHub PRs, GitLab MRs, Nitro, review feedback adapters, artifact hosts, or PR/MR review feedback policy.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Review Feedback Routing

Route PR/MR artifact handling separately from AI review feedback. Machine policy is the default source of truth; repo policy can override it later.

## When to Use

- `plan-unit-delivery` or `plan-review` needs to decide which artifact host and review feedback adapter to use.
- A repo has GitHub and GitLab remotes, mirrored repositories, or ambiguous review workflows.
- The user asks how Nitro or hosted review feedback should be requested or consumed.

## Source of Truth

Read routing in this order:

1. repo override: `.agents/review-routing.yaml`;
2. machine policy: `~/.agents/review-routing.yaml`;
3. tracked machine-policy source in this repo: `review-routing.yaml`;
4. examples in this skill as documentation only;
5. ask one blocking question if routing is still ambiguous.

Do not put review routing in CLI runtime config JSON. That config is for CLI mechanics, not review workflow policy.

## Vocabulary

| Term | Meaning | Examples |
| --- | --- | --- |
| `artifact.host` | Where the PR/MR lives | `github`, `gitlab` |
| `artifact.kind` | Review artifact type | `pull_request`, `merge_request` |
| `create_adapter` | Skill for opening/updating the artifact | `github-pr-create`, `glab-mr-create` |
| `inspect_adapter` | Skill for gathering host metadata/diff/checks | `github-adapter-review`, `gitlab-adapter-review` |
| `reviewer` | Actor that provides review feedback | `nitro`, `human` |
| `feedback_adapter` | Skill for requesting/polling/parsing feedback | `nitro-review-feedback` |

## Workflow

1. Detect repo remotes with `git remote -v`.
2. Match routes by `remote_host`, then by more specific keys when present: `remote_url_pattern`, `org`, then `repo`.
3. Use the selected artifact adapters for PR/MR creation and inspection.
4. Use `review_feedback.primary` to request or wait for hosted feedback.
5. Treat `review_feedback.experimental` as opt-in only.
6. Normalize reviewer output before feeding it into `diff-review`.
7. When Nitro is required, validate the route and final feedback with
   `scripts/nitro-feedback-gate.ts` before allowing a planning or delivery gate
   to pass.

Local reviewer evidence is source provenance for the commit boundary only. It
must not satisfy artifact-host inspection, MR approval, CI or no-pipeline
inspection, `planning_review`, or `nitro_feedback_gate` requirements.

If `origin`, `upstream`, or a supplied PR/MR URL point to different artifact hosts, prefer the host for the artifact being created or reviewed. If that is still ambiguous, ask one blocking question. Never fail open to the first route.

For the first stacked-delivery cut, required Nitro feedback is supported only
for Fullscript GitLab merge requests. GitHub PRs, non-Fullscript GitLab MRs,
and ambiguous artifact hosts return `nitro_route_unsupported`; do not
substitute Codex or another reviewer.

## Request Semantics

| Mode | Meaning |
| --- | --- |
| `automatic` | Feedback is expected to start from host automation, such as branch rules, labels, or CI integration |
| `explicit` | The agent must request feedback, such as a PR comment, slash command, or connector action |
| `manual` | Tell the user the exact manual request needed |
| `disabled` | Do not request that feedback route |

Use `trigger` to clarify the expected automatic or explicit event, such as `artifact_created`, `review_requested`, `label_added`, or `comment_posted`. If `required: true`, the review gate cannot pass until latest-head feedback is collected and resolved. Missing, unavailable, stale, timed-out, or unresolved required feedback is blocking.

For Nitro routes, use this default wait policy:

```yaml
wait:
  start_ack_timeout_minutes: 10
  poll_interval_minutes: 1
  start_timeout_outcome: nitro_review_start_blocked
```

The timeout applies only to Nitro acknowledging or starting the review. Once
Nitro starts, completion is pending until the latest-head review finishes.

## Staleness Rule

Review feedback must name the artifact head SHA to satisfy a review gate. Feedback with no head SHA is useful context, but the gate remains blocked until the reviewer output is tied to the latest PR/MR head.

## Delivery Gate Outcome

For required review feedback, normalize the final gate outcome before returning
to `plan-unit-delivery`:

```yaml
review_feedback:
  status: passed | blocked
  reviewed_head: <latest artifact head sha>
```

Use `passed` only when the routed reviewer produced latest-head feedback and no
actionable findings remain. Use `blocked` for missing feedback, timeout, stale
feedback, unavailable adapters, unresolved findings, or unknown head SHA.

When the selected reviewer is Nitro, return the shared gate shape validated by
`scripts/nitro-feedback-gate.ts validate`:

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

## Normalized Feedback Contract

```markdown
reviewer: <nitro | human | unknown>
artifact: <PR/MR URL>
head_sha: <sha-or-unknown>
feedback_kind: <inline | summary | check | discussion | review>
status: <pending | no issues | findings | unavailable | stale>
findings: <normalized diff-review findings or none>
stale_against_head: <yes | no | unknown>
verification_gaps: <none | list>
```

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating all GitLab remotes as Nitro | Match `git.fullscript.io` specifically |
| Treating all GitHub remotes the same | Add `org` or `repo` match keys when private GitHub and open-source GitHub differ |
| Mixing GitHub/GitLab with Nitro | Keep artifact host and review feedback separate |
| Adding future reviewers before they exist | Leave them out until the adapter exists |
| Letting CLI config decide review policy | Read routing YAML instead |
| Letting a typo fail open | Unmatched routes must ask or block according to `unmatched` |
| Assuming `automatic` explains itself | Set a `trigger` and record whether the expected event happened |
| Passing stale feedback as clean | Require matching `head_sha` or mark the gate blocked |

## Validation Scenarios

- Fullscript GitLab MR: pass only if `git.fullscript.io` selects GitLab artifact adapters and explicit Nitro feedback requested through `/request_review @nitro`.
- GitHub PR: return `nitro_route_unsupported` for required Nitro feedback in this first cut.
- Mixed `origin`/`upstream` remotes: pass only if the artifact URL or target remote controls routing, or the agent asks.
- Unmatched typo host: pass only if routing asks or blocks instead of picking the nearest route.
- Future reviewer absent: pass only if no unconfigured reviewer route is selected or invented.

## Test Evidence

- RED: sub-agent `019eae29-0cdb-76c2-bbb9-7a5be0501e9a` mixed some artifact-host and reviewer terms, suggested a non-runtime config location, and identified over-broad GitHub routing, origin/upstream ambiguity, vague automatic semantics, skip/override gaps, and typo fail-open risk.
- GREEN: this skill separates artifact host, review feedback, and adapters; uses machine policy before repo overrides; excludes unconfigured future reviewers; and requires unmatched routes to ask or block.
- GREEN: GitHub artifacts now remain unsupported for required Nitro feedback in the first stacked-delivery cut instead of selecting another reviewer.
- RED: thread `019eb821-3bda-7db2-b40d-12c90f93b4cb` blocked after repeated polls because routing marked Fullscript Nitro as automatic with `request_review: false`, so no Nitro review was requested.
- GREEN: Fullscript Nitro routing now uses explicit `review_requested` semantics with `request_review: true`, matching the Fullscript Nitro rule that posts `/request_review @nitro` after MR creation or material follow-up pushes.
