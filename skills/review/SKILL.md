---
name: review
description: Use when running mandatory phase review coverage, bounded repair closure, exact-MR-head readiness, or hosted finding review without mutation.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Review

## Authority

Review is read-only. It inspects one exact artifact fingerprint, target-base
diff, or Git HEAD and never repairs, commits, publishes, requests provider
action, or merges. Announce Review, read-only authority, and the exact target
once on non-trivial entry.
Shared lifecycle authority and delivery budgets remain canonical in
`rules/investigation-and-implementation.md`.

## Coverage

Under Standard delivery, run one discovery pass for every planning or
completed-code target. Resolve required types through `scripts/review-contract.ts`
and record one current `passed`, `finding`, or `blocked` result per type and
selected domain specialist. Planning covers implementation readiness, edge
cases/risk, code simplification, refactoring, and delivery shape. Completed code
covers `code-simplifier`, `code-quality-review`, `deslop`, `diff-review`, and
`scrutinize`.

Explicit Fast delivery has no planning artifact and skips completed-code local
Review and reviewer subagents. Review remains the read-only normalizer for CI
and Nitro evidence retrieved by Finish and returns actionable hosted findings
to Execute; it does not emit a local technical-readiness checkpoint for Fast.

`code-simplifier` always retains a distinct result. A small coherent target may
use one integrated inline pass; outcome coverage, not reviewer count, controls
readiness. Atomic plans and OpenSpec are planning contracts, not Doc Smith
reader-persona work.

For the last final OpenSpec unit, inspect implementation, completed tasks,
canonical specs, removal from active discovery, and the dated archive on the
same exact HEAD. Closure inconsistency returns to Execute and invalidates
affected exact-head evidence.

## Planning and POC Boundaries

A planning finding belongs in the artifact only when it changes observable
behavior, architecture/canonical ownership, safety/rollout, migration,
delivery-unit shape, or end-to-end acceptance. Files, symbols, commands,
exhaustive cases, CI mechanics, receipts, and intermediate discoveries are a
task-local implementation consideration for Execute.

Before handoff, validate one planning checkpoint against the exact path and
fingerprint. Missing, duplicate, stale, blocked, repair, `plan_required`, or
blocking results fail. Only evidenced nonblocking `defer` considerations may
remain.

At POC first objective proof, run only `code-simplifier`,
`code-quality-review`, `scrutinize` with architecture/reuse/system-path scope,
and targeted real-entrypoint proof. Do not treat intentionally incomplete code
as a completed implementation. Architecture-affecting change invalidates this
checkpoint.

Planning delivery-shape review challenges split and merge alternatives,
standalone safety, local proof, ownership, risk, rollback, deployment, objective
proof, and the canonical delivery budgets. After an accepted POC, `post_poc` is
the authoritative topology gate: bind every final unit and material footprint
entry to the accepted POC head and reconciled OpenSpec fingerprint. Unassigned,
stale, `split_required`, or `merge_required` evidence blocks Execute. Run
`scripts/validate-planning-review.ts` with the task-local checkpoint and
lifecycle context; prose agreement is insufficient.

## Execution and Findings

Inline when coherent. When delegation is faster, give each reviewer an
immutable packet: exact identity/diff, reviewer contract, changed paths,
applicable rules and accepted decisions, verification evidence, and gaps. Use
clean context by default. Start independent ready types together, backfill
capacity, and join at one phase barrier without reducing coverage.

Normalize findings with ID, type, severity, location, issue, evidence,
remediation outcome, invalidated surfaces, and one disposition: `repair`,
`defer`, or `plan_required`. Hold mutation until the barrier, then return one
deduplicated findings batch to Plan or the single Execute owner.

Apply the test-worthiness boundary in `rules/testing-and-verification.md` to new
or materially changed tests. Report a low-value test as an actionable finding
when it mirrors implementation or claims hosted CI behavior from local
configuration assertions without exercising an independent contract.

Closure is limited to enumerated repairs and affected proof. Emit exactly one
resolution per repair with `findingId`, `resolutionEvidence`,
`recheckedSurfaces`, and `affectedVerificationPassed`. Missing, duplicate,
unevidenced, semantically unresolved, or incomplete-surface resolutions fail.
Ownership findings must name the surviving canonical owner, removed alternate,
and inspected producer-to-consumer path.

Ordinary repairs stay in closure. New or materially changed parallel owners,
shared-infrastructure branches, repeated invariants, semantic behavior, or
accepted contract/risk require fresh discovery; replacement discovery
supersedes earlier results. A patch-equivalent rebase may reuse discovery only
after base-sensitive equivalence proof and emits a fresh exact-target checkpoint.

Normalize receipt-shape errors from evidence already returned; do not re-prompt
solely for formatting. Return unresolved in-scope work automatically. Ask the
user only for a new contract decision or reserved authority.

## Hosted Feedback

After Finish performs provider interaction, use `github-adapter-review` or
`gitlab-adapter-review`; add `nitro-review-feedback` when policy selects Nitro.
Read the complete response and every unresolved Nitro-authored discussion.
Stale source/head/base evidence and reassuring summaries that hide actionable
feedback do not pass. Codex-authored PR feedback remains retired.

Under Standard delivery, hosted gates do not replace local coverage. Under Fast
delivery, required CI plus exact-head Nitro closure intentionally replace only
the completed-code local Review wave; native hooks and focused implementation
verification remain required. Apply the same findings batch and bounded closure
rules. Keep provider identity, URL, target, normalized status, findings, and
routing task-local.

## Technical Readiness

Under Standard delivery, after a hook-clean commit is published as draft and hosted review is requested,
emit `technical_readiness_checkpoint` only when the exact hosted identity,
resolved target-base SHA, HEAD, target-base diff, hook evidence, delivery-budget
assessment, required review/specialist results, repair resolutions, any rebase
proof, provider route, and hosted semantic evidence are current and blocker-free.
For Nitro, require Finish's exact-head semantic review evidence for the complete
response and unresolved discussions.

`scripts/review-contract.ts` validates coverage, identity, routing, closure,
affected surfaces, rebase safety, and hosted evidence. Review never reruns the
repository full suite: the pre-commit hook owns the full local suite for each
committed head. Emit only a compact task-local receipt with target, execution
routing, per-type outcomes, finding counts, and local/hosted/readiness status.
