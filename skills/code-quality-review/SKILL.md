---
name: code-quality-review
description: Use when doing a strict maintainability review, structural review, code quality audit, thermonuclear review, harsh review, or review for abstraction quality, spaghetti growth, file sprawl, type-boundary drift, and architecture fit.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Code Quality Review

Run a strict, findings-only maintainability and architecture review. Working
behavior is necessary but does not excuse ownership drift, scattered policy,
or accidental state. Never edit.

## Bind the Target

Resolve the exact target-base diff, then inspect surrounding code and the
accepted reuse contract and any exception with explicit user authority. Ground every finding in changed code plus
repository precedent; taste is not evidence. For a POC, distinguish real reuse
from a parallel implementation that merely reproduces behavior.

## Structural Lens

Prioritize:

1. A product, auth, access, billing, permission, or lifecycle invariant
   scattered across routes, hooks, services, or UI branches rather than one
   policy/model owner.
2. Cross-layer leakage or feature behavior placed in shared/global modules.
3. Broad new modules mixing persistence, policy, tokens, formatting, delivery,
   audit, and orchestration.
4. Admin/write paths re-deriving data through public/client-safe read models
   instead of returning the fields they already own.
5. Multi-step flows that can leave implicit partial state.
6. Ad-hoc object shapes, casts, `any`, optionality, or fallbacks that hide the
   invariant.
7. Near-duplicate helpers, thin wrappers, generic indirection, and new
   branches/modes that increase concepts.
8. Feature-specific sprawl into already-large files, especially a material
   threshold crossing without an ownership-based decomposition.

Ask whether the new abstraction removes complexity, whether independent
orchestration is needlessly serialized, and whether the canonical module can
own the behavior. Do not reduce this lens to naming or line count; that belongs
to `deslop` or `code-simplifier` unless it exposes structural debt.

## Severity and Output

- **Critical:** clear scattered security/lifecycle policy or accidental state;
  must change.
- **Warning:** likely maintainability regression with a scoped remedy.
- **Suggestion:** useful improvement that does not block alone.

```text
Code quality result: passed | finding | blocked
Target: <base...head>
Finding: [severity] <title> [confidence and reason]
Location: <path:line>
Structural impact:
Repository precedent:
Recommendation:
Residual risk:
```

Prefer recommendations that move one invariant to its owner, delete branches,
split broad modules by responsibility, return owned data directly, make partial
states explicit, and restore type boundaries. If clean, name the architecture
and ownership paths inspected. Return findings to Execute.
