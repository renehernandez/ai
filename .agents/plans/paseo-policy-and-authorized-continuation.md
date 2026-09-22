# Policy-aware delivery and authorized continuation

## Objective

Make the managed Pi/Paseo runner represent the delivery path the user actually
approved: repositories without hosted verification can publish truthfully, and
an explicitly authorized follow-up review and repair can advance the same task
without stale publication bookkeeping blocking delivery. Preserve finite default
limits, exact-target evidence, and separately scoped terminal authority.

## Accepted scope

Deliver one atomic plan plus implementation in one Ready AI-repository PR,
without a separate planning PR or POC. Extend the existing runner, provider
probes, and owning instructions; do not add another tracker or orchestrator.
The earlier new-sessions-only limit remains the default rollout. The explicit
exception is supported, opt-in recovery of existing states affected by a
user-authorized follow-up, including dashboard PR #2. No bulk migration or
birthday-workflow recovery is included. The Paseo default-planner UI feature
remains deferred.

This tooling delivery does not authorize dashboard merge, installation update,
deployment, or live workflow-state modification. Supply the supported recovery
procedure and prove it against an isolated copy. Actual recovery belongs to its
single task owner after the merged tooling is installed and authority verified.

## Reuse and deviation

Canonical state transitions, exact-action waivers, locking, and receipts live in
`skills/handoff-brief/scripts/paseo-workflow-state.ts`. The adjacent runner owns
review reservations, immutable snapshots, handoff, and finite monitoring.
`skills/finish/scripts/paseo-hosted-probe.ts` and its provider helpers own hosted
readback. The Pi/Paseo workflow reference owns the managed lifecycle contract;
AGENTS.md remains the repository delivery-policy source. Extend these owners and
the existing workflow/probe regression suites and charter behavior scenarios.

Current receipts require Genie or Nitro; hosted waivers require an existing
publication. Publication and repair slots are write-once, current hosted target
is derived from the original publication or hosted repair, and completion blocks
all transitions. These owners cannot currently express intentionally absent
reviewers or a subsequent user-authorized batch. Add only the policy and bounded
continuation state needed to express those paths. Cohesively extract state
logic if necessary rather than further enlarging already oversized modules.

## This tooling change's delivery policy

The user explicitly confirmed that this AI repository currently requires neither
hosted CI nor an automated hosted reviewer, and directed removal of its Genie
requirement. Treat both gates as not required, not waived or passed. Persist this
repository-wide policy in AGENTS.md and align the canonical AI-repository routing
rule and other directly contradictory guidance during implementation. Preserve
the work-profile Fullscript Nitro policy and unrelated repositories' policies.
Do not install CI or a reviewer as part of this change. Local verification,
native hooks, managed local review, and Ready artifact identity readback remain
required. Before implementation handoff, carry this user disposition explicitly
so the old installed Genie requirement cannot override the accepted policy.

## Delivery policy

Resolve CI and hosted-review policy independently during planning, before
implementation handoff. Each is explicitly required, not required, or unknown.
Unknown policy prompts one material question during planning and blocks handoff
until answered, rather than failing after implementation. Absence of provider
configuration or an empty check list alone does not establish not-required policy.

Persist user-approved repository-wide policy in that repository's AGENTS.md
under its normal write authority; read-only discovery never edits it. Carry the
resolved policy, provider/repository identity, source location, and source
fingerprint in task state and the handoff. Keep temporary exceptions private.
Detect material policy-source changes at delivery and re-resolve them rather
than silently using a stale snapshot. Generic personal-profile Genie policy
must not override explicit project policy.

A not-required gate is neither passed, failed, nor waived. A repository can have
CI without a reviewer, a reviewer without required CI, both, or neither. No
reviewer means no fabricated bot identity, review request, or absent-bot polling.
Required but unavailable, failed, pending, or unknown evidence stays visible;
policy cannot erase observed failures or silently waive a required gate.
Publication and exact-action exceptions must be representable without a
pre-publication hosted-waiver deadlock. Artifact identity and Ready state still
require readback even when both hosted verification gates are not required.

## Bounded continuation

Keep the ordinary one local review round per phase, one local repair batch, and
one hosted repair batch. Only a new explicit user instruction authorizes a
follow-up batch. Record its source, bounded purpose, allowed phases, same-task
and artifact identity, expected predecessor head, and distinct batch identity.
Merge or deployment wording alone does not authorize extra review/repair rounds;
a request for extra review/repair does not grant terminal authority.

Within the existing state file, retain completed batch history and one active
batch. Preserve prior snapshots, reviewer identities, findings, decisions,
repairs, publications, failed gates, waivers, and completion records rather
than clearing flags or replacing history. Dispatch and repair limits apply to
the authorized batch; reservations remain atomic and retries cannot duplicate
workers or consume a second batch. A bookkeeping reconciliation alone never
launches agents. Uncertain launches, corrupt state, missing required snapshots,
and uncertain writer ownership remain hard blockers.

Support both follow-up work authorized before edits and reconciliation of
already-performed follow-up work with verifiable authorization and evidence.
Recovery may adopt existing complete, target-bound evidence; it must not invent
reviews, dispatch replacements automatically, or retrospectively assert that
unreviewed repairs received independent review. Missing current evidence stays
an explicit gate until satisfied or exactly waived where permitted.

