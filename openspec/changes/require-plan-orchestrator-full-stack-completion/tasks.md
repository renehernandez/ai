## 1. Full-Stack Orchestration Contract

- [ ] 1.1 Tighten orchestrator contract and host preflight
      Update `skills/plan-orchestrator` docs, adapter prompts, templates, and
      host-capability preflight so partial OpenSpec delivery cannot be terminal
      success. Unsupported stack/review hosts must produce `delivery_blocked`
      with routing evidence. `plan-orchestrator/SKILL.md` must explicitly add
      `delivery_blocked` as an orchestrator-level terminal state, not leave it
      only in the sequencer vocabulary.
- [ ] 1.2 Define shared stack-state evidence helpers
      Add or extract shared helpers for OpenSpec task inventory, stack artifact
      parsing, gate evidence, and task-delta validation. Reuse these helpers
      from orchestrator, sequencer, and delivery scripts. Depends on 1.1.
- [ ] 1.3 Add full-stack completion validation
      Extend `validate-stack-ready` so it parses concrete stack-tip `tasks.md`
      evidence, requires task-to-artifact evidence, rejects self-attested
      completion booleans, rejects checked future tasks without artifacts, and
      rejects partial stacks. Depends on 1.2.
- [ ] 1.4 Split direct sequencer goals from orchestrator goals
      Add caller and goal contracts to `plan-unit-sequencer` so direct
      invocation can still use `next_task`, but `caller: plan_orchestrator`
      always uses full-stack behavior and cannot emit terminal completion while
      unchecked deliverable tasks remain. Depends on 1.2.
- [ ] 1.5 Add resume predecessor verification
      Extend resume templates, validators, and instructions so continuation
      emits `resume_ready` only after predecessor artifacts, gates, task deltas,
      cumulative task state, and restack evidence pass; otherwise emit
      `delivery_blocked`. Depends on 1.2 and 1.3.
- [ ] 1.6 Preserve one-unit delivery evidence
      Update `plan-unit-delivery` handoff and ledger guidance so each unit
      records selected task ID, selected task base SHA, predecessor artifact,
      implementation artifact URL/ref, implementation head SHA, task-delta
      validation command/output, CI evidence, Nitro evidence, and restack state.
      Depends on 1.2.
- [ ] 1.7 Align plan-ready, plan-review, docs, and rules
      Audit/update `skills/plan-ready`, `skills/plan-review`, `AGENTS.md`,
      `instructions/AGENTS.md`, `rules/feature-delivery.md`, adapter prompts,
      and normative planning references so they align on `stack_ready` or
      `delivery_blocked` as orchestrator terminal states. Depends on 1.1 and
      1.4.
- [ ] 1.8 Update regression coverage and examples
      Add fixtures and tests for partial-stack rejection, resume predecessor
      verification, stale predecessor gates, invalid cumulative task state,
      unsupported host blocking, session handoff as non-success, and direct
      sequencer `next_task` behavior outside orchestrator. Depends on 1.3, 1.4,
      1.5, and 1.6.
- [ ] 1.9 Validate agent behavior and refresh runtime
      Run `writing-skills`, address findings, refresh installed skill surfaces,
      ensure reusable runtime scripts include all imported shared helpers such
      as `scripts/nitro-feedback-gate.ts`, and execute touched installed
      planning scripts after refresh. `plan-unit-delivery` currently imports
      that helper in both repo-local and installed runtime copies, so the
      implementation must either install the helper or remove the import before
      runtime refresh can pass. Depends on 1.7 and 1.8.
