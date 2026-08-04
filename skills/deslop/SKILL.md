---
name: deslop
description: Use when reviewing a branch diff for AI-generated clutter, style drift, over-defensive logic, unnecessary comments, type-system bypasses, verbose helpers, or local-convention violations.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Deslop

Run a findings-only review for clutter introduced or materially worsened by an
exact diff. Never edit. Local repository convention—not generic clean-code
taste—is the evidence boundary.

## Lens

Inspect neighboring code, then flag:

- comments narrating ordinary code where local code relies on names/structure;
- defensive checks on internal paths whose invariant current callers prove;
- broad error wrappers that conflict with established failure semantics;
- `any`, double casts, or non-null assertions where local narrowing exists;
- one-caller generic helpers that name no repository concept;
- generated-looking nesting or verbosity with a direct local pattern; and
- unrelated formatting or churn outside the accepted outcome.

Keep comments and guards that preserve business rules, security assumptions,
migration constraints, public behavior, or non-obvious trade-offs. Leave
architecture/ownership to `code-quality-review` and concept reduction to
`code-simplifier`.

```text
Deslop result: passed | finding | blocked
Target: <base...head>
Finding: [severity] <artifact> [confidence]
Location: <path:line>
Local-convention evidence:
Behavior-preserving recommendation:
Residual convention risk:
```

Return findings to Execute. A clean result names the neighboring convention
inspected.
