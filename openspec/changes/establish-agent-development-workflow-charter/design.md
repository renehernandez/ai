## Context

The repository already has five lifecycle modes, specialized rules, review gates, delivery budgets, OpenSpec rehearsal, Nitro feedback handling, and provider adapters. Their behavior is spread across independently selectable surfaces. This has produced four recurring failures: duplicated instructions drift, exact-fingerprint size exceptions cause approval churn after routine repairs, continuous descendant restacking consumes resources, and provider adapters bypass the canonical change-request description owner.

The design must apply to all kinds of work without adding another lifecycle mode. It must preserve project-specific provider policy, task-local workflow evidence, exact-head readiness, and explicit user authority for merge, deployment, cleanup, and POC disposal.

## Goals / Non-Goals

**Goals:**

- Establish one universal principles and change-control charter.
- Make charter compliance a validation gate for every agent-behavior surface.
- Preserve small semantic delivery while supporting coherent removal and enabling-refactor work.
- Make size-exception authority durable across contract-preserving changes.
- Reduce stack restack, pipeline, and review churn without weakening promoted-MR readiness.
- Keep Nitro review current after every pushed implementation head.
- Keep POCs open until the user authorizes closure and automatically reconcile their durable learnings.
- Eliminate independently selectable change-request description adapters.

**Non-Goals:**

- Automatic task creation, naming, pinning, archival, or other task housekeeping.
- Portfolio status or interface redesign.
- Automatic merge, deployment, cleanup, or POC closure.
- A persistent workflow ledger, scheduler, or coordination database.
- A new provider abstraction or dependency.

## Decisions

### Use a lean charter with specialized canonical owners

The charter owns durable principles, authority boundaries, universal delivery standards, and change control. Existing rules and skills continue to own executable lifecycle, provider, review, and verification mechanics. Entry points reference the charter instead of repeating it, and implementation removes contradictory duplicates.

This is preferred over installing the entire source charter unchanged because repetition would violate progressive disclosure and create another drift surface. It is preferred over folding every clause into existing rules because future workflow changes need one explicit compliance target.

### Gate every agent-behavior surface

The gate applies to shared and project instructions, rules, skills, agent definitions, hooks, agent-behavior validators, and automation prompts. Validator discovery uses charter-owned filenames plus explicit agent or skill semantics; an ordinary product helper such as `scripts/validate-data.ts` remains outside the gate. `writing-skills` remains the canonical behavior-change reviewer and gains a charter-compliance contract with:

- structural proof that the change names the canonical owner, affected principles, intended deviations, and obsolete guidance removed; and
- clean-context RED/GREEN behavior scenarios selected from the charter’s prohibited-failure catalog.

The native hook suite runs affected validation before commit, and planning or implementation Review validates the complete target-base-to-source-head behavior diff. The cumulative range gate must map every changed behavior surface to a canonical owner and executable contract scenario; proof from only the latest repair commit is insufficient. Prose claiming compliance is not sufficient. Ordinary product code that does not change agent behavior remains outside this gate.

### Treat refactoring pressure as semantic guidance

For manually authored code, roughly 400 lines is a strong refactoring signal. At 500 lines, further growth requires an upfront enabling refactor or a cohesion-based justification. Generated code, schemas, fixtures, data tables, and cohesive declarative artifacts retain category-aware treatment.

An enabling refactor is delivered and validated before its consumer when it safely simplifies the canonical owner and remains useful if later work stops. This does not force arbitrary file splitting or unrelated cleanup.

### Separate removal exemptions from semantic size exceptions

Removal-only MRs have no numeric file or line cap when their sole outcome is retirement or deletion. Necessary fallout edits to references, tests, configuration, and documentation remain eligible. Replacement behavior, new dependencies, migrations, or unrelated refactoring fail the removal classification and restore ordinary budgets.

Non-removal final MRs retain the 10-file/500-line target and 15-file/1,000-line cap. A user-approved exception binds to the named artifact, accepted outcome, and unsafe-to-split rationale. Base and head identities and measured counts are evidence, not authority keys. Patch-equivalent rebases, base advancement, and contract-preserving Review, Nitro, CI, validation, or path repairs preserve the exception. Material outcome, ownership, behavior, deployment, or split-rationale changes require renewed authority.

