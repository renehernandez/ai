# Plan Ready And Plan Unit Delivery Split

## Goal

Split the current `plan-unit-delivery` workflow into two focused skills:

- `plan-ready`: turn an idea, plan file, OpenSpec change, or Linear ticket into an implementation-ready plan with reviewed scope and a validated handoff.
- `plan-unit-delivery`: consume a ready handoff and carry the approved slice through implementation, local gates, hosted review feedback, PR/MR, and CI.

The split should make the implementation workflow more deterministic by moving brainstorming and plan hardening out of `plan-unit-delivery`.

Follow-up lane: `plan-to-review` now covers publishing a reviewed plan or OpenSpec change as a planning-only PR/MR for Nitro, Codex, and developer feedback before implementation. It consumes a `plan_review_request` or `plan_ready_handoff`, requires a planning-only diff, waits for routed automated feedback, and stops before coding.

## Motivation

The current `plan-unit-delivery` skill covers both exploratory planning and delivery. That makes it too easy for an agent to blur phases, skip review gates, keep brainstorming during implementation, or finish early after PR creation or review request.

The first iteration should stay minimal. It should add a clear handoff contract and small helper scripts, without persistent workflow state, committed readiness blocks, or a full state machine.

## Scope

Implement the first slice:

- Add `skills/plan-ready/SKILL.md`.
- Add `skills/plan-ready/agents/openai.yaml`.
- Add `skills/plan-ready/scripts/plan-ready.ts`.
- Refactor `skills/plan-unit-delivery/SKILL.md` so it requires a `plan_ready_handoff` before implementation.
- Update `skills/plan-unit-delivery/agents/openai.yaml` with the new invocation shape.
- Add `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts`.
- Update shared rules or `AGENTS.md` only if needed for discoverability.

Do not add persistent state under the repo or under `~/.agents/delivery-gates` in the first slice.

Do not embed readiness handoff blocks in committed plan files, OpenSpec files, or Linear comments by default.

## Skill Boundary

### `plan-ready`

Use `plan-ready` when the request starts from an idea, feature request, plan file, OpenSpec change, Linear ticket, or fuzzy implementation goal that needs to become ready for implementation.

Responsibilities:

1. Inspect live repo context and the planning artifact.
2. Brainstorm or clarify scope when needed.
3. Write or update the authoritative planning artifact:
   - plan file under the project plan location;
   - OpenSpec change through the project OpenSpec workflow;
   - Linear ticket content or linked plan context.
4. Run reviewer selection with an LLM-as-judge step.
5. Run all required plan reviewers as same-harness subagents.
6. Resolve plan-review findings.
7. Run final `scrutinize` on the plan.
8. Emit a `plan_ready_handoff` block.
9. Stop for user verification.

`plan-ready` must not start implementation, invoke `plan-unit-delivery`, create branches, push, open PRs/MRs, or request hosted review.

### `plan-unit-delivery`

Use `plan-unit-delivery` only when a valid `plan_ready_handoff` is available from the current session or the user prompt.

Responsibilities:

1. Validate the handoff.
2. Inspect live repo, branch, remotes, and artifact-host routing.
3. Implement the approved slice.
4. Run local verification.
5. Launch implementation reviewers as internal Codex subagents, immediately report launched reviewers and returned subagent IDs in-session, and validate the launch report.
6. Reconcile reviewer outcomes for implementation review, implementation scrutiny, code quality, simplification, deslop, security when relevant, and docs alignment.
7. Validate the final reviewer outcome report.
8. Create or update the routed GitHub PR or GitLab MR.
9. Run artifact-host review.
10. Wait for routed review feedback on the latest head.
11. Iterate on actionable review or CI failures.
12. Finish only when CI is green or blocked with evidence.

`plan-unit-delivery` must not brainstorm or expand scope. If the handoff is missing, invalid, stale enough to require planning review, or has unresolved blockers, it must stop and ask the user to run `plan-ready`.

## Planning Artifact Modes

Support three artifact modes:

| Mode | Artifact reference | First slice behavior |
| --- | --- | --- |
| Plan file | `docs/plans/<name>.md` or project-specific plan path | Update the plan file, but keep readiness state out of the committed file |
| OpenSpec | `openspec/changes/<change-id>` | Use OpenSpec's proposal/spec/design/tasks workflow; do not add a custom readiness artifact in v1 |
| Linear | Linear issue key or URL | Use the ticket as the planning artifact; do not post the full handoff as a comment by default |

OpenSpec notes:

