---
name: work-health-brief
description: Use when summarizing active repository work, repo status, work dashboards, open PRs, dirty worktrees, stale branches, checks pending, CI failing, merge queue, deployment status, merge readiness, or next actions.
---

# Work Health Brief

## Overview

Produce a compact operational brief from live repo/provider state. Separate active work, blockers, and next actions without changing files.

## When To Use

Use for "what's next?", work dashboards, project health, daily briefs, stale branch checks, PR triage, or cross-worktree status. Skip when the user asks for a single known PR or command output.

## Quick Reference

| Signal | Check |
| --- | --- |
| Dirty work | `git status --short --branch` per relevant checkout |
| Multi-worktree state | `git worktree list` |
| Open PRs | provider tool such as `gh pr status` or `gh pr list` |
| CI health | provider checks/runs for active PRs |
| Local/remote drift | branch tracking status, fetched refs, merge state |

## Workflow

1. Load project and user rules only when they affect status interpretation.
2. Inspect relevant local checkouts/worktrees; do not clean, stash, pull, sync, delete branches, or otherwise mutate work.
3. Prefer provider tools for live remote state. Run `git fetch` only when the user expects refreshed refs or approves it; note that refs changed.
4. If provider access is missing, report the verification gap and use local refs/remotes only.
5. Group output by actionability:
   - ready: safe next action is obvious;
   - blocked: external, permission, product, or dirty-state blocker;
   - watch: checks/runs pending;
   - stale: branch/worktree likely needs cleanup or decision.
6. Recommend one concrete next action, then list secondary options.

## Brief Format

```markdown
Scope / verified:
Top next action:
Ready:
Blocked:
Watching:
Stale / cleanup:
Verification gaps:
```

Omit empty sections. Each non-empty section should name its source: local status, provider state, or verification gap.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Treating dirty worktrees as cleanup targets | Report them; do not mutate |
| Listing every branch equally | Prioritize actionable work |
| Trusting stale local state | Prefer provider tools; state the gap or explicitly refresh refs |
| Saying "checks failing" vaguely | Name the check and classify the blocker |
| Ending without a recommendation | Lead with one next action |

## Validation Scenarios

- Multiple worktrees with dirty docs and one green PR: pass only if dirty work is preserved and PR is top action.
- Provider auth unavailable: pass only if local-only scope and verification gap are explicit.
- Many stale branches: pass only if cleanup is separated from immediate work.

## Test Evidence

- RED: baseline ran local cleanup/prune during a dashboard and risked overclaiming provider state.
- GREEN: skill run refused mutation, marked local-only scope, and separated ready, blocked, watching, stale cleanup, and gaps.
- REFACTOR: workflow forbids cleanup/sync mutations and requires sources for non-empty sections.
