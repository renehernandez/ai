---
name: code-simplifier
description: Use when simplifying code, cleaning up recently modified code, refactoring for clarity, improving readability, reducing nesting, removing redundant abstractions, or making behavior-preserving maintainability edits.
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Bash(cargo:*), Bash(go:*), Bash(pytest:*), Bash(mise:*), Edit
---

# Code Simplifier

Simplify recently changed code while preserving behavior. Prefer clear, boring, project-native code over clever compression or broad refactors.

## When to Use

- The user asks to simplify code, clean up code, refactor for clarity, improve readability, or make code more maintainable.
- A follow-up implementation pass is needed after `code-quality-review` findings.
- Recently touched code has redundant branches, avoidable nesting, duplicate logic, or thin abstractions.

Use `deslop` when the main issue is AI-shaped clutter. Use `code-quality-review` when the user wants findings only.

## Scope

Default to changed or recently touched code:

```bash
git merge-base HEAD main
git diff --stat <base>..HEAD
git diff <base>..HEAD
```

If `main` is unavailable, use the project's active base branch. Broaden scope only when the user asks or when a local simplification needs nearby context.

## Principles

- Preserve behavior exactly unless the user explicitly asks for a behavior change.
- Follow project rules, local tooling, package scripts, and neighboring code.
- Make code easier to read, test, and extend.
- Prefer explicit names and straightforward control flow over dense one-liners.
- Remove complexity; do not just move it to a different file.
- Keep useful abstractions that clarify ownership or isolate real variation.

## Simplification Targets

| Pattern | Prefer |
| --- | --- |
| Nested conditionals or ternaries | Early returns, named predicates, or a simple dispatcher |
| Duplicate branches | Shared helper, common setup, or a single clearer flow |
| Thin wrappers and pass-through helpers | Direct calls unless the wrapper names a real concept |
| Cast-heavy or optional-heavy code | Explicit type boundaries and narrowing |
| Large mixed-purpose functions | Focused helpers split by responsibility |
| Obvious comments | Self-explanatory names or deleted comments |
| Over-chained expressions | Named intermediate values when they improve scanning |
| Scattered special cases | A single owner, policy helper, or model that explains the variation |

## Guardrails

- Do not optimize for fewer lines at the expense of clarity.
- Do not introduce new libraries or dependencies for simplification.
- Do not rewrite stable unrelated code to match a personal style preference.
- Do not remove comments that explain business rules, security assumptions, migrations, or non-obvious trade-offs.
- If preserving behavior is uncertain, stop and explain the risk before editing further.

## Verification

Run the narrowest relevant verification after edits:

- existing focused tests for touched code
- typecheck or lint when types or style changed
- project-native commands only, such as package scripts, language test runners, or documented task runners

Describe the exact verification performed. If verification is not available or not run, say why.

## Final Response

Keep the close-out concise:

- What was simplified.
- What behavior was preserved.
- What verification was performed.
