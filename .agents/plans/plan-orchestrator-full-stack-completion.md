# Plan Orchestrator Full Stack Completion

## Goal

Make `$plan-orchestrator` mean exactly one delivery outcome: the full reviewed
stack is ready. Invoking the orchestrator must continue through every
deliverable OpenSpec task, producing the full stack of PRs or MRs, or stop only
with a blocker that explains why the stack cannot continue.

## Problem

The current stacked-delivery workflow removed legacy delivery modes, but it
still allows the orchestrator to complete after one implementation unit because
`plan-unit-sequencer` has a valid `next_task` route. That lower-level route is
useful when the sequencer is invoked directly, but it is unsafe as the default
for `$plan-orchestrator`.

The failure mode is:

1. A user invokes `$plan-orchestrator` on a multi-task OpenSpec change.
2. The workflow completes planning review correctly.
3. The sequencer selects and delivers task `1.1`.
4. The thread reports success even though tasks `1.2+` remain unchecked.

That makes a partial stack look like a complete orchestration run.

## Decisions

- `$plan-orchestrator` always uses a full-stack delivery goal.
- `$plan-orchestrator` never exposes or selects `next_task` or
  `bounded_sequence`.
- `plan-unit-sequencer` may keep `next_task` and `bounded_sequence` only for
  direct invocation outside the orchestrator.
- Orchestrator success is `stack_ready`, not "complete" or "shipped".
- `stack_ready` is valid only when every deliverable OpenSpec task is checked
  at the current stack tip and every stack artifact has passed required gates.
- If deliverable tasks remain, the only valid orchestrator states are
  continuing or blocked with evidence.
- Resume always verifies predecessor tasks and artifacts before selecting the
  next unchecked task.

## Scope

In scope:

- Update `skills/plan-orchestrator` instructions, adapter prompts, templates,
  scripts, and tests so the orchestrator always requires full-stack delivery.
- Update `skills/plan-unit-sequencer` instructions, adapter prompts, scripts,
  and tests so direct invocation may use one-task routes, but orchestrator
  invocation always loops until full stack readiness or a blocker.
- Update `skills/plan-unit-delivery` handoff and ledger guidance as needed so
  predecessor verification has enough task-delta, stack, CI, and Nitro evidence.
- Audit and update `skills/plan-ready` and `skills/plan-review` instructions,
  adapter prompts, and handoff wording so they route into orchestrator-owned
  full-stack delivery rather than implying bare sequencer continuation.
- Update shared planning contract helpers and validators for stack readiness,
  resume validation, and incomplete-stack rejection.
- Extract or add shared stack-state helpers for stack artifacts, task inventory,
  gate evidence, and task-delta validation so orchestrator, sequencer, and
  delivery scripts consume the same evidence semantics.
- Add regression tests for partial task completion, stale predecessor state,
  invalid cumulative task state, and successful full-stack readiness.
- Audit and update `AGENTS.md`, `instructions/AGENTS.md`,
  `rules/feature-delivery.md`, and any normative plan references whose wording
  conflicts with full-stack orchestration through `stack_ready` or
  `delivery_blocked`.
- Update installed agent prompts or runtime skill assets affected by the
  contract change.
- Ensure reusable runtime scripts include every shared script imported by
  installed planning skills. `plan-review` and `plan-unit-delivery` currently
  import `scripts/nitro-feedback-gate.ts` in both the repo-local and installed
  runtime copies. If an installed helper resolves only because an unmanaged file
  happens to exist under a runtime scripts directory, while
  `agent-runtime.config.json` does not declare it in `reusableScripts`, runtime
  refresh must make that helper managed or remove the imports.
- Run `writing-skills` review before delivery because this changes shared agent
  behavior.
- Refresh installed runtime skill surfaces after implementation so the live
  machine uses the updated workflow contract.

Out of scope:

- Merging the ready stack after `stack_ready`.
- Removing direct `plan-unit-sequencer` support for `next_task`.
- Changing OpenSpec's core schema.
- Building a generic PR or MR stack manager.
- Supporting non-reviewed direct publish as an orchestrated delivery path.

## Required Behavior

### Orchestrator Full Stack Loop

`$plan-orchestrator` must:

1. Run readiness and planning review as it does today.
2. Materialize OpenSpec changes when `plan-ready` emits an
   `openspec_blueprint`.
3. Validate planning review before implementation sequencing.
4. Invoke `plan-unit-sequencer` with an orchestrator-owned full-stack delivery
   context.