## Publication and terminal gates

Provide a supported continuation/reconciliation transition and subsequent
publication recording. Validate live repository remote, artifact host and
identity, source branch/head, target branch/base, Ready/open state, and local
worktree identity. Use expected prior state and live-head comparison to reject
races, stale requests, mismatched PRs, and unrelated changes. Failed validation
leaves prior state intact. Repeating an identical successful recovery is
idempotent; changed inputs require new validation, not another automatic batch.

Bind every new publication and evidence record to its batch and actual target.
Old-head review reports, CI, and waivers remain historical and do not satisfy
new-head gates. Preserve the distinction between reviewed head and verified
repair head. Base changes also invalidate base-sensitive evidence. Immediately
before a terminal action, evaluate the actual current source/base and hosted
identity against the recorded gate disposition; do not rely solely on the
runner's last remembered head. The terminal owner must independently hold
scoped user authority. Gate success or a waiver grants no merge, deployment,
installation, cleanup, or destructive authority.

Report bookkeeping mismatch, failed CI, missing review evidence, and missing
authority as separate plain-language conditions with the next owning action.
Agents operate internal state transitions; users answer material decisions,
not edit workflow JSON or run recovery bookkeeping themselves.

## Existing-state recovery and rollout

Support validated legacy state through the canonical runner, under its lock,
with an atomic upgrade and preserved original evidence. Unknown or inconsistent
state formats fail without modification. Finished legacy tasks may open only
an explicitly authorized bounded continuation; prior completion remains history.
No state deletion, replacement initialization, hand-edited JSON, or duplicate
worker launch is permitted. Do not interpret a legacy Genie field as proof that
Genie was configured when its own evidence says otherwise; re-resolve policy.

The dashboard procedure must inspect the original state and immutable evidence,
verify sole ownership and the original follow-up instruction, inspect the live
PR, preview reconciliation, then apply the supported transition when authorized.
If its live head has moved from the reported repaired head, stop and re-evaluate
instead of forcing that historic target. Record current CI and local review/
repair evidence separately from the old hosted collection error. Missing bot
policy or evidence remains a separate issue after bookkeeping is repaired.
Return an exact-current-target disposition to the dashboard owner; do not merge
or install as part of tooling delivery.

Before merge, exercise all AX behavior using isolated HOME and runtime roots,
including an isolated copy of the dashboard state. Do not patch the live managed
runtime or originals. Install merged tooling only through normal AX default-
branch synchronization. Preserve native hooks, single-writer ownership,
force-push prohibition, and fixed managed role/model routing.

## Acceptance and proof

First visible proof: reproduce the stale-publication waiver rejection and the
no-reviewer publication deadlock through the existing runner entrypoint, then
show both supported paths succeeding with honest evidence and no terminal
mutation. Use independent hosted/transport fixtures, not state assertions alone.

Prove the four CI/reviewer policy combinations, unknown-policy handoff blocking,
approved AGENTS.md persistence and handoff, policy drift, and action-scoped
waivers that retain failed evidence. Empty valid provider collections must not
crash; empty or malformed command output must not become passing evidence.
Exercise the real command boundary that produced the parsing error before
choosing a parser repair. Retain complete per-lens owner fallback for degraded
reviewers without replacement dispatch.

Prove an authorized follow-up review, repair, subsequent publication, fresh
hosted collection, and exact-current-head terminal evaluation; reject extra
unauthorized batches, stale heads/bases/waivers, mismatched artifacts, uncertain
ownership, and concurrent duplicate recovery. Verify history preservation,
idempotent recovery, already-completed follow-up adoption, and rejection of
unsupported legacy state without data loss. No test may infer terminal authority
from a gate disposition or treat a bookkeeping repair as a quality pass.

Run focused workflow and hosted-probe unit tests, isolated runtime integration
proof, project lint/format and native hook suites, and writing-skills RED/GREEN
pressure scenarios for changed instructions. Update charter owner/scenario
coverage and remove contradictory one-shot guidance within the canonical owner.
Run one planning review round and one implementation review round using managed
roles, with fallback assessments for degraded evidence. Publish Ready under the
user-confirmed AI-repository policy with neither hosted CI nor automated review
required; do not request Genie or poll absent gates. Verify the live artifact
identity and report local evidence separately. No merge is authorized.

## Delivery boundary and risk

One coherent outcome is truthful, current-target delivery within the existing
finite workflow. Policy, publication history, recovery, and gate evaluation
share the same state invariants; separating incompatible receipt/state changes
would create unsafe intermediate behavior. Keep UI defaults, generic workflow
engines, bulk migration, new dependencies, and unrelated refactors out of scope.
Target the normal review budget; reassess the effective diff before delivery.
If the implementation exceeds the hard file/line threshold, return with concrete
split evidence or seek a scoped size exception rather than discovering the cap
after claiming delivery readiness. The principal risks are stale evidence
reuse, unauthorized batch reopening, policy drift, and recovery data loss;
exact-target validation, immutable history, finite reservations, and isolated
regression proof are required controls.