- OpenSpec's current packaged `spec-driven` schema uses `proposal`, `specs`, `design`, and `tasks`.
- `openspec status --json` reports `applyRequires: ["tasks"]`.
- OpenSpec schema customization exists but is experimental, so v1 should not fork or extend the schema.
- `plan-ready` should validate OpenSpec changes with `openspec validate <change-id> --strict --no-interactive` when applicable.

## Reviewer Selection

`plan-ready` always runs three baseline reviewers as same-harness subagents:

- `implementation-readiness`
- `edge-cases-and-risks`
- `simplification-and-scope-control`

Before reviewer fanout, `plan-ready` runs an LLM-as-judge reviewer-selection step. The judge may select optional reviewers only from this fixed catalog:

- `security-and-auth`
- `data-migration-and-backfill`
- `ci-and-release-impact`
- `frontend-ux-accessibility`
- `infra-and-cloud`
- `docs-and-agent-alignment`
- `performance-and-scale`
- `agent-runtime-and-skill-compatibility`

The judge must return structured output:

```yaml
reviewer_selection_judge:
  verdict: baseline_sufficient | add_optional_reviewers
  baseline_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
  selected_optional_reviewers:
    - <optional-reviewer-name>
  rationale:
    <optional-reviewer-name>: <why this reviewer is needed>
```

The main agent may not remove baseline reviewers or judge-selected optional reviewers. It may add a reviewer from the optional catalog if it records a reason.

Selection rules:

- Select `docs-and-agent-alignment` for changes to reusable workflows, docs, skills, rules, automation prompts, background review expectations, or PR/MR description contracts.
- Select `agent-runtime-and-skill-compatibility` for changes to skill folder structure, skill metadata, bundled scripts, Codex adapter files, same-harness subagent routing, install/update behavior, or agent runtime behavior.
- Validate the judge output before reviewer fanout. The selection is not ready if the judge invents reviewer names or chooses `baseline_sufficient` while listing optional reviewers.
- In Codex, run reviewer agents with the internal Codex subagent tool exposed by the current harness; do not use the `dispatch` skill, Claude Code `Task`, or any external Claude harness for `plan-ready` reviewers.

## Reviewer Output Contract

Each reviewer subagent must return:

```yaml
reviewer: <name>
verdict: pass | findings | blocked
blocking_findings:
  - title: <short title>
    class: agent_fixable | user_decision | external_blocker
    evidence: <concrete evidence>
    required_change: <change required before readiness>
nonblocking_findings:
  - title: <short title>
    evidence: <concrete evidence>
    suggestion: <optional change>
summary: <one paragraph>
```

Finding behavior:

- `agent_fixable`: the agent updates the planning artifact and reruns affected review.
- `user_decision`: the agent asks one focused question and incorporates the answer.
- `external_blocker`: the agent records the blocker and cannot mark the plan ready until it is resolved or the user explicitly accepts the risk.

Plan readiness requires all blocking findings to be resolved or explicitly blocked with evidence.

## Handoff Contract

`plan-ready` emits the handoff only in the final session response. It should not write the handoff into committed planning artifacts by default.

Minimal v1 handoff:

```yaml
plan_ready_handoff:
  status: ready
  artifact_type: plan | openspec | linear
  artifact_ref: <path, change id/path, issue key, or URL>
  approved_slice: <short implementation slice>
  required_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
```

`plan-unit-delivery` accepts only:

- `status: ready`;
- supported `artifact_type`;
- non-empty `artifact_ref`;
- non-empty `approved_slice`;
- known reviewer names;
- `unresolved_blockers: []`;
- `scrutiny_verdict: ship`.

If any required field is missing or invalid, `plan-unit-delivery` blocks before implementation.

## Helper Scripts

Add two dedicated scripts. They may start similar but should remain separate so the skills can evolve independently.

### `skills/plan-ready/scripts/plan-ready.ts`

Initial commands:

- `detect`: print repo root, branch, head SHA, remotes, likely artifact type, OpenSpec presence, and plan-directory hints.
- `reviewer-template`: print baseline reviewers, optional reviewer catalog, and the strict LLM-as-judge output shape.
- `validate-selection`: validate reviewer-selection judge output from stdin or `--file`.
- `handoff-template`: print the minimal `plan_ready_handoff` YAML skeleton.
- `validate-handoff`: validate handoff YAML from stdin or `--file`.

The skill should refer to this as the bundled `scripts/plan-ready.ts` script so installed skills do not assume the target project has a `skills/` directory.

