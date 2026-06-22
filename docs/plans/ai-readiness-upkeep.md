# AI Readiness Upkeep Plan

## Goal

Add an `ai-readiness-upkeep` skill that keeps active projects ready for AI-assisted development by finding missing enforceable verification and minimal agent-facing intent updates during delivery and review workflows.

The skill should run as a mechanical gate. It returns structured findings for the implementer to apply; it does not edit the target project itself.

## Motivation

AI-assisted work degrades when a project's implicit contracts stay in human memory, reviewer comments, or one-off agent prompts. The upkeep pass should convert repeated lessons into durable project surfaces, with executable verification preferred over prose.

Two external ideas shape the plan:

- [The Intent Layer](https://intent-systems.com/intent-layer) argues for durable, versioned, progressively disclosed context that agents already consume, such as `AGENTS.md` and nearby instruction files.
- [AI Is Forcing Us To Write Good Code](https://bits.logic.inc/p/ai-is-forcing-us-to-write-good-code) emphasizes enforced guardrails: tests, hooks, CI, types, fast environments, clear names, and isolated workflows.

The repo-local interpretation is:

1. Intent helps agents find and understand the rails.
2. Verification makes the rails enforceable.
3. Upkeep review should prefer mechanical checks over new rules whenever the contract can be checked.

## Scope

Implement the first slice:

- Add `skills/ai-readiness-upkeep/SKILL.md`.
- Add `skills/ai-readiness-upkeep/agents/openai.yaml`.
- Add `skills/ai-readiness-upkeep/scripts/ai-readiness-upkeep.ts`.
- Wire `ai-readiness-upkeep` into feature delivery, plan-unit-delivery, local diff review, and the background review rubric as a findings-producing gate.
- Update `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts` so the conditional reviewer is represented in launch templates, launch validation, review-report validation, gate templates, and ledger validation.
- Update docs alignment guidance only enough to clarify the boundary between documentation drift and AI readiness enforcement.
- Add focused tests for the new helper script and the `plan-unit-delivery` validator/template changes.

The first slice should be tooling-neutral. Examples may mention package scripts, Make, Rails, Terraform, GitHub Actions, GitLab CI, LeftHook, generated artifacts, schema validators, and Cloudflare Workers, but the skill must not center any one ecosystem.

## Non-Goals

- Do not create `ai-readiness-init` or `ai-readiness-audit` in this slice.
- Do not build a generic platform, long-lived state store, dashboard, or cross-repo scanner.
- Do not make the upkeep reviewer mutate project files directly.
- Do not require every project to use LeftHook, Node, Wrangler, or a specific CI provider.
- Do not turn every observation into an agent rule.
- Do not require universal coverage thresholds or type-system choices. The skill should enforce the project's stated contracts, not import another team's policy wholesale.
- Do not update hosted adapter skills in the first slice unless a validator-backed integration requires it. Start with `diff-review` and the background review rubric.

## Implementation Sequence

Follow `writing-skills` test discipline before writing the new skill content:

1. Read `skills/writing-skills/SKILL.md` and its directly relevant testing guidance.
2. Define the pressure scenarios from this plan as RED tests.
3. Run baseline reviewer prompts without `ai-readiness-upkeep` loaded and capture the failure rationalizations verbatim.
4. Write the minimal `SKILL.md`, helper script, adapter prompt, and workflow wiring that address the observed failures.
5. Rerun the pressure scenarios with the new skill loaded and capture GREEN results.
6. Refactor the skill only to close observed loopholes, then rerun affected scenarios.
7. Record RED/GREEN/REFACTOR evidence in the new `SKILL.md` test evidence section or a directly linked skill test note.

Do not ship the skill as untested process documentation.

## Skill And Adapter Acceptance Criteria

`skills/ai-readiness-upkeep/SKILL.md` must use supported skill frontmatter only:

```yaml
---
name: ai-readiness-upkeep
description: Use when project work may require updates to verification scripts, task commands, hooks, CI checks, agent instructions, rules, skills, review rubrics, or automation so the repo stays ready for AI-assisted development.
---
```

The description must stay trigger-focused. It should not summarize the whole workflow.

Only add `allowed-tools` if the implementation needs to constrain tool access for a specific harness. The skill should otherwise describe the review behavior and the structured report contract.

`skills/ai-readiness-upkeep/agents/openai.yaml` must expose:

- `interface.display_name`;
- `interface.short_description`;
- `interface.default_prompt`.

The default prompt must tell Codex to run `ai-readiness-upkeep` as a findings-only gate, validate the produced `ai_readiness_upkeep_report`, and leave all project edits for the implementer.

## Skill Contract

`ai-readiness-upkeep` reviews a diff, plan, PR/MR, review thread, CI failure, or operational lesson and answers:

1. What project contract did this work expose?
2. Is that contract already enforced?
3. If not, can it be enforced mechanically?
4. Where should that verification run?
5. What minimal agent-facing instruction is needed so future agents maintain the check?

The output is an `ai_readiness_upkeep_report` with:

- `verdict`: `passed`, `findings`, `blocked`, or `not_applicable`;
- checked surfaces;
- contract findings;
- missing verification findings;
- minimal intent or instruction findings;
- deferred items with reasons.

The gate passes when there are no unresolved blocking findings.

## Verdict Semantics

Use verdicts mechanically:

- `passed`: the reviewed scope was applicable and no findings remain.
- `findings`: only nonblocking findings or deferred items remain.
- `blocked`: at least one unresolved blocking finding remains.
- `not_applicable`: the reviewed scope is outside the trigger policy or does not expose an AI readiness contract.

`passed` and `not_applicable` reports must not contain blocking findings. `findings` reports must not contain blocking findings. Any unresolved blocking finding requires `blocked`.

## Priority Order

The reviewer should classify every candidate in this order:

1. **Executable verification**: test, typecheck, schema validation, generated drift check, config validator, dependency or security check, deploy/config dry check, data-contract check, or similar.
2. **Automation lane**: task command, local hook, CI check, release/deploy gate, scheduled check, or manual runbook step.
3. **Agent intent**: `AGENTS.md`, project rules, local skill, review rubric, or nearby docs that explain when and why the check exists.
4. **Defer or ignore**: one-off, unstable, too expensive, already covered, or not connected to this change.

Rules and docs are secondary unless the expectation cannot be checked mechanically.

## Mechanical Workflow

The skill should follow this workflow:

1. Inspect the planning artifact or diff scope.
2. Identify changed surfaces:
   - source behavior;
   - tests and fixtures;
   - package or task commands;
   - hooks;
   - CI/release/deploy config;
   - generated files;
   - schemas, migrations, API contracts, or type contracts;
   - infrastructure config;
   - `AGENTS.md`, rules, skills, prompts, or review rubrics.
3. Infer contracts exposed by the change or review feedback.
4. Search for existing checks that enforce each contract.
5. Decide the cheapest reliable automation lane.
6. Emit blocking findings when a repeatable, meaningful, cheaply enforceable contract lacks verification.
7. Emit nonblocking findings when enforcement is useful but expensive, broad, or outside the approved slice.
8. Emit minimal intent findings only after verification placement is decided.

## Enforcement Lanes

Use these lanes in structured findings:

| Lane | Use When |
| --- | --- |
| `task_command` | A developer or agent must have a stable command to run the check. |
| `local_hook` | The check is cheap enough to run before commit or before a tool action. |
| `ci` | The check needs full repo context, secrets-free CI context, or branch protection. |
| `release_or_deploy` | The check must run near publish, deploy, migration, or rollback. |
| `scheduled` | Drift can appear without a code diff, such as external service or dependency drift. |
| `manual` | The contract is real but cannot be safely automated yet. |
| `none` | No enforcement is needed. |

The skill should prefer `task_command` plus `ci` for branch-critical checks. It should prefer `local_hook` only for fast, low-noise checks.

`manual` and `none` are not valid lanes for blocking findings. Use them only for nonblocking or deferred items because blocking findings must point to enforceable verification or automation.

For `release_or_deploy`, require an existing release/deploy gate or a clearly scoped command to wire in the current project. Otherwise emit a nonblocking finding or deferred item so the skill does not invent deployment automation for a project that lacks it.

## Tooling-Neutral Command Discovery

Before recommending a new command surface, inspect the target project's existing command patterns:

- package manager scripts such as `package.json`, `pyproject.toml`, `Cargo.toml`, `Gemfile`, `mix.exs`, `go.mod`, or Gradle/Maven files;
- task runners such as `Makefile`, `justfile`, `Taskfile.yml`, `Rakefile`, `bin/*`, or project-local scripts;
- hook configs such as Lefthook, pre-commit, Husky, Overcommit, or language-native hook wrappers;
- CI job names and reusable CI templates;
- README, `AGENTS.md`, and docs that name canonical verification commands.

Prefer extending an existing command family over introducing a new tool. If no command pattern exists, recommend a project-native command name and mark broad command-system work nonblocking unless the current change requires it.

## Finding Policy

Blocking findings:

- A changed behavior, generated artifact, schema, config, or workflow exposes a repeatable contract.
- The contract can be checked with a scoped script or existing tool.
- The check is cheap enough for at least one automation lane.
- Missing enforcement would leave future agents guessing or relying on review memory.
- The finding has concrete evidence from the diff, plan, review feedback, CI failure, or operational incident.
- The proposed check is deterministic, scoped, safe to run in the selected lane, secrets-free unless the lane already has the needed secret context, and does not mutate external state.

Nonblocking findings:

- The check is valuable but broad, slow, or outside the approved slice.
- The project lacks enough structure to add a reliable check in the current change.
- The finding belongs in a future `ai-readiness-audit`.

Not applicable:

- Pure formatting, generated churn with no contract change, isolated prose edits, or changes already covered by existing checks.
- CI, hook, task-command, or config edits that only rename, comment, reformat, or mechanically translate existing checks without changing the enforced contract.
- Docs-only edits only when they do not alter project contracts, agent workflows, verification instructions, review expectations, or operational expectations.

## Delegation To Existing Skills

`ai-readiness-upkeep` should stay small and route specialized work:

- Use `docs-alignment-review` when documentation, agent instructions, review rubrics, or prompts may be stale.
- Use `writing-skills` when the right outcome is a new or changed reusable skill.
- Use `doc-smith` when non-trivial docs need to be written or reviewed.
- Use `scrutinize` when a proposed enforcement path may be overbuilt, under-scoped, or weakly evidenced.
- Use domain skills only after detecting that domain's files or commands in the target project.

The upkeep skill should not run every related skill by default. It should identify the needed owner and produce a structured finding for the implementer.

In `ai-readiness-upkeep` review mode, delegated skills are classification aids only. They should produce recommended implementer actions unless the surrounding workflow explicitly shifts into implementation.

## Helper Script

Add `skills/ai-readiness-upkeep/scripts/ai-readiness-upkeep.ts` with initial commands:

- `report-template`: print the required `ai_readiness_upkeep_report` YAML skeleton.
- `validate-report`: validate a report from stdin or `--file`.

The validator should check:

- known verdict values;
- known enforcement lanes;
- checked surfaces are present;
- blocking findings include a contract, evidence, required change, and target enforcement lane;
- `passed`, `findings`, and `not_applicable` reports do not contain unresolved blocking findings;
- `blocked` reports contain at least one blocking finding;
- blocking findings do not use `manual` or `none` lanes;
- all findings classify whether the implementer should add verification, wire automation, update intent, or defer.
- raw YAML and fenced `yaml` Markdown blocks both validate.

The script should not inspect or mutate target project files in v1.

## Report Shape

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

## Workflow Wiring

Update these files in the first slice:

| File | Required Change |
| --- | --- |
| `rules/feature-delivery.md` | Add AI readiness upkeep to the pre-commit quality gate as a conditional pass for verification, hook, CI, generated-artifact, contract, infra/deploy, agent-instruction, skill, prompt, or review-rubric changes. Run it before the final `docs-alignment-review` whenever readiness findings can cause docs or agent-doc changes. Rerun docs alignment after implementer-applied readiness changes. |
| `skills/plan-unit-delivery/SKILL.md` | Add `ai-readiness-upkeep` as a conditional implementation review pass. Define trigger predicates, skipped-reviewer evidence, report validation, outcome mapping, and the `ai_readiness_upkeep` ledger gate. |
| `skills/plan-unit-delivery/agents/openai.yaml` | Update the default prompt so plan-unit-delivery launches or skips the AI readiness reviewer with evidence and validates the report before PR/MR creation or final delivery. |
| `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts` | Add `ai-readiness-upkeep` to known review passes, update reviewer templates, launch validation, review-report validation, gate templates, ledger validation, and tests. The reviewer remains conditional, not part of the always-required baseline. |
| `skills/diff-review/SKILL.md` | Add a review lens for missing enforceable verification when a diff changes contracts or agent workflows. It should point to `ai-readiness-upkeep` rather than duplicating the skill. |
| `templates/background-agent-pr-review-rubric.md` | Add a rubric check for missing enforceable verification before accepting prose-only AGENTS/rules/docs updates. |
| `skills/docs-alignment-review/SKILL.md` | Clarify that docs alignment checks whether documentation is stale, while AI readiness upkeep checks whether newly exposed contracts should be enforced mechanically. |

Do not update `skills/github-adapter-review/SKILL.md` or `skills/gitlab-adapter-review/SKILL.md` in the first slice unless implementation proves the hosted adapter output cannot surface the new `diff-review` rubric or background review rubric without a direct adapter change.

`plan-unit-delivery` should include `ai-readiness-upkeep` as a conditional review pass when the diff touches:

- task commands;
- hooks;
- CI/release/deploy config;
- generated artifacts;
- schemas or API contracts;
- infrastructure config;
- agent instructions, rules, skills, prompts, or review rubrics;
- review feedback that says future agents should avoid or repeat something.

For `plan-unit-delivery` report mapping:

- If the AI readiness reviewer is not triggered, list `ai-readiness-upkeep` under `skipped_reviewers` with `not_applicable` evidence and set the `ai_readiness_upkeep` ledger gate to `not_applicable`.
- If launched, record its inline or built-in subagent evidence id in `reviewer_launch`.
- The reviewer must emit an `ai_readiness_upkeep_report` and run `skills/ai-readiness-upkeep/scripts/ai-readiness-upkeep.ts validate-report` against it.
- A validated report with `verdict: passed` maps to reviewer outcome `passed`.
- A validated report with `verdict: findings` may map to reviewer outcome `passed` only after nonblocking findings are recorded as residual risk or future work.
- A report with `verdict: blocked`, invalid YAML, unknown lanes, or missing required fields maps to reviewer outcome `blocked` until the implementer applies fixes or the user explicitly accepts the trade-off.
- The final `reviewer_report` must not contain unresolved `findings` or `blocked` outcomes.

Update review guidance so PR/MR reviews can invoke the skill when the review finds missing enforcement rather than only code correctness issues.

## Validation Plan

Use `writing-skills` test discipline for the new skill.

Pressure scenarios:

1. A feature updates a generated artifact manually but does not add a drift check.
2. A review comment corrects an agent workflow, but the proposed fix only adds prose and no executable check.
3. A CI failure reveals a missing validation command, but the plan only says "remember to run this."
4. A small docs-only change correctly returns `not_applicable`.
5. A Cloudflare or Terraform example is classified through generic config/deploy lanes rather than special-cased as the core skill.

Helper script tests:

- valid `passed` report;
- valid `findings` report with only nonblocking verification delta;
- valid `blocked` report with a blocking verification delta;
- invalid unknown lane;
- invalid `passed` or `findings` report with blocking findings;
- invalid blocking finding missing evidence or required change;
- invalid blocking finding using `manual` or `none`;
- valid fenced `yaml` report input.

Concrete test targets:

- Add `tests/unit/ai-readiness-upkeep-script.test.ts` for the new helper script.
- Update `tests/unit/plan-unit-delivery-script.test.ts` or add the nearest matching unit test file for `plan-unit-delivery` template, launch-report, review-report, and ledger validation changes.
- Add integration coverage only if the implementation changes cross-command behavior rather than validator-only behavior.

Required local verification:

- `pnpm run test:unit`
- `pnpm test` when `plan-unit-delivery` integration or runtime wiring changes more than unit-level validator behavior.

Runtime compatibility verification:

- Run `pnpm ax skills validate --all-profiles` or a narrower selected profile set after adding the skill.
- Run the appropriate `pnpm ax update --profile <name>` or `pnpm ax update --all-profiles` command when managed skill, agent, or instruction runtime artifacts need refresh.
- Expect `agent-runtime.lock.json` or runtime managed artifacts to change only when the runtime update command requires it; do not hand-edit runtime lock artifacts.

## Success Criteria

- The skill is discoverable for AI readiness, agent readiness, verification upkeep, hooks, CI, automation, and project upkeep.
- The skill is tooling-neutral and does not privilege one stack.
- The output is structured enough for unattended `plan-unit-delivery` and PR review workflows.
- The first outcome is implementer-applied verification deltas, not direct mutation by the reviewer.
- The helper script validates the report shape.
- Workflow docs make the gate conditional enough to avoid noise and strict enough to catch missing cheap enforcement.
- `plan-unit-delivery` templates, validators, and delivery ledger can launch, skip, validate, and report the conditional AI readiness reviewer mechanically.
- Runtime validation confirms the new skill is compatible with managed skill installation/update paths.
