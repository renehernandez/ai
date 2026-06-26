# Personal Publication Checkpoint

## Goal

Simplify Rene's personal agent workflow so local commits can move quickly while
agent-published work still gets a final local review checkpoint before it leaves
the machine.

## Problem

The current `ax commit --require-review-gate` path binds every required local
review pass to the exact staged diff hash. That is too heavy for normal agent
iteration: when reviewers find real issues, each fix changes the staged diff
and invalidates previous passes. The result is repeated full review fanout even
when tests and validation are already passing.

This is a personal workflow problem. It should not become project-specific
configuration, team policy, CI behavior, hosted-review policy, or a new
project-level hook.

## Decisions

- Agents may use ordinary `ax commit` during implementation iteration.
- Agents should not use `ax commit --require-review-gate` as the default commit
  path for plan delivery, review feedback fixes, pipeline fixes, or cleanup
  commits.
- Before any agent publishes work, it must run one final personal review
  checkpoint against the branch diff being published and record the exact HEAD
  SHA.
- Publishing means push, PR creation, MR creation, PR update, MR update, or
  direct publication.
- The final checkpoint is personal workflow evidence. Keep it in the thread or
  private workflow state unless an existing project review flow already asks for
  reviewer-facing evidence.
- Existing hosted gates remain separate. CI, Nitro, MR approval, GitHub review,
  GitLab review, and pipeline inspection are not satisfied by the personal
  checkpoint.
- `ax commit --require-review-gate` remains available for explicit user
  requests or unusually sensitive local commits.

## Scope

In scope:

- Update portable user-level instructions and repo-local mirrors owned by this
  AI repo so agents treat publication as the blocking boundary.
- Update plan workflow skills and prompts that currently tell agents to use
  required-gate commits by default.
- Update `ax-cli` guidance that describes `ax commit`, review-gate behavior, or
  live runtime refresh for this personal workflow.
- Update hosted publication skills that own push, PR creation, MR creation, PR
  update, or MR update mechanics, including `change-request-create`,
  `glab-mr-create`, and `github-pr-create` when their guidance can bypass the
  final checkpoint.
- Update local validation or regression tests that assert the old per-commit
  gate behavior in personal workflow guidance.
- Refresh and validate the affected installed runtime surfaces when source
  changes are intended to become live as part of delivery:
  - for `instructions/**`, `rules/**`, or `AGENTS.md`, run
    `pnpm ax instructions update --profile personal`,
    `pnpm ax instructions validate --profile personal`,
    `pnpm ax instructions update --profile work`, and
    `pnpm ax instructions validate --profile work`;
  - for `skills/**`, run `pnpm ax skills update --profile personal`,
    `pnpm ax skills validate --profile personal`,
    `pnpm ax skills update --profile work`, and
    `pnpm ax skills validate --profile work`.
- Preserve the existing review-gate implementation as an opt-in tool unless a
  narrow compatibility edit is required.

Out of scope:

- Project-specific configuration.
- Team-visible CI requirements or hooks.
- A new `ax push` command.
- Carry-forward reviewer scoring or materiality classifiers.
- Replacing hosted review or hosted CI gates.
- Changing raw `git commit` behavior.

## Implementation Plan

### 1. Personal workflow publication rule

Deliverable: update the shared instruction and rule surfaces so the default
agent contract is: commit normally during iteration, run one final personal
checkpoint before publishing.

Acceptance:

- User-level and repo-local agent instructions no longer say that `ax commit`
  runs a local review gate as the default commit path.
- Publication guidance names push, PR/MR creation, PR/MR update, and direct
  publication as checkpoint boundaries.
- Guidance explicitly says this is personal workflow evidence, not
  project-specific configuration or team policy.
- Guidance keeps hosted review and CI gates separate from the personal
  checkpoint.
- If portable instruction or skill changes are intended to become live, the
  affected installed runtime surfaces are refreshed and validated for both
  `personal` and `work` profiles before publication.
- If runtime refresh cannot be validated, publication blocks with the stale
  source root or wrong-target evidence instead of silently publishing source
  changes that are not live.

Verification:

- Search the instruction and rule surfaces for stale default `--require-review-
  gate` guidance.
- Run the relevant instruction or skill text tests if the changed surfaces have
  regression coverage.
- Run `pnpm ax validate`.
- Run profile-scoped update and validation commands for every changed
  instruction, rule, or skill surface.
- Run `pnpm ax status --profile personal` and `pnpm ax status --profile work`
  after any intended runtime refresh and require changed instruction or skill
  surfaces to point at the selected source root before publication.

First real confirmation: an agent following the updated instructions can make
multiple local commits without rerunning required local reviewers for each
staged hash, then is blocked from publishing until it records a final branch
diff review and exact HEAD SHA.

### 2. Plan workflow skill alignment

Deliverable: update plan workflow skills, prompts, and validators that route
normal delivery through required-gate commits so they instead require the final
personal checkpoint before publishing.

Acceptance:

- `plan-ready`, `plan-review`, `plan-unit-delivery`, `plan-unit-sequencer`, and
  `plan-orchestrator` guidance uses the same publication-boundary rule where
  applicable.
- `ax-cli` guidance preserves `ax commit --require-review-gate` as opt-in and
  points normal personal workflow delivery to the publication checkpoint.
- `change-request-create`, `glab-mr-create`, and `github-pr-create` guidance
  require the final personal checkpoint before agent-initiated push, PR/MR
  creation, or PR/MR update when they publish local work.
- Review feedback, pipeline fixes, conflict fixes, and cleanup commits are not
  forced through required-gate commit mode by default.
- The final checkpoint records branch diff scope, target base, exact HEAD SHA,
  reviewer outcome, and any blocking findings.
- The workflow still blocks publication when the checkpoint has unresolved
  blocking findings.
- The workflow fails closed before publication when checkpoint evidence is
  missing, stale, or tied to a different HEAD SHA.
- Rollback is source-controlled: revert the instruction or skill guidance
  change, refresh the installed personal runtime surfaces if they were updated,
  and rerun `pnpm ax validate` plus `pnpm ax status`.

Verification:

- Run targeted tests for plan workflow scripts or fixtures that assert commit
  and publication contracts.
- Run `pnpm ax validate` if instruction or skill surfaces are changed.
- Exercise or validate the final-checkpoint contract with a representative
  branch diff so the visible result is either `passed` with the reviewed HEAD
  SHA or `blocked` with named blocking findings.

## Expected Delivery Shape

This is one atomic plan delivery. The implementation may touch several AI repo
surfaces, but the outcome is one personal workflow rule and one verification
story.

Expected hosted route: GitLab MR against `main` for this AI repo.

## Risks

- Stale skill text may keep telling agents to use `--require-review-gate` even
  after the top-level instruction changes.
- Runtime-installed instructions may remain stale until refreshed.
- The final checkpoint wording could become a vague ritual unless it names the
  branch diff, target base, HEAD SHA, and blocker result.
- Runtime refresh could point at the wrong source root; validation must block
  publication rather than treating source edits as live.

## Non-Goals

- Do not design a generalized publication platform.
- Do not add a project opt-in matrix.
- Do not add a change materiality classifier.
- Do not add new team requirements.
