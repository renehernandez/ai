---
name: review
description: Use when running mandatory phase review coverage, bounded repair closure, exact-MR-head readiness, or hosted finding review without mutation.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Review

## Authority

Review is read-only. It inspects one exact artifact fingerprint, target-base
diff, or Git HEAD and never fixes, commits, publishes, polls through provider
mutation, or merges. For non-trivial entry, announce `Review`, read-only
authority, and the target once.

## Required Review Coverage

Every planning and completed-code target receives one discovery pass against a
stable exact artifact or diff. Cover every phase-specific review type. One
integrated inline pass may cover all types for a small coherent change. Use
subagents only when separating concerns is expected to finish faster; coverage
outcomes, not distinct reviewer identities, decide readiness.

Use `scripts/review-contract.ts` as the reviewer catalog. Planning types are
`implementation-readiness`, `edge-cases-and-risk`,
`code-simplifier`, `refactoring-opportunities`, and `delivery-shape`.
Completed-code types are `code-simplifier`, `code-quality-review`, `deslop`,
`diff-review`, and `scrutinize`. Record one current `passed`, `finding`, or
`blocked` outcome for every type. Add affected-domain specialists only when the
exact target exposes their domain.

`code-simplifier` is a core reviewer for planning and completed-code targets.
It always keeps its own recorded outcome, even when one inline execution covers
several review types or delegated execution falls back to an available model.
Another review type never substitutes for its simplification evidence.

Atomic plans and OpenSpec artifacts are planning contracts. Review them here;
do not also invoke Doc Smith reader personas.

For the last final OpenSpec unit, inspect implementation, completed task state,
canonical spec synchronization, absence of the completed change from the active
namespace, and its dated archived record on one exact HEAD. Missing or
inconsistent closure state is an Execute repair finding. Any archive or
canonical-spec repair invalidates the prior exact-head result and refreshes the
affected local and hosted evidence.

## Planning Artifact Boundary

Classify every planning finding before returning it. It is an artifact finding
only when it changes externally observable behavior, architecture or canonical
ownership, safety or rollout policy, migration, a delivery-unit boundary, or
end-to-end acceptance. Plan repairs those durable contract gaps.

Everything else is a task-local implementation consideration, including exact
files, symbols, commands, exhaustive test cases, CI wiring mechanics, provider
receipts, review chronology, and intermediate discoveries. Pass those to
Execute without requiring them in the artifact. Implementation readiness means
that no material decision is unresolved; it does not require a prose recipe or
protection from rediscovering repository mechanics after context compaction.

Before Plan hands the artifact to Execute, validate one completed planning
checkpoint against the exact artifact path and fingerprint. Require exactly one
current result for every planning type and selected specialist. A result may
carry only evidenced, nonblocking `defer` findings classified as task-local
implementation considerations; missing, duplicate, stale, blocked, `repair`,
`plan_required`, or blocking findings prevent handoff.

At a POC's first objective proof, run only:

1. `code-simplifier`
2. `code-quality-review`
3. `scrutinize`, including architecture fit, repository reuse, and the real
   system path
4. targeted verification of the real entrypoint and visible success or failure

Do not run completed-code discovery against intentionally incomplete POC
code. A later architecture-affecting change invalidates the first-proof
checkpoint.

Select affected-domain specialists from the exact diff, such as security,
documentation/agent alignment, AX/skill compatibility, data,
infrastructure, performance, migration, provider behavior, or UI. Every
selected specialist receives one outcome against the same immutable target.

Every required review type resolves through the catalog in
`scripts/review-contract.ts`. Do not launch a named reviewer without its
objective, evidence questions, decision criteria, and normalized output
contract.

## Immutable Task Packets

Give every delegated reviewer a bounded task packet containing:

- artifact path and fingerprint, or target base, resolved base SHA, HEAD, and
  diff identity;
- assigned reviewer contract and normalized output requirement;
- changed-file list or exact diff scope;
- applicable repository rules and accepted reuse/deviation decisions;
- current verification evidence and known gaps; and
- only accepted decisions required to interpret the target.

