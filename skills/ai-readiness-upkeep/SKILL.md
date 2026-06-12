---
name: ai-readiness-upkeep
description: Use when project work may require updates to verification scripts, task commands, hooks, CI checks, agent instructions, rules, skills, review rubrics, or automation so the repo stays ready for AI-assisted development.
---

# AI Readiness Upkeep

## Overview

Keep active projects ready for AI-assisted development by finding contracts that should be enforced mechanically. This is a findings-only gate: report what the implementer must change, but do not edit target project files from this review.

## When To Use

Use during delivery and review when a diff, plan, CI failure, review thread, or operational lesson touches verification scripts, task commands, hooks, CI, generated artifacts, schemas, deploy config, agent instructions, skills, prompts, or review rubrics.

Return `not_applicable` for pure formatting, mechanical generated churn with no contract change, isolated prose edits, or changes already covered by existing checks.

## Priority Order

1. Prefer executable verification: tests, type checks, schema validation, drift checks, config validators, or existing tool checks.
2. Then choose the automation lane: `task_command`, `local_hook`, `ci`, `release_or_deploy`, `scheduled`, `manual`, or `none`.
3. Add only the smallest intent update needed so agents know the check exists and what failure means.
4. Defer one-off, unstable, expensive, or unenforceable ideas.

Blocking findings require concrete evidence, a repeatable contract, and an enforceable lane. `manual` and `none` are never blocking lanes.

## Workflow

1. Inspect the changed surface and existing verification commands. Prefer repo-native commands from package scripts, Make/Rake/Just/Task files, language-native runners, hooks, CI job names, README, and `AGENTS.md`.
2. Infer the project contract exposed by the change or review feedback.
3. Check whether an existing script, hook, CI job, or release/deploy gate already enforces it.
4. If enforcement is missing and cheap, deterministic, scoped, safe, and secrets-free for the chosen lane, emit a blocking finding.
5. If enforcement is useful but broad, slow, unsafe, or outside the slice, emit a nonblocking finding or deferred item.
6. Validate the final report with `scripts/ai-readiness-upkeep.ts validate-report`.

Use related skills only for classification. For example, use `docs-alignment-review` to decide whether docs are stale, `writing-skills` to identify a skill-quality issue, or domain skills after detecting domain files. Leave the actual edits to the implementer workflow.

## Report Contract

```yaml
ai_readiness_upkeep_report:
  verdict: passed | findings | blocked | not_applicable
  checked:
    surfaces:
      - source
      - tests
      - task_commands
      - hooks
      - ci
      - generated_artifacts
      - schemas_or_contracts
      - infra_or_deploy
      - agent_instructions
      - review_rubrics
    evidence:
      - path-or-command: why checked
  findings:
    blocking:
      - title: <short title>
        contract: <new or changed expectation>
        evidence: <diff, file, review comment, failure, or plan section>
        required_change: <implementer action>
        action_type: add_verification | wire_automation | update_intent | create_skill | defer
        lane: task_command | local_hook | ci | release_or_deploy | scheduled
        target_surface: <path, command, or config>
    nonblocking:
      - title: <short title>
        evidence: <evidence>
        suggestion: <implementer action>
        action_type: add_verification | wire_automation | update_intent | create_skill | defer
        lane: task_command | local_hook | ci | release_or_deploy | scheduled | manual | none
  deferred:
    - item: <candidate>
      reason: <why not part of this slice>
```

Verdicts are mechanical:

- `passed`: applicable, no findings remain.
- `findings`: only nonblocking findings or deferred items remain.
- `blocked`: at least one unresolved blocking finding remains.
- `not_applicable`: the scope does not expose an AI readiness contract.

The validator requires `checked.evidence`, `findings.blocking`, `findings.nonblocking`, and `deferred` to be present even when they are empty.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Accepting prose when a check is cheap | Report the missing verification delta |
| Recommending a new tool before inspecting project commands | Extend the repo-native command family first |
| Blocking on slow, flaky, networked, or unsafe checks | Make it nonblocking or deferred |
| Treating docs-only edits as always irrelevant | Check whether they alter contracts, verification instructions, or agent workflows |
| Editing files from the review | Return implementer actions only |

## Test Evidence

- RED: `generated_artifact_drift` failed because a manual artifact update lacked reproducible drift verification. Baseline rationalization: "Without a repeatable check, stale generated runtime or lock output can land silently."
- RED: `prose_only_agent_workflow_fix` failed because an `AGENTS.md` sentence did not enforce a tool-invocation contract. Baseline rationalization: "A sentence in AGENTS.md helps, but it has no validation path and will not catch regressions."
- RED: `ci_failure_missing_validation_command` failed because a plan asked agents to remember a validation command instead of wiring it into a task command or CI.
- GREEN control: `docs_only_not_applicable` passed because the change did not alter any workflow, command, verification path, generated artifact, CI, deploy config, schema, or project contract.
- GREEN control: `tooling_specific_overfit` passed when the reviewer used Make/Rake/Terraform validation instead of forcing Cloudflare-specific checks into a non-Cloudflare project.
- GREEN: with this skill loaded, `generated_artifact_drift` returned `ai_readiness_upkeep_report.verdict: blocked` and required a repeatable repo-native drift verification command or check.
- GREEN: with this skill loaded, `prose_only_agent_workflow_fix` returned `ai_readiness_upkeep_report.verdict: blocked` and required a package-manager-mediated validation lane instead of prose-only guidance.
- GREEN: with this skill loaded, `ci_failure_missing_validation_command` returned `ai_readiness_upkeep_report.verdict: blocked` and required schema validation through a repo-native task command and CI check.
- GREEN: with this skill loaded, `docs_only_not_applicable` returned `ai_readiness_upkeep_report.verdict: not_applicable` for isolated clarity prose.
- GREEN: with this skill loaded, `tooling_specific_overfit` returned `ai_readiness_upkeep_report.verdict: passed` by choosing Make/Rake/Terraform validation and rejecting unwarranted Cloudflare-specific checks.
