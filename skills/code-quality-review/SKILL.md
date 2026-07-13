---
name: code-quality-review
description: Use when doing a strict maintainability review, structural review, code quality audit, thermonuclear review, harsh review, or review for abstraction quality, spaghetti growth, file sprawl, type-boundary drift, and architecture fit.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Code Quality Review

Run a strict, findings-only review focused on maintainability, structure, and long-term codebase health. Do not edit files. Do not rubber-stamp working code that makes the codebase messier.

## When to Use

- The user asks for a strict code quality review, maintainability review, structural review, thermonuclear review, or quality audit.
- A branch works functionally but may worsen architecture, readability, ownership, or type boundaries.
- The user wants review findings before a follow-up implementation pass.
- An OpenSpec POC reaches its first objective proof or its complete exact head;
  use this strict pass before expansion and again before publication.
- A final implementation reaches its stable exact head and needs the required
  structural review before publication.

For ordinary correctness/security/performance review, use the repo's normal review path first. This skill is a stricter maintainability lens.

## Review Scope

Start with the branch diff, then follow references across the codebase when needed to validate ownership, canonical helpers, existing abstractions, or architectural precedent.
For a POC or final implementation, read its reuse and deviation contract and
treat a functionally working parallel implementation as a finding unless
repository evidence justifies the deviation.

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

## Deep Structural Checks

Run these checks before declaring the review clean:

- **Scattered policy**: Is one product, auth, access, billing, permission, or lifecycle invariant enforced across multiple routes, hooks, services, or UI branches instead of one owned policy/model?
- **Cross-layer leakage**: Did client/UI code import server/domain/database modules, or did shared modules absorb feature-specific behavior?
- **Day-one large module**: Did a new feature start with a broad service/module that owns persistence, policy, tokens, formatting, delivery, audit, and public read models?
- **Wrong read model**: Does an admin/write path re-derive data through a public/client-safe lookup instead of returning the fields it already owns?
- **Global sprawl**: Did feature-specific styling, config, or helpers get added to an already-large global/shared file without a decomposition path?
- **Partial state**: Can a multi-step flow succeed halfway and leave an accidental state that future code must handle implicitly?
- **Complexity relocation**: Did the refactor move complexity around without reducing the number of concepts a reader must hold?

## What to Flag

Prioritize findings in this order:

1. Structural regressions that make the codebase harder to change.
2. Missed simplifications where a plausible redesign deletes meaningful complexity.
3. Spaghetti growth from new conditionals, flags, modes, or narrow branches.
4. Scattered policy or invariant enforcement across layers.
5. Ownership, layer, or canonical-helper drift.
6. Type-boundary problems that force casts, loose objects, or unclear invariants.
7. File sprawl, especially a PR pushing a file from below 1000 lines to above 1000 lines or adding feature code to already-large global files.
8. Thin wrappers, pass-through helpers, generic magic, and indirection that does not earn its keep.

Avoid low-value nits when larger design issues exist.

## Severity

Use these labels:

- **Critical**: Must fix before approval; the change creates clear architectural debt, scattered access/security/lifecycle policy, or accidental partial state.
- **Warning**: Should fix before approval; the design likely gets worse, but the remedy is scoped. Boundary leaks, broad day-one modules, wrong read-model reuse, and global sprawl are usually warnings unless they create a critical invariant problem.
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

## Recommendation Style

Push for changes that delete complexity instead of rearranging it:

- Reframe the state model so branches disappear.
- Move an invariant into the one policy/model/module that owns it.
- Split broad modules by ownership: policy, persistence, tokens, delivery, formatting, orchestration.
- Return owned data directly instead of re-parsing through another read path.
- Move feature-specific code out of global/shared files unless it is genuinely reusable.
- Replace casts, optionality, and fallback branches with explicit boundaries.
- Keep orchestration linear and make partial states explicit when they are unavoidable.

Do not settle for rename-level feedback when the issue is structural.

## Approval Bar

Do not approve just because behavior works. Approval requires:

- no clear structural regression
- no obvious simplification that would delete meaningful complexity
- no scattered special-case branching in shared flows
- no product, auth, access, billing, permission, or lifecycle policy scattered across layers
- no accidental partial state from non-atomic multi-step workflows
- no unjustified file-size jump past a healthy boundary
- no type or boundary churn that hides the real invariant
- no duplicate helper or wrong-layer ownership when a canonical home is visible
- no feature-specific sprawl into global/shared files without a clear decomposition path

If the bar is not met, report findings only. Leave implementation for the follow-up.
