# Evidence-Bearing Review Closure

## Objective

Make bounded repair closure prove that each original in-scope finding is
semantically resolved, including simplification, reuse, and canonical-ownership
findings that can survive a superficially plausible repair. Preserve the
current review workflow's latency and autonomy: no additional reviewer pass,
full-suite run, provider request, durable state, or routine user decision.

## Current Gap

The merged review-convergence workflow correctly runs one discovery pass,
batches findings, returns repairs to the single Execute owner, and limits
closure to affected review and verification surfaces. Its deterministic
closure receipt currently proves only that repair finding IDs were revisited
and that affected verification passed globally.

That receipt cannot prove that the closure reviewer checked the requested
remediation outcome on the repaired head, re-inspected every surface
invalidated by the finding, or rejected a repair that merely repackages the
same duplicate configuration, alternate path, or ownership problem. A later
full review can therefore discover simplification opportunities that bounded
closure should already have caught.

## Selected Approach

### Make each repair finding carry its own closure proof

Replace the closure receipt's loose finding-ID list and global verification
boolean with exactly one resolution record for every discovery finding whose
disposition is `repair`. `ClosureResult.resolutions` contains records with:

- `findingId`, the original finding ID;
- `resolutionEvidence`, concise evidence that the finding's stated remediation
  outcome holds on the repaired head;
- `recheckedSurfaces`, the review and verification surfaces rechecked because
  of that repair; and
- `affectedVerificationPassed`, the affected-verification result for that
  resolution.

The deterministic readiness validator requires a one-to-one relationship
between repair findings and resolution records. It rejects missing, duplicate,
unknown, blank, or scope-expanded records; incomplete surface coverage; blank
or duplicate rechecked surfaces; and failed affected verification. Deferred
findings never receive resolution records.

For duplication, reuse, routing, lifecycle, or ownership findings, sufficient
resolution evidence identifies the surviving canonical owner, the alternate
representation, fallback, branch, or override that was removed, and the
producer-to-consumer path inspected. The existing `remediationOutcome` remains
the postcondition that closure evaluates; no architecture-specific field is
required on every finding.

### Keep closure bounded unless the repair changes review risk

The same closure reviewer inspects the repair diff and either completes the
per-finding resolutions or reports that the repair materially changed the
review risk. Ordinary local repairs remain in bounded closure. Fresh completed-
code discovery is required when the repair introduces or materially changes:

- a sibling helper, parser, handler, service, renderer, or policy;
- a repeated schema, constant, identity, routing, or lifecycle invariant;
- a feature-specific branch in shared infrastructure;
- a second durable source of truth;
- a canonical ownership or reuse decision;
- schema or semantic validation; or
- accepted success, failure, compatibility, or rollout behavior.

This reuses the existing rule that a material review-risk change invalidates
discovery. It adds no new pass or persisted routing mechanism. Removing a
branch, replacing a literal with its existing canonical constant, or moving a
derivation to the already accepted owner stays in closure. Introducing a
handwritten parser, a generic parser-claim protocol, a second configuration
representation, or weakened schema validation starts fresh discovery
automatically. Replacement discovery supersedes the earlier discovery and
closure in the final readiness checkpoint; the superseded evidence remains
task-local instead of requiring lineage state in the checkpoint schema.

### Preserve autonomous convergence

Receipt-shape errors are normalized by the coordinator from the evidence
already returned by the current closure execution; they do not launch or
re-prompt a reviewer. Missing substantive resolution evidence is not treated as
a formatting problem or invented by the coordinator: the finding remains
unresolved and returns automatically to the same Execute owner. A concrete
material review-risk change starts fresh discovery without asking the user.
New nonblocking improvements are deferred and cannot hold technical readiness.

User input is required only for a genuinely new material contract decision or
authority reserved to the user, such as merge. There is no arbitrary retry cap
that converts routine repair convergence into user steering.

## Performance And Completion Constraints

- Run zero additional reviewer executions compared with the current bounded-
  closure workflow.
- Run zero additional full-suite executions; the hook remains the full-suite
  owner for each committed head.
- Make zero additional provider calls beyond the current exact-head refresh
  behavior.
- Add no polling, timers, persistent ledger, database, agent type, hook, or
  dependency.
