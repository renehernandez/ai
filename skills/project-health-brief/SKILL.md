---
name: project-health-brief
description: Use when summarizing active repository work, repo status, work dashboards, open PRs, dirty worktrees, stale branches, checks pending, CI failing, merge queue, deployment status, merge readiness, or next actions.
---

# Project Health Brief

Produce a read-only operational brief from refreshed local and provider state.
Prioritize actionability without cleaning, stashing, pulling, syncing, deleting,
or otherwise mutating work.

## Assess

Inspect relevant worktrees and branch tracking. Prefer authenticated provider
evidence for open artifacts, checks, queues, and deployments. Fetch only when
the user expects refreshed refs or authorizes that mutation; otherwise name the
local-ref limitation.

Classify each material item:

- **Ready:** the next safe action is supported by current evidence.
- **Blocked:** an external, permission, product, conflict, or dirty-state
  condition prevents progress.
- **Watching:** a current check, review, run, or deployment is pending.
- **Stale / cleanup:** likely needs a later ownership or cleanup decision; never
  treat it as immediate deletion authority.

Lead with one concrete next action, then secondary choices. Every non-empty
section names whether its evidence is local status, provider state, or a
verification gap.

```text
Scope / exact state verified:
Top next action:
Ready:
Blocked:
Watching:
Stale / cleanup:
Verification gaps:
```

Omit empty sections. Do not overclaim provider freshness from local refs or list
all branches with equal weight.
