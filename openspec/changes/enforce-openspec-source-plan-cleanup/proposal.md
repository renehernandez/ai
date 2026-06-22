## Why

Plan-to-OpenSpec conversion currently leaves an ambiguous boundary between the
temporary `.agents/plans/**` intake artifact and the durable OpenSpec change.
When the source plan remains staged, committed, or published beside the
OpenSpec change, reviewers and future agents can treat a scratch plan as
review evidence even though OpenSpec owns the proposal, design, specs, and task
state after materialization.

## What Changes

- Treat `.agents/plans/**` source plans as scratch intake artifacts in the
  plan-to-OpenSpec path.
- Require `plan-orchestrator` to delete the primary source plan only after the
  OpenSpec change is created and strict validation passes.
- Preserve the source plan when OpenSpec creation or validation fails.
- Block plan-to-OpenSpec publication when the primary source plan has already
  been committed.
- Require `plan-review` to reject `artifact_type: openspec` planning diffs that
  contain any `.agents/plans/**` path.
- Keep atomic plan review behavior unchanged for `artifact_type: plan`.
- Verify updated skill docs, prompts, scripts, tests, and runtime surfaces.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-first-plan-orchestration`: add source-plan cleanup and OpenSpec
  planning-diff invariants to the reviewed planning workflow.
- `ax-cli`: require runtime validation to prove installed planning skills and
  prompts agree on the source-plan cleanup contract.

## Impact

- `skills/plan-orchestrator` instructions, agent prompt, helper scripts, and
  tests.
- `skills/plan-review` instructions, agent prompt, helper scripts, and tests.
- OpenSpec specs for reviewed planning orchestration and runtime validation.
- Runtime skill validation and installed skill refresh evidence for personal
  and work profiles.