In Codex, default bounded reviewer delegation to `fork_turns="none"`. Use a
small recent-turn window only when the assignment genuinely depends on an
unresolved conversational decision. Full-thread inheritance is an exceptional
recovery path and requires a task-local rationale. Use the equivalent clean-
context mechanism in other harnesses.

## Inline Or Delegated Execution

Prefer one inline pass when the main thread already has the exact diff and the
change is small enough to inspect coherently. If delegation will be faster,
build the ready queue before launching, reserve coordinator capacity, and start
all independent review types together up to available capacity. Backfill freed
slots from that queue.

Join at one phase barrier after every required outcome arrives. Wait for
completion, failure, or a genuine stall instead of running short status-polling
loops. When capacity is lower than delegated work, use the minimum number of
waves. Never lower required type coverage to match a runtime ceiling.

Launch a wave only when its target is stable enough for that phase. More fanout
must not create knowingly stale review work.

## Findings Batch And Invalidation

Every review type returns `passed`, `finding`, or `blocked`. Include evidence
detail only for findings or blockers, except that every first-objective-proof
reviewer result records the exact evidence inspected even when it passes.
Normalize each finding with an ID, review
type, severity, affected location, issue, evidence, remediation outcome,
invalidated review or verification
surfaces, and exactly one disposition:

- `repair` for a required in-scope correction owned by Plan or Execute;
- `defer` for a nonblocking improvement that must not expand the current work;
- `plan_required` when the finding changes the accepted behavior,
  architecture, safety, ownership, migration, or delivery contract.

For planning targets, also classify the result as a durable artifact finding or
a task-local implementation consideration using the boundary above.

Hold mutation until the phase barrier. Deduplicate and reconcile overlapping
results into one task-local findings batch, then return it to Plan or the single
Execute owner. Read-only agents may investigate ambiguous findings or propose
tests concurrently; they never edit the implementation worktree.

After the findings batch is repaired, run one closure check limited to the
enumerated `repair` findings and affected verification. In that same closure
execution, return exactly one resolution record for every repair finding:

- `findingId` identifies the original finding;
- `resolutionEvidence` shows that its stated remediation outcome holds on the
  repaired head;
- `recheckedSurfaces` includes every review or verification surface invalidated
  by that finding; and
- `affectedVerificationPassed` records affected proof for that resolution.

Do not emit a resolution for a deferred or unknown finding. Closure fails when
a resolution is missing, duplicated, unevidenced, omits an invalidated surface,
has failed affected verification, or the repair remains semantically unresolved.
It defers unrelated nonblocking suggestions instead of opening another
discovery cycle.

For duplication, routing, lifecycle, reuse, or ownership findings, evidence
must name the surviving canonical owner, the alternate representation,
fallback, branch, or override removed, and the producer-to-consumer path
inspected. Passing tests or wrapping duplicate inputs in a composite value does
not prove that one owner remains.

A material scope, behavior, architecture, safety, migration, ownership,
delivery, or review-risk change returns to Plan or starts one new bounded
discovery pass against the new stable target. Ordinary repair commits do not
restart discovery. Start fresh completed-code discovery when a repair introduces
or materially changes a sibling helper, parser, handler, service, renderer, or
policy; a repeated schema, constant, identity, routing, or lifecycle invariant;
a feature branch in shared infrastructure; a second durable source of truth; a
canonical ownership or reuse decision; semantic validation; or accepted
success, failure, compatibility, or rollout behavior. Removing a branch,
reusing an existing constant, or moving derivation to the already accepted
owner stays in closure.

When a material repair starts fresh discovery, that replacement discovery
supersedes the earlier discovery and closure for technical readiness. Keep the
earlier evidence task-local; do not combine its resolution records with the
replacement discovery results. Build the checkpoint from the replacement
results and require closure only for repair findings produced by that discovery.

Normalize receipt-shape errors from evidence already returned by the current
closure execution; do not launch or re-prompt a reviewer merely to format the
receipt. Never invent missing substantive evidence. Keep that finding
unresolved and return it automatically to the same Execute owner without asking
the user. Start materially required rediscovery automatically. Ask the user
only for a genuinely new contract decision or reserved authority, never for a
routine repair, schema correction, deferred improvement, or arbitrary retry
limit.

