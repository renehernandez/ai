---
name: deslop
description: Use when cleaning AI-generated code artifacts, style drift, over-defensive logic, unnecessary comments, type-system bypasses, or branch diffs that need behavior-preserving polish before review.
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(pnpm:*), Edit
---

# Deslop

Remove AI-shaped clutter from a branch while keeping the intended behavior intact.

## When to Use

- The user asks to deslop, clean up AI code, polish a branch, or make code review-ready.
- A diff contains comments, abstractions, guards, casts, or structure that do not match the surrounding code.
- Review feedback points to style drift, unnecessary complexity, or type shortcuts.

Do not use this as permission for a broad refactor. If the requested task is troubleshooting, diagnose and report before editing.

## Workflow

1. Find the review base:
   ```bash
   git merge-base HEAD main
   ```
   If `main` is unavailable, use the project’s active base branch.
2. Inspect only the branch delta first:
   ```bash
   git diff --stat <base>..HEAD
   git diff <base>..HEAD
   ```
3. Read nearby code before editing so local patterns drive the cleanup.
4. Remove only changes that are clearly slop or style drift.
5. Run the narrowest relevant verification for touched code, using package-managed commands such as `pnpm run`, `pnpm exec`, or the project’s documented scripts.
6. Summarize what changed and the exact verification performed.

## Cleanup Targets

| Pattern | Clean it up by |
| --- | --- |
| Obvious comments explaining ordinary code | Deleting them unless they preserve domain context |
| Defensive checks on trusted internal paths | Removing them when surrounding code relies on the same invariants |
| Broad `try`/`catch` wrappers | Keeping only error handling that matches local failure semantics |
| `any`, double casts, or non-null assertions | Using the real type, narrowing, or local helper patterns |
| New abstractions with one caller | Inlining unless the abstraction matches existing design |
| Deep nesting from generated code | Flattening with early returns when behavior stays equivalent |
| Generic names or verbose helpers | Renaming to match local vocabulary |
| Unrelated formatting churn | Reverting that hunk or restoring the file’s existing style |

## Guardrails

- Preserve behavior unless fixing a clear bug discovered during cleanup.
- Prefer smaller diffs over clever rewrites.
- Do not remove comments that explain business rules, security assumptions, data migrations, public API behavior, or non-obvious trade-offs.
- Do not replace a working local convention with a generic “clean code” preference.
- If a cleanup would require changing tests or public behavior, stop and report the trade-off.

## Final Response

Keep the close-out short:

- What slop was removed or simplified.
- What behavior was intentionally preserved.
- The exact verification command or manual check performed.