A non-removal final MR may never exceed 50 changed files, even under an exception. Disposable POCs and removal-only MRs are the only artifacts allowed above that boundary.

### Publish the real final stack once, then promote one child at a time

After the POC is accepted, reconciled, closed under user authority, and final implementation begins, final delivery units may implement according to semantic eligibility. Their real-diff draft MRs are created sequentially in total Git order: the root targets the normal base and every child targets its immediate predecessor. Empty placeholder MRs are prohibited.

Once the initial stack exists, an earlier MR change does not trigger descendant restacks. Descendant CI and review remain provisional until promotion. After a predecessor merges, only its immediate child retargets and restacks onto the verified merged result. That push refreshes the child’s gates. Deeper descendants remain untouched until their own predecessor merges.

This replaces continuous propagation because the latter spends worktree, pipeline, and reviewer resources on heads that will change again. Exact-head readiness is preserved at the point each MR becomes the promoted merge candidate.

### Request and close Nitro feedback explicitly for every pushed head

Nitro never starts merely because a branch was pushed. Finish posts a new top-level request after every source-head push:

- `/request_review @nitro` for an effective diff of 50 files or fewer;
- `@nitro review` for a POC or removal-only MR above 50 files.

The workflow does not post a duplicate request while Nitro is already in flight for the same source head and effective diff. A newer push makes older feedback stale. Target-only movement on an unpromoted descendant does not trigger a request.

Finish monitors the complete response and unresolved Nitro-authored discussions. Execute repairs every in-scope actionable finding, pushes the new head, and Finish requests Nitro again. The loop ends only when the latest head has no actionable feedback or a material decision requires human follow-up. A human-required decision blocks only that MR while unrelated authorized work continues.

### Separate POC acceptance, reconciliation, and disposal authority

Technical readiness and clean automated review never close a POC. Personal acceptance may freeze the reviewed head, but Finish closes it only after the user explicitly requests closure or contextually authorizes it by stating that the work is ready to proceed to stack breakdown.

Durable implementation and review learnings are recorded as they arise and reconciled once against the stable accepted POC head before closure and final-stack breakdown. Plan updates every affected OpenSpec artifact automatically. Contract-preserving updates require no extra prompt. Materially unproved scope, architecture, safety, or delivery changes are surfaced for user acceptance and may require another POC.

POC commits remain disposable and never enter final implementation ancestry.

### Reconcile POC learnings into executable evidence

The POC established that exact-head proof must be derived from the artifact
owner rather than reconstructed from labels:

- charter pressure coverage maps every changed behavior surface to a
  contract-specific RED/GREEN scenario that executes its owner; the same
  contract registry derives affected principles, TypeScript syntax binds each
  tested assertion value to a statically reachable call from the canonical
  import or top-level helper rather than matching comments, string literals,
  shadowed bindings, mutable or aliased assertion bindings, dynamic
  expectations, test-local process-runner substitution, or message-only
  evidence, including source propagation through statically non-empty
  `for...of` assertions without double-counting the loop binding;
  provider-gate execution lives in a portable helper owned by the reviewed
  Nitro skill, rule-owner scenarios import one validator-owned
  repository reader that captures immutable staged Git blobs instead of
  trusting local canned readers or mutable worktree content, preserves the
  hook-owned index object store needed to resolve those blobs while rejecting
  ambient repository and worktree redirection, and future agent-behavior validator or
  agent-prompt surfaces fail closed;
- removal-only evidence is checked against the authoritative Git diff and
  passed exact-head diff review while allowing obsolete dependency removal as
  retirement fallout; authoritative add, modify, or delete status makes every
  net-new path fail the classification while necessary additive fallout in an
  existing modified path remains uncapped and subject to the passed exact-head
  semantic review as the accepted control, and the production readiness
  boundary resolves Git itself rather than accepting a caller-supplied
  resolver;