A target-base change makes the checkpoint stale, but does not automatically
discard discovery. A patch-equivalent rebase may reuse it only after Review
confirms that the effective patch, base-sensitive context, required coverage,
and affected verification remain materially unchanged. Emit a fresh exact-
target checkpoint with that rebase evidence. Otherwise run one new discovery
pass.

## Planning Delivery Shape

Planning review verifies the artifact's reuse and deviation contract against
the live repository. For `delivery-shape`, challenge both under-splitting and
over-splitting. Each top-level OpenSpec unit must produce one reviewable
outcome, remain correct and safe before successors, own local proof, and have
coherent reviewer, risk, rollback, and deployment boundaries. Prefer stack
objective proof in unit 1, but permit one or two groundwork units first when
each has current standalone value, directly enables a named successor, and
reduces the size or risk of the first outcome MR. Block a third pre-outcome
unit, speculative or successor-dependent groundwork, and contradictory
proposal/task/MR topology.

Before a POC, treat the proposed topology as provisional. After an accepted
POC, the `delivery-shape` result is the authoritative final-topology gate. It
must carry structured evidence bound to the accepted POC head and reconciled
OpenSpec fingerprint, assess every proposed final unit, account for every
material POC footprint entry through one owning unit or a declared cross-unit
integration hotspot, compare that coverage with the authoritative material
footprint identifiers and fingerprint derived from the accepted POC, and
challenge the strongest plausible split and merge. The checkpoint lifecycle
discriminator is mandatory: `post_poc` consumes that accepted-POC context;
`atomic_or_pre_poc` is the only fast path without delivery-shape evidence.
Missing, stale, incomplete, unassigned, `split_required`, or `merge_required`
evidence blocks final Execute handoff. Record material topology change
independently of unit IDs; any material change requires user acceptance.

At the existing planning Review barrier, write the task-local checkpoint and
expected lifecycle context as one JSON input, then run
`pnpm exec tsx scripts/validate-planning-review.ts <task-local-checkpoint.json>`
from this skill folder. A passing command is
required before Plan hands the execution seed to Execute. Do not substitute
prose inspection or a direct library call that omits the lifecycle context.

When POC, prior implementation, MR, or incident evidence exists, stress-test
every unit against its actual footprint and ownership seams. A unit that
dominates the stack or crosses materially different ownership, activation,
security, rollback, review, or deployment boundaries remains under-split even
when the root contains valid early objective proof. Combine checkbox-only units
and split those independent seams without turning file count or churn into a
universal threshold. Keep exact footprint evidence task-local and retain only
the final topology and concise split rationale in the OpenSpec.

## Hosted Feedback

Review normalizes provider comments, automated review, CI, and approvals after
Finish performs the required provider interaction. Hosted gates never replace
local required coverage, and stale source-HEAD or target-base feedback never
passes. Apply the same one-batch and bounded-closure rule to hosted repair
feedback; only a material contract or risk change starts new discovery.

Use `github-adapter-review` for GitHub and `gitlab-adapter-review` for GitLab.
When active Fullscript policy selects Nitro, additionally use
`nitro-review-feedback`. Inspect the complete available feedback surface and
read the entire response and all unresolved Nitro-authored discussions;
reassuring summary language does not clear actionable feedback later in the
same response or carried forward to the effective diff. Do not request, poll,
normalize, or gate on Codex-authored PR review feedback;
`codex-review-feedback` remains retired.

Fullscript GitLab/Nitro retain their configured policies; this workflow changes
local review orchestration without weakening or replacing hosted gates.

Keep provider, artifact URL, target identity, normalized status, findings, and
execution routing task-local. Keep identities, transcripts, fingerprints,
retries, and mode state out of commits, trackers, and hosted descriptions.

## Compact Review Receipt

After discovery or closure, emit one compact task-local receipt derived only
from state already collected during Review:

```text
Review: discovery | MR !123 @ <head> | inline
- code-simplifier: passed
- code-quality-review: passed
- deslop: passed
- diff-review: passed
- scrutinize: passed
Findings: 0 repair, 0 defer, 0 plan_required
Local: passed | Nitro: pending | Readiness: pending
```