5. Deliver one implementation unit at a time through `plan-unit-delivery`.
6. After each unit reaches passed latest-head CI and Nitro gates, inspect the
   current stack tip again.
7. Continue selecting the next unchecked deliverable task until no deliverable
   task remains unchecked.
8. Emit `stack_ready` only after the full stack validates.

The orchestrator must not mark the active goal complete after one task unless
the whole OpenSpec change has exactly one deliverable task.

### Completion States

Valid orchestrator terminal states:

- `stack_ready`: the full stack is ready for merge follow-through.
- `delivery_blocked`: the workflow cannot continue without a fix, external
  action, or human decision.

Invalid terminal states:

- Success after one OpenSpec task when later deliverable tasks remain.
- "Complete" wording without a validated `stack_ready` contract.
- "Shipped" wording for an unmerged stack.
- Goal completion while stack-tip `tasks.md` has unchecked deliverable tasks.

### Stack Ready Validation

`stack_ready` validation must require:

- Planning review artifact exists and has passed the latest required gates.
- Every implementation artifact in stack order exists.
- Every deliverable OpenSpec task is checked at the current stack tip.
- No future task is checked without its own implementation artifact.
- Each implementation artifact corresponds to exactly one expected deliverable
  task checkbox delta.
- Every implementation artifact has passed latest-head CI and Nitro gates.
- Stack base/head relationships prove each artifact descends from its
  predecessor.
- `restack_required` is false.
- Any manual or external task is either completed with evidence or reported as
  blocking.

The validator must not trust self-attested booleans such as
`all_deliverable_tasks_checked: true`. It must read or receive concrete
stack-tip `tasks.md` content or a path to that content, parse the deliverable
task inventory, and compare that inventory with structured implementation
artifact evidence.

Each implementation stack entry for an OpenSpec task must include:

- selected task ID;
- predecessor artifact or base ref;
- selected task base SHA;
- implementation artifact URL or ref;
- implementation artifact head SHA;
- task-delta validation evidence from the shared task-delta checker;
- latest-head CI evidence;
- latest-head Nitro evidence;
- restack state.

### Incomplete Stack Rejection

If task `1.1` is checked and task `1.2` is unchecked, the validator must reject
`stack_ready` and any goal-completion output. The valid result is an in-progress
state that continues with task `1.2`, or `delivery_blocked` if a predecessor or
external gate blocks progress.

### Resume Predecessor Verification

Before resuming from a partially delivered stack, `$plan-orchestrator` must
inspect and verify the full predecessor chain:

- Each previously checked deliverable task has a corresponding implementation
  PR or MR in stack order.
- Each predecessor artifact still has passed latest-head CI and Nitro feedback.
- Each predecessor task delta is valid against its base: exactly the expected
  task changed from unchecked to checked.
- The current stack tip contains cumulative task state: prior tasks checked,
  future deliverable tasks unchecked.
- Earlier artifacts have not changed after descendants were created, unless
  descendants were restacked and their gates rerun.

If any predecessor is missing, stale, failed, restacked without fresh gates, or
inconsistent with `tasks.md`, the orchestrator must stop as `delivery_blocked`.
It must not select the next unchecked task until predecessor verification
passes.

Resume validation must split inspected state from continuation state:

- `resume_ready`: predecessor artifacts, task deltas, CI, Nitro, cumulative
  task state, and restack evidence all pass, so the next task can be selected.
- `delivery_blocked`: any predecessor or stack evidence is missing, stale,
  failed, pending, or inconsistent.

Budget exhaustion, token exhaustion, or session handoff is not success. If the
workflow cannot keep running in the current session, it must stop as
`delivery_blocked` with durable resume evidence and must not mark the active
goal complete. Resume evidence must classify whether the halt is immediately
retryable session exhaustion or an external blocker requiring user or system
action, so retry can resume from the latest verified stack state without
mislabeling normal exhaustion as a failed predecessor gate.

### Direct Sequencer Invocation

`plan-unit-sequencer` can still support direct goals:

- `next_task`
- `bounded_sequence`
- `complete_change`

But those goals are direct sequencer concerns only. When the caller is
`plan-orchestrator`, the sequencer must receive an explicit full-stack context
and behave as `complete_change`.

## Implementation Tasks

### 1.1 Tighten orchestrator contract and host preflight

