## 1. Skill Contract And POC Artifact Rules

- [ ] 1.1 Add the `plan-poc` skill contract, required input shape, and draft artifact boundary.
  - First real confirmation: the `plan-poc` workflow command runs against a sample OpenSpec change and reports draft-only POC output that includes the OpenSpec files, marks the hosted artifact as review-only, and refuses merge or POC commit reuse as final delivery.
- [ ] 1.2 Add the first POC state template or helper for one draft artifact and one referenced OpenSpec change.
- [ ] 1.3 Add focused contract coverage for draft state, `POC:` title, OpenSpec inclusion, and non-merge body language.

## 2. POC Implementation Loop

- [ ] 2.1 Add POC branch task-state rules that mark only contextual work items for the current POC unit.
- [ ] 2.2 Add latest-head routed feedback checkpoints after material POC pushes and feedback-fix pushes.
- [ ] 2.3 Add fixtures for two POC units completed in one draft artifact with reviewer checkpoints between pushes.

## 3. Learning Summary And Closure

- [ ] 3.1 Add the `poc_learning_summary` contract with delivery-source and commit-reuse fields.
- [ ] 3.2 Add unmerged draft artifact closure guidance and summary emission rules.
- [ ] 3.3 Add coverage that rejects missing `delivery_source: revised_openspec` or `poc_commits_reused: false`.

## 4. Runtime Alignment And Regression Coverage

- [ ] 4.1 Update runtime-facing prompts and repo rules so `plan-poc` stays an opt-in review rehearsal.
- [ ] 4.2 Add drift checks that prevent `plan-poc` from being treated as normal mergeable implementation delivery.
- [ ] 4.3 Preserve normal `plan-orchestrator` stack-ready routing and private support artifact boundaries in tests.
