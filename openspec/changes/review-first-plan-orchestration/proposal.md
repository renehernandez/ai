## Why

Plan workflow skills currently blur readiness, planning review, sequencing, and
implementation. That makes it possible to start implementation from an
unreviewed plan or OpenSpec change, and the current skill names no longer match
the desired responsibilities.

## What Changes

- Make `plan-orchestrator` the top-level entrypoint from fuzzy idea or plan
  request to completed delivery when no blockers appear.
- Rename the current implementation sequencing responsibilities to
  `plan-unit-sequencer`.
- Rename `plan-to-review` to `plan-review` and make it emit the reviewed
  planning handoff consumed before implementation.
- Require a planning-only PR or MR before implementation for both atomic plans
  and OpenSpec changes.
- Update `plan-ready` and `plan-unit-delivery` so their contracts align with
  review-first planning.
- Add shared planning-contract validation helpers to avoid duplicating YAML
  parsing and handoff validation across plan skills.
- Update Agents Experience skill installation so renamed skills do not leave stale
  installed old-name surfaces callable.

## Capabilities

### New Capabilities

- `review-first-plan-orchestration`: end-to-end plan workflow orchestration,
  mandatory planning review, reviewed-planning handoff, implementation unit
  sequencing, and stale installed skill cleanup.

### Modified Capabilities

None.

## Impact

- `skills/plan-orchestrator` becomes the top-level workflow skill.
- `skills/plan-unit-sequencer` owns implementation unit selection and sequence
  state after planning review.
- `skills/plan-to-review` moves to `skills/plan-review`.
- `skills/plan-ready` and `skills/plan-unit-delivery` update their contracts for
  review-first delivery.
- Plan skill scripts and tests gain shared planning-contract helpers.
- Repo-level agent rules document the hosted planning-review exception to
  direct-publish guidance.
- `scripts/ax.ts`, `agent-runtime.lock.json`, and integration tests
  cover cleanup of stale installed skill names after renames.
