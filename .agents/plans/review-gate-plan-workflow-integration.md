# Review Gate Plan Workflow Integration

## Goal

Wire reviewed plan delivery into the `ax commit` review-gate foundation through
reviewed, sequenced implementation tasks so plan implementation commits cannot
be made by agents until required local review passes have completed against the
current staged diff.

The first observable outcome is that `plan-unit-delivery` arms and updates
Git-private review-gate state for a selected unit, records current-session
reviewer results against the staged diff, and Codex or Claude command hooks
redirect raw agent `git commit` attempts to `ax commit`.

## Dependency

This plan depends on `.agents/plans/review-gate-commit-foundation.md` being
implemented and published first. It is a multi-deliverable follow-up and should
be materialized as an OpenSpec change after the foundation exists. The required
foundation commands and module are:

- `ax commit`;
- `ax review-gate status`;
- `ax review-gate validate-commit`;
- `scripts/review-gate.ts`;
- Git-private gate state at `$(git rev-parse --git-dir)/ax/review-gate.json`.

## Motivation

The commit foundation provides the validator, but plan delivery must decide when
the gate is active, which reviewers are required, and how reviewer outcomes are
recorded. This integration keeps the gate private to Rene's agent workflow while
making local review completion a hard precondition before agents commit and
request hosted review.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Gate arming | Creating or updating Git-private review-gate state so `ax commit` blocks until review evidence is complete. |
| Baseline review passes | The required local plan-unit-delivery review-pass IDs for all plan workflow implementation commits. |
| Dynamic review passes | Additional required review-pass IDs selected from plan context, touched files, risk routing, or reviewer findings. |
| Review-pass result | Structured evidence that a local review pass completed against the current staged diff. |
| Raw agent commit guard | A Codex or Claude command hook that blocks agent-issued raw `git commit` and instructs the agent to use `ax commit`. |
| Post-commit gate state | The gate state after a successful commit, recording the commit SHA or disarming the staged-diff gate before push and hosted review. |

## Scope

### In Scope

- Update `plan-unit-delivery` to arm review-gate state for implementation
  commits.
- Define the baseline required review-pass set using existing
  `plan-unit-delivery` pass IDs: `implementation-review`,
  `implementation-scrutiny`, `code-quality-review`, `code-simplifier`,
  `deslop`, and `docs-alignment-review`.
- Add dynamic reviewer routing with canonical skill IDs such as
  `ai-readiness-upkeep`, `security-review`, `github-adapter-review`,
  `gitlab-adapter-review`, `nitro-review-feedback`,
  `review-feedback-routing`, `cloudflare`, `workers-best-practices`,
  `terraform`, and `infra`.
- Record structured current-session reviewer outcomes against the current staged
  diff fingerprint.
- Mark stale reviewer results when the staged diff changes.
- Require local review gate completion before `plan-unit-delivery` proceeds to
  commit, push, or hosted Nitro review.
- Update `plan-ready` and `plan-orchestrator` wording so they require the gate
  contract but do not own diff state.
- Update `skills/plan-ready/agents/openai.yaml`,
  `skills/plan-orchestrator/agents/openai.yaml`, and
  `skills/plan-unit-delivery/agents/openai.yaml` alongside SKILL.md changes.
- Extend private runtime hook registration so it can manage command hooks, then
  add a user-level Codex and Claude command hook that blocks agent raw
  `git commit` usage and points to `ax commit`.
- Register the command hook through the private runtime hook flow, without
  changing project hook configuration.
- Add tests for plan-unit-delivery gate state creation, dynamic reviewer
  routing, reviewer-result recording, stale diff handling, and raw agent commit
  hook behavior.

### Out Of Scope

- Adding local `.git/hooks` installation.
- Editing project-owned Lefthook, Husky, CI, or committed hook configuration.
- Blocking Rene's manual terminal `git commit` escape hatch.
- Building autonomous subagent reviewer execution.
- Changing Nitro hosted review behavior beyond preserving local-review-before-
  Nitro ordering.
