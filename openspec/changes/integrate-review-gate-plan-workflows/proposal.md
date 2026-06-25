## Why

The local `ax commit` review-gate foundation exists, but reviewed plan workflow
skills do not yet arm that gate from their reviewer evidence. Without an
explicit phase-owned activation contract, plan workflow commits can still rely
on the ordinary no-gate `ax commit` path and bypass the local reviewer evidence
the workflow is meant to require.

## What Changes

- Normalize `plan-ready` OpenSpec blueprint review metadata so it carries the
  same required and optional reviewer sets as atomic plan handoffs.
- Add private phase-owned gate activation behind `plan-ready` and
  `plan-unit-delivery`.
- Keep `scripts/review-gate.ts` as the only module that serializes gate state,
  hashes staged diffs, resolves Git metadata paths, writes active gates, and
  consumes successful gates.
- Make owning workflow skills fail closed before invoking `ax commit` when
  reviewer evidence, subagents, or gate activation are missing, stale,
  malformed, or blocking.
- Keep `ax commit` non-heuristic: it validates an active gate when present and
  still allows ordinary no-gate commits outside phase-owned workflow commits.
- Keep `plan-orchestrator` out of gate writing; it validates fresh phase
  evidence and routes stale or missing evidence back to the owning phase.
- Update skill docs, adapter prompts, runtime instructions, tests, and installed
  runtime validation for the phase-owned gate contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ax-cli`: local review-gate state writing, validation, and post-commit
  consumption semantics for phase-owned workflow gates.
- `review-first-plan-orchestration`: plan-ready, plan-unit-delivery, and
  plan-orchestrator contracts for reviewer-set normalization, phase-owned gate
  activation, fail-closed workflow commits, and runtime alignment.

## Impact

- `scripts/review-gate.ts` and `scripts/ax.ts`
- `skills/plan-ready`, `skills/plan-unit-delivery`,
  `skills/plan-orchestrator`, and `skills/ax-cli`
- `skills/*/agents/openai.yaml` adapter prompts for affected plan workflow
  skills
- `AGENTS.md`, `instructions/AGENTS.md`, and instruction tests
- OpenSpec and plan workflow unit tests plus AX CLI integration tests
- Runtime lock/profile refresh and validation surfaces
