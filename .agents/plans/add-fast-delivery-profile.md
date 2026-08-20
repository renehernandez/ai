# Add Fast Delivery Profile

## Goal

Give Rene two explicit delivery profiles for Fullscript GitLab work that uses
Nitro: keep the current reviewed workflow as the default, and add an opt-in fast
workflow that reaches a Ready merge request after one implementation pass and
uses required CI plus Nitro feedback as its post-publication review loop.

## Approach

- Preserve `standard` as the default delivery profile. It retains the current
  atomic-plan and OpenSpec routes, mandatory OpenSpec POC, local planning and
  implementation Review, draft-first publication, and technical-readiness
  checkpoint.
- Add an explicit-only `fast` delivery profile inside the existing Explore,
  Plan, Execute, Review, and Finish lifecycle. It is a profile of those modes,
  not a sixth lifecycle mode or a new orchestration skill.
- Treat a clear user selection of fast delivery as acceptance of the fast
  action path. A concrete request may proceed directly to Execute without a
  separate brainstorming response or committed planning artifact. Normal
  repository setup remains part of Execute and is not exposed as a preflight
  phase, report, checkpoint, or user pause.
- Limit fast delivery to one coherent final MR with settled behavior and an
  active Fullscript Nitro review policy. If implementation exposes a material
  decision, an independently reviewable multi-unit shape, a durable
  cross-component contract, a migration design, or a need for rehearsal, stop
  writes and return to Plan instead of silently weakening or widening either
  profile.
- In fast delivery, run affected project-native verification while
  implementing and commit through the native hooks. Skip the completed-code
  local Review wave and reviewer subagents.
- Publish the hook-clean source head directly as Ready, request Nitro after
  publication and every repair push, and monitor the newest required pipeline
  graph plus the complete exact-head Nitro response and discussions.
- Return all in-scope actionable hosted findings to Execute in one batch when
  practical. Each repair commit remains hook-clean and receives fresh CI and
  Nitro evidence. Advisory feedback may be dispositioned only under the
  existing semantic feedback rules or direct user scope.
- Complete fast delivery only when the current Ready MR head has passing
  required CI, a semantically clean exact-head Nitro result, and no unresolved
  actionable discussion. Fast delivery never authorizes merge, deployment, or
  cleanup.

## Reuse And Deviation Contract

Reuse `rules/investigation-and-implementation.md` as the canonical owner of
delivery routing and accepted authority, `rules/git-and-review.md` as the owner
of publication and Ready state, and `rules/fullscript/nitro-review.md` as the
owner of exact-head Nitro request and feedback closure. Extend the existing
Explore, Execute, Review, Finish, and change-request creation guidance as thin
consumers; do not add a parallel lifecycle, publisher, monitor, reviewer, or
preflight mechanism.

The new mechanism is one explicit delivery-profile discriminant. Existing
owners cannot express both draft-first local Review and Ready-first hosted
Review without that discriminant. The intentional deviations in `fast` are:
no committed plan, no POC, no local completed-code Review, and Ready-on-create.
Native hooks, delivery budgets, exact-head Nitro semantics, required CI,
one-writer ownership, current-head repair closure, and terminal-action authority
remain unchanged.

## Scope

In scope: canonical delivery and provider rules, concise repository and
portable entrypoint projections, the existing lifecycle and change-request
skills that consume those rules, deterministic authority/readiness contracts
where needed, and focused behavioral tests.

Out of scope: a new lifecycle mode or skill, changes to Nitro itself, new CI or
GitLab infrastructure, relaxed hooks or required pipelines, automatic merge,
deployment, cleanup, inference from generic urgency, and Fast delivery for
projects without an active Nitro policy.

## Delivery Shape

Deliver the plan and implementation together as one atomic change set directly
to GitLab `main`, as explicitly requested for this policy change. Do not create
an MR for this delivery. The policy must change atomically across its canonical
owners, required projections, and behavioral proof; splitting them would
temporarily leave agents with contradictory routing, publication, and readiness
rules. A cohesive footprint above 10 files is therefore acceptable with this
unsafe-to-split rationale, but a forecast above 15 files or 1,000 changed lines
returns to Plan.

## Acceptance

- Work with no explicit fast selection follows the existing standard workflow
  without behavioral change.
- Generic urgency such as `quick`, `ASAP`, or `move fast` does not select fast
  delivery by itself.
- A clear fast-delivery selection on one concrete, settled implementation may
  proceed without a separate brainstorming turn, planning artifact, POC, local
  Review wave, or reviewer subagent.
- Fast delivery performs ordinary setup inside Execute, then runs focused
  verification and native hooks before publication.
- Finish creates or updates the fast-delivery MR as Ready and preserves that
  state through feedback repairs and revalidation.
- Nitro is explicitly requested for every source head. The full response and
  unresolved discussions are read semantically; a receipt or reassuring summary
  alone cannot pass the gate.
- Every in-scope actionable Nitro or required-CI finding is repaired and
  reverified on a fresh exact head without another user prompt.
- Fast completion requires current-head hooks, required CI, and Nitro closure;
  missing or unavailable Nitro evidence remains a blocker even though the MR is
  already Ready.
- Fast delivery never implies merge, deployment, cleanup, force-push, or another
  terminal mutation.
- Work that requires OpenSpec or multiple final MRs returns to Plan rather than
  entering Fast.

## Verification

- Add clean-context RED/GREEN scenarios for default Standard routing, explicit
  Fast routing, generic-urgency non-selection, Ready-on-publication, omitted
  local Review, exact-head Nitro repair cycles, unavailable Nitro, Ready-state
  preservation, and unchanged merge authority.
- Add a negative scenario proving OpenSpec-shaped or multi-unit work cannot use
  Fast silently.
- Exercise the canonical contract through repository lifecycle tests rather
  than relying on entrypoint prose assertions alone.
- Run charter validation and the repository's focused behavior-contract tests.
- Apply `writing-skills` RED/GREEN/refactor verification to every changed skill
  surface before commit.
- Commit through the native hooks, which own the full repository-required suite.

## AI Readiness Contract

The delivery-profile distinction must be mechanically covered. Prose-only
guidance would allow Standard and Fast consumers to drift on plan routing,
local Review, Ready publication, Nitro rerequests, and merge authority. Extend
the existing charter-backed lifecycle and skill-rule evaluation lanes; do not
introduce a separate CI job or manual checklist.

## Risk

Fast delivery intentionally moves defect discovery from local Review to a Ready
hosted MR. Nitro may require repair pushes, which restart exact-head CI and
review cycles, and an unavailable Nitro service blocks completion after the MR
is already Ready. These are accepted tradeoffs of the explicit profile. The
unchanged hook, CI, Nitro, and merge-authority gates prevent fast delivery from
becoming an unreviewed merge path.

## First Real Confirmation

Run a clean-context Nitro-repository scenario where Rene explicitly requests a
one-shot fast implementation. The agent must implement once, commit through
native hooks, publish a Ready MR without local reviewer runs, request and read
Nitro on the exact head, repair one actionable finding, request Nitro again,
and stop at a current-head Ready-to-merge report without merging.
