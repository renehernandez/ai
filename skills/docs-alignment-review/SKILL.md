---
name: docs-alignment-review
description: Use when a branch, pull request, implementation workflow, or code review may require updates to docs, plans, agent docs, rules, skills, automation prompts, or PR descriptions.
---

# Docs Alignment Review

Decide whether an exact diff changed a documented reader, operator, reviewer,
or agent contract. This is a findings-only Review technique: it does not write
documentation or provider descriptions.

## Review

1. Resolve the exact target base and head. Inspect the behavioral diff and only
   the nearby documentation surfaces it can affect.
2. Identify changes to user behavior, workflows, architecture, ownership,
   commands, CI/deploy operations, configuration, security boundaries, data or
   API contracts, verification, rollback, or agent expectations.
3. Check the corresponding surfaces: README/docs, plans/specs, AGENTS/rules,
   shared skills/automations, and reviewer-facing change description.
4. Return actionable gaps or a reasoned clean/not-applicable verdict.

Route prose quality to `doc-smith`. Route a newly exposed contract that should
be mechanically enforced to `ai-readiness-upkeep`; missing automation is not
merely a documentation finding. Re-run this review when repairs materially
change the exact diff.

## Output

```text
Docs Alignment Verdict: clean | updates needed | not applicable
Target: <base>...<head>
Checked: <relevant surfaces>
Findings:
- [severity] <surface>: <stale or missing contract> -> <required update>
Reason if clean/not applicable: <evidence-backed explanation>
```

Use `not applicable` only when the diff cannot reasonably affect documented
behavior or agent expectations. Do not demand documentation churn for
formatting or generated-file movement, and do not claim clean without naming
the surfaces and causal reason.
