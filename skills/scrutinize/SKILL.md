---
name: scrutinize
description: Use when the user asks to scrutinize, sanity-check, challenge, get a second opinion on, or adversarially validate a plan, implementation diff, PR, hosted review feedback, proposed approach, claim-heavy review, or mandatory workflow gate.
---

# Scrutinize

Run a findings-only adversarial review. Ask whether the artifact should exist,
whether a smaller path achieves the goal, and whether the real system path
proves its claims. Never edit; normal review lenses retain correctness,
security, maintainability, and prose ownership.

## Bind Fresh Evidence

For a PR, implementation, CI result, hosted finding, or readiness claim, verify
the live branch, base, exact head, diff, host metadata, and relevant checks.
For a standalone plan, inspect current repository precedent and any live state
the plan cites. State the verified boundary when evidence is unavailable.

## Challenge

1. Restate the intended outcome in one sentence. If it cannot be stated, the
   artifact needs `rework`.
2. Test whether existing code, documentation, workflow, or a smaller change
   achieves it with less surface.
3. Trace the real producer-to-consumer code, document, workflow, or hosted path
   far enough to prove or disprove the central claims. A POC that works through
   parallel architecture does not prove fit with the planned canonical owner.
4. Report only evidence-backed findings. Plausible but unproven concerns belong
   under residual risk.
5. State what evidence would change the conclusion and return a strict verdict.

## Gate and Output

`BLOCKER` and `MAJOR` fail the gate. A Plan `MINOR` returns to Plan. An
implementation `MINOR` returns to Execute or remains explicitly non-blocking
when no artifact change is required. Rerun after a material repair.

```text
Reviewed surface: <exact artifact and evidence>
Finding: [BLOCKER|MAJOR|MINOR] <title> [confidence and reason]
Location: <path:line or artifact section>
Why it matters:
Evidence:
Smaller or safer change:
Residual risk:
Evidence that would change the verdict:
Scrutinize verdict: ship | fix-then-ship | rework | reject - <reason> [confidence]
```

`ship` passes. `fix-then-ship` requires scoped repair and rerun. `rework` means
the artifact is underspecified or wrongly shaped. `reject` means the goal is
invalid, unsafe, unnecessary, or contradicted by current constraints.
