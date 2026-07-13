---
name: code-simplifier
description: Use when reviewing recently changed code for behavior-preserving simplification, clearer control flow, reduced nesting, redundant abstractions, or unnecessary concepts.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Code Simplifier

Run a findings-only simplification review. Do not edit files. Find concrete ways
to remove complexity while preserving every accepted success and failure
behavior.

## Scope

Start with the exact branch diff, then read enough neighboring code to verify
project conventions and canonical owners:

```bash
git merge-base HEAD main
git diff --stat <base>..HEAD
git diff <base>..HEAD
```

Use the active target branch when `main` is not the review base. Do not broaden
into unrelated cleanup.

## Review Lens

Look for:

- nested branches or ternaries that a linear flow can replace;
- duplicate branches, setup, or policy decisions;
- thin wrappers and abstractions that name no durable concept;
- casts, optionality, or fallback paths hiding a simpler invariant;
- mixed-purpose functions that obscure ownership;
- scattered special cases that an existing policy or model already owns;
- comments or intermediate layers made unnecessary by clearer names; and
- complexity moved between files without reducing concepts.

A valid finding must identify a behavior-preserving alternative grounded in the
diff and surrounding code. Fewer lines alone are not evidence of simplification.
Keep useful boundaries that isolate real variation, security assumptions,
migrations, or non-obvious business rules.

## Output

Return `passed`, `finding`, or `blocked` with source evidence. For each finding:

```markdown
**[SEVERITY] Simplification title** [confidence: 0.86 - high]
Location: `path:line`
Issue:
Evidence:
Behavior-preserving recommendation:
```

If clean, name the inspected diff and remaining behavioral risk. Send findings
to the Execute owner; never stage, commit, or apply the recommendation.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Optimizing for line count | Require lower cognitive or structural complexity. |
| Suggesting a behavior change | Route it as a contract question, not simplification. |
| Rewriting stable neighboring code | Keep findings scoped to introduced or materially worsened complexity. |
| Editing after finding an easy cleanup | Return the finding to the single Execute owner. |
