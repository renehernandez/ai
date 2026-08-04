---
name: linear-project-overview
description: Use when drafting, reviewing, or updating a Linear project's summary or description, especially when the overview is unstable, overloaded with delivery detail, duplicates milestones or updates, or needs approval-safe provider mutation.
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(linearis:*), Bash(jq:*), mcp__linear__*, mcp__codex_apps__linear_*
---

# Linear Project Overview

## Mode Boundary

This is a bounded specialist, not a lifecycle owner. Explore owns drafting and
review, which are read-only. Finish owns a later explicitly approved update.
Never treat the initial request as permission to mutate Linear.

Use an available authenticated Linear MCP or app integration first. Fall back
to `linearis` when that integration is unavailable, unauthenticated, or lacks
the required operation, and follow the `linearis` skill for CLI mechanics.

## Provider Field Mapping

Keep workflow language distinct from Linearis field names:

| Workflow term | Linearis project field |
| --- | --- |
| Summary | `description` |
| Markdown description | `content` |

The workflow summary is the short project outcome. The workflow description is
the complete Markdown overview. Preserve this mapping in every preview,
comparison, write, and readback.

## Content Contract

Write the summary as one stable project-outcome statement within Linear's
255-character limit. It should remain true when dates, milestones, or
implementation choices change.

Use this description structure:

```markdown
## Why
<problem or opportunity and its consequence>

## Outcome
<durable target state>

## Scope
<project-level capabilities or responsibilities>

## Non-goals
<plausibly confusing adjacent scope that is not included>

## Success
<observable project-level end states or meaningful KPIs>
```

Include `Non-goals` only when adjacent scope could reasonably be mistaken for
current scope and the source artifacts show that ambiguity. Never invent a
non-goal to complete the template; omit the section when the evidence does not
support one. Do not add a `Resources` heading; native project resources own
supporting documents and links. Use an inline stable link only when it is
necessary to understand a specific statement.

Name architecture only when establishing it is itself the outcome. Prefer
stable responsibilities and boundaries over volatile interfaces or sequence.
Exclude milestone and issue inventories, delivery order, rollout sequence,
current status, blockers, risks, next steps, issue-level acceptance criteria,
and detailed design. Exclude future-adjacent work unless a conditional
non-goal prevents a plausible scope misunderstanding.

## Source Precedence

Use this order:

1. Explicit decisions in the current conversation.
2. An accepted Project Brief, design, plan, or specification.
3. Verified current repository or system behavior.
4. Team feedback that must be resolved.
5. Existing Linear text, initiative, milestones, and resources as context.

Do not infer purpose from an overview that is being corrected or reverse-engineer
it from the delivery inventory.

## Draft Or Review

1. Identify the exact existing project, or establish that the request concerns
   a proposed project.
2. Through the selected Linear adapter, read the project, project documents,
   milestones, and issues without mutation. On the CLI fallback path, first use
   `linearis projects usage` and the relevant domain usage. Read accepted
   source artifacts when available.
3. Traverse every project discussion page through `pageInfo.endCursor`, then
   traverse every relevant root thread's replies before selecting unresolved
   feedback.
4. Route unresolved purpose or scope before drafting.
5. Return an exact preview containing:
   - the immutable Linear project ID and link, or `proposed project` when no
     provider target exists;
   - the observed workflow `summary` (`description` field), workflow
     `description` (`content` field), and each relevant unresolved
     feedback item's identifier, resolution state, body, update timestamp, and
     anchored quoted text when present;
   - the proposed `summary` and complete `description`; and
   - alignment, drift, feedback, and intentional-exclusion findings.
6. Stop. The first turn is read-only and returns an exact preview.

For a proposed project, draft the overview only. This skill never creates a
Linear project.

## Apply An Approved Preview

Proceed only after a later explicit instruction approves the exact preview.

1. Re-fetch the exact project by immutable ID, traverse every project
   discussion page and every relevant root thread's replies, and only then
   select the relevant unresolved feedback.
2. Compare the current Linear `description` and `content` fields exactly with
   the observed workflow summary and description in the approved snapshot. Any
   mismatch stops the update and returns a refreshed preview for approval.
3. Compare each relevant unresolved feedback item's identifier, resolution
   state, body, update timestamp, and anchored quoted text exactly with the
   approved snapshot. New or changed material feedback stops the update and
   refreshes the preview; minor wording drift is reported without blocking.
4. Update only the mapped `description` and `content` fields through the
   preferred integration when it supports the approved rich Markdown. If that
   integration is unavailable, unauthenticated, or lacks the operation, fall
   back to `linearis`; return its file-backed-input capability blocker before a
   rich Markdown write.
5. Read both fields back through the adapter that performed the write, require
   exact equality with the approved values, and return the project link. Report
   a mismatch as failed verification without another provider write.

Materially contradictory unresolved feedback blocks finalization. Minor wording
feedback is reported but does not block. Never change teams, initiatives, lead,
members, status, dates, labels, priority, milestones, issues, updates, comments,
documents, or native resources.

## Adjacent Owner Routing

| Need | Owner |
| --- | --- |
| Unresolved purpose, outcome, or scope | `brainstorming` |
| New-effort intake or context mapping | `start-project` |
| Milestones or issues | `linear-breakdown` |
| Detailed design document | Native project document, with `doc-smith` when engineering-document guidance is useful |
| Progress, health, blockers, or next steps | Linear project update |

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Turning milestones into the description | State stable scope; leave delivery stages in milestones |
| Keeping a status snapshot because it is useful today | Put transient progress in a project update |
| Promoting possible future work into scope | Omit it or use a conditional non-goal when ambiguity is plausible |
| Applying after the project changed | Refresh the preview and request approval again |
| Confusing workflow terms with CLI fields | Map summary to `description` and Markdown description to `content` |
| Sending approved Markdown as a CLI inline argument | Use the preferred integration or return the CLI file-backed-input capability blocker |
| Prompting for integration login while Linearis is authenticated and capable | Fall back to `linearis` without weakening preview or readback requirements |
| Updating related project fields for consistency | Change only the approved mapped fields |