- Generalizing the review gate to every non-plan feature delivery path.
- Implementing this entire plan as one atomic delivery unit.

## Desired Behavior

`plan-unit-delivery` should own implementation-time gate state. It should:

1. Identify the selected unit and current plan workflow context.
2. Compute the current staged diff fingerprint when reviewer evidence is
   recorded or validated.
3. Select baseline review passes plus dynamic review passes.
4. Write or update `$(git rev-parse --git-dir)/ax/review-gate.json`.
5. Record reviewer outcomes from the current agent session.
6. Require `ax review-gate validate-commit` to pass before `ax commit`.
7. Record the successful commit SHA or disarm the staged-diff gate after commit
   so push and Nitro review have durable evidence even though the index is
   clean.
8. Continue to push and Nitro review only after local review gate completion.

`plan-ready` and `plan-orchestrator` should describe the review-gate contract
for planned delivery, but neither should create or mutate diff-specific gate
state. Readiness and orchestration happen before there is a final staged diff;
delivery owns the commit evidence.

The raw agent commit guard should be a private command hook. When an agent tries
to run raw `git commit`, it should block with a short message:

```text
Use ax commit so the local review gate can validate this staged diff.
```

The guard should allow other Git commands and should not install project Git
hooks. The hook plan must name the exact event, matcher, payload shape,
registration config, trust/status reporting, and malformed-payload fail-open
behavior before implementation.

## Dynamic Reviewer Routing

V1 routing should start conservative and explicit:

| Trigger | Required reviewer |
| --- | --- |
| Skills, rules, instructions, hooks, automations, CI, verification scripts, runtime config, generated agent surfaces, or review rubrics changed | `ai-readiness-upkeep` |
| Auth, secrets, permissions, untrusted input, network boundaries, data access, or dependency risk changed | `security-review` |
| GitHub PR workflow behavior changed | `github-adapter-review` |
| GitLab MR workflow behavior changed | `gitlab-adapter-review` |
| Nitro review routing or feedback behavior changed | `nitro-review-feedback` or `review-feedback-routing` |
| Cloudflare runtime, Workers, Durable Objects, or Wrangler behavior changed | `cloudflare` or `workers-best-practices` |
| Terraform or infrastructure files changed | `terraform` or `infra` |

The implementation can encode this as a small routing module used by
`plan-unit-delivery` and review-gate state generation. It does not need to be a
generic policy engine in v1.

## Implementation Tasks

### 1. Plan Delivery Gate Ownership

- [ ] 1.1 Update `plan-unit-delivery` instructions to require review-gate state
  before implementation commit.
- [ ] 1.2 Add or update `plan-unit-delivery` scripts so a selected unit can arm
  the gate with baseline review passes.
- [ ] 1.3 Ensure gate state includes the selected unit identity, required
  review passes, staged diff fingerprint, and review-pass result placeholders.
- [ ] 1.4 Require gate validation before commit, push, or hosted Nitro review.
- [ ] 1.5 Define post-commit gate-state behavior: either record the commit SHA
  that passed the gate or disarm the staged-diff gate before push and hosted
  review.
- [ ] 1.6 Reuse `scripts/review-gate.ts` from the foundation instead of
  duplicating state IO or staged-diff hashing in `plan-unit-delivery`.

### 2. Reviewer Result Recording

- [ ] 2.1 Reuse existing `plan-unit-delivery` reviewer/report validators where
  possible instead of creating a parallel review result contract.
- [ ] 2.2 Record `status`, `diffHash`, `completedAt`, and summary evidence for
  each required review pass.
- [ ] 2.3 Treat changed staged diff fingerprints as stale reviewer evidence.
- [ ] 2.4 Preserve accepted risks only when the underlying reviewer policy allows
  acceptance rather than remediation.
- [ ] 2.5 Normalize gate state to existing plan-unit-delivery review-pass IDs:
  `implementation-review`, `implementation-scrutiny`, `code-quality-review`,
  `code-simplifier`, `deslop`, and `docs-alignment-review`.

