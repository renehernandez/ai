# Feature Delivery Rules

These rules cover end-to-end feature work in Codex, Claude Code, and other
harnesses that follow the shared `~/.agents` instructions.

Agents should load this file when the user says "feature delivery workflow",
"follow feature delivery", "use the feature delivery rule", or similar. If a
project repo does not define this workflow locally, use this shared rule at
`~/.agents/rules/feature-delivery.md`.

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
4. Run a docs alignment pass for the branch diff and update affected docs,
   plans, agent docs, automation prompts, or the PR description when the diff
   changes behavior, workflows, architecture, commands, tests, CI, deployment,
   data contracts, auth/access boundaries, or agent expectations.
5. Before committing, run and report the quality gate below until there are no
   unresolved findings that should be fixed.
6. Commit the feature branch without `--no-verify`.
7. Push the feature branch.
8. Create or update the artifact-host PR/MR using `gh` for GitHub or `glab` for GitLab.
9. Monitor CI checks until they pass, fail for an external reason, or require
   user input.
10. For CI failures caused by the branch, fix them, rerun local verification,
   update the branch, and continue monitoring.

Review-first plan workflows are the exception to ordinary direct-publish or
implementation-first handling. When `plan-orchestrator`, `plan-review`, or an
approved plan workflow requires planning review, create the planning-only PR/MR
first, wait for the required planning-review gate, and only then continue to
implementation sequencing.

When review feedback, CI, or browser checks expose missing coverage, apply the
Fastest Durable Regression rule in `rules/testing-and-verification.md` before
rerunning the broader gate.

This applies to normal prompts and goal-style prompts. Do not stop after local
implementation when the user asked for feature work unless a real blocker is
reached.

## Pre-Commit Quality Gate

Before committing feature work, run these passes over the branch diff:

1. `scrutinize` for adversarial validation of intent, simpler alternatives,
   real code paths, and evidence-backed claims.
2. `code-quality-review` for strict maintainability and structural findings.
3. `code-simplifier` for behavior-preserving clarity and simplification.
4. `deslop` for AI-shaped clutter, over-defensive code, style drift, thin
   wrappers, unnecessary comments, casts, and unrelated formatting churn.
5. `ai-readiness-upkeep` when the diff changes verification scripts, task
   commands, hooks, CI/release/deploy config, generated artifacts, schemas or
   API contracts, infrastructure config, agent instructions, rules, skills,
   prompts, review rubrics, or review feedback that future agents should repeat
   or avoid.
6. `docs-alignment-review` for stale or missing docs, plans, PR descriptions,
   agent docs, skills, rules, hooks, automation prompts, or review rubrics.

If any pass produces actionable findings that should be resolved before review,
fix them, rerun the relevant verification, and repeat the gate. After
`scrutinize` findings are fixed, rerun `scrutinize` on the changed artifact.
After `code-simplifier` or `deslop` changes, rerun `code-quality-review`. After
AI readiness findings create verification, docs, or agent-doc changes, rerun
`ai-readiness-upkeep` as needed and then rerun `docs-alignment-review` before
considering the gate complete.

Treat `scrutinize` verdicts as binding:

- `ship` passes the gate.
- `fix-then-ship` and `rework` block commit and push until fixed, rerun, or
  explicitly accepted as a reported trade-off by the user.
- `reject` blocks commit and push until the goal is changed or abandoned.
- `MINOR` findings should be fixed automatically when local and low-risk;
  otherwise report them as non-blocking residual risk.

Treat `code-quality-review` severity as binding:

- **Critical** findings block commit and push unless fixed or explicitly reported
  to the user as a trade-off that needs approval.
- **Warning** findings should be fixed by default when the remedy is scoped. If
  deferred, report the reason and risk.
- **Suggestion** findings may be deferred, but do not hide repeated suggestions
  that point to the same structural issue.

The gate is complete only when there are no remaining actionable findings to
fix, or when the remaining item is an explicit trade-off that has been reported
to the user.

Before the commit or final delivery summary, include a short quality-gate
section with each pass marked:

- `clean`: no actionable findings
- `not applicable`: pass was considered but the diff has no relevant surface
- `fixed`: findings were fixed and verification was rerun
- `deferred`: finding remains with a stated reason and risk
- `blocked`: finding requires user input or a product decision

Include the highest-severity `code-quality-review` finding, or state that there
were no structural findings.
Include the `scrutinize` verdict and whether any `MINOR` findings were fixed or
left as residual risk.

Use subagents or slash skills for these passes. In Codex, read each named
`SKILL.md` before applying it and run the required subagent review path.

## PR/MR and CI Follow-Through

For GitHub repositories:

- Use `gh pr create`, `gh pr edit`, `gh pr view`, and `gh pr checks`.
- If a PR already exists for the branch, update it instead of creating a
  duplicate.
- Watch checks with `gh pr checks` or the relevant workflow commands until the
  result is clear.
- Fix branch-caused CI failures and push updates without asking for another
  confirmation.
- After review or CI fixes change the diff, rerun relevant verification and
  `docs-alignment-review` before pushing or declaring the PR finished. The final
  docs alignment verdict must apply to the final branch diff, not an earlier
  version of the branch.
- Stop and report when CI is blocked by missing secrets, unavailable external
  services, permission failures, flaky upstream infrastructure, or a product
  decision.

For GitLab repositories:

- Use `glab mr create`, `glab mr update`, `glab mr view`, and GitLab CI tools
  such as `glab ci`.
- If an MR already exists for the branch, update it instead of creating a
  duplicate.
- Watch pipeline checks with `glab ci` or the relevant GitLab pipeline commands
  until the result is clear.
- Fix branch-caused CI failures and push updates without asking for another
  confirmation.
- After review or CI fixes change the diff, rerun relevant verification and
  `docs-alignment-review` before pushing or declaring the MR finished. The final
  docs alignment verdict must apply to the final branch diff, not an earlier
  version of the branch.
- Stop and report when CI is blocked by missing secrets, unavailable external
  services, permission failures, flaky upstream infrastructure, or a product
  decision.

Do not merge the PR/MR unless the user explicitly asks to merge, or has already
given merge-after-green instructions for that PR/MR.

## Safety Boundaries

- Never push directly to `main` or `master` without explicit confirmation.
- Repo-local instructions may explicitly authorize direct-main publication. A
  review-first plan workflow may still require a planning-only PR/MR before
  implementation, even in repos that otherwise publish directly to `main`.
- Never bypass hooks with `--no-verify`.
- Never overwrite unrelated user changes.
- Do not install dependencies unless the user asked for it or the approved plan
  requires it.
- Do not loop forever. If the same quality-gate or CI blocker persists after two
  serious fix attempts, report the blocker, the evidence, and the next decision
  needed.
