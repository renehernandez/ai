---
name: code-simplifier
description: Use when reviewing planning artifacts or changed code for contract- or behavior-preserving simplification, smaller scope, clearer control flow, reduced nesting, redundant abstractions, or unnecessary concepts.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Code Simplifier

Run a findings-only simplification review. Do not edit files. Find concrete ways
to remove scope or complexity while preserving every accepted contract boundary
and success and failure behavior.

## Core Reviewer Boundary

This is a mandatory core reviewer for stable planning artifacts, POC first
objective proof, completed POCs, and final implementations. Always return its
own `passed`, `finding`, or `blocked` outcome. An integrated inline review may
share execution, and unavailable delegated models may fall back to an available
model or inline execution, but another review type never substitutes for the
simplification result.

Review the exact target only. Return findings to Plan for planning artifacts or
to the single Execute owner for implementation diffs. Never stage, commit, edit,
or apply a recommendation.

## Planning Artifact Scope

Start with the exact planning artifact and supplied fingerprint. Read enough
repository context to verify its precedent, canonical-owner, earliest-proof,
and delivery-shape claims. Challenge:

- scope or delivery units that do not contribute to the accepted outcome;
- proposed machinery that an existing owner can absorb;
- duplicated contracts, policies, sources of truth, or review mechanisms;
- setup-only work or abstractions not consumed by the earliest objective proof;
- complexity shifted into later implementation without a coherent owner; and
- optional hardening promoted into required scope without a concrete risk.

A valid planning finding identifies a smaller coherent artifact shape that
preserves accepted behavior, architecture, canonical ownership, safety,
migration, delivery, and end-to-end acceptance. If the simplification would
change one of those durable boundaries, return it as a material contract
question rather than a behavior-preserving repair.

## Implementation Diff Scope

Start with the exact branch diff, then read enough neighboring code to verify
project conventions and canonical owners:

```bash
git merge-base HEAD main
git diff --stat <base>..HEAD
git diff <base>..HEAD
```

Use the active target branch when `main` is not the review base. Do not broaden
into unrelated cleanup.

## Implementation Lens

Look for:

- nested branches or ternaries that a linear flow can replace;
- duplicate branches, setup, or policy decisions;
- thin wrappers and abstractions that name no durable concept;
- casts, optionality, or fallback paths hiding a simpler invariant;
- mixed-purpose functions that obscure ownership;
- scattered special cases that an existing policy or model already owns;
- comments or intermediate layers made unnecessary by clearer names; and
- complexity moved between files without reducing concepts.

A valid implementation finding must identify a behavior-preserving alternative
grounded in the diff and surrounding code. Fewer lines alone are not evidence
of simplification. Keep useful boundaries that isolate real variation, security
assumptions, migrations, or non-obvious business rules.

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
to the Execute owner.

For a planning target, replace `Location` with the artifact section or line and
name the exact fingerprint. If clean, name the inspected artifact, repository
precedent checked, and remaining delivery or contract risk. Send findings to
Plan.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Optimizing for line count | Require lower cognitive or structural complexity. |
| Suggesting a behavior change | Route it as a contract question, not simplification. |
| Rewriting stable neighboring code | Keep findings scoped to introduced or materially worsened complexity. |
| Editing after finding an easy cleanup | Return the finding to the single Execute owner. |
| Treating planning simplification as code review | Challenge artifact scope, ownership, proof, and delivery shape against live precedent. |
| Dropping simplification when delegation fails | Fall back to available execution or return `blocked`; never omit the core outcome. |

## Test Evidence

- RED planning: the prior code-only contract allowed handoff after a generic
  integrated planning review because it required no planning-artifact result or
  model fallback.
- GREEN planning: under deadline and unavailable-model pressure, the revised
  contract required its own artifact-bound outcome while allowing inline
  execution.
- RED POC: the prior contract allowed expansion after `code-quality-review` and
  `scrutinize` because it defined no first-proof simplification gate.
- GREEN POC: the revised contract required simplification before expansion and
  rejected the two other reviewers as substitutes while using available-model
  fallback.
