# Intent-Based Workflow Authority

## Goal

Interpret user authority from the semantic intent of the conversation instead
of requiring a small set of exact transition phrases. Once the user clearly
accepts a presented in-scope work path, continue across its required lifecycle
modes to the next mandatory human checkpoint without asking for a synonym such
as `proceed`.

## Approach

- Separate lifecycle ownership from task authorization. Explore, Plan, Execute,
  Review, and Finish continue to own their existing mutation surfaces; the
  accepted task determines how far those modes may advance automatically.
- Treat contextual assent such as `agreed`, `sounds good`, `let's do that`, or
  equivalent language as authorization when it clearly accepts a presented
  mutation path. These phrases are examples, not a closed command vocabulary.
- Derive the next mandatory human checkpoint from the semantic route: direct or
  atomic work continues through draft technical readiness; pre-POC OpenSpec work
  continues through the complete disposable POC and exact-head technical
  readiness; accepted POC work continues through reconciliation and final-stack
  technical readiness.
- Preserve explicit limiting language and material-change interruptions. Merge,
  deployment, cleanup, credential grants, destructive actions, and POC disposal
  remain separately authorized boundaries.

## Scope

Refine the existing authority principle, central investigation and
implementation mechanics, portable and repository entrypoints, and the Plan,
Execute, and Finish handoff language. Strengthen the existing lifecycle-authority
contract tests and clean-context probes with semantic-assent, pre-POC
continuation, narrow-scope, and terminal controls.

The cohesive change touches 15 files because the canonical owner, installed and
repo-local entrypoints, four consuming skills, atomic plan, validator routing,
and the existing contract-specific tests must move together. The validator
adjustment classifies atomic plans as governed artifacts rather than reusable
runtime behavior, binds Brainstorming to the existing lifecycle-authority
contract, and preserves the removal-only evidence contract on the canonical
rules that still own that policy. Splitting these changes would leave an
entrypoint or lifecycle consumer contradicting its owner, make the required plan
fail the behavior-surface gate, or ship changed shared behavior without its
required RED/GREEN evidence.

Replace obsolete word-trigger and mode-scoped continuation language rather than
adding a POC exception, new lifecycle mode, approval registry, phrase parser, or
parallel authority mechanism.

## Reuse And Deviation Contract

The agent-development charter remains the principle owner. The investigation
and implementation rule remains the canonical owner of task routing and
authority progression. Plan and Execute remain thin consumers that hand work
across their existing ownership boundary. The existing `lifecycle-authority`
charter contract and mode-lifecycle fixtures remain the verification owners.

This change extends the confirmation-churn precedent by correcting its
mode-scoped limitation. It introduces no new authority source: conversational
context already establishes the accepted outcome and presented work path. The
only deviation is that clear contextual assent may authorize that presented
path without a prescribed verb.

## Acceptance

- Authority is inferred from clear contextual intent, not exact wording.
- Agreement that clearly accepts a presented mutation path authorizes that path;
  agreement with design alone still does not invent an unpresented mutation.
- A reviewed pre-POC OpenSpec automatically hands off to POC Execute when the
  accepted path includes implementation, and stops at exact-head personal POC
  acceptance.
- Direct and atomic work continue through hook-clean draft publication, CI, and
  configured automated review without another mode-transition prompt.
- `Plan-only`, `Execute-only`, local-only, and equivalent language cap the path.
- Material contract changes and human-only actions interrupt normally.
- Merge, deployment, cleanup, destructive actions, credential grants, and POC
  disposal are never inferred from ordinary work acceptance.

## Verification

- RED evidence: the cited Linear AgentRequest task stopped after Plan despite a
  clearly accepted Plan-to-POC path; this task also asked twice for the exact word
  `proceed` after the user said `agreed`.
- GREEN pressure scenarios cover equivalent assent language, the complete
  pre-POC transition, and a control that stops before terminal actions.
- Focused lifecycle-authority, entrypoint, and skill tests prove the route and
  its limiting controls.
- `writing-skills` validates the changed Brainstorming, Plan, Execute, and Finish
  behavior; charter
  validation verifies canonical ownership, obsolete guidance removal, and
  executable RED/GREEN coverage.
- The native pre-commit hook owns the complete repository suite.

## First Real Confirmation

Replay the referenced sequence in a clean-context pressure scenario: Explore
presents OpenSpec reconciliation followed by its mandatory disposable POC, and
the user responds with semantically clear assent without the word `proceed`.
The agent must enter Plan, pass planning Review, hand off to POC Execute, publish
and review the draft POC, and stop for exact-head personal acceptance. A paired
control must refuse merge, deployment, cleanup, and POC disposal.

## Delivery

Deliver this plan and the authority-model refactor together in one final draft
MR. It is one coherent workflow invariant and requires no OpenSpec or POC.