- Nitro readiness is derived from raw GitLab MR and contiguous note/discussion
  pages whose provider next-page metadata reaches the empty terminal value,
  distinguishing a missing header/body separator from an empty invalid header
  block,
  plus MR versions that bind the request after the exact current-head
  transition, including older unresolved Nitro discussions; mixed reassuring
  and actionable text and later reopened concerns remain actionable, GitLab's
  capped `1000+` count stays explicitly inexact but routes above 50 files, and
  only resolvable, unresolved Nitro discussion threads carry forward across
  review cycles because historical `individual_note` summaries cannot be
  resolved through GitLab. The deterministic gate treats Nitro prose as an
  unstable interface: it proves that a substantive exact-head completion was
  received but does not classify the completion as clean, advisory, or
  actionable. Finish reads every complete response and unresolved discussion
  and decides semantically whether Nitro raised feedback requiring an MR
  change; human-review advice alone is nonblocking. Technical readiness
  requires that exact-head Finish semantic-review record with no actionable
  feedback, so a structurally complete receipt cannot bypass the human-language
  judgment. Missing, empty, or symbol-only completions and malformed provider
  evidence remain fail-closed; the large-artifact route requires an actual
  non-system `@nitro review` note
  with a requesting username rather than a generic reviewer system event; and
- provider updates require hosted body readback, while published non-tip stack
  repairs use native amendments that leave descendant refs untouched.

These are contract-preserving clarifications learned during the disposable POC
and are part of the final implementation contract. The POC also confirmed that
the charter validator, Nitro evidence gate, delivery-shape evidence owner, and
removal-only readiness binding need responsibility-based helper modules before
further growth at the 500-line boundary. The POC applied that boundary by
separating the charter contract registry from assertion provenance, source
binding integrity, executable flow, mutation and escape detection, and the
coordinating TypeScript AST evidence engine once the combined source crossed
500 authored lines. Provider execution moved to the owning Nitro skill instead
of adding provider-specific implementation proof to the generic charter
validator. Each responsibility remains independently readable below the
boundary while the contract registry stays the single policy owner.

### Collapse change-request policy and mutation into one selectable owner

`change-request-create` becomes the only installed skill that creates or updates a PR/MR title or description. GitHub and GitLab mechanics move under its internal references. Finish and stacked-delivery guidance invoke only this owner.

`github-pr-create` and `glab-mr-create` are retired as selectable skills. The central owner preserves provider routing, authentication, duplicate detection, template and human-owned content, tracking semantics, draft creation, and hosted title/body readback. Direct `gh`, `glab`, or API wording does not bypass the policy pass.

This is preferred over another handoff receipt because the existing prose-only handoff has already failed under direct adapter invocation.

## Risks / Trade-offs

- **A lean charter may omit a critical constraint** → Keep authority, destructive-action, delivery, and change-control invariants normative; route only mechanics to specialized owners.
- **A semantic size exception may drift silently** → Require current footprint reporting and renew authority on material contract, ownership, deployment, or split-rationale change.
- **Unrestacked descendants may show stale or conflicting provider state** → Mark their gates provisional and prohibit readiness until immediate-child promotion after predecessor merge.
- **Nitro request loops may create duplicate work** → Key requests to the current pushed head, suppress same-head duplicates, and never request on target-only movement before promotion.
- **Automatic reconciliation may silently expand the contract** → Auto-apply only durable learnings supported by the accepted POC; surface materially unproved deltas before final implementation.
- **Retiring provider adapters may reduce discoverability** → Keep provider mechanics as clearly routed internal references under `change-request-create`.

## Migration Plan

1. Deliver the charter and validation foundation.
2. Align delivery, POC, stack, exception, and Nitro owners with the charter.
3. Consolidate change-request publication and retire standalone adapters.
4. Validate the complete behavior in one disposable POC.
5. Reconcile POC findings and finalize the three-unit delivery shape before independent final implementation.

Rollback is unit-scoped: revert the affected final MR before its successors merge. The charter foundation remains useful independently; lifecycle alignment preserves existing authority boundaries; publication consolidation can restore adapter installation without changing hosted artifacts.

## Open Questions

None. The user accepted the material scope, authority, sizing, stack, Nitro, POC, and publication decisions during Explore.
