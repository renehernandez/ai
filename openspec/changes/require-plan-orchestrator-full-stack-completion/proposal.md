## Why

`plan-orchestrator` can still appear successful after delivering only the first
OpenSpec task because the lower-level sequencer supports a valid `next_task`
route. The orchestrator needs a stricter contract: invoking it means the full
reviewed stack is ready, or the workflow stops with blocker evidence.

## What Changes

- Require `plan-orchestrator` to invoke implementation sequencing in full-stack
  mode and finish only with `stack_ready` or `delivery_blocked`.
- Make `stack_ready` depend on parsed stack-tip `tasks.md` state plus
  structured task-to-artifact evidence, not self-attested booleans.
- Add resume predecessor verification before any next task can be selected.
- Add caller and goal context to sequencer behavior so direct `next_task`
  remains possible outside `plan-orchestrator`, but cannot satisfy orchestrator
  completion.
- Align plan-adjacent skills, rules, adapter prompts, and runtime-installed
  skill surfaces with the full-stack contract.
- Prove installed planning skill scripts execute after runtime refresh,
  including reusable shared script imports.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-first-plan-orchestration`: full-stack orchestrator completion,
  concrete stack-ready evidence, caller-aware sequencing, resume predecessor
  verification, and adjacent skill/rule alignment.
- `ax-cli`: reusable runtime script installation and installed-script
  execution checks for planning skills.

## Impact

- `skills/plan-orchestrator`, `skills/plan-unit-sequencer`,
  `skills/plan-unit-delivery`, `skills/plan-ready`, and `skills/plan-review`.
- Shared planning contract helpers and tests under `scripts/` and test suites.
- Adapter prompts for affected planning skills.
- `AGENTS.md`, `instructions/AGENTS.md`, `rules/feature-delivery.md`, and any
  normative planning references that describe orchestrator terminal states.
- `agent-runtime.config.json`, runtime skill update/status/validation flows,
  and installed planning skill script execution checks.
