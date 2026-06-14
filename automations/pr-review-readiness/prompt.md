# PR Review Readiness Automation

Determine whether a pull request or merge request is ready for human,
hosted-agent, background-agent, or CI-based review. This automation is not a
code review. It checks whether review has enough context and whether the review
surface is current.

## Inputs

The automation instance should provide:

- repository root path;
- provider, such as GitHub or GitLab;
- provider repository identifier, such as `owner/repo`;
- pull request or merge request number, or instructions to infer it from the
  current branch;
- optional plan, spec, issue, or project-doc paths;
- optional review rules or checklist paths.

If a PR/MR cannot be identified, inspect the current branch and report the
missing provider link as the top gap.

## Read-Only Contract

Do not edit the PR description, post comments, request reviews, push commits,
rerun checks, merge, rebase, or modify local files. This automation only reports
readiness gaps and next actions.

## Inspection Checklist

1. Identify the review surface and latest head SHA.
2. Read the PR/MR title and description.
3. Check whether a plan, spec, issue, or task link exists when the change is
   non-trivial.
4. Check whether the description names risk areas, verification performed, and
   remaining gaps.
5. Inspect changed file categories: source, tests, docs, agent docs, workflow,
   infrastructure, migrations, dependency manifests, or generated files.
6. Inspect check, CI, deployment, and preview state.
7. Inspect existing human or hosted-agent review comments and whether they
   apply to the latest head SHA.
8. Check whether docs, rules, skills, automation prompts, or PR descriptions
   likely need alignment.

Use project-local review rules when they exist. If rules are unavailable, use
generic readiness criteria and report the gap.

## Output

Use this shape and omit empty sections:

```markdown
Scope / verified:
Readiness verdict:
Top next action:
Context gaps:
Verification gaps:
Review freshness:
Docs / agent-doc alignment:
Blocking checks:
Ready for review:
```

Use one of these verdicts:

- `ready`: review can proceed with the current context;
- `needs-context`: description, plan, risk, or verification context is missing;
- `needs-fixes`: checks, build, deployment, or known review blockers should be
  fixed before review;
- `stale-review`: previous review feedback does not apply to the latest head;
- `blocked`: provider access, auth, missing branch, or missing PR/MR prevents a
  reliable readiness call.

Do not say "ready" unless the verdict applies to the latest head SHA.
