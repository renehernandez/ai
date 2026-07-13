---
name: review
description: Use when inspecting a planning artifact, code diff, POC head, final implementation head, or hosted review finding without mutation.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Review

## Authority

Review is read-only. It inspects one exact artifact fingerprint, target-base
diff, or Git HEAD and never fixes, commits, publishes, polls through provider
mutation, or merges. For non-trivial entry, announce `Review`, read-only
authority, and the target once.

## Phase-Specific Baselines

Use `scripts/review-contract.ts` to select the deterministic baseline.

Planning or OpenSpec targets run:

1. `implementation-readiness`
2. `edge-cases-and-risk`
3. `simplification-and-scope`
4. `refactoring-opportunities`
5. `delivery-shape`

Atomic plans and OpenSpec artifacts are planning contracts. Review them here;
do not also invoke Doc Smith reader personas. During planning convergence,
rerun only reviewer lanes invalidated by an edit. Before Execute handoff, run
the complete planning baseline once against the final artifact fingerprint.

At a POC's first objective proof, run only:

1. `code-quality-review`
2. `scrutinize`, including architecture fit, repository reuse, and the real
   system path
3. targeted verification of the real entrypoint and visible success or failure

Do not run the completed-code baseline against intentionally incomplete POC
code. A later architecture-affecting change invalidates the first-proof
checkpoint.

Completed POC and final implementation targets require five separate reviewer
runs:

1. `code-simplifier`
2. `code-quality-review`
3. `deslop`
4. `diff-review`
5. `scrutinize`

The writer, coordinator, hosted bots, and automated tests do not count as
reviewer identities. Each required reviewer uses a distinct task-local
reviewer-run identity and inspects the same immutable target. The five reviewer
contracts retain correctness, regression, maintainability, verification, and
architecture-fit/reuse coverage without treating coverage labels as substitute
reviewers.

Select affected-domain specialists from the exact diff and risk profile, such
as security, documentation/agent alignment, AX/skill compatibility, data,
infrastructure, performance, migration, provider behavior, or UI. Every
selected specialist uses another distinct reviewer-run identity. Record the
task-local rationale for selected specialists and risk-relevant omissions.

Every baseline reviewer ID resolves through the catalog in
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

## Work-Conserving Review Waves

Build the dependency graph and ready queue before delegation. Reserve
coordinator capacity, then launch all currently ready reviewers together up to
the available worker capacity. Backfill each freed worker slot immediately from
the ready queue.

Join at one phase barrier after all required results arrive. Wait for
completion, failure, or a genuine stall instead of running short status-polling
loops. When capacity is below the required reviewer count, preserve every
reviewer across the minimum number of waves. Never lower coverage to match a
runtime ceiling.

Launch a wave only when its target is stable enough for that phase. More fanout
must not create knowingly stale review work.

## Findings Batch And Invalidation

Every reviewer returns `passed`, `finding`, or `blocked` with source evidence.
Normalize each finding with reviewer, severity, affected location, issue,
evidence, remediation outcome, and invalidated review or verification surfaces.

Hold mutation until the phase barrier. Deduplicate and reconcile overlapping
results into one task-local findings batch, then return it to Plan or the single
Execute owner. Read-only agents may investigate ambiguous findings or propose
tests concurrently; they never edit the implementation worktree.

After a findings batch is fixed, rerun only affected reviewers and verification
surfaces during intermediate convergence. A material scope, architecture,
safety, migration, ownership, or delivery change returns to Plan. Before final
handoff or publication, run the complete required baseline on the stable exact
target.

Any implementation HEAD or resolved target-base SHA change invalidates the
complete publication checkpoint even when intermediate reviewer evidence was
lane-scoped.

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
the local baseline, and stale source-HEAD or target-base feedback never passes.

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
reviewer-run identity task-local. Keep identities, transcripts, fingerprints,
retries, and mode state out of commits, trackers, and hosted descriptions.

## Publication Checkpoint

Before every push, PR/MR creation, or PR/MR update, emit a task-local
`publication_checkpoint` only when all are current for the exact target:

- target-base ref, resolved SHA, and implementation HEAD;
- inspected target-base diff and hook evidence;
- all five distinct findings-only reviewer runs;
- every selected affected-domain specialist on a distinct identity;
- resolved provider route; and
- no blockers.

`scripts/review-contract.ts` validates reviewer selection, exact target
identity, passing status, reviewer-run independence, exclusions, and specialist
completion. Any HEAD or resolved target-base SHA change makes the checkpoint
stale. If evidence cannot be recovered after resume, rerun it; never reconstruct
persisted gate state.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Running the completed-code baseline at first POC proof | Run Code Quality, Scrutinize, and targeted proof only. |
| Counting coverage labels as separate reviewers | Require the five distinct reviewer skills and identities. |
| Passing full conversation history to every reviewer | Use the immutable task packet and clean context. |
| Launching or polling reviewers one at a time | Fill ready worker slots and join at a phase barrier. |
| Fixing each finding as it arrives | Close the barrier, deduplicate, then send one findings batch to the owner. |
| Reusing a partial review as the final gate | Run the complete stable-target baseline before handoff or publication. |
| Persisting reviewer ledgers or gate state | Keep evidence task-local and recomputable. |
| Treating Nitro or CI as local Review | Evaluate it as a separate hosted gate. |

## Test Evidence

- RED: lane strings could satisfy publication without distinct reviewer-run
  identities, and the complete POC baseline ran at both first proof and final
  head.
- GREEN: contract fixtures require five distinct final reviewer runs, two
  independent first-proof reviewers plus targeted proof, and every selected
  specialist.
- REFACTOR: capacity fixtures preserve coverage across minimum waves while
  task-packet and barrier guidance removes context and polling churn.
