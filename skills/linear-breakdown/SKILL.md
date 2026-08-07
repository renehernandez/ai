---
name: linear-breakdown
description: Use when collaboratively turning plans, OpenSpec changes, specs, design docs, or implementation proposals into Linear issues, milestones, projects, or delivery slices.
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(linearis:*), Bash(jq:*), mcp__linear__*, mcp__codex_apps__linear_*
---

# Linear Breakdown

## Authority

This specialist turns accepted artifacts into semantic outcome slices. It does
not replace implementation `plan`. Discovery and deduplication are read-only;
only Finish writes after the user reviews the proposed breakdown. Use an
available authenticated Linear MCP or app integration first and fall back to
`linearis` only when it is unavailable, unauthenticated, or lacks the
operation.

Immediate creation requires explicit acceptance of both skipping the breakdown
preview and writing Linear now. Speed, trust, or “create the tickets” alone is
not that authority. Preview approval does not authorize unseen Linear prose;
provider messages still use
`rules/git-and-review.md#agent-authored-provider-messages`.

## Shape the Delivery Arc

Extract the target outcome, earliest real end-to-end proof, reusable systems,
constraints/non-goals, and deferred hardening. Present 2–3 arcs with the
recommended outcome-first arc, then refine slices in small groups.

Default order:

1. prove the real path once;
2. make failures diagnosable;
3. make it trustworthy and safe;
4. activate, deploy, or enforce it;
5. expand scenarios or integrations;
6. finish docs, operations, ownership, and cleanup.

Foundation belongs in the first issue only when required by that proof. Split
different outcomes, owners, or independently shippable work. Merge unused
foundation or tiny tasks with identical verification. Separate advisory order
from true blocking dependencies. Suggest a milestone only for a coherent arc,
normally three or more issues.

Load [issue shape and proof](references/issue-shape.md) when drafting issue
bodies. Every slice needs an outcome-centered title, scope, acceptance,
verification, exclusions, dependencies, and references. Hosted/external
behavior needs direct proof that the claimed path ran; generic green CI or code
existence is insufficient. Name runtime activation conditions and cross-system
identifier representations, or add discovery/narrow the slice.

## Preview and Apply

Return `linear_breakdown_preview` with source artifact, awaiting-approval
status, recommended arc/milestone, first observable outcome, ordered issue
summaries, dependency distinctions, reuse/update decisions, deferred work,
issue count, and one mode: `draft_only`, `create_after_approval`, or explicitly
authorized `create_immediately`.

After approval, re-read every immutable target and stop on material drift.
Apply only approved fields and require exact readback through the adapter that
performed the write. Use the preferred integration for rich issue descriptions.
On the `linearis` fallback path, rich descriptions trigger its file-backed-input
blocker and only description-free bounded scalar mutations may proceed. Re-read
before changing adapters so an ambiguous mutation is never duplicated. Return
verified issue keys/links, milestone link, order/dependencies, deferred work,
drift, and capability gaps.

If the first one or two issues do not produce an observable outcome, revise the
breakdown before preview.
