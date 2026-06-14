# Repo Health Brief Automation

Produce a concise operational brief for one repository or a closely related
worktree family. Inspect live local and provider state without mutating work.

## Inputs

The automation instance should provide:

- repository root path;
- provider, such as GitHub or GitLab, when available;
- optional provider repository identifier, such as `owner/repo`;
- optional long-lived main checkout path;
- optional list of related worktree roots;
- optional project-specific rules or plan paths to inspect.

If an input is missing, continue with the available state and report the
verification gap.

## Read-Only Contract

Do not clean, stash, pull, sync, prune, delete branches, edit files, merge,
rebase, install dependencies, or run destructive commands. This automation is
for inspection and recommendation only.

## Inspection Checklist

Use incremental scope. Start cheap, then expand only when the first pass shows
activity.

1. Inspect the current branch, dirty state, and upstream tracking status.
2. Inspect related worktrees and classify clean, dirty, detached, stale, or
   missing-upstream checkouts.
3. Inspect open pull requests or merge requests when provider tooling is
   authenticated.
4. Inspect check, CI, review, merge queue, and deployment state for active
   review surfaces.
5. Inspect the long-lived main checkout when configured.
6. Inspect project rules only when they affect status interpretation.

Prefer provider tools for live remote state. If provider access is missing or
stale, name that explicitly rather than guessing.

## Output

Use this shape and omit empty sections:

```markdown
Scope / verified:
Top next action:
Ready:
Blocked:
Watching:
Stale / cleanup:
Verification gaps:
```

Each non-empty section should name its source, such as local status, provider
state, check state, deployment state, or verification gap.

Keep the brief short and actionable. Lead with one concrete next action.
