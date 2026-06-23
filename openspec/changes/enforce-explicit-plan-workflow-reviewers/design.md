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
state or invent reviewer lists.

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
no-gate allow path for non-workflow commits.

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
  status, and hook validation as required delivery evidence.

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
