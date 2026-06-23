## 1. Task-Shape Contract

- [x] 1.1 Define the shared OpenSpec task-shape contract in AI repo rules and
      planning workflow documentation, including deliverable-only tasks,
      lifecycle-phase blocking, documentation exceptions, validation exceptions,
      private support artifact boundaries, and `needs_spec_redesign`.
- [x] 1.2 Extend the existing OpenSpec task parser/classifier surface with one
      shared task-shape classifier and minimized AI repo regression fixtures for
      validation-only tasks, final documentation or validation groups,
      manual-looking proof tasks, valid deliverable tasks with embedded
      verification, and documentation, testing, validation, CI,
      reviewer-tooling, runtime-validation-tooling, and reusable AI workflow
      machinery exceptions, including in-flight specs that either qualify for
      those exceptions or must block with `needs_spec_redesign`.

## 2. Blueprint Prevention

- [x] 2.1 Update `plan-ready` skill instructions, adapter prompt, blueprint
      template, and blueprint validator so generated blueprints use deliverable
      tasks only and reject validation-only or proof-only task entries.
- [ ] 2.2 Update `plan-ready` reviewer selection and readiness review guidance
      so workflow/rule/skill changes select the relevant optional reviewers and
      block lifecycle-phase task shapes before readiness succeeds.

## 3. OpenSpec Review And Delivery Gates

- [ ] 3.1 Update `openspec-tasks` documentation, adapter prompt, audit output,
      parser classification, and tests so existing bad task lists return
      `needs_spec_redesign` without rewriting specs.
- [ ] 3.2 Update `plan-review` documentation, adapter prompt, and validation
      helpers so OpenSpec planning-review publication runs the task-shape audit
      and blocks planning MRs or PRs on `needs_spec_redesign`.
- [ ] 3.3 Update `plan-orchestrator`, `plan-unit-sequencer`, their adapter
      prompts, and any shared stack validation helpers so delivery sequencing
      refuses validation-only tasks and lifecycle-phase cleanup tasks if they
      slip through earlier.

## 4. Reviewer And Agent-Rule Alignment

- [ ] 4.1 Update reviewer role prompts or rubrics so baseline reviewers treat
      validation-only tasks, final documentation/validation phases, checkbox-only
      delivery units, and committed local workflow artifacts as blocking
      planning-readiness findings.
- [ ] 4.2 Update portable agent rules and repo-local instructions so agents do
      not commit local workflow artifacts into work-project repositories while
      still allowing reusable AI repo workflow machinery and regression fixtures.
