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
- Accepted implementation work includes direct user requests to implement, fix,
  build, apply a plan, or deliver review-feedback changes, plus approved plan
  workflow delivery units. It excludes brainstorming, planning, OpenSpec
  proposal creation, `plan-ready` output, planning review, troubleshooting-only
  findings, and review-only work until the user or workflow enters an
  implementation or delivery step.
- After accepted implementation work is complete, verify the change, stage only
  the intended files, commit on the feature branch, push to the selected
  hosted-review remote, create or update a PR/MR when the project has a
  hosted-review workflow, inspect CI or no-pipeline state, and follow
  branch-caused review or CI feedback through to closure. Select the
  hosted-review provider before pushing, and push only to that provider's remote
  or URL when a configured remote fans out to multiple hosts.
- Before any agent-authored work is published by pushing, creating or updating a
  PR/MR, or direct publication, run the final personal publication checkpoint
  against the branch diff and exact HEAD SHA. Record target base, diff scope,
  HEAD SHA, reviewer outcome, and any blocking findings in private thread or
  support evidence unless the project workflow already requires reviewer-facing
  evidence. If the checkpoint is missing, stale, tied to a different HEAD, or
  reports unresolved blockers, pause before publishing. This checkpoint is a
  personal workflow boundary and does not replace hosted review, CI, Nitro,
  MR/PR approval, or project gates.
- Pause instead of publishing when the diff contains secrets, unrelated user
  changes, generated noise, unresolved product or safety decisions, or ambiguous
  hosted-review provider routing. If verification is blocked by external state
  or missing local tooling and no product, safety, or routing decision is
  pending, publish only after disclosing the limitation in the hosted review
  artifact or final handoff.
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
  ledgers, reports, validation inputs, and validation outputs must not be
  committed and must stay in thread evidence by default. When file-backed
  recovery or correlation is needed, use the private plan-artifact workflow
  owned by the `ax-cli` steering skill. Do not commit `.agents/plans/**` support
  sidecars.
- Do not stage or commit local workflow artifacts into work-project
  repositories. Reviewer scratch, readiness reports, reviewer reports, delivery
  ledgers, screenshots, command proof, validation evidence, rejected generated
  shapes, and private plan-support pointers belong in the chat thread or
  private plan-support storage. Reusable AI repo workflow machinery, managed
  agent rules, skills, validators, runtime scripts, and regression fixtures may
  be committed only in the AI project that owns them and only when that
  machinery is the feature being changed.
- Portable shared skills must not depend on repo-root workflow scripts, private
  runtime paths, or `runtime.reusableScripts`. Package helper logic inside the
  owning skill folder, or use a real package dependency, so the skill remains
  reusable on its own.

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
