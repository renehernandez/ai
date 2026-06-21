## Why

`plan-orchestrator` currently carries two implementation continuation modes and
does not make latest-head automated feedback closure a hard sequencing gate.
That has led agents to stop early, resume incompletely, or move to later tasks
before the current MR is fully reviewed.

## What Changes

- **BREAKING**: Remove `ship_then_continue` and `stack_when_ready` from the plan
  workflow and replace them with one `stacked_delivery` mode.
- Require one planning MR for each single plan file or OpenSpec change before
  implementation starts.
- Require one stacked implementation MR for an atomic plan, or one stacked
  implementation MR per OpenSpec deliverable task.
- Make Fullscript GitLab plus Nitro the only supported hosted-review route for
  this first cut; unsupported hosts return `nitro_route_unsupported`.
- Add a shared `nitro_feedback_gate` contract for request evidence,
  review-start acknowledgement, review completion, stale feedback, actionable
  findings, and non-actionable rationale.
- Require fresh Nitro feedback after every material head-changing push.
- Require `stack_ready` completion to prove Nitro feedback closure for the
  planning MR and every implementation MR in the stack.
- Update shared repo rules, installed instructions, plan skills, adapter
  prompts, validators, tests, and runtime refresh expectations.

## Capabilities

### New Capabilities

- `review-first-plan-orchestration`: stacked plan delivery, reviewed planning
  handoffs, Nitro-only feedback gates, and stack-ready completion semantics.

### Modified Capabilities

None.

## Impact

- `skills/plan-orchestrator`, `skills/plan-review`,
  `skills/plan-unit-sequencer`, `skills/plan-unit-delivery`,
  `skills/plan-ready`, `skills/review-feedback-routing`, and
  `skills/nitro-review-feedback`.
- `scripts/planning-contracts.ts` and planning skill helper scripts.
- Plan workflow adapter prompts and unit tests.
- `AGENTS.md`, `instructions/AGENTS.md`, and `rules/feature-delivery.md`.
- Runtime skill update/status/validation for personal and work profiles.
