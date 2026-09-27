---
name: handoff-brief
description: Use when pausing work or passing it to a new session, thread, agent surface, cloud agent, or future session that should start its own workflow.
---

# Handoff Brief

Create a paste-ready session handoff: what a new top-level session needs to
start one standard workflow. Brief creation is read-only and grants no launch,
write, or publication authority. The contract and receiving rules are
canonical in `rules/handoff-and-resume.md`.

Do not use this skill for worker assignments inside one orchestrated workflow.
In AX-managed Pi/Paseo sessions, the orchestrator writes implementer and
repair assignments under [the Pi workflow](references/paseo-workflow.md).

## Build the Brief

Refresh the relevant worktree, branch, dirty state, hosted artifact, checks,
and deployment state before summarizing. Live state supersedes an older
handoff. Separate verified facts, assumptions, and memory-derived context.

State what to achieve, not how to deliver it. Leave out step sequences,
dispatch commands, agent profiles, reviewer rosters, review-skill lists, draft
or Ready state, and standing orders; the receiver's workflow owns them. Carry
only limits the user actually stated.

Cloud/hosted handoffs must rely on repo-visible or hosted evidence, or state the
local-only gap.

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
