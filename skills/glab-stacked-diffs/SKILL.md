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
- After predecessor merge, retarget only its immediate child, merge the updated
  target into that child, and publish the additive reconciliation with an
  ordinary push; leave deeper descendants untouched.
- Technical readiness leaves every MR draft until merge authority marks it
  ready. Single-MR merge authority is consumed by that merge; bottom-to-top
  continuation requires user-authored aggregate or sequential scope. Material
  effective-diff change renews affected authority.
- Once an MR is marked ready, preserve that state through repairs, restacks,
  base movement, gate failures, and revalidation. Only a user request naming
  that exact MR and specifically asking to return it to draft authorizes the
  transition.
- Keep hooks enabled. Use `stack save` for a new tip diff and `stack amend` only
  during unpublished construction. Correct every published MR with a new
  additive commit so its implementation and repair history remains visible.

## Routing Decisions

Before mutation, inspect authentication, repository, worktree state, current
branch, remote heads, `glab stack list`, and every MR's source, target, state,
draft state, and SHA. A direct commit, missing entry, unexpected target,
closed/merged artifact, or external head change freezes mutation for recovery
inspection.

Agents never run `glab stack sync`: it may force-push rewritten branches,
rebase later entries, or remove managed entries. Never use it to publish,
propagate an open predecessor change, or reconcile target movement. A mid-stack
insertion or unrepresentable topology returns to Plan. A required history
rewrite is human-owned and blocks agent continuation.

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
current lifecycle owner, exact additive command/procedure selected, observed
remote head, draft/target state, and any topology, authority, or recovery
blocker.
