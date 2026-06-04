# Session Startup Rules

Use these rules at the start of non-trivial repo work, especially when resuming project work or moving between local, remote-control, and cloud agent surfaces.

## Startup Pass

Before editing code, committing, reviewing, merging, deploying, or giving status, gather only the context needed for the task:

1. Read the workspace `AGENTS.md` and the matching project rule files.
2. Check the current branch and working tree with `git status --short --branch`.
3. Check worktree placement with `git worktree list` when the repo uses multiple worktrees or the checkout may be detached.
4. Check remote state with `git fetch` or GitHub CLI when the task depends on PRs, CI, merge state, deployed state, or latest `main`.
5. Search memory only when prior decisions, workflow preferences, or thread continuity are relevant.
6. Inspect directly affected files before expanding to generated files, broad schema, or unrelated docs.

Prefer targeted `rg`, `git`, and `gh` commands. Avoid broad scans unless the first pass shows they matter.

## VialMate Defaults

For VialMate app work, a clean latest-main starting point is expected unless the user intentionally resumes a specific branch or worktree.

When attached to a detached or generated worktree, determine whether the task is:

- a discussion or planning thread, where detached state may be fine;
- an implementation thread, where a named feature branch should usually be created or selected;
- a resume/merge/review thread, where the existing branch, PR, and CI state should be recovered first.

Do not assume the long-lived main checkout, the current Codex worktree, and GitHub `main` are aligned. Verify before acting.

## Status Brief

For substantial work, provide a short startup brief with:

- current cwd and branch/worktree status;
- relevant PR or branch if found;
- whether local changes are present;
- the narrow next step.

Keep the brief concise. Do not turn startup into a full report unless the user asks for status.
