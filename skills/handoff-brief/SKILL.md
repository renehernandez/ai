---
name: handoff-brief
description: Use when pausing, transferring, summarizing, or resuming non-trivial work across threads, agents, local apps, remote-control sessions, cloud agents, PR reviews, CI runs, or future sessions.
---

# Handoff Brief

## Overview

Create a compact continuation artifact that another agent or future session can verify against live state and use immediately.

## When To Use

Use when work may continue elsewhere, the user asks to summarize current state, a thread is ending, or a task is crossing local/cloud/CI surfaces. Skip trivial one-step answers.

## Quick Reference

| Handoff target | Include |
| --- | --- |
| Local agent or remote-controlled host | cwd, branch, dirty state, local-only context |
| Cloud agent or hosted review | repo-visible files, branch/PR, decisions, no local-only assumptions |
| CI or merge follow-up | PR, checks, run IDs, blockers, next verification |
| Future session | objective, decisions, changed files, next action |

## Workflow

1. Verify live state before summarizing: `git status --short --branch`, worktree, PR, CI, or deployment state as relevant.
2. Separate facts from assumptions. Mark any unverified memory-derived context.
3. Capture only what the next agent needs:
   - objective and current decision;
   - repo/cwd, branch, PR, and dirty state;
   - files changed or docs written;
   - verification run with exact test-layer names;
   - blockers, owner, and whether they are branch-caused, external, permission-related, or product decisions;
   - next concrete command/action.
4. If live state differs from the prior handoff, state the difference and trust live state.
5. Keep the brief paste-ready.

## Brief Template

```markdown
Objective:
Surface/Repo:
Branch/PR:
State:
Changed:
Verified:
Local-only / Repo-visible:
Blocked:
Next:
```

Omit empty sections. Add links/paths only when useful.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Writing a narrative recap | Write a continuation brief |
| Hiding dirty state | Report it directly |
| Saying "tests passed" generically | Name unit/component/integration/E2E/deploy verification |
| Relying on local files for cloud handoff | Point to repo-visible docs or say what is local-only |
| Giving no next action | End with one concrete command or decision |

## Validation Scenarios

- Dirty detached checkout: pass only if branch/worktree state is explicit.
- Cloud handoff: pass only if repo-visible context is enough to continue.
- Failed CI handoff: pass only if blocker type and next verification are clear.

## Test Evidence

- RED: baseline handled dirty cloud handoff but used a looser narrative shape.
- GREEN: skill run produced explicit dirty/detached and local-only continuation fields.
- REFACTOR: template now forces Surface/Repo, Branch/PR, and Local-only / Repo-visible.
