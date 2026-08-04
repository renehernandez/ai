---
name: handoff-brief
description: Use when pausing, transferring, summarizing, or resuming non-trivial work across threads, agents, local apps, remote-control sessions, cloud agents, PR reviews, CI runs, or future sessions.
---

# Handoff Brief

Create a paste-ready continuation artifact that another agent or session can
verify against live state and act on immediately. This skill summarizes; it
does not mutate repository or provider state.

## Build the Brief

Refresh the relevant worktree, branch, dirty state, hosted artifact, checks,
and deployment state before summarizing. Live state supersedes an older
handoff. Separate verified facts, assumptions, and memory-derived context.

Include only continuation-critical information:

- objective and accepted decisions;
- repository/cwd, worktree, branch, PR/MR, and exact head when relevant;
- changed and untracked files, distinguishing local-only from repo-visible;
- verification with named unit/integration/E2E/deploy layers;
- blocker type and owner: branch-caused, external, permission, or product;
- one exact next action or decision.

Cloud/hosted handoffs must rely on repo-visible or hosted evidence, or state the
local-only gap.

```text
Objective:
Surface / repository:
Branch / artifact / exact head:
State:
Changed:
Verified:
Local-only / repo-visible:
Blocked:
Next:
```

Omit empty fields. Do not turn the brief into a narrative recap or claim generic
“tests passed.”
