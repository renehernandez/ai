# Feature Delivery Rules

These rules cover end-to-end feature work in Codex, Claude Code, and other
harnesses that follow the shared `~/.agents` instructions.

## Default Feature Workflow

When the user asks to build, implement, or finish a feature, treat that as
approval to carry the work through the full feature-delivery workflow unless the
user explicitly limits the scope. Troubleshooting-only requests still follow the
diagnose-and-report flow first.

The default workflow is:

1. Inspect the live repo state, current branch, working tree, and upstream status.
2. Implement the requested change on a feature branch, preserving unrelated user
   changes.
3. Run the narrowest useful verification for the touched code.
4. Before committing, run the quality gate below until there are no unresolved
   findings that should be fixed.
5. Commit the feature branch without `--no-verify`.
6. Push the feature branch.
7. Create or update the GitHub PR using `gh`.
8. Monitor CI checks until they pass, fail for an external reason, or require
   user input.
9. For CI failures caused by the branch, fix them, rerun local verification,
   update the branch, and continue monitoring.

This applies to normal prompts and goal-style prompts. Do not stop after local
implementation when the user asked for feature work unless a real blocker is
reached.

## Pre-Commit Quality Gate

Before committing feature work, run these passes over the branch diff:

1. `code-quality-review` for strict maintainability and structural findings.
2. `code-simplifier` for behavior-preserving clarity and simplification.
3. `deslop` for AI-shaped clutter, over-defensive code, style drift, thin
   wrappers, unnecessary comments, casts, and unrelated formatting churn.

If any pass produces actionable findings that should be resolved before review,
fix them, rerun the relevant verification, and repeat the three-pass gate. The
gate is complete only when there are no remaining actionable findings to fix, or
when the remaining item is an explicit trade-off that must be reported to the
user.

When a harness has subagents or slash skills for these passes, use them. In
Codex, read each named `SKILL.md` before applying it and perform the closest
available local workflow if a dedicated subagent is unavailable.

## PR and CI Follow-Through

For GitHub repositories:

- Use `gh pr create`, `gh pr edit`, `gh pr view`, and `gh pr checks`.
- If a PR already exists for the branch, update it instead of creating a
  duplicate.
- Watch checks with `gh pr checks` or the relevant workflow commands until the
  result is clear.
- Fix branch-caused CI failures and push updates without asking for another
  confirmation.
- Stop and report when CI is blocked by missing secrets, unavailable external
  services, permission failures, flaky upstream infrastructure, or a product
  decision.

Do not merge the PR unless the user explicitly asks to merge, or has already
given merge-after-green instructions for that PR.

## Safety Boundaries

- Never push directly to `main` or `master` without explicit confirmation.
- Never bypass hooks with `--no-verify`.
- Never overwrite unrelated user changes.
- Do not install dependencies unless the user asked for it or the approved plan
  requires it.
- Do not loop forever. If the same quality-gate or CI blocker persists after two
  serious fix attempts, report the blocker, the evidence, and the next decision
  needed.
