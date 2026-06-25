## Why

The review-first planning workflow currently maps each deliverable OpenSpec
checkbox to its own implementation MR. That preserves auditability, but recent
plan delivery produced a 32-MR stack, making review, CI, Nitro feedback, and
merge follow-through too expensive for the value of each individual artifact.

The workflow needs a phase-based delivery contract: one MR per reviewable phase,
with nested sub-tasks recorded as commit-sized progress evidence inside that
phase MR.

## What Changes

- Change OpenSpec delivery semantics from "one MR per deliverable checkbox" to
  "one MR per phase" for review-first plan orchestration.
- Define phase quality rules: one reviewable outcome, usually 2-6 sub-tasks,
  more than 6 and at most 8 sub-tasks as a split smell requiring an explicit
  `Justification:` note, and more than 8 sub-tasks as an unconditional
  planning-readiness blocker.
- Add merge-smell rules for tiny one-sub-task phases that are not independently
  risky, independently deployable, or large enough to review alone.
- Make `openspec-tasks` the shared source of truth for phase/sub-task parsing,
  phase sizing, merge-smell detection, legacy-flat compatibility, and
  lifecycle-only task blocking.
- Update `plan-ready`, `plan-review`, `plan-orchestrator`,
  `plan-unit-sequencer`, `plan-unit-delivery`, stack-state helpers, adapter
  prompts, and related tests to consume the shared phase model.
- Require planning review and implementation MR descriptions to expose phase
  count, sub-task count, selected phase, completed sub-tasks, and phase-delta
  evidence.
- Preserve existing planning review, Nitro, CI, implementation reviewer, stack
  integrity, and resume gates.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-first-plan-orchestration`: OpenSpec implementation stacks use
  phase-based delivery units, phase/sub-task task-state validation, and
  phase-aware review artifact evidence instead of one implementation MR per
  deliverable checkbox.

## Impact

- Affected skills: `skills/plan-ready`, `skills/openspec-tasks`,
  `skills/plan-review`, `skills/plan-orchestrator`,
  `skills/plan-unit-sequencer`, `skills/plan-unit-delivery`, and their adapter
  prompts.
- Affected shared helpers: OpenSpec task parsing/classification, stack-state
  validation, plan workflow validators, task-delta validation, resume
  validation, and stack-ready validation.
- Affected guidance: `rules/docs-and-specs.md`, repo-local agent instructions
  where they describe plan delivery, planning MR body expectations,
  implementation MR body expectations, and change-request body guidance.
- Affected tests: blueprint validation fixtures, task-shape audit fixtures,
  phase-delta fixtures, resume/stack-ready fixtures, prompt/template contract
  assertions, and legacy flat-task compatibility fixtures.
