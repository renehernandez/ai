---
name: glab-stacked-diffs
description: Use when creating or managing stacked GitLab merge requests with `glab stack`, especially when publishing real diffs in order, promoting a child after predecessor merge, or recovering stack-managed history.
allowed-tools: Bash(glab:*), Bash(git:*), AskUserQuestion
---

# GitLab Stacked Diffs

## Authority

This specialist supplies `glab stack` routing decisions inside the active
lifecycle mode. It grants no repository write, provider write, ready, merge,
deployment, cleanup, or recovery authority. Explore/Review may inspect;
Execute may edit, validate, save, or amend; Finish alone may publish, sync,
retarget, or restack within accepted scope. `change-request-create` owns every
reviewer-facing MR creation or description.

Use for several sequential review units, a published ancestor correction, a
direct-commit/metadata mismatch, or promotion after predecessor merge. Use one
MR for one coherent change and unrelated MRs when no predecessor relationship
exists.

## Invariants

- Preserve one total Git order; each open descendant targets its immediate
  predecessor.
- Publish coherent real-diff draft MRs sequentially. Never create empty
  placeholders.
- Change only the substantive MR while its predecessor is open. Do not restack
  descendants.
- After predecessor merge, retarget and restack only its immediate child with
  an exact expected remote-head lease; leave deeper descendants untouched.
- Technical readiness leaves every MR draft. Single-MR merge authority is
  consumed by that merge; bottom-to-top continuation requires user-authored
  aggregate or sequential scope. Material effective-diff change renews
  affected authority.
- Keep hooks enabled. Use `stack save` for a new tip diff and `stack amend` only
  for unpublished construction or the tip. A published non-tip amendment must
  preserve descendant refs.

## Routing Decisions

Before mutation, inspect authentication, repository, worktree state, current
branch, remote heads, `glab stack list`, and every MR's source, target, state,
draft state, and SHA. A direct commit, missing entry, unexpected target,
closed/merged artifact, or external head change freezes mutation for recovery
inspection.

`glab stack sync` is not the default publication or propagation path: it cannot
create the required drafts safely and may rewrite or remove managed entries.
Never use it to propagate an open predecessor change. A mid-stack insertion or
unrepresentable topology returns to Plan. Destructive recovery needs explicit
authority.

Load only the needed procedure:

- [workflows](references/workflows.md) for construction, sequential publication,
  amendments, and predecessor promotion;
- [troubleshooting](references/troubleshooting.md) for direct commits,
  divergence, leases, and recoverable tips;
- [command reference](references/command-reference.md) for installed command
  behavior and experimental flags;
- [upstream provenance](references/upstream.md) when fork origin matters.

## Output

Return the managed stack map, substantive owner, propagation-only descendants,
current lifecycle owner, exact command/procedure selected, expected remote-head
lease where applicable, draft/target state, and any topology, authority, or
recovery blocker.
