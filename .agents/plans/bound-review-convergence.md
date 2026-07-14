# Bound Review Convergence

## Goal

Reduce time to a published draft MR without weakening required review coverage.
Keep plans and OpenSpecs outcome-focused as established by MR !198.

## Approach

- During implementation, run focused verification for the changed behavior.
  The pre-commit hook owns the full local suite; review agents inspect its
  evidence and do not rerun that suite.
- After a hook-clean commit, push and create or update the draft MR. Request
  Nitro, then start local Review against the same exact MR head so hosted and
  local review proceed concurrently.
- Cover every existing phase-specific review type. A small coherent change may
  receive one integrated inline pass in the main agent thread. Use parallel
  subagents only when separate review concerns can complete faster that way.
  Readiness depends on coverage outcomes, not separate reviewer identities.
- Emit one compact task-local review receipt with the review phase, current MR
  head, execution routing, one outcome per required type, finding counts, and
  local/Nitro readiness. Derive it only from state already collected during the
  review; it must not trigger extra commands, timers, hashes, persisted ledgers,
  or review runs.
- Normalize current-head local and hosted findings into one batch. Required
  in-scope repairs return to the owner, optional improvements are deferred, and
  material contract changes return to Plan.
- After repairs, let the next commit hook rerun the full suite, then run closure
  only for affected review types and verification after requesting refreshed
  Nitro for the same new head. Start new discovery only for a material contract
  or review-risk change.
- Preserve review across a rebase only when the effective patch, base-sensitive
  context, required coverage, and affected verification remain materially
  unchanged.

## Scope

Move local Review from a pre-publication gate to a technical-readiness gate.
Extend the existing reviewer catalog, task-local findings batch, phase barrier,
exact-head evidence, and Finish follow-through; add no orchestration layer.

Keep provider-required CI and Nitro policy, lifecycle modes, Direct Execute
eligibility, OpenSpec POC proof, and `writing-skills` policy unchanged. Add no
review types, reviewer skills, persistent ledgers, route envelopes, accepted-
contract hashes, or retroactive cleanup.

## Reuse And Deviation

Reuse the current phase-specific review catalogs as mandatory coverage and the
pre-commit hook as the canonical full-suite owner. Reuse the draft MR as the
shared exact-head surface for local and hosted review.

The material deviations are:

- draft publication requires a hook-clean commit but not completed local
  review;
- required review types may be covered inline or distributed across subagents,
  without one identity per type; and
- the complete local and hosted gate authorizes technical readiness rather than
  initial draft publication.

## Acceptance

- A hook-clean commit can publish a draft MR before local review completes.
- Nitro is requested before local Review starts, and both inspect the same MR
  head concurrently.
- Every required review type has a current `passed`, `finding`, or `blocked`
  outcome, regardless of whether coverage ran inline or through subagents.
- Review output shows each required type and its outcome, plus discovery versus
  closure, routing, finding counts, and local/Nitro gate status in one compact
  receipt. Evidence detail appears only for findings.
- Producing that receipt adds no verification, polling, review pass, or durable
  workflow artifact.
- Neither inline Review nor review subagents rerun the full suite; the pre-
  commit hook is the full-suite authority for every committed head.
- Local and hosted findings converge into one in-scope repair batch without
  optional suggestions expanding the change.
- Repair closure covers only affected review types and verification. Material
  contract or review-risk changes require new discovery.
- Technical readiness requires current local coverage, required provider gates,
  resolved in-scope findings, and successful closure when repairs occurred.
- A patch-equivalent rebase can preserve review only after base-sensitive
  validation and a fresh exact-target readiness checkpoint.

## First Real Confirmation

A representative small change runs focused verification, commits through the
full-suite hook, publishes a draft MR, requests Nitro, and completes all local
review types in one inline pass while Nitro runs. Any repair receives one new
hook run, a refreshed Nitro request, and bounded local closure on the same head,
without another full discovery round.

## Delivery

Amend this plan and its implementation in existing draft MR !199 from
`codex/bounded-review-convergence` to `main`. No OpenSpec or POC is required.
