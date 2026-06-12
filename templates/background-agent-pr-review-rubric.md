# Background Agent PR Review Rubric

Use this template for cloud, hosted, asynchronous, or otherwise background agent reviews. Copy it into a repo-visible location such as `.agents/rules/background-pr-review.md`, `.agents/rules/cloud-pr-review.md`, or `docs/agent-review-rubric.md`, then adapt project-specific paths, test names, and risk areas.

## Review Contract

Review only issues introduced or materially worsened by the PR or branch diff. Prefer actionable blockers over commentary. Do not edit files unless the review request explicitly asks for fixes.

Assume the background agent may not see local-only files, user-level rules, uncommitted worktrees, shell history, local secrets, or private desktop state. Use only repo-visible instructions, PR metadata, CI/check results, and the diff. If important context is unavailable, report the gap instead of guessing.

## Required Checks

1. Plan alignment: if a plan, spec, issue, or PR description exists, verify the implementation matches it and call out drift.
2. Correctness: look for behavior regressions, broken flows, missing edge cases, data loss, race conditions, and error-handling gaps.
3. Security and privacy: check auth, authorization, secrets, injection risk, data exposure, and sensitive-data handling.
4. Performance and scalability: check unnecessary work, query or network fan-out, blocking paths, and resource lifecycle problems.
5. Usability and accessibility: check user-facing regressions, unclear states, broken navigation, keyboard/screen-reader issues, and mobile layout risks.
6. Maintainability: check ownership boundaries, unnecessary abstractions, duplication, naming drift, hidden coupling, and testability.
7. Docs and agent-doc alignment: if the PR changes behavior, architecture, commands, workflows, tests, CI, deployment, auth/access boundaries, data contracts, or agent expectations, verify relevant docs, plans, agent docs, automation prompts, review rubrics, and the PR description are updated or explain why no update is needed.
8. AI readiness and enforceable verification: when the PR adds or changes a project contract, prefer an executable check over prose-only AGENTS/rules/docs guidance. Report missing cheap verification for generated artifacts, schemas, task commands, hooks, CI, deploy config, or agent workflow constraints.
9. Verification: name missing or weak test coverage by exact layer, such as unit, integration, worker-runtime, database integration, local browser E2E, deployed-preview E2E, or deployment verification.
10. CI and deployment: inspect required checks when available. Separate branch-caused failures from external, permission, service, or flaky-infrastructure blockers.

## Ignore

- Formatting, import order, or lint nits owned by automated tooling.
- Unrelated pre-existing issues not touched by the diff, unless the PR makes them materially worse.
- Preferences that conflict with explicit repo-visible rules.

## Output Format

Start with findings. If there are no actionable findings, say so and name residual verification risk.

```markdown
**[SEVERITY] Title**
Location: path:line
Issue:
Evidence:
Recommendation:
```

Use these severities:

- `Critical`: must fix before merge; security, data loss, broken core behavior, or invalid deployment.
- `Warning`: should fix before merge unless an explicit trade-off is accepted.
- `Suggestion`: useful improvement that may be deferred.

End with:

```markdown
Review scope:
Verification checked:
Docs alignment checked:
Context gaps:
```
