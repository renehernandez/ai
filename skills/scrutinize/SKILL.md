---
name: scrutinize
description: Use when the user asks to scrutinize, sanity-check, challenge, get a second opinion on, or adversarially validate a plan, implementation diff, PR, hosted review feedback, proposed approach, claim-heavy review, or mandatory workflow gate.
---

# Scrutinize

## Overview

Stand outside the artifact and ask whether it should exist, whether a smaller path works, and whether the real system path proves its claims.

This is not a generic review. Use the normal review skills for their scopes; use this skill to challenge intent and verify claims end to end.

## When to Use

- plan, design doc, architecture, or proposed approach scrutiny
- implementation diff, branch, PR, hosted review feedback, or merge-readiness scrutiny
- sanity checks, second opinions, and adversarial validation requests
- mandatory `plan-ready`, `plan-review`, and `plan-unit-delivery` gates

Do not use for pure formatting review, prose polish, status briefs, or implementation without a review gate.

## Workflow

1. **Intent**: restate the goal in one sentence. If you cannot, verdict is `rework`.
2. **Simpler path**: ask whether existing code, docs, workflow, or a smaller change solves the same goal with less surface.
3. **Trace**: follow the real code, doc, workflow, PR, or system path far enough to prove or disprove the main claims.
4. **Evidence**: report only concrete findings backed by a cited input, path, plan step, diff section, workflow state, or documented assumption.
5. **Verdict**: end with the strict verdict line.

## Freshness Rule

Before scrutinizing a PR, branch diff, implementation, CI result, hosted review feedback, or merge-readiness claim, verify live state first: branch, base, diff, relevant PR metadata, checks, and current head.

Before scrutinizing a standalone plan or design doc, inspect live repo context enough to validate assumptions. Full PR and check state is required only when the plan references a PR, branch, CI result, or deployed behavior.

If live state cannot be verified, state the verified scope before findings.

## Gate Behavior

| Severity | Gate behavior |
| --- | --- |
| `BLOCKER` | Stop; fix before proceeding. |
| `MAJOR` | Stop; fix before proceeding unless the user explicitly accepts the trade-off. |
| `MINOR` in plan scrutiny | Fix automatically before implementation when scoped and mechanical. |
| `MINOR` in implementation or PR scrutiny | Fix automatically when local and low-risk; otherwise report as non-blocking residual risk. |

When required fixes change the reviewed artifact, rerun scrutiny before proceeding.

## Evidence Rule

Do not report speculative findings. Every finding must cite the concrete evidence that exposes it.

If a concern is plausible but unproven, put it under `Residual risk`, not findings.

Before the final verdict, ask what evidence would change the conclusion. Inspect local evidence, name unavailable evidence as residual risk, and use `fix-then-ship` or `rework` when missing evidence is required for the gate.

## Output

For findings:

```markdown
Reviewed surface: <scope checked>

**[MAJOR] Finding title** [confidence: 0.86 - high | reason: concrete evidence basis]
Location: `path:line`
Why it matters:
Evidence:
Suggested change:

Scrutinize verdict: fix-then-ship - <single biggest reason>. [confidence: 0.86 - high | reason: <short evidence basis>]
```

For clean scrutiny, one paragraph is allowed if it names the reviewed surface, simpler-alternative result, residual risk, and strict verdict line.

Verdicts:

- `ship`: gate passes.
- `fix-then-ship`: gate fails until findings are fixed and scrutiny is rerun.
- `rework`: gate fails because the artifact is underspecified or shaped incorrectly.
- `reject`: gate fails because the goal is invalid, unsafe, unnecessary, or contradicted by current constraints.

`MINOR` findings can coexist with `ship` only when non-blocking or already fixed by the surrounding workflow.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Reviewing only the diff | Trace unchanged callers, helpers, docs, or workflow paths needed to verify the claim. |
| Treating approval as scope lock | Still run the simpler-path check unless the user explicitly says not to question scope. |
| Reporting plausible risks as findings | Move unproven concerns to residual risk. |
| Rubber-stamping clean output | State what was traced and what residual risk remains. |
| Letting `MINOR` plan issues carry into coding | Apply scoped mechanical plan fixes before implementation. |

## Validation Scenarios

- Plan adds a new policy helper while an existing helper owns the same invariant: pass only if scrutiny flags the simpler path before implementation.
- PR claims behavior is preserved but unchanged caller paths can bypass it: pass only if scrutiny traces the real caller path before verdict.
- Review sees plausible concurrency or CI concerns without evidence: pass only if concerns become residual risk, not findings.

## Test Evidence

- RED: earlier direct-delivery and plan-unit-delivery docs allowed completion without any mandatory adversarial scrutiny gate.
- GREEN: with this skill loaded, the duplicate-helper and retry-claim scenarios produced evidence-backed `MAJOR` findings and `fix-then-ship` verdicts.
- REFACTOR: with this skill loaded, plausible but unproven concurrency and CI concerns stayed under residual risk instead of becoming findings.
