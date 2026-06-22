---
name: docs-alignment-review
description: Use when a branch, pull request, implementation, plan-unit-delivery workflow, or code review may require updates to docs, plans, agent docs, rules, skills, automation prompts, or PR descriptions.
---

# Docs Alignment Review

## Overview

Check whether a diff changes behavior, contracts, workflows, or agent expectations enough that documentation should move with it. A clean verdict must say why no docs update is needed.

This is separate from `ai-readiness-upkeep`: docs alignment decides whether the written context is stale or missing, while AI readiness decides whether a newly exposed contract should be enforced mechanically by a script, task command, hook, CI check, release/deploy gate, or other automation lane.

## When To Use

Use during plan-unit-delivery workflows, PR reviews, background review rubrics, and before opening or updating a PR. Skip for pure formatting changes or mechanical generated-file churn unless the generated change affects documented behavior.

## Workflow

1. Establish the diff base with provider tools or `git merge-base`.
2. Inspect changed files and nearby docs/rules only as needed.
3. Decide whether the diff changes any documentation trigger:
   - user-visible behavior, workflows, navigation, UI states, or error states;
   - architecture, ownership boundaries, source taxonomy, or invariants;
   - commands, package scripts, CI, deployment, infrastructure, or environment variables;
   - auth/access boundaries, data contracts, schemas, migrations, APIs, or events;
   - test strategy, verification layers, or release/rollback expectations;
   - agent expectations in `AGENTS.md`, `.agents/rules/*`, skills, hooks, automation prompts, or background-review rubrics.
4. Check relevant documentation surfaces:
   - user and engineering docs such as `README*`, `docs/*`, `.agents/plans/*`, `docs/specs/*`;
   - repo-visible agent docs such as `AGENTS.md` and `.agents/rules/*`;
   - shared agent docs and skills when the change affects reusable agent behavior;
   - PR title/body when reviewers need plan links, verification, or context.
5. If docs are stale or missing, report actionable updates. If no update is needed, state the reason.

## Verdict Format

```markdown
Docs Alignment Verdict: clean | updates needed | not applicable

Checked:
- User/engineering docs:
- Plans/specs:
- Agent docs:
- Skills/automations:
- PR description:

Findings:
- [severity] surface: issue -> recommended update

Reason if clean:
```

Use `not applicable` only when the diff cannot reasonably affect documented behavior or agent expectations.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Treating docs alignment as only README updates | Check plans, agent docs, rules, skills, automation prompts, and PR context |
| Requiring docs churn for tiny changes | Return `not applicable` with a reason |
| Saying clean without evidence | Name the surfaces checked and why no update is needed |
| Letting implementation drift from the plan | Flag the plan or PR description alignment gap |
| Hiding agent-doc drift | Classify whether the update belongs in repo-local docs or shared agent docs |
| Treating missing verification as only a docs issue | Route enforceable contract gaps to `ai-readiness-upkeep` |

## Test Evidence

- RED: prior PR workflows could finish code and review without deciding whether plans or agent docs were stale.
- GREEN: this skill forces an explicit docs alignment verdict with checked surfaces and a reason when clean.
- REFACTOR: the skill stays focused on alignment decisions and delegates prose quality to `doc-smith`. It also covers the pressure case where an agent fixes review or CI feedback after an earlier docs verdict: the agent must rerun docs alignment on the final diff before completion.
