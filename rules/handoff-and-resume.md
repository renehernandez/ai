# Handoff And Resume Rules

Use these rules when work may continue in another thread, another agent surface, a remote-control client, a cloud agent, or a future session.

## Handoff Brief

If a handoff is written as YAML or JSON, include a concise `## Readable Summary`
before the structured block so the thread remains scannable.

When handing off non-trivial work, include:

- objective and current decision;
- repository, cwd, branch, and PR number if any;
- current worktree state, including uncommitted changes;
- files changed or docs written;
- verification already run, using exact test layer names such as unit, component, worker-runtime, database integration, local browser E2E, deployed-preview E2E, or deployment verification;
- CI, review, merge, or deploy state if relevant;
- blockers and whether they are branch-caused, external, permission-related, or product decisions;
- the next concrete command or action.

For cloud handoffs, include repo-visible file paths and avoid relying only on local `~/.agents` rules or machine memory.

## Resume Pass

When resuming from a handoff, do not restart discovery from scratch. First verify the handoff against live state:

1. Confirm cwd, branch, worktree, and uncommitted changes.
2. Confirm PR and CI state through `gh` when relevant.
3. Re-read only the rule files and changed files needed for the next action.
4. Continue from the next concrete action unless live state contradicts the handoff.

If live state differs from the handoff, state the difference and use live state as authoritative.

## Cross-Surface Notes

Remote control of a local desktop agent should be treated as a local continuation when the host is connected. Hosted web agents or delegated cloud work should be treated as cloud work and need repo-visible context.

When asking another surface to continue, explicitly say which surface the handoff targets: local desktop app, remote control, cloud agent, GitHub PR review, or CI automation.
