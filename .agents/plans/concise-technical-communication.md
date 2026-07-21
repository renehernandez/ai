# Concise Technical Communication

## Goal

Make agent conversation and durable technical prose direct, compact, and easy
to act on while preserving required evidence and inline confidence scores.

## Approach

- Establish one shared communication rule based on applicable ASD-STE100
  principles: lead with the result, keep one point per sentence, prefer active
  voice and concrete words, use stable technical terms, and stop when the
  reader can act or decide.
- Define channel-specific defaults for progress commentary, final responses,
  and durable documents. Omit empty sections, repeated context, routine process
  narration, generic transitions, and duplicated conclusions.
- Keep detail when it changes correctness, safety, uncertainty, ownership,
  behavior, acceptance, or the reader's next action. Do not enforce arbitrary
  word limits or a controlled vocabulary.
- Preserve the current confidence framework and its inline annotations.

## Scope

Apply the contract to agent commentary, final responses, documentation, atomic
plans, OpenSpec artifacts, ADRs, handoffs, and change-request descriptions.
Align existing shared instructions, documentation guidance, and user-facing
skill output contracts that require redundant framing or fixed empty sections.

Do not claim ASD-STE100 compliance, reproduce its controlled dictionary, add a
prose linter, rewrite existing durable documents, or change code-comment and
machine-readable contract requirements.

## Terms

- **Concise:** contains the information needed to understand, decide, or act,
  without repetition or routine narration.
- **Durable document:** agent-authored prose committed to a repository or
  published to a provider for later use.
- **Required evidence:** concrete proof needed to support a claim, decision,
  diagnosis, readiness state, or next action.

## Reuse And Deviation Contract

`AGENTS.md` and `instructions/AGENTS.md` remain the concise entrypoints.
`rules/docs-and-specs.md` remains the owner for durable documentation and
planning prose. `rules/confidence.md` remains the unchanged owner for
confidence annotations. Existing user-facing skills remain the owners of their
domain-specific outputs.

Add one shared communication owner because the current rules cover durable
documentation and generic filler but do not define a complete contract for
progress commentary and final responses. Existing owners will reference or
specialize that rule instead of duplicating it. The end-to-end proof will show
that the same task produces shorter conversation and durable prose without
losing decisions, evidence, confidence, or next actions.

## Acceptance

- Responses lead with the outcome, decision, or blocker and contain no routine
  restatement of the request or tool narration.
- Progress commentary reports only material new state and the next meaningful
  action.
- Final responses contain the result, required proof, blockers, and next action
  only when each item applies.
- Durable documents retain goals, decisions, constraints, evidence, and
  acceptance while removing execution-diary detail and repeated context.
- Confidence annotations continue to follow `rules/confidence.md`.
- Safety-critical, uncertain, or contract-defining detail is never removed to
  satisfy brevity.

## Verification

- Focused instruction and skill contract tests for conversation and durable
  prose behavior.
- Repository skill validation and formatting.
- `writing-skills` RED/GREEN pressure scenarios covering verbose commentary,
  repetitive final responses, over-structured brainstorming, and bloated
  durable documents.
- Exact target-base diff review under the existing publication checkpoint.

## Risk

Over-trimming can hide evidence or a material decision. The contract therefore
defines concision by reader need, not length, and explicitly preserves details
that affect correctness, safety, uncertainty, ownership, behavior, acceptance,
or the next action.

## First Real Confirmation

Run clean-context pressure scenarios for one implementation task and one
documentation task. The revised agents must produce shorter commentary, final
responses, and durable prose while retaining the same decisions, confidence
annotations, verification evidence, blockers, and actionable next step.

## Delivery

Deliver this plan and the shared communication-rule changes together in one
final draft MR from `codex/concise-technical-communication`. No OpenSpec or POC
is required.
