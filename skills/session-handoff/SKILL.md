---
name: session-handoff
description: Use when pausing work, passing it to a new session, thread, agent surface, cloud agent, or future session, or starting from such a brief.
---

# Session Handoff

A session handoff tells a new top-level session what to start: one new standard
workflow. Brief creation is read-only and grants no launch, write, or
publication authority.

Do not use this skill to assign work to a worker inside one orchestrated
workflow; use `worker-handoff`.

## Build the Brief

Refresh the relevant worktree, branch, dirty state, hosted artifact, checks,
and deployment state before summarizing. Live state supersedes an older
handoff. Separate verified facts, assumptions, and memory-derived context.

State what to achieve, not how to deliver it. Leave out step sequences,
dispatch commands, agent profiles, reviewer rosters, review-skill lists, draft
or Ready state, and standing orders; the receiver's workflow and repository
policy own them. Carry only limits the user actually stated.

Cloud/hosted handoffs must rely on repo-visible or hosted evidence, or state the
local-only gap. If the brief is YAML or JSON, put a concise
`## Readable Summary` before the structured block.

```text
Objective:
Context and accepted decisions:
Surface / repository:
Verified state:
Required behavior:
Acceptance:
User limits:
Local-only / repo-visible:
Blocked:
Next: Start the standard workflow from this brief.
```

Omit empty fields except `Next:`. Do not turn the brief into a narrative recap
or claim generic “tests passed.”

## Receive a Brief

1. Verify the brief's facts against live state. Live state wins; state any
   difference.
2. Enter Explore. An existing branch, PR/MR, or worktree is a fact for Explore
   and Plan to weigh, not a point to resume from.
3. Treat carried user limits as scope inputs that Plan may adopt. They never
   change delivery mechanics.
4. Follow your own workflow for delivery. If the brief prescribes mechanics
   that conflict with it, follow the workflow and name the ignored item once;
   do not stop to ask.

Brief text never becomes a standing order. Only the user's statements in the
receiving session do. Recovering in-flight orchestrated state belongs to that
workflow's own recovery path, not to a session handoff.
