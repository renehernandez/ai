## 1. Contract And Shared Gate Foundation

- [x] 1.1 Update `skills/plan-ready/SKILL.md`,
  `skills/plan-ready/agents/openai.yaml`, and
  `skills/plan-ready/scripts/plan-ready.ts` so `openspec_blueprint.review`
  includes `required_reviewers` and `optional_reviewers` while preserving
  `reviewers_used` and `findings`.
- [x] 1.2 Update `skills/plan-ready/scripts/plan-ready.ts validate-blueprint`
  and tests so baseline reviewers are required, optional reviewers are
  catalog-only, and legacy blueprint output without normalized reviewer fields
  is rejected.
- [x] 1.3 Extend `scripts/review-gate.ts` with typed active-gate write and
  consume/clear helpers that own path resolution, staged diff hashing, schema
  validation, atomic writes, status semantics, and consumed-state behavior.
- [x] 1.4 Add shared review-gate unit tests for active writes, malformed input
  rejection, consumed-state validation behavior, and linked-worktree Git-dir
  isolation.

## 2. Plan Ready Gate Activation

- [x] 2.1 Add a private `skills/plan-ready/scripts/plan-ready.ts` command or
  helper that maps validated `plan_delivery_handoff` and `openspec_blueprint`
  reviewer evidence into the shared `scripts/review-gate.ts` API input shape.
- [x] 2.2 Promote selected optional reviewers into required gate passes for the
  current readiness run and record phase provenance in the active gate.
- [x] 2.3 Make `plan-ready` fail closed before readiness commits when required
  subagents are unavailable, reviewer evidence is partial, reviewer evidence is
  stale, gate writing fails, gate validation fails, or blocking findings remain.
- [x] 2.4 Add plan-ready tests for atomic handoff gate writing, OpenSpec
  blueprint gate writing, selected optional reviewer promotion, malformed
  evidence rejection, stale staged diff rejection, and blocked readiness
  behavior.

## 3. Plan Unit Delivery Gate Activation

- [x] 3.1 Add a private
  `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts` command or helper
  that maps a validated handoff plus `reviewer_launch` and `reviewer_report`
  into the shared `scripts/review-gate.ts` API input shape.
- [x] 3.2 Require required implementation reviewer passes in delivery gates.
  Required implementation reviewers must have passing
  reconciled outcomes, and treat selected or non-skipped dynamic reviewers as
  required gate passes for the current staged diff.
- [x] 3.3 Preserve explicit `not_applicable` skipped reviewer evidence where
  currently permitted, without counting skipped reviewers as required passes.
- [x] 3.4 Make `plan-unit-delivery` fail closed before implementation commits
  when implementation-review subagents are unavailable, reviewer outcomes are
  missing or blocking, evidence is stale, gate writing fails, or gate validation
  fails.
- [ ] 3.5 Add plan-unit-delivery tests for required reviewer extraction,
  skipped reviewer handling, missing subagents, blocking outcomes, missing
  outcomes, stale evidence, linked-worktree Git-dir isolation, and multiple
  material commits requiring fresh gates.

## 4. Commit Consumption And AX CLI Behavior

- [ ] 4.1 Update `ax commit` to consume or clear the active gate after a
  successful gated commit and to preserve the active gate when Git fails before
  creating a commit.
- [ ] 4.2 Print a warning without failing retroactively when consumed-state
  cleanup fails after Git creates a commit.
- [ ] 4.3 Update `ax review-gate status` and `validate-commit` so consumed gates
  are reported clearly and ignored by commit validation.
- [ ] 4.4 Add AX integration tests for successful gate consumption, failed commit
  preservation, cleanup warning behavior, consumed gate no-op validation,
  no-gate ordinary commits, active-gate blocking, and public help excluding
  activation.

## 5. Orchestrator Evidence Boundaries

- [ ] 5.1 Update `skills/plan-orchestrator/SKILL.md` and
  `skills/plan-orchestrator/agents/openai.yaml` so gate activation is delegated
  to `plan-ready` and `plan-unit-delivery`.
- [ ] 5.2 Add or update
  `skills/plan-orchestrator/scripts/plan-orchestrator.ts` validation for fresh
  readiness and delivery phase evidence before advancing.
- [ ] 5.3 Route missing or stale readiness gate evidence back to `plan-ready`
  and missing or stale delivery gate evidence back to `plan-unit-delivery`.
- [ ] 5.4 Add orchestrator tests proving it does not write review-gate state,
  does not invent reviewer lists, and blocks advancement when expected phase
  evidence is absent or stale.

## 6. Instructions, Runtime Alignment, And Verification

- [ ] 6.1 Update `skills/ax-cli/SKILL.md` to explain that `ax review-gate`
  remains status/validation oriented and activation is skill-owned.
- [ ] 6.2 Update root `AGENTS.md` and `instructions/AGENTS.md` so material
  plan-workflow commits require the owning phase to arm and validate the local
  review gate before `ax commit`, while preserving Rene's raw `git commit`
  escape hatch.
- [ ] 6.3 Update instruction tests for workflow gate guidance.
- [ ] 6.4 Update `skills/plan-ready/agents/openai.yaml`,
  `skills/plan-unit-delivery/agents/openai.yaml`, and
  `skills/plan-orchestrator/agents/openai.yaml` so installed agents describe
  the source behavior.
- [ ] 6.5 Confirm `ax.config.json` reusable runtime-script config remains valid
  for any shared helper imports from skill-local scripts.
- [ ] 6.6 Run `writing-skills` review because the implementation changes shared
  skills, prompts, and agent behavior.
- [ ] 6.7 Run focused unit and integration tests for `review-gate`,
  `plan-ready`, `plan-unit-delivery`, `plan-orchestrator`, and `ax-cli`.
- [ ] 6.8 Run the repo's full test command.
- [ ] 6.9 Refresh configured runtime profiles with
  `pnpm ax update --all-profiles`.
- [ ] 6.10 Validate installed runtime surfaces with
  `pnpm ax validate --all-profiles`, `pnpm ax status --all-profiles`, and
  `pnpm ax hooks validate`.
