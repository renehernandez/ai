---
name: code-quality-review
description: Use when doing a strict maintainability review, structural review, code quality audit, thermonuclear review, harsh review, or review for abstraction quality, spaghetti growth, file sprawl, type-boundary drift, and architecture fit.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Code Quality Review

Run a strict, findings-only review focused on maintainability, structure, and long-term codebase health. Do not edit files. Do not propose implementation patches unless the user asks in a follow-up.

## When to Use

- The user asks for a strict code quality review, maintainability review, structural review, thermonuclear review, or quality audit.
- A branch works functionally but may worsen architecture, readability, ownership, or type boundaries.
- The user wants review findings before a follow-up implementation pass.

For ordinary correctness/security/performance review, use the repo's normal review path first. This skill is a stricter maintainability lens.

## Review Scope

Start with the branch diff, then follow references across the codebase when needed to validate ownership, canonical helpers, existing abstractions, or architectural precedent.

```bash
git merge-base HEAD main
git diff --stat <base>..HEAD
git diff <base>..HEAD
```

If `main` is unavailable, use the project's active base branch.

Read enough surrounding code to avoid false positives. A structural finding must be grounded in changed code plus codebase context, not taste alone.

## Review Lens

Ask these questions for every meaningful change:

- Is there a simpler reframing that would delete branches, modes, helpers, or concepts?
- Did the diff add scattered special cases to an existing flow?
- Is the logic in the canonical package, module, service, component, or layer?
- Does this reuse the codebase's existing helper or model instead of creating a near-duplicate?
- Does a new abstraction reduce complexity, or only hide it behind another name?
- Did the change add casts, `any`, unnecessary optionality, or ad-hoc object shapes that obscure the invariant?
- Did a cohesive file become too large, too stateful, or too hard to scan?
- Are related updates atomic enough, or can the new flow leave partial state behind?
- Is independent orchestration serialized in a way that makes the design harder to reason about?

## What to Flag

Prioritize findings in this order:

1. Structural regressions that make the codebase harder to change.
2. Missed simplifications where a plausible redesign deletes meaningful complexity.
3. Spaghetti growth from new conditionals, flags, modes, or narrow branches.
4. Ownership, layer, or canonical-helper drift.
5. Type-boundary problems that force casts, loose objects, or unclear invariants.
6. File sprawl, especially a PR pushing a file from below 1000 lines to above 1000 lines.
7. Thin wrappers, pass-through helpers, generic magic, and indirection that does not earn its keep.

Avoid low-value nits when larger design issues exist.

## Severity

Use these labels:

- **Critical**: Must fix before approval; the change creates clear architectural debt or a major maintainability regression.
- **Warning**: Should fix before approval; the design likely gets worse, but the remedy is scoped.
- **Suggestion**: Worth improving; not approval-blocking unless repeated across the diff.

Every actionable statement needs a confidence score using the repo format: `[confidence: 0.85 - high | reason: <short reason>]`.

## Findings Format

Lead with findings. If there are none, say so and mention residual risk.

```markdown
**[WARNING] Structural complexity** [confidence: 0.86 - high | reason: diff adds three mode branches and existing helper owns this concern]
Location: `src/path/file.ts:42`
Issue: This adds feature-specific branches inside the shared request flow, so every caller now has to reason about a one-off mode.
Evidence: `src/path/file.ts` already delegates related policy decisions to `resolveRequestPolicy`, and the new branch bypasses that path.
Recommendation: Move the new decision into the existing policy helper so the shared flow stays linear.
```

Keep the output short and rigorous: high-conviction findings, then open questions or assumptions, then a brief note on what context was reviewed.

## Approval Bar

Do not approve just because behavior works. Approval requires:

- no clear structural regression
- no obvious simplification that would delete meaningful complexity
- no scattered special-case branching in shared flows
- no unjustified file-size jump past a healthy boundary
- no type or boundary churn that hides the real invariant
- no duplicate helper or wrong-layer ownership when a canonical home is visible

If the bar is not met, report findings only. Leave implementation for the follow-up.