Use the phase, current MR head, routing, one outcome per required type, finding
counts, and local/hosted readiness. Do not run commands, verification, timers,
hashes, polling, extra reviews, or persistent ledgers to produce the receipt.

## Technical Readiness Checkpoint

After a hook-clean commit is pushed to a draft PR/MR and hosted review is
requested, emit a task-local `technical_readiness_checkpoint` only when all are
current for the exact hosted target:

- artifact identity;
- target-base ref, resolved SHA, and implementation HEAD;
- inspected target-base diff and hook evidence;
- every phase-specific review type and selected affected-domain specialist;
- one evidence-bearing resolution for every enumerated repair finding, covering
  its remediation outcome, invalidated surfaces, and affected verification;
- patch-equivalence and base-sensitive verification evidence when discovery is
  reused after a rebase;
- resolved provider route; and
- no blockers.

`scripts/review-contract.ts` validates complete type coverage, exact hosted
target identity, passing status, routing, specialist completion, one-to-one
repair resolutions, and complete affected-surface coverage. It rejects
unevidenced or unclosed repairs, closure scope expansion, material rebase
changes, and stale discovery. If evidence cannot be recovered after resume,
rerun the bounded work; never reconstruct persisted gate state.

For planning targets, the same script's planning-checkpoint validator binds
every required result to the exact artifact fingerprint before Execute handoff.

Review never reruns the repository full suite inline or through subagents. The
native pre-commit hook owns the full local suite for each committed head;
Review consumes that hook evidence and runs only inspection or affected closure
proof.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Running full completed-code discovery at first POC proof | Run Code Simplifier, Code Quality, Scrutinize, and targeted proof only; defer Deslop and Diff Review. |
| Starting one subagent per required type for a small change | Cover all types in one integrated inline pass. |
| Passing full conversation history to every reviewer | Use the immutable task packet and clean context. |
| Launching or polling reviewers one at a time | Fill ready worker slots and join at a phase barrier. |
| Fixing each finding as it arrives | Close the barrier, deduplicate, then send one findings batch to the owner. |
| Restarting discovery after an ordinary repair | Run one closure check against the repair batch and affected proof. |
| Closing findings by ID without semantic proof | Record one evidenced resolution per repair finding and recheck every invalidated surface. |
| Asking the user to resolve routine convergence | Return in-scope work to Execute or start materially required rediscovery automatically. |
| Treating every rebase as materially new | Verify patch equivalence, base-sensitive context, required coverage, and affected proof first. |
| Rerunning the full suite during Review | Consume the commit-hook result and inspect the exact MR head. |
| Producing elaborate review proof | Emit the compact receipt from already collected state. |
| Persisting reviewer ledgers or gate state | Keep evidence task-local and recomputable. |
| Treating Nitro or CI as local Review | Evaluate it as a separate hosted gate. |
| Reviewing code while deferring completed archive state | Inspect implementation, canonical specs, tasks, and the dated archive on the same final head. |

## Test Evidence

- RED: closure could record only finding IDs plus one global verification bit,
  so the checkpoint could not require semantic resolution evidence or prove
  that every invalidated surface was rechecked; later review could rediscover
  the surviving simplification or duplicate-ownership problem.
- GREEN: contract fixtures and pressure scenarios require one evidenced
  resolution per repair, reject a composite wrapper that preserves duplicate
  authority, escalate a handwritten parser, and keep correct single-owner and
  local-cleanup repairs bounded.
- RED: the earlier archive sentence did not tell Review whether canonical specs
  and the dated archive belonged to its final exact-head target.
- GREEN: revised pressure scenarios keep implementation, completed tasks,
  canonical specs, active-namespace absence, and the archive on one target and
  invalidate that result after any closure repair.
- REFACTOR: fixtures close missing, duplicate, unknown, unevidenced, incomplete-
  surface, and failed-verification loopholes, and replacement discovery
  supersedes old closure evidence without another review execution, persistent
  workflow state, or review-time suite run.
