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
`simplification-and-scope`, `refactoring-opportunities`, and `delivery-shape`.
Completed-code types are `code-simplifier`, `code-quality-review`, `deslop`,
`diff-review`, and `scrutinize`. Record one current `passed`, `finding`, or
`blocked` outcome for every type. Add affected-domain specialists only when the
exact target exposes their domain.

Atomic plans and OpenSpec artifacts are planning contracts. Review them here;
do not also invoke Doc Smith reader personas.

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

At a POC's first objective proof, run only:

1. `code-quality-review`
2. `scrutinize`, including architecture fit, repository reuse, and the real
   system path
3. targeted verification of the real entrypoint and visible success or failure

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
detail only for findings or blockers. Normalize each finding with an ID, review
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
enumerated `repair` findings and affected verification. Closure passes when the
repairs and affected behavior pass. It defers unrelated nonblocking suggestions
instead of opening another discovery cycle, and fails when a repair remains
unresolved or the affected behavior exposes a blocking defect.

A material scope, behavior, architecture, safety, migration, ownership,
delivery, or review-risk change returns to Plan or starts one new bounded
discovery pass against the new stable target. Ordinary repair commits do not
restart discovery.

A target-base change makes the checkpoint stale, but does not automatically
discard discovery. Review may reuse it only after confirming that the effective
patch, base-sensitive context, required coverage, and affected verification
remain materially unchanged. Emit a fresh exact-target checkpoint with that
rebase evidence. Otherwise run one new discovery pass.

## Planning Delivery Shape

Planning review verifies the artifact's reuse and deviation contract against
the live repository. For `delivery-shape`, challenge both under-splitting and
over-splitting. Each top-level OpenSpec unit must produce one reviewable
outcome, remain correct and safe before successors, own objective proof, and
have coherent reviewer, risk, rollback, and deployment boundaries. Combine
checkbox-only units and split materially different ownership, activation,
security, rollback, or deployment seams.

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
- one successful closure result for the enumerated repair findings and affected
  verification, when repairs occurred;
- patch-equivalence and base-sensitive verification evidence when discovery is
  reused after a rebase;
- resolved provider route; and
- no blockers.

`scripts/review-contract.ts` validates complete type coverage, exact hosted
target identity, passing status, routing, and specialist completion. It rejects
unclosed repairs, closure scope expansion, material rebase changes, and stale
discovery. If evidence cannot be recovered after resume, rerun the bounded
work; never reconstruct persisted gate state.

Review never reruns the repository full suite inline or through subagents. The
native pre-commit hook owns the full local suite for each committed head;
Review consumes that hook evidence and runs only inspection or affected closure
proof.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Running completed-code discovery at first POC proof | Run Code Quality, Scrutinize, and targeted proof only. |
| Starting one subagent per required type for a small change | Cover all types in one integrated inline pass. |
| Passing full conversation history to every reviewer | Use the immutable task packet and clean context. |
| Launching or polling reviewers one at a time | Fill ready worker slots and join at a phase barrier. |
| Fixing each finding as it arrives | Close the barrier, deduplicate, then send one findings batch to the owner. |
| Restarting discovery after an ordinary repair | Run one closure check against the repair batch and affected proof. |
| Treating every rebase as materially new | Verify patch equivalence, base-sensitive context, required coverage, and affected proof first. |
| Rerunning the full suite during Review | Consume the commit-hook result and inspect the exact MR head. |
| Producing elaborate review proof | Emit the compact receipt from already collected state. |
| Persisting reviewer ledgers or gate state | Keep evidence task-local and recomputable. |
| Treating Nitro or CI as local Review | Evaluate it as a separate hosted gate. |

## Test Evidence

- RED: small changes launched one subagent per catalog type before publication,
  waited on slow reviewers after focused proof passed, and repeated full
  discovery after narrow repairs.
- GREEN: contract fixtures require every phase type while allowing one inline
  execution identity, require the hosted artifact, close only affected types,
  and preserve discovery only with patch-equivalent rebase evidence.
- REFACTOR: fixtures reject missing type coverage, unclosed repairs, closure
  scope expansion, blocking affected-behavior defects, and materially changed
  rebase context without adding persistent workflow state or review-time suite
  runs.