Update `skills/plan-orchestrator/SKILL.md`, adapter prompts, and script
templates so `$plan-orchestrator` always drives full-stack delivery and can
finish only with `stack_ready` or `delivery_blocked`. Add a host-capability
preflight that proves the repository can provide the required stack host, CI
source, and Nitro/review gates before entering the full-stack loop.

Acceptance:

- Orchestrator docs state there is no user-facing option for partial delivery.
- Adapter prompts require full stack delivery for OpenSpec-backed requests.
- Legacy success wording is removed or constrained behind validated
  `stack_ready`.
- `plan-orchestrator/SKILL.md` explicitly introduces `delivery_blocked` as an
  orchestrator-level terminal state instead of leaving the term only in the
  sequencer vocabulary.
- The orchestrator prompt says it invokes the sequencer in full-stack
  orchestrator mode and cannot accept sequencer `next_task` completion as
  terminal success.
- Unsupported stack/review hosts produce `delivery_blocked` with routing
  evidence instead of fallback delivery.

Verification:

- `pnpm agent-runtime skills validate --profile personal`
- `pnpm agent-runtime skills validate --profile work`

### 1.2 Define shared stack-state evidence helpers

Add or extract shared helpers under `scripts/planning-contracts.ts` or a focused
sibling module for stack artifacts, task inventory, gate evidence, and
task-delta validation. Reuse those helpers from orchestrator, sequencer, and
delivery scripts.

Acceptance:

- Shared parsing covers OpenSpec deliverable task inventory from `tasks.md`.
- Shared task-delta validation is used by both delivery and resume/stack-ready
  validation.
- Shared stack artifact parsing records task ID, artifact ref, head SHA, gate
  evidence, predecessor, and restack state.
- Existing delivery task-delta behavior is preserved.

Verification:

- `pnpm test`
- Targeted tests proving delivery and resume reject the same invalid task
  deltas

### 1.3 Add full-stack completion validation

Extend `skills/plan-orchestrator/scripts/plan-orchestrator.ts` and shared
planning contracts so `validate-stack-ready` rejects incomplete OpenSpec task
state and missing stack evidence without trusting self-attested completion
booleans.

Acceptance:

- `stack_ready` requires parsed stack-tip `tasks.md` evidence with no unchecked
  deliverable tasks.
- Each implementation artifact names its selected task ID and task-delta
  evidence.
- A fixture with task `1.1` checked and task `1.2` unchecked is rejected.
- A fixture with all deliverable tasks checked and matching stack evidence is
  accepted.
- A fixture with a checked future task but no matching implementation artifact
  is rejected.

Verification:

- `pnpm test`
- Targeted unit tests for `validate-stack-ready`

### 1.4 Split direct sequencer goals from orchestrator goals

Update `skills/plan-unit-sequencer` instructions, scripts, adapter prompts, and
tests so direct invocation can still select one task, but orchestrator
invocation always uses full-stack sequencing. Add a concrete caller/goal
contract such as `caller: direct | plan_orchestrator` and
`goal: next_task | bounded_sequence | complete_change`.

Acceptance:

- Direct `plan-unit-sequencer` can still produce one-task handoffs.
- Orchestrator-originated sequencing cannot stop after one task while
  deliverable tasks remain.
- The selected task report includes whether the caller is direct sequencer or
  orchestrator full-stack mode.
- `caller: plan_orchestrator` cannot emit a terminal complete state while
  unchecked deliverable tasks remain.

Verification:

- `pnpm test`
- Targeted sequencer tests for direct and orchestrated routes

### 1.5 Add resume predecessor verification

Extend resume templates, validators, and instructions so continuation verifies
the predecessor stack before selecting the next unchecked deliverable task.

Acceptance:

- Resume state records predecessor artifacts, task IDs, head SHAs, gate
  outcomes, task-delta evidence, and restack evidence.
- Resume validation rejects a checked predecessor task without matching
  implementation artifact evidence.
- Resume validation rejects stale or failed predecessor gates.
- Resume validation rejects non-cumulative `tasks.md` state.
- Resume validation emits `resume_ready` only when predecessor verification
  passes and emits `delivery_blocked` otherwise.

Verification:

- `pnpm test`
- Targeted resume validator tests

### 1.6 Preserve one-unit delivery evidence

Update `skills/plan-unit-delivery` handoff and ledger guidance so each delivered
unit exposes the evidence needed by predecessor verification.

Acceptance:

- Delivery output records selected task ID, implementation artifact URL,
  implementation head SHA, task-delta validation evidence, CI evidence, Nitro
  evidence, predecessor artifact, and restack state.
- Delivery cannot mark a selected task complete in a follow-up bookkeeping-only
  commit.
- Delivery ledger includes `selected_task_base_sha`, implementation artifact
  head SHA, task-delta validation command/output, and hosted artifact URL.
- Delivery remains limited to exactly one approved unit.

Verification:

- `pnpm agent-runtime skills validate --profile personal`
- `pnpm agent-runtime skills validate --profile work`
- Existing delivery validator tests

### 1.7 Align plan-ready, plan-review, docs, and rules

Audit and update planning-adjacent skills and normative instructions so they
describe the same full-stack orchestration contract.

Acceptance:

- `skills/plan-ready` and `skills/plan-review` either receive necessary wording
  and adapter prompt updates or have explicit no-change evidence.
- `AGENTS.md`, `instructions/AGENTS.md`, and `rules/feature-delivery.md` are
  audited for stale wording around plan orchestration, stacked sequencing,
  terminal success, and direct publish exceptions.
- Normative references align on `stack_ready` or `delivery_blocked` as
  orchestrator terminal states.

Verification:

- `pnpm agent-runtime instructions validate --profile personal`
- `pnpm agent-runtime instructions validate --profile work`
- `pnpm agent-runtime skills validate --profile personal`
- `pnpm agent-runtime skills validate --profile work`

### 1.8 Update regression coverage and examples

Add fixtures and tests covering the original failure mode and the new resume
gate.

Acceptance:

- Partial OpenSpec stack cannot validate as `stack_ready`.
- Goal-completion fixture with remaining tasks is rejected or classified as
  incomplete.
- Resume after task `1.1` verifies task `1.1` before selecting task `1.2`.
- Resume with stale predecessor Nitro or CI gates blocks.
- Direct sequencer `next_task` behavior remains valid outside orchestrator.
- Host capability failure blocks before the full-stack loop.
- Budget or session handoff cannot be reported as success while stack work
  remains.

Verification:

- `pnpm test`
- `pnpm biome:check:all` or scoped formatting checks if broad repo formatting
  has unrelated drift

### 1.9 Validate agent behavior and refresh runtime

Run the shared agent-behavior review and refresh installed skill surfaces after
the implementation is complete.

Acceptance:

- A recorded `writing-skills` review passes or its findings are addressed
  before runtime refresh.
- Installed runtime skill copies are refreshed for relevant profiles.
- Runtime status confirms the active skill surfaces point at the updated
  durable checkout.
- Installed script execution checks pass for touched planning skills, including
  `~/.agents/skills/plan-orchestrator/scripts/plan-orchestrator.ts detect`,
  `~/.agents/skills/plan-unit-sequencer/scripts/plan-unit-sequencer.ts detect`,
  and `~/.agents/skills/plan-unit-delivery/scripts/plan-unit-delivery.ts
  detect` or equivalent supported commands.
- Reusable runtime scripts include every shared script imported by installed
  planning skills. Because `plan-review` and `plan-unit-delivery` currently
  import `scripts/nitro-feedback-gate.ts`, runtime refresh must either install
  that helper beside installed skill roots or refactor the installed scripts so
  the import is no longer required. If the helper resolves only from an
  unmanaged file under a runtime scripts directory, this task converts
  accidental availability into managed refresh behavior.

Verification:

- `pnpm agent-runtime skills update --profile personal`
- `pnpm agent-runtime skills update --profile work`
- `pnpm agent-runtime skills status --profile personal`
- `pnpm agent-runtime skills status --profile work`
- `pnpm agent-runtime skills validate --profile personal`
- `pnpm agent-runtime skills validate --profile work`

## Risks

- The orchestrator may become a long-running workflow that spans many MRs and
  large token budgets. The correct mitigation is resumable state validation,
  not partial-success wording.
- Stack evidence can become noisy. Validators should require the minimum fields
  needed to prove predecessor order, task deltas, and latest-head gates.
- Direct sequencer behavior could accidentally leak back into orchestrator
  behavior. Tests must cover the caller/context boundary explicitly.
- Some repositories may not support reviewed stacks. Those routes should stop
  as `delivery_blocked` with routing evidence, not silently fall back to direct
  delivery.

## Open Questions

None. The intended behavior is settled: invoking `$plan-orchestrator` must
deliver the full stack of PRs or MRs, or stop blocked with evidence.