- Build and validate the receipt in linear time over the findings and their
  affected surfaces.
- Request resolution records only for findings dispositioned to repair.
- Never let a nonblocking improvement, receipt formatting error, or ordinary
  in-scope repair put the user back into the control loop.

## Reuse And Deviation Contract

### Inspected precedents and canonical owners

- `.agents/plans/review-workflow-parallelization.md` owns the accepted
  immutable review packets, one findings barrier, single-writer repair batch,
  and affected-surface convergence model.
- `.agents/plans/bound-review-convergence.md` owns the merged one-discovery,
  one-hook-per-head, bounded-closure, and material-review-risk invalidation
  decisions.
- `skills/review/SKILL.md` owns discovery, closure behavior, technical
  readiness, and user-escalation boundaries.
- `skills/review/scripts/review-contract.ts` owns the deterministic finding,
  closure, and readiness contracts.
- `tests/unit/review-workflow-contract.test.ts` owns focused regression proof
  for the machine-enforced Review contract.
- `skills/execute/SKILL.md` owns the single writer and automatic in-scope repair
  loop; the pre-commit hook remains the full-suite verification owner.

### Direct reuse and extension

Extend Review's existing closure result and readiness validator instead of
adding another reviewer, orchestration layer, or workflow state. Reuse each
finding's remediation outcome and invalidated surfaces as the canonical inputs
to its resolution proof. Reuse the existing closure findings collection for
new deferred improvements and the current material-review-risk route for fresh
discovery. When discovery produced no repair findings, no closure receipt is
required.

### Justified deviation

The closure receipt becomes evidence-bearing per finding because a set of IDs
plus one global verification boolean cannot establish semantic resolution or
affected-surface coverage. This is an internal task-local contract with no
persisted compatibility surface. No other lifecycle owner or provider contract
changes.

End-to-end proof must exercise the real Review receipt and readiness validator,
then pressure-test the reviewer instructions against repairs where syntax and
tests alone are insufficient.

## Acceptance

- Every repair finding has exactly one complete resolution on the repaired
  head, and no deferred or unknown finding can be represented as resolved.
- Each resolution demonstrates the original remediation outcome and covers all
  surfaces invalidated by that finding.
- A repair that combines two mutable configuration inputs behind a composite
  value remains unresolved when it preserves the original duplicate authority.
- A correct repair that derives one snapshot from one canonical owner passes
  bounded closure without a fresh full discovery pass.
- A handwritten YAML or equivalent local parser workaround triggers fresh
  completed-code discovery because it introduces material review risk.
- A simple local cleanup remains in bounded closure.
- Reviewer mutation attempts remain rejected; the Execute owner performs every
  repair.
- Malformed closure output is corrected task-locally without user prompting.
- New blocking defects or material ownership and architecture changes prevent
  readiness and route automatically to Execute or fresh discovery as
  appropriate.
- New nonblocking improvements are recorded for deferral and do not block
  readiness.
- Contract tests preserve one discovery pass, one findings batch, affected-only
  closure, hook-owned full-suite verification, and no routine user escalation.
- Shared behavior changes pass `writing-skills` pressure scenarios and the
  repository's native verification without dependency or lockfile changes.

## First Real Confirmation

The changed Review behavior rejects a shallow composite-configuration repair,
escalates a handwritten parsing workaround to fresh discovery, and accepts a
single-owner derivation through bounded closure. All three outcomes use the
existing closure execution and hook evidence, so the successful path adds no
review pass, full-suite run, provider call, or user interaction.

## Delivery Shape

Deliver this plan and its implementation as one atomic change in one draft MR
from `codex/evidence-bearing-review-closure` to `main`. No OpenSpec, POC,
separate planning MR, new dependency, or live runtime sync is required.

Keep the detailed contract centralized in Review and align Execute or shared
rules only where their existing repair and escalation promises would otherwise
contradict it. Reviewer scratch, receipts, fingerprints, and pressure-test
evidence remain task-local.

## Out Of Scope

- An unconditional cold whole-diff review after every repair.
- A persistent review-escape ledger or private orchestration store.
- Architecture-specific fields such as `canonicalOwner` on every finding.
- Additional reviewer identities, provider reviewers, or retry policies.
- Changes to merge, deployment, cleanup, or other reserved authority.