The script must not mutate repo files, post Linear comments, create OpenSpec artifacts, or write persistent state in v1.

### `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts`

Initial commands:

- `detect`: print repo root, branch, head SHA, remotes, artifact-host clues, and cheap PR/MR clues when available.
- `validate-handoff`: validate handoff YAML from stdin or `--file`.
- `reviewer-template`: print the internal Codex reviewer launch report, final reviewer outcome report, and execution rules.
- `validate-launch-report`: validate that all required implementation reviewers were launched, conditional security review is accounted for, and each launched reviewer has a returned subagent id.
- `validate-review-report`: validate that the final reviewer outcome report includes all required implementation reviewers, accounts for conditional security review, and has no unresolved `findings` or `blocked` outcomes before PR/MR creation or final delivery.
- `gate-template`: print the final delivery gate ledger shape.
- `validate-ledger`: validate the final delivery ledger before the agent finishes.

The skill should refer to this as the bundled `scripts/plan-unit-delivery.ts` script so installed skills do not assume the target project has a `skills/` directory.

The script must not create branches, push, open PRs/MRs, request review, or modify files in v1.

## `plan-unit-delivery` Final Gate Ledger

`plan-unit-delivery` should keep the existing final ledger requirement, but treat it as implementation-delivery evidence rather than planning evidence.

Required gates:

- handoff validation
- session-start/live-state inspection
- implementation
- local verification
- reviewer subagents
- implementation review
- implementation scrutiny
- code quality review
- code simplifier
- deslop
- security review when applicable
- docs alignment
- review feedback routing
- artifact creation or update
- artifact-host review
- routed review feedback
- CI

Each gate should be marked `passed` or `blocked` unless the script treats the gate as conditional; `not_applicable` is valid only for conditional gates with one line of evidence.

## Testing Plan

Use `writing-skills` validation before shipping.

Pressure scenarios:

1. Missing handoff: invoke `plan-unit-delivery` with only a fuzzy feature request. It must stop and ask for `plan-ready`.
2. Optional reviewer needed: plan changes skill/runtime behavior. The reviewer-selection judge should add `agent-runtime-and-skill-compatibility` and `docs-and-agent-alignment`.
3. Unresolved blocker: a plan reviewer returns `user_decision`. `plan-ready` must ask the user and must not emit `status: ready` until resolved.
4. Plan-to-implementation boundary: after `plan-ready` emits a valid handoff, it must stop for user verification and must not start coding.
5. Handoff validation: `plan-unit-delivery` receives a handoff with `scrutiny_verdict: fix-then-ship`. It must block before implementation.

## Pressure Test Evidence

- RED: baseline plan-ready subagent `019eb39e-5890-76c0-a967-f287d449de7a` inspected committed pre-edit files and failed as expected. It cited `Using dispatch to run required plan reviewers.`, `Dispatch all baseline reviewers plus judge-selected optional reviewers as subagents.`, and adapter text `run required dispatch plan reviewers`; its rationalization was that explicit `dispatch` would route Codex reviewer execution away from internal Codex subagents.
- RED: baseline plan-unit-delivery subagent `019eb39e-7a2b-7453-81b0-37fb35df9005` inspected committed pre-edit files and failed as expected. It cited `Run local PR/diff review with diff-review`, `Run scrutinize on the implementation diff`, `Run the pre-commit quality gate`, and adapter text `run local verification, implementation review, $scrutinize...`; its rationalization was: `inline helper-skill review satisfies the workflow; nothing says I must launch internal Codex reviewer subagents or report each reviewer's final outcome`.
- GREEN: missing handoff pressure passed. A subagent found that `plan-unit-delivery` requires exactly one valid `plan_ready_handoff`, rejects fuzzy ideas, and tells the user to run `plan-ready` or paste a handoff before implementation.
- RED/GREEN: optional reviewer pressure initially failed because `plan-ready` listed the optional catalog but did not make `docs-and-agent-alignment` and `agent-runtime-and-skill-compatibility` likely enough for skill/runtime changes. The skill and script now include selection rules for reusable workflow/docs/skills/rules changes and skill metadata/script/runtime changes.
- GREEN: reviewer-selection validation now accepts `docs-and-agent-alignment` plus `agent-runtime-and-skill-compatibility`, rejects invented optional reviewer names, and rejects invented baseline reviewer names.
- GREEN: unresolved blocker pressure passed. `plan-ready` requires `user_decision` blockers to ask the user, and both scripts reject handoffs with non-empty `unresolved_blockers`.
- GREEN: phase boundary pressure passed. `plan-ready` stops after handoff and does not invoke `plan-unit-delivery`, start implementation, create branches, push, open PRs/MRs, or request hosted review.
- GREEN: invalid scrutiny pressure passed. `plan-unit-delivery` and its script reject handoffs where `scrutiny_verdict` is not `ship`.
- GREEN: plan-ready routing subagent `019eb361-1adb-7771-a77a-388b11dc4b8b` passed after the routing patch and found Codex should use internal Codex subagents, not dispatch or Claude.
- GREEN/REFACTOR: plan-unit-delivery routing subagent `019eb370-7dce-75d3-97ff-6c80d6406aab` passed the routing intent but found validator loopholes for one-reviewer reports, unresolved `findings`/`blocked`, missing security accounting, one-reviewer examples, and post-feedback inline reruns. The workflow and script now close those gaps.
- GREEN: final plan-unit-delivery subagent `019eb391-6f16-7e03-8744-1e73e0daa807` passed after refactor with `Remaining actionable ambiguity: None.`

