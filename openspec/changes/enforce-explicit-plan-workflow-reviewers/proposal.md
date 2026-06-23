## Why

Plan workflow commits can still fall through the ordinary no-gate `ax commit`
path when reviewer evidence is implicit, stale, or only described in prose. The
existing local review-gate work gives agents a commit-time validator, but the
workflow needs an explicit phase contract for when a gate is required and which
reviewers must pass.

The durable fix is to make reviewer sets explicit in plan workflow outputs,
bind phase evidence to the staged diff at the commit-owning phase, and add an
`ax commit` mode that fails when workflow commits try to proceed without an
active fresh gate. Local gates remain separate from hosted Nitro review: local
reviewers block commits, while Nitro gates still block stack advancement and
delivery completion.

## What Changes

- Make `plan-ready` emit explicit readiness reviewer evidence for both atomic
  handoffs and OpenSpec blueprints.
- Make `plan-review` consume readiness evidence, bind it to the current staged
  planning diff, arm the local gate, and use a required-gate `ax commit` path
  for planning commits.
- Make `plan-unit-delivery` require explicit implementation reviewer evidence
  for material implementation commits.
- Add a required-gate `ax commit` mode for workflow phases while preserving the
  ordinary no-gate wrapper path for non-workflow commits.
- Keep `plan-orchestrator` limited to validating phase evidence and routing
  stale or missing evidence back to the owning phase.
- Keep hosted `planning_review`, `nitro_feedback_gate`, MR approval, CI or
  no-pipeline inspection, and unsupported-host routing separate from local
  reviewer gates.
- Align skill docs, adapter prompts, root and portable instructions, tests, and
  installed runtime validation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-first-plan-orchestration`: explicit reviewer evidence, commit-owning
  phase boundaries, local gate versus hosted gate separation, and orchestrator
  evidence routing.
- `ax-cli`: required-gate commit mode and post-commit gate consumption behavior
  for workflow-owned review gates.

## Impact

- `skills/plan-ready`, `skills/plan-review`, `skills/plan-unit-delivery`, and
  `skills/plan-orchestrator`
- `scripts/review-gate.ts` and `scripts/ax.ts`
- Plan workflow adapter prompts under affected skills
- `AGENTS.md`, `instructions/AGENTS.md`, and instruction tests
- `tests/unit/*` and `tests/integration/ax-cli.test.ts`
- Runtime profile refresh and validation surfaces