### 3. Dynamic Reviewer Routing

- [ ] 3.1 Add routing rules for `ai-readiness-upkeep` and `security-review`.
- [ ] 3.2 Add routing rules for artifact-host and domain-specific reviewers
  using canonical skill IDs.
- [ ] 3.3 Validate that dynamic routing is evaluated before the gate can pass.
- [ ] 3.4 Keep routing data small, explicit, and covered by tests.
- [ ] 3.5 If the routing module lives under `scripts/` and managed skills import
  it, add it to `runtime.reusableScripts` and cover it with reusable-script
  validation.

### 4. Plan Skill Alignment

- [ ] 4.1 Update `plan-ready` wording so implementation-ready outputs require
  local review-gate enforcement during later delivery.
- [ ] 4.2 Update `plan-orchestrator` wording so reviewed planning flows continue
  into `plan-unit-delivery` for gate ownership.
- [ ] 4.3 Confirm neither `plan-ready` nor `plan-orchestrator` creates
  diff-specific gate state.
- [ ] 4.4 Update `skills/plan-ready/agents/openai.yaml`,
  `skills/plan-orchestrator/agents/openai.yaml`, and
  `skills/plan-unit-delivery/agents/openai.yaml` so installed prompts match
  SKILL.md behavior.

### 5. Raw Agent Commit Guard

- [ ] 5.1 Add a private user-level command hook under `hooks/` that detects raw
  agent `git commit`.
- [ ] 5.2 Extend hook config, registration, status, and validation to manage
  command hooks in addition to the existing startup hook.
- [ ] 5.3 Define the exact Codex and Claude hook event, matcher, payload shape,
  command, timeout, trust/status reporting, and managed-backup behavior.
- [ ] 5.4 Ensure the hook blocks raw agent `git commit` with guidance to use
  `ax commit`.
- [ ] 5.5 Ensure the hook allows non-commit Git commands and malformed payloads
  fail open with diagnostics rather than blocking unrelated tool use.
- [ ] 5.6 Update `hooks/README.md` to describe managed command hook
  registration and raw commit guard behavior.

### 6. Verification

- [ ] 6.1 Add tests for plan-unit-delivery gate arming.
- [ ] 6.2 Add tests for required baseline reviewers.
- [ ] 6.3 Add tests for dynamic reviewer routing.
- [ ] 6.4 Add tests for stale staged diff reviewer results.
- [ ] 6.5 Add tests proving local review gate completion is required before
  commit/push/Nitro review in plan delivery.
- [ ] 6.6 Add tests for raw agent commit hook block and non-commit allow paths.
- [ ] 6.7 Run hook validation after registration changes.
- [ ] 6.8 Run `writing-skills` review because this changes skills, agent
  prompts, hook behavior, and runtime docs.
- [ ] 6.9 Refresh and check installed skills for both `personal` and `work`
  profiles after skill or prompt changes.

## Verification Commands

Expected verification for the implementation slice:

```bash
pnpm run test:unit
pnpm test:integration -- tests/integration/ax-cli.test.ts
pnpm ax hooks update
pnpm ax hooks validate
pnpm ax hooks status
pnpm ax skills update --profile personal
pnpm ax skills update --profile work
pnpm ax skills status --profile personal
pnpm ax skills status --profile work
pnpm ax validate --profile personal
pnpm ax validate --profile work
```

Manual verification should include invoking the new command hook with a raw
`git commit` payload and a non-commit Git payload to confirm the block and allow
paths.

## Rollout Notes

- This plan keeps hook enforcement private to Codex and Claude command hooks.
- This plan does not install `.git/hooks/pre-commit`.
- This plan leaves manual terminal `git commit` as Rene's personal escape hatch.
- This plan should run only after the commit foundation plan is delivered.
- This plan should be implemented through OpenSpec tasks, not as one atomic
  plan delivery unit.
