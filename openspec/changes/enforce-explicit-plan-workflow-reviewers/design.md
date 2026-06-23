## Context

The current local review-gate foundation validates active Git-private state for
the staged diff. That is necessary but insufficient for plan workflows because
ordinary `ax commit` still permits no-gate commits. The workflow needs an
explicit way for commit-owning phases to say: this is material plan workflow
work, so a fresh active gate is mandatory.

There are two commit boundaries:

- `plan-review` owns planning branch commits. It consumes readiness evidence
  emitted by `plan-ready` and binds that evidence to the staged planning diff.
- `plan-unit-delivery` owns implementation commits. It validates reviewer
  reports against the current staged implementation diff.

`plan-orchestrator` coordinates these phases but does not write review-gate
state or invent reviewer lists. Existing `plan-ready` review-gate activation
commands are migration surface only; after this change, normal readiness runs
produce evidence and `plan-review` owns readiness-to-planning-commit binding.

## Goals / Non-Goals

**Goals:**

- Require explicit reviewer evidence in plan workflow outputs.
- Promote selected dynamic reviewers into required gate passes for the current
  run.
- Add a required-gate `ax commit` mode for material workflow commits.
- Preserve ordinary no-gate `ax commit` behavior outside workflow-required
  commits.
- Bind readiness evidence to staged planning diffs in `plan-review`.
- Bind implementation evidence to staged implementation diffs in
  `plan-unit-delivery`.
- Keep local reviewer gates separate from hosted Nitro gates.
- Refresh and validate installed runtime surfaces after shared behavior lands.

**Non-Goals:**

- Public `ax review-gate activate`.
- Generic feature-delivery reviewer rules outside plan workflows.
- Project Lefthook, Husky, CI, or committed hook changes.
- Blocking Rene's direct raw `git commit` escape hatch.
- Hosted Nitro behavior changes.
- Signed attestations, append-only audit logs, or remote evidence storage.

## Decisions

### Add A Required-Gate Commit Mode

`ax commit --require-review-gate -m "..."` is the workflow commit path. It
fails when no active gate exists, then validates the gate against the staged
diff before delegating to Git. Ordinary `ax commit -m "..."` keeps the existing
no-gate allow path only when no active workflow-required gate exists. If an
active workflow-required gate exists, ordinary `ax commit` fails with a
diagnostic that names the owning workflow and gives the required-gate command.

This avoids hidden heuristics based on branch names, changed files, commit
messages, or marker files.

A material workflow commit is any commit a plan workflow phase intentionally
sends through the required-gate path. `ax commit` must not decide materiality by
inspecting paths, branch names, or commit messages.

### Keep `plan-ready` As A Classifier

`plan-ready` records readiness reviewer evidence and emits it in machine-readable
handoff or blueprint output. It does not commit or publish. `plan-review` is the
planning commit owner and must bind readiness evidence to the staged planning
diff.

### Keep Gate State Centralized

Phase scripts map validated evidence into shared review-gate APIs and write the
active gate before invoking `ax commit --require-review-gate`. `ax commit` only
validates the existing active gate for the current staged diff and consumes it
after a successful Git commit; it does not bind reviewer evidence or duplicate
phase-owned activation logic. State path resolution, staged diff hashing, schema
validation, active writes, consumed state, and status formatting stay in shared
review-gate/AX code.

For required-gate commits, `ax commit` also verifies the created commit still
matches the reviewed staged diff before consuming the gate. If a pre-commit hook
or commit-time index mutation causes the committed diff to diverge from the
validated gate hash, `ax commit` must leave evidence unconsumed or mark it
blocked, report the created commit SHA, and fail the command so the workflow
does not treat that head as locally reviewed. The recovery output must require a
human-controlled repair such as reverting or resetting the invalid commit before
reviewers are rerun.

Gate validation and consumption must be atomic. Required-gate commit should use
a repo/worktree-scoped lock or equivalent compare-and-consume transition, then
re-read state under the lock before consumption. The consume step confirms the
gate identity, staged diff hash, required reviewers, workflow, unit id, and
worktree binding still match the pre-commit validation.

Active gate state must include enough identity to reject linked-worktree or
branch drift: Git common directory, worktree-specific Git directory or worktree
path, branch or detached `HEAD` ref, pre-commit `HEAD` SHA, staged diff hash,
owning workflow, and unit id. A gate armed in one linked worktree must not be
consumable from another worktree that shares the same common Git directory.

For OpenSpec planning, `plan-orchestrator` owns blueprint materialization and
creates a `plan_review_request`. `plan-review` consumes that request, including
explicit readiness reviewer evidence and OpenSpec provenance evidence, before
arming the planning gate. The proof can be direct blueprint-to-change provenance
validation using source plan, change id, artifact fingerprint, generated path
checks, and strict OpenSpec validation. If provenance cannot be proven, the
workflow must rerun readiness reviewers against the materialized OpenSpec diff
before committing.

Every head-changing commit owned by `plan-unit-delivery` for a selected unit is
material for this workflow, including implementation edits, tests, OpenSpec task
checkbox updates, review-feedback fixes, pipeline fixes, conflict fixes, and
restack fixes. Those commits use required-gate mode. Ordinary `ax commit` remains
available for non-workflow commits and Rene's manual escape hatch via raw
`git commit`.

### Keep Hosted Review Separate

Local reviewer evidence can prove a local commit gate; it cannot satisfy
`planning_review`, `nitro_feedback_gate`, MR approval, CI/no-pipeline
inspection, or unsupported-host routing. Nitro remains the hosted gate for
planning and implementation MRs.

## Risks / Trade-offs

- Required-gate mode adds another commit path. The explicit flag is worth the
  extra surface because it removes silent no-gate fallback without guessing.
- Readiness evidence can go stale before `plan-review` commits. `plan-review`
  must revalidate artifact fingerprints and staged diff binding at commit time.
- Dynamic reviewers can become noisy. Require explicit selection rationale and
  catalog validation.
- Runtime profiles can lag source changes. Treat profile update, validation,
  and status as required delivery evidence. Run hook validation only if hook
  source or hook registration behavior changes.

## Migration Plan

1. Normalize readiness reviewer evidence.
2. Add required-gate AX behavior.
3. Bind readiness evidence at the `plan-review` commit boundary.
4. Enforce implementation reviewer evidence in `plan-unit-delivery`.
5. Preserve orchestrator evidence boundaries.
6. Add local-versus-hosted gate separation tests.
7. Align instructions, prompts, and runtime surfaces.
8. Refresh and validate installed profiles.

Rollback is a normal code rollback of the OpenSpec implementation stack. Raw
manual `git commit` remains available throughout.
