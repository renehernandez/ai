---
name: deslop
description: Use when reviewing a branch diff for AI-generated clutter, style drift, over-defensive logic, unnecessary comments, type-system bypasses, verbose helpers, or local-convention violations.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Deslop

Run a findings-only review of AI-shaped clutter and local-convention drift. Do
not edit files. Keep the lens narrower than architectural refactoring or generic
code quality.

## Scope

Inspect the exact branch delta first, then nearby code that establishes the
local convention:

```bash
git merge-base HEAD main
git diff --stat <base>..HEAD
git diff <base>..HEAD
```

Flag only artifacts introduced or materially worsened by the diff.

## Review Lens

Look for:

| Artifact | Evidence required |
| --- | --- |
| Obvious comments explaining ordinary code | Neighboring code relies on names and structure instead. |
| Defensive checks on trusted internal paths | The same invariant is consistently trusted by existing callers. |
| Broad `try`/`catch` wrappers | Local failure semantics are narrower and already established. |
| `any`, double casts, or non-null assertions | A real type or existing narrowing pattern is available. |
| One-caller generic abstractions | The abstraction adds indirection without matching an existing concept. |
| Generated-looking nesting or verbosity | A local pattern expresses the same behavior more directly. |
| Unrelated formatting churn | The changed hunk is not required for the accepted outcome. |

Do not flag comments that preserve business rules, security assumptions,
migration constraints, public API behavior, or non-obvious trade-offs. Do not
replace a working local convention with generic clean-code taste.

## Output

Return `passed`, `finding`, or `blocked` with source evidence. For each finding:

```markdown
**[SEVERITY] Slop artifact** [confidence: 0.86 - high]
Location: `path:line`
Issue:
Local-convention evidence:
Behavior-preserving recommendation:
```

If clean, name the inspected diff and residual convention risk. Send findings
to the Execute owner; never stage, commit, or apply cleanup.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Treating all verbosity as slop | Require neighboring project evidence. |
| Removing meaningful defensive behavior | Report only when the trusted invariant is proven. |
| Expanding into architecture review | Leave ownership and structural design to `code-quality-review`. |
| Fixing an obvious artifact directly | Return the finding to the single Execute owner. |
