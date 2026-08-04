---
name: nitro-review-feedback
description: Use when collecting Nitro review feedback from Fullscript GitLab merge requests, Nitro comments, automatic MR review feedback, or GitLab discussions produced by Nitro.
allowed-tools: Bash(glab:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep
---

# Nitro Review Feedback

## Authority

This bounded Review specialist collects and normalizes Nitro feedback from a
Fullscript GitLab MR. It is read-only: never request Nitro, post notes, mutate
the MR, fix findings, publish, or merge. Missing access returns `unavailable`
with evidence. Finish owns provider requests and semantic response review;
`rules/fullscript/nitro-review.md` owns request timing and routing policy.

Use only when active project policy selects Nitro or Review needs current Nitro
evidence for the latest effective diff. Nitro is the reviewer, not the artifact
host.

## Collect and Validate

1. Confirm the artifact is a Fullscript GitLab MR and read its current head.
2. From this skill directory, run
   `scripts/gitlab-evidence-collect.ts <iid> <artifact-lifecycle>
   <artifact-classification>` to collect MR metadata, notes, discussions, and
   versions with complete pagination headers.
3. Run `scripts/nitro-feedback-gate.ts validate-gitlab-evidence` on that raw
   envelope. The validator owns request command selection, identity,
   chronology, diff classification, pagination, latest-head binding, completion
   receipt, and unresolved-discussion gates.
4. Read every Nitro-authored response after the current-head request. The latest
   completion supplies receipt identity, but any response or unresolved thread
   requiring an MR change remains actionable. Human-review advice alone is
   nonblocking unless another authority requires it.
5. Classify `pending`, `no issues`, `findings`, `unavailable`, or `stale` and
   normalize actionable items to the shared `diff-review` finding contract.
6. Run `normalize-feedback`, then `validate`, through
   `scripts/nitro-feedback-gate.ts`.

Do not infer clean from a structurally passing raw receipt. The deterministic
gate proves provider evidence and chronology, not the meaning of Nitro prose.
Return the complete response and unresolved discussions to Finish for exact-head
`hostedFeedbackSemanticReview`. Missing current feedback returns a pending
request state to Finish; this specialist never reimplements or mutates request
policy.

## Output

Return `nitro_feedback_gate` with:

- artifact URL, lifecycle, classification, and classification evidence;
- current head SHA and provider evidence;
- effective-diff head, file count, and evidence;
- request note ID/URL, author, exact body, observed head, and evidence;
- start status/evidence and completion status, head, author, note, and evidence;
- normalized actionable, non-actionable, and stale feedback;
- `passed`, `blocked`, or `pending` outcome; and
- access, pagination, identity, staleness, or semantic-review gaps.

Only raw-provider validation may satisfy the structural hosted gate. Old-head
feedback never satisfies current Review. Any repair push needs a new Finish
request and a new latest-head collection cycle.
