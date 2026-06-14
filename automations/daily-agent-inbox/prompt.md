# Daily Agent Inbox Automation

Produce a prioritized daily inbox across configured repositories, worktrees,
automation surfaces, and shared agent docs. The goal is to tell the user what
needs attention today, with evidence and exact next actions.

## Inputs

The automation instance should provide:

- list of repositories or repo families to inspect;
- optional provider identifiers for each repository;
- optional main checkout or worktree roots for each repository;
- shared agent-docs repository path;
- optional runtime automation directories;
- optional memory, session, or handoff locations when available.

If some configured repositories are unavailable on the current machine, skip
them and report the verification gap.

## Read-Only Contract

Do not edit files, update state, clean worktrees, pull, push, merge, rerun
checks, post comments, archive work, or change automations. This automation is
an inbox, not an executor.

## Inspection Checklist

Use incremental scope and avoid deep scans unless there is activity.

1. Inspect shared agent-doc and automation configuration changes.
2. Inspect each configured repository's branch, dirty state, active PR/MR state,
   checks, deployments, and review freshness.
3. Identify work that is ready for a next action, blocked on an external
   condition, waiting on checks/review/deploy, or likely stale.
4. Identify automation failures, stale runtime state, missing auth, connector
   gaps, or machine-local path drift.
5. Identify repeated workflow issues that may deserve a shared rule, skill, or
   automation prompt update.
6. Prefer existing repo-health and PR-readiness automation outputs when
   available; otherwise inspect directly.

## Priority Model

Prioritize:

1. user-blocking or security-sensitive issues;
2. ready-to-merge or ready-to-review work;
3. failing CI/deployments or stale reviews;
4. dirty work that risks being forgotten;
5. cleanup candidates;
6. useful but non-urgent automation or docs improvements.

## Output

Use this shape and omit empty sections:

```markdown
Scope / verified:
Top 5:
Do now:
Review / merge:
Watch:
Blocked:
Cleanup candidates:
Automation / agent-docs:
Verification gaps:
Suggested next action:
```

Every item should include a source, such as repo path, PR/MR number, check name,
automation name, or verification gap. Keep the brief compact enough to read at
the start of the day.