Validation outputs:

- `bun skills/plan-ready/scripts/plan-ready.ts validate-selection --file /private/tmp/plan-ready-valid-selection.yaml` -> `reviewer_selection_judge valid`
- `bun skills/plan-ready/scripts/plan-ready.ts validate-handoff --file /private/tmp/plan-ready-valid-handoff.yaml` -> `plan_ready_handoff valid`
- `bun skills/plan-unit-delivery/scripts/plan-unit-delivery.ts validate-launch-report --file /private/tmp/plan-unit-delivery-valid-launch-report.yaml` -> `reviewer_subagent_launch valid`
- `bun skills/plan-unit-delivery/scripts/plan-unit-delivery.ts validate-review-report --file /private/tmp/plan-unit-delivery-valid-review-report.yaml` -> `reviewer_subagent_report valid`
- `bun skills/plan-unit-delivery/scripts/plan-unit-delivery.ts validate-ledger --file /private/tmp/plan-unit-delivery-valid-ledger.yaml` -> `delivery_gate_ledger valid`
- Negative fixtures were rejected for bare reviewer-selection rationale, missing optional-reviewer rationale, missing launch IDs, under-launched reviewer reports, unresolved findings, `implementation-review-agent: not_applicable`, and mandatory ledger gates marked `not_applicable`.
- `bun build skills/plan-ready/scripts/plan-ready.ts --outfile /private/tmp/plan-ready-check.js` and `bun build skills/plan-unit-delivery/scripts/plan-unit-delivery.ts --outfile /private/tmp/plan-unit-delivery-check.js` both bundled successfully.

## Success Criteria

- `plan-ready` produces a concise, valid handoff and stops for user verification.
- `plan-unit-delivery` refuses to implement without a valid handoff.
- Plan review always uses baseline same-harness subagent reviewers.
- Implementation review in Codex uses internal Codex subagents, reports launched reviewers and returned subagent IDs in-session, validates the launch report, and includes validated reviewer outcomes.
- Optional reviewers are selected by LLM judge from the fixed catalog only.
- No readiness state is written into committed plan files, OpenSpec files, or Linear comments by default.
- Helper scripts provide deterministic templates and validation without becoming workflow engines.
- Local validation and skill pressure scenarios pass or report evidence-backed blockers.

## V1 Detail Decisions

- `validate-handoff` should accept both raw YAML and a Markdown fenced code block containing the handoff. The final response from `plan-ready` will usually include a fenced block, so the receiving skill should handle that shape.
- Scripts should use plain TypeScript and Node built-ins in the first slice. Avoid adding parser dependencies unless validation becomes too brittle.
- `plan-unit-delivery` should accept a handoff from the current session or from the user prompt. If it cannot locate exactly one handoff, it should ask the user to paste the handoff explicitly.
- Security review should be conditional in v1. Run it when the implementation changes auth, authorization, secrets, token handling, sensitive data, dependency trust, webhooks, or externally reachable surfaces.

## Residual Risks

- Without persistent state, a different session or machine may not have the handoff. The correct fallback is to rerun `plan-ready` or paste the handoff, not to infer readiness from the artifact alone.
- Without a real YAML parser dependency, script validation may need to stay conservative. If parsing fenced handoffs becomes fragile, add a small dependency in a later slice.
- Since readiness is not committed, background agents and reviewers will see the plan content but not the local readiness proof. That is intentional for v1 to avoid review noise.
