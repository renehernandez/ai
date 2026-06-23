## 1. Readiness Reviewer Evidence

- [ ] 1.1 Update `plan-ready` contracts, validators, docs, and prompts so
  atomic handoffs and OpenSpec blueprints carry explicit baseline reviewers,
  selected dynamic reviewers, per-reviewer status, artifact fingerprint,
  skipped rationale, blocking findings, completion timestamp, and gate outcome.
- [ ] 1.2 Validate that baseline reviewers are always present and dynamic
  reviewers come only from the optional reviewer catalog.
- [ ] 1.3 Promote selected optional reviewers into downstream required gate
  passes for the readiness run.
- [ ] 1.4 Add `plan-ready` tests for missing baseline reviewers, invalid dynamic
  reviewers, missing reviewer evidence, stale artifact fingerprints, blocking
  findings, skipped reviewers, and selected optional reviewer promotion.

## 2. Required-Gate AX Commit Behavior

- [ ] 2.1 Add a required-gate workflow commit mode to `ax commit`, such as
  `ax commit --require-review-gate -m "..."`.
- [ ] 2.2 Make required-gate mode fail when no active fresh gate exists while
  ordinary `ax commit -m "..."` keeps the no-gate allow path for non-workflow
  commits.
- [ ] 2.3 Consume or clear active gates after successful gated commits, preserve
  active gates when Git fails before creating a commit, and warn without failing
  retroactively when post-commit cleanup fails.
- [ ] 2.4 Update `ax review-gate status` and `validate-commit` so missing,
  active, blocking, stale, and consumed gates are reported clearly.
- [ ] 2.5 Add AX unit and integration tests for required-gate missing-state
  failure, no-gate ordinary commits, successful consumption, failed commit
  preservation, cleanup warning behavior, consumed gate validation no-op, active
  gate blocking, and public help excluding activation.

## 3. Planning Commit Boundary

- [ ] 3.1 Update `plan-review` to accept and validate readiness reviewer
  evidence from `plan-ready` outputs before committing a planning branch.
- [ ] 3.2 Bind readiness evidence to the current staged planning diff before
  arming the local review gate.
- [ ] 3.3 Call required-gate `ax commit` mode for planning workflow commits.
- [ ] 3.4 Add `plan-review` tests for missing, stale, malformed, and blocking
  readiness evidence at the planning commit boundary.

## 4. Implementation Commit Boundary

- [ ] 4.1 Update `plan-unit-delivery` reviewer launch and report contracts so
  implementation commits require fresh explicit reviewer evidence for the
  current staged implementation diff.
- [ ] 4.2 Preserve explicit `not_applicable` reviewer evidence without counting
  skipped reviewers as required gate passes.
- [ ] 4.3 Ensure any direct blocked-gate fallback does not become a second
  review-gate state implementation outside shared review-gate APIs.
- [ ] 4.4 Add `plan-unit-delivery` tests for required reviewer extraction,
  skipped reviewers, blocking outcomes, missing outcomes, stale evidence,
  missing subagents, linked worktrees, and multiple material commits requiring
  fresh gates.

## 5. Orchestrator Evidence Boundary

- [ ] 5.1 Update `plan-orchestrator` docs, prompts, validators, and tests so it
  validates phase evidence freshness and routes stale or missing evidence back
  to the owning phase.
- [ ] 5.2 Prove `plan-orchestrator` does not write review-gate state.
- [ ] 5.3 Prove `plan-orchestrator` does not invent or recompute reviewer lists.
- [ ] 5.4 Add tests for missing readiness evidence routing to `plan-ready` and
  missing delivery evidence routing to `plan-unit-delivery`.

## 6. Local Gate And Hosted Gate Separation

- [ ] 6.1 Add validation or tests proving local reviewer gate evidence cannot
  satisfy `planning_review`, `nitro_feedback_gate`, MR approval,
  CI/no-pipeline inspection, or unsupported-host routing.
- [ ] 6.2 Keep `/request_review @nitro`, latest-head Nitro feedback, and
  actionable-feedback resolution as separate hosted-review requirements after
  local commit gates pass.
- [ ] 6.3 Document that local review gates block commits and hosted Nitro gates
  block stack advancement or delivery completion.

## 7. Instructions, Prompts, And Runtime Alignment

- [ ] 7.1 Update root `AGENTS.md` and `instructions/AGENTS.md` so agents use
  `ax commit`, workflow skills use required-gate mode for material workflow
  commits, and raw `git commit` remains Rene's manual escape hatch.
- [ ] 7.2 Update `skills/ax-cli`, affected plan workflow skills, and adapter
  prompts for explicit reviewer evidence and required-gate commit behavior.
- [ ] 7.3 Add or update instruction and skill validation tests for the new
  guidance.
- [ ] 7.4 Run `writing-skills` review for changed shared skills, prompts, and
  agent behavior.

## 8. Verification And Runtime Refresh

- [ ] 8.1 Run focused tests:
  `pnpm exec node --import tsx --test tests/unit/review-gate.test.ts`,
  `pnpm exec node --import tsx --test tests/unit/plan-ready-script.test.ts`,
  `pnpm exec node --import tsx --test tests/unit/plan-review-script.test.ts`,
  `pnpm exec node --import tsx --test tests/unit/plan-unit-delivery-script.test.ts`,
  `pnpm exec node --import tsx --test tests/unit/plan-orchestrator-script.test.ts`,
  `pnpm exec node --import tsx --test tests/unit/ax-cli.test.ts`,
  `pnpm exec node --import tsx --test tests/integration/ax-cli.test.ts`,
  `pnpm exec node --import tsx --test tests/unit/agent-instructions.test.ts`,
  and `pnpm exec node --import tsx --test tests/unit/skill-validate.test.ts`.
- [ ] 8.2 Run `pnpm exec tsx scripts/skill-validate.ts`.
- [ ] 8.3 Run `pnpm run test:unit`, `pnpm run test:integration`, and
  `pnpm test`.
- [ ] 8.4 Discover configured runtime profiles from `ax.config.json`, then run
  `pnpm ax update --all-profiles`.
- [ ] 8.5 Validate installed runtime surfaces with
  `pnpm ax validate --all-profiles`, `pnpm ax status --all-profiles`, and
  `pnpm ax hooks validate`.
