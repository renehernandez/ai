---
name: session-start
description: Use when beginning, resuming, or rerouting repository work across local, remote-control, cloud, or CI surfaces, especially with detached worktrees, stale branches, PRs, CI, merge state, or deployment state.
---

# Session Start

## Overview

Start from live state. Recover surface, repo, worktree, PR, and CI context before implementation, review, merge, deploy, troubleshooting, or status.

## When To Use

Use for non-trivial repo tasks, especially continue, resume, next, where are we, or pick this back up. Skip trivial questions that do not depend on repo state.

## Quick Reference

| Situation | First move |
| --- | --- |
| Local app, CLI, IDE, or remote-controlled host | Use local workspace, shell, skills, hooks, and user rules |
| Hosted web agent, cloud task, hosted review | Use repo-visible instructions and PR/repo diff |
| GitHub Actions, GitLab CI, scheduled job | Treat as CI automation; verify logs/state remotely |
| Detached, dirty, generated, or stale worktree | Check Git/worktree state before editing |
| Continue/resume/next/status | Verify handoff against live state |

## Workflow

1. Read applicable entrypoints: project `AGENTS.md`, project `.agents/rules/*.md`, and user rules such as `~/.agents/AGENTS.md` when present.
2. Classify the surface: local host, cloud agent/review, or CI automation.
3. Verify live state before conclusions:
   - `git status --short --branch`;
   - `git worktree list` when generated worktrees or detached state may matter;
   - provider tools such as `gh pr view`, `gh pr checks`, or CI log viewers when PR/CI state matters.
4. Search memory or prior session evidence only when continuity or previous decisions matter.
5. If remote tools are missing, unauthenticated, blocked, or not the right provider, inspect remotes/local refs and report exactly what could not be verified.
6. Inspect directly affected files before broad scans.
7. Give a short startup brief, then proceed with the narrow next action.

## Brief

Keep startup briefs short: surface, repo, branch/worktree, remote context, loaded context, next action. For quick implementation turns, one sentence is enough.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Assuming cloud agents can see user-level local rules | Put cloud-needed guidance in repo-visible files |
| Treating remote control as cloud-only | If it controls a local host, use local context and host state |
| Reporting from memory without checking live remote state | Verify PR, CI, merge, and deploy state with provider tools |
| Editing from a detached or stale worktree by accident | Check branch/worktree state and create/select a branch when needed |
| Turning startup into a long report | Give only the context needed for the next action |

## Validation Scenarios

- Detached checkout with changed CI: pass only if live branch/PR/CI state is checked or the gap is reported.
- Remote-controlled local host: pass only if local rules/context are considered before cloud assumptions.
- Non-GitHub or unauthenticated repo: pass only if provider fallback/degraded verification is explicit.
