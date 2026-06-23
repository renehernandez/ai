## Why

The review-first planning workflow has repeatedly turned routine proof work into
OpenSpec delivery tasks. Final groups such as `Documentation And Validation`
create checkbox-only PRs or MRs for checks that should be verification gates on
real deliverables.

## What Changes

- Add shared task-shape rules for deliverable-only OpenSpec tasks, lifecycle
  phase blocking, documentation exceptions, validation exceptions, and private
  support artifact boundaries.
- Add one canonical task-shape classifier used by blueprint validation,
  `tasks.md` audit, planning review, and delivery sequencing.
- Update `plan-ready` so generated blueprints reject validation-only and
  proof-only tasks before OpenSpec files are created.
- Update existing-spec gates so `openspec-tasks`, `plan-review`,
  `plan-orchestrator`, and `plan-unit-sequencer` block bad task shape with
  `needs_spec_redesign`.
- Align reviewer rubrics, adapter prompts, portable rules, and repo-local
  instructions so local workflow artifacts stay out of work-project repos.

## Capabilities

### New Capabilities

### Modified Capabilities

- `review-first-plan-orchestration`: OpenSpec planning and delivery must reject
  validation-only tasks, lifecycle-phase groups, and committed local workflow
  artifacts unless the change is specifically about that area.
- `ax-cli`: Runtime validation requirements must cover changed shared skills,
  instructions, rules, adapter prompts, and reusable script imports for the
  configured profiles.

## Impact

- Affected skills: `skills/plan-ready`, `skills/openspec-tasks`,
  `skills/plan-review`, `skills/plan-orchestrator`,
  `skills/plan-unit-sequencer`, and their adapter prompts.
- Affected shared helpers: OpenSpec task parsing/classification, stack-state
  validation, and plan workflow validators.
- Affected guidance: root and portable agent instructions, shared rules, and
  reviewer rubrics.
- Affected tests: AI repo unit fixtures for bad task shape and valid
  workflow-area-as-feature exceptions.
