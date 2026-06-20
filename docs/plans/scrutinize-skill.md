# Scrutinize Skill Plan

## Goal

Add a mandatory `scrutinize` skill for adversarial validation of plans, implementation diffs, PRs, hosted review feedback, and proposed approaches.

The skill should challenge whether the change should exist, check for a simpler path, trace the real system path, verify claims against evidence, and end with a strict machine-scannable verdict.

## Scope

Implement the first slice in this branch:

- `skills/scrutinize/SKILL.md`
- `skills/scrutinize/agents/openai.yaml`
- workflow wiring in `rules/feature-delivery.md`
- workflow wiring in `skills/plan-unit-delivery/SKILL.md`
- a quick trigger rule in `AGENTS.md`

No runtime automation, install script, or extra helper program is needed for the first slice.

## Skill Contract

`scrutinize` is not a generic review skill. It is an adversarial validation pass with this sequence:

1. Restate intent in one sentence.
2. Ask whether a smaller existing path would meet the goal.
3. Trace the real code, doc, workflow, PR, or system path far enough to verify the main claims.
4. Report only evidence-backed actionable findings.
5. End with `Scrutinize verdict: ship|fix-then-ship|rework|reject - <single biggest reason>.`

Use `ship`, `fix-then-ship`, `rework`, and `reject` as the only verdicts.

## Gate Behavior

- `BLOCKER`: stop and fix before proceeding.
- `MAJOR`: stop and fix before proceeding unless the user explicitly accepts the trade-off.
- `MINOR` during plan scrutiny: fix automatically before implementation when scoped and mechanical.
- `MINOR` during implementation or PR scrutiny: fix automatically when local and low-risk; otherwise report as non-blocking residual risk.

## Freshness Rule

For PRs, branch diffs, implementation reviews, CI results, hosted review feedback, or merge-readiness claims, verify live state first: branch, base, diff, PR metadata, checks, and current head as relevant.

For standalone plans or design docs, inspect live repo context enough to validate assumptions. Full PR and check state is required only when the plan references a PR, branch, CI result, or deployed behavior.

If live state cannot be verified, the output must state the verified scope, such as local diff only or plan text plus current working tree only.

## Evidence Rule

Do not report speculative findings. Every finding must cite a concrete input, code path, plan step, PR diff section, workflow state, or documented assumption.

Plausible but unproven concerns belong under residual risk, not findings.

Before the final verdict, ask what evidence would change the conclusion. Inspect it if available locally; otherwise name it as residual risk. If the missing evidence is required for the gate, use `fix-then-ship` or `rework`.

## Output Format

Findings use:

```markdown
**[MAJOR] Finding title** [confidence: 0.86 - high | reason: concrete evidence basis]
Location: `path:line`
Why it matters:
Evidence:
Suggested change:
```

Clean runs may be one paragraph if they include:

- reviewed surface
- simpler-alternative result
- residual risk
- strict verdict line

## Workflow Wiring

`feature-delivery.md` should run `scrutinize` as the first pre-commit quality gate before maintainability, simplification, deslop, and docs alignment.

`plan-unit-delivery/SKILL.md` should run `scrutinize` twice:

- after plan review and before implementation
- after local implementation review and before hosted or background review and CI completion

The workflow should apply required fixes and rerun scrutiny when the reviewed artifact changes.

## Validation Plan

Use `writing-skills` validation:

1. RED: run pressure scenarios without the new skill and capture likely failures.
2. GREEN: write the minimal skill that blocks those failures.
3. REFACTOR: rerun pressure scenarios and close loopholes.

Pressure scenarios should cover:

- a plan that adds a broad new helper while an existing helper already owns the policy
- a PR that looks correct in the diff but fails when the unchanged call path is traced
- a clean-looking review that wants to report speculative risks without concrete evidence

## Validation Evidence

RED baseline:

- Current documented feature-delivery and plan-unit-delivery workflows fail the proposed requirement because they do not require an adversarial scrutiny gate in either workflow.
- Reasoning-only pressure prompts often selected the desired behavior without the skill, so the useful failing baseline is the documented workflow gap: agents can follow current instructions and skip scrutiny.

GREEN/REFACTOR:

- Plan-helper scenario: with `scrutinize` loaded, the agent produced a `MAJOR` finding for adding a duplicate access helper, applied gate behavior, and returned `fix-then-ship`.
- Retry-claim scenario: with `scrutinize` loaded, the agent traced the unchanged caller branch, produced a `MAJOR` finding, named evidence that would change the conclusion, and returned `fix-then-ship`.
- Speculative-risk scenario: with `scrutinize` loaded, the agent refused to turn unproven concurrency and CI concerns into findings, recorded them as residual risk, and returned `ship`.

## Success Criteria

- The skill is concise and discoverable.
- `agents/openai.yaml` exposes a usable default prompt.
- Mandatory workflow docs clearly define where scrutiny runs and how verdicts affect gates.
- Writing-skills validation demonstrates baseline failures and post-skill compliance.
- Local verification and review gates pass or report evidence-backed blockers.
