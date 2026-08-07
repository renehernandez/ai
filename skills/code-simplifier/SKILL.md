---
name: code-simplifier
description: Use when reviewing planning artifacts or changed code for contract- or behavior-preserving simplification, smaller scope, clearer control flow, reduced nesting, redundant abstractions, or unnecessary concepts.
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Code Simplifier

Run a findings-only review for fewer concepts and a smaller coherent solution
without changing accepted success, failure, authority, safety, or migration
behavior. Never edit. This core reviewer returns its own `passed`, `finding`,
or `blocked` result for planning artifacts, POC objective/complete heads, and
final implementations; another review lens cannot substitute for it.

## Bind the Target

For a plan, record the artifact fingerprint and inspect live repository
precedent. For code, resolve the exact target-base diff and read enough
producers, consumers, tests, and canonical owners to prove preservation. Do not
broaden into unrelated cleanup.

## Planning Lens

Challenge scope or units that do not serve the accepted outcome, new machinery
an existing owner can absorb, duplicate sources of truth, setup-only work not
consumed by earliest proof, deferred complexity without an owner, and optional
hardening promoted without concrete risk.

A recommendation must describe a smaller coherent artifact while preserving
accepted architecture, ownership, delivery, acceptance, and risk boundaries.
A change to those boundaries is a material Plan question, not simplification.

## Implementation Lens

Look for:

- branches, modes, state, types, helpers, or policy decisions representing one
  concept more than once;
- values stored or passed when canonical inputs can derive them;
- thin wrappers or abstractions without durable variation;
- casts, optionality, and fallbacks hiding a simpler invariant;
- special cases bypassing an existing policy/model owner;
- mixed-purpose functions and complexity moved between files;
- comments or names that duplicate rather than expose the invariant; and
- compatibility for shapes that existed only on the current unshipped branch.

Use one term per concept and one concept per term. Prefer canonical vocabulary;
shorter is not simpler when domain precision is lost. Code must make sense
without branch or conversation history.

Remove compatibility only after proving it is absent from the target base,
accepted contract, current callers, and external consumers. Keep boundaries
that isolate real variation, security assumptions, migrations, or non-obvious
business rules. Fewer lines alone are not evidence.

`deslop` owns local-style and verbosity drift. `code-quality-review` owns
structural architecture and layer ownership. Report those concerns here only
when they duplicate or conceal a concept required for simplification.

## Output

```text
Simplification result: passed | finding | blocked
Target: <fingerprint or base...head>
Finding: [severity] <title> [confidence]
Location: <path:line or artifact section>
Redundant concept:
Surviving source of truth:
Producers and consumers inspected:
Behavior-preserving recommendation:
Residual risk:
```

Every finding identifies the redundant representation or compatibility path,
the surviving owner, and why reachable success and failure behavior remains
unchanged. Return plan findings to Plan and code findings to the single Execute
owner.
