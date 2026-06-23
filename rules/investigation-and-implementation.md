# Investigation and Implementation Rules

These rules govern when to diagnose, when to edit, and how to route implementation work.

## Troubleshooting and Investigation

- When the user is troubleshooting, investigating, or debugging an issue, do not take action such as committing, pushing, editing files, or running fixes before presenting findings and asking how to proceed.
- Troubleshooting mode means analyze, diagnose, and report, then wait for the user's decision before acting.
- This applies even when the fix seems obvious.
- If the failure may come from Codex runtime, hooks, plugins, or automation state, inspect `~/.codex` runtime configuration such as `config.toml`, cached plugin hook definitions, and runtime automation artifacts before changing repo files. Do not assume the fault is in the current workspace just because the symptom appeared there.

## Brainstorming and Design Sessions

- When the user wants to brainstorm, design, or think through a problem, always use the `/brainstorm` skill.
- Do not load the lower-level `brainstorming` skill directly for these requests.
- This applies in plan mode and normal mode.
- When the user says they dislike a proposed name, structure, taxonomy, folder
  layout, API shape, or other design choice, treat it as a request for
  alternatives and tradeoffs. Do not rename, restructure, or otherwise apply
  the change unless the user explicitly asks for implementation.

## Code Implementation

- When the user asks to implement, fix, build, or apply changes, work in the current agent session by default.
- Skills and workflows may delegate to available local, cloud, or custom subagents when they define a bounded implementation, exploration, or verification lane.
- Do not refer to retired agent names or require a subagent that is not available in the current harness.
- For implementation work that needs planning, review-first delivery, stacked PRs/MRs, or multi-step coordination, use `plan-orchestrator` and its related plan workflow skills.
- Do not commit or push non-feature implementation work unless the user explicitly asks or the approved plan requires it.
- In plan-to-OpenSpec conversion, `.agents/plans/**` files are scratch intake.
  Delete the source plan only after the OpenSpec change is created, strict
  validation passes, and repo-local OpenSpec scaffolding validation passes when
  available. Preserve it when creation or validation fails. If the source plan
  is already committed, block and repair the branch instead of publishing a
  deletion-only source-plan diff. For `artifact_type: openspec`, the
  planning-review diff must contain no `.agents/plans/**` paths.
- For `artifact_type: plan`, only the primary atomic plan markdown document
  under `.agents/plans/**` is a valid reviewed planning artifact. Support
  sidecars such as review requests, reviewer selections, handoffs, blueprints,
  ledgers, reports, validation inputs, and validation outputs must stay in
  thread evidence by default. When file-backed recovery or correlation is
  needed, record them with `pnpm ax plans artifact record` and recover them with
  `pnpm ax plans artifact list`; do not commit `.agents/plans/**` support
  sidecars.
- Do not stage or commit local workflow artifacts into work-project
  repositories. Reviewer scratch, readiness reports, reviewer reports, delivery
  ledgers, screenshots, command proof, validation evidence, rejected generated
  shapes, and private plan-support pointers belong in the chat thread or
  private plan-support storage. Reusable AI repo workflow machinery, managed
  agent rules, skills, validators, runtime scripts, and regression fixtures may
  be committed only in the AI project that owns them and only when that
  machinery is the feature being changed.

## Local Code Review

- When the user asks to review local changes, review their changes, review the working tree, or self-review, use the relevant review skill in the current session.
- For broad or high-risk reviews, skills may launch available local, cloud, or custom subagents for independent review lanes, then reconcile findings in the parent thread.
- Do not refer to retired agent names or require a subagent that is not available in the current harness.

## Compound Step

- Invoke the `/compound` skill at the end of substantive implementation, troubleshooting, brainstorming, or design work when non-obvious learnings should be captured.
- Also invoke `/compound` at the end of a substantive session when the user says they are done, such as `that's it`, `thanks`, `wrap up`, or `done for now`.
- Keep the compound step brief.
- Skip it when the work was trivial, such as a single typo fix or small config tweak, or when no non-obvious learning was produced.
- Respect the user's request to skip compound.
