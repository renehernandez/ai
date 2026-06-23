## Context

The AX commit wrapper already validates active review-gate state for the staged
diff and delegates to Git only when validation passes. The reviewed plan
workflow now needs the missing producer side: `plan-ready` and
`plan-unit-delivery` must convert their reviewer selection and reviewer outcome
evidence into that local gate before material workflow commits exist.

The implementation crosses shared scripts, skill docs, adapter prompts, agent
instructions, OpenSpec planning workflow behavior, and installed runtime
surfaces. The narrow v1 boundary is local and phase-owned: hosted Nitro review
still happens after MR creation, and Rene's manual raw `git commit` escape
hatch remains outside enforcement.

## Goals / Non-Goals

**Goals:**

- Normalize `openspec_blueprint.review` so `plan-ready` outputs both
  historical reviewer evidence and machine-readable required/optional reviewer
  sets.
- Keep selected optional reviewers pinned to the run and required for the
  gate once selected.
- Add private gate activation helpers behind `plan-ready` and
  `plan-unit-delivery`.
- Centralize gate serialization, staged diff hashing, Git metadata path
  resolution, validation, active writes, and consumed-state behavior in
  `scripts/review-gate.ts`.
- Make owning workflow skills fail closed before invoking `ax commit` when
  required subagents, reviewer outcomes, or gate activation evidence are
  missing, stale, malformed, or blocking.
- Keep `plan-orchestrator` limited to evidence validation and routing back to
  the owning phase.
- Prove linked-worktree Git-dir behavior, multiple material commit behavior,
  and installed runtime alignment.

**Non-Goals:**

- Add a public `ax review-gate activate` command.
- Add workflow inference to `ax commit`.
- Enforce this gate for raw manual terminal `git commit`.
- Change hosted Nitro review semantics.
- Generalize local gate activation beyond `plan-ready`, `plan-unit-delivery`,
  and `plan-orchestrator`.
- Add append-only audit storage, signed attestations, or dedicated reviewer
  infrastructure.

## Decisions

### Centralize Gate State In `scripts/review-gate.ts`

`scripts/review-gate.ts` remains the only owner of the review-gate state path,
staged diff hash, schema validation, atomic active-state writes, and
consumed-state behavior. New phase helpers pass validated workflow evidence
into exported review-gate APIs rather than writing JSON directly.

Alternative considered: let each phase script write the Git-private JSON. That
would duplicate path resolution and hashing logic and make stale or malformed
state easier to create.

### Keep Activation Private To Workflow Skills

Gate activation belongs behind the owning phase because that phase has the
reviewer selection, reviewer outcome, and blocked-phase context. `ax
review-gate` remains status and validation oriented; no public activation
command is added.

Alternative considered: expose `ax review-gate activate`. That would make it
easy for agents to hand-author or replay gate state without proving the phase
contract.

### Fail Closed Before `ax commit` In Workflow Skills

`ax commit` keeps its ordinary no-gate behavior so private non-workflow commits
continue to work. Workflow enforcement therefore sits before the owning skill
invokes `ax commit`: if a material workflow commit requires a gate, the skill
must write and validate it first or produce a blocked phase output.

Alternative considered: make `ax commit` infer workflow context from branch
names, files, or markers. That would be brittle and would make ordinary local
commits depend on hidden heuristics.

### Normalize Reviewer Contracts Before Gate Writing

`plan_delivery_handoff` already carries `required_reviewers` and
`optional_reviewers`. `openspec_blueprint.review` should carry the same
machine-readable fields while preserving `reviewers_used` and `findings` as
review history. Gate writing should use the normalized reviewer set and promote
selected optional reviewers into required gate passes for that run.

Alternative considered: derive policy from `reviewers_used`. That conflates
historical evidence with the enforcement policy and makes optional reviewer
promotion ambiguous.

### Orchestrator Validates Evidence But Does Not Write Gates

`plan-orchestrator` coordinates phases and validates freshness before advancing,
but it does not invent reviewer lists or write review-gate state. Missing or
stale evidence routes back to `plan-ready` or `plan-unit-delivery`.

Alternative considered: let orchestrator repair or write gates. That would
centralize too much policy and blur phase ownership.

## Risks / Trade-offs

- Workflow skills may accidentally rely on ordinary no-gate `ax commit`
  behavior -> add explicit fail-closed checks and tests before workflow commit
  calls.
- Phase helpers may drift from review-gate validation semantics -> route all
  writes and consumes through `scripts/review-gate.ts`.
- Consumed-state support may add complexity -> deleting the active gate after
  successful commit is acceptable only if status output still explains the
  absence clearly enough and tests cover the behavior.
- Runtime installed profiles may lag source changes -> refresh and validate all
  configured profiles and status surfaces after skill/instruction updates.
- Linked worktrees can store Git metadata outside the worktree root -> include
  linked-worktree fixtures for active and consumed gate paths.

## Migration Plan

1. Update contracts and shared gate APIs first.
2. Add phase-specific gate writers behind `plan-ready` and
   `plan-unit-delivery`.
3. Add post-commit consumption behavior to `ax commit`.
4. Update orchestrator evidence boundaries.
5. Update guidance, adapter prompts, and runtime config.
6. Refresh and validate installed runtime profiles.

Rollback is a normal code rollback of the OpenSpec implementation stack. The
manual raw `git commit` escape hatch remains available throughout the rollout.

## Open Questions

None. Proceed with private phase-owned activation and shared review-gate state
APIs.
