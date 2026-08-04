# Agent development workflow charter

This charter applies to every kind of work. It governs shared agent behavior
while specialized rules and skills own project, lifecycle, provider, review,
verification, and operational mechanics.

## Principles

- Preserve user authority. Authority follows the outcome and action path the
  user clearly accepts in context, not prescribed wording. Explore is
  read-only; Plan, Execute, Review, and Finish retain their mutation surfaces;
  and accepted work may traverse them to its policy checkpoint. Explicit limits
  cap that route, and terminal actions require separately scoped acceptance.
- Prefer one canonical owner. Extend the existing owner of a policy, workflow,
  interface, or invariant instead of adding a parallel path or repeating its
  mechanics in entrypoints.
- Use progressive disclosure. Keep global guidance compact, load specialized
  context only when its trigger applies, and keep details one reference away
  from the owning entrypoint.
- Design expressive interfaces. Make the safe action the obvious action, keep
  invalid states difficult to express, and validate fragile transitions through
  deterministic helpers rather than prose alone.
- Keep work semantically small. Deliver one coherent outcome with a safe stop
  state, clear ownership, and direct proof. Numeric budgets constrain review
  load but never justify an unsafe mechanical split.
- Make the change easy, then make the easy change. Deliver an enabling refactor
  before its consumer when it is independently useful and reduces the
  consumer's risk or size.
- Keep manually authored files maintainable. Roughly 400 lines is a strong
  refactoring signal. At 500 lines, further growth needs an upfront enabling
  refactor or a cohesion-based justification. Generated code, schemas, fixtures,
  data tables, and cohesive declarative artifacts receive category-aware
  treatment.
- Preserve evidence at the right boundary. Durable contracts belong in their
  canonical artifact; fingerprints, reviewer scratch, receipts, and execution
  ledgers remain task-local.

## Delivery standards

- A normal final MR targets at most 10 changed files and 500 changed lines.
  More than 15 files or 1,000 changed lines requires an accepted semantic
  exception. A non-removal final MR may never exceed 50 changed files.
- A removal-only MR has no numeric file or line cap when its sole outcome is
  retirement or deletion plus necessary fallout. Replacement behavior, a new
  file, a new dependency, a migration, or unrelated refactoring fails this
  classification.
  Its file evidence must equal the authoritative target-base-to-source-head Git
  diff, and its semantic classification must bind to the passed exact-head
  `diff-review`; removing an obsolete dependency remains eligible fallout.
- A size exception belongs to the named artifact, accepted outcome, and
  unsafe-to-split rationale. Contract-preserving rebases, base movement, review,
  CI, validation, and necessary path repairs preserve its authority. Material
  outcome, ownership, behavior, deployment, review-boundary, or split-rationale
  changes require renewal.
- Create a final stack from real diffs, sequentially in total Git order. After
  publication, do not restack descendants for an open predecessor's changes.
  When a predecessor merges, promote and restack only its immediate child;
  deeper descendants remain untouched.
- A push does not itself start Nitro. Finish explicitly requests Nitro after
  every source-head push, suppresses only a duplicate request for the same
  source head and effective diff, and monitors through latest-head closure.
- Keep a POC open after technical readiness and exact-head acceptance. Close it
  only on an explicit user request or contextual authority that the work is
  ready to proceed to stack breakdown. Reconcile durable POC learnings into the
  OpenSpec before closure and final implementation.

## Change-control gate

Changes to instructions, rules, skills, agent definitions, hooks, validators,
and automation prompts must pass charter validation before commit. Ordinary
product code that does not change agent behavior is outside this gate.

For each affected agent-behavior surface, validation must identify:

- its canonical owner;
- affected principles;
- any intended deviation and its authority;
- obsolete or contradictory guidance removed; and
- the clean-context RED/GREEN pressure scenarios that prove behavior.

Prose claiming compliance is not proof. The native hook must run structural
validation against Git's active staged index and the affected behavior
scenarios. The validator's explicit owner registry rejects unclassified durable
surfaces; every changed behavior surface maps to a contract-specific scenario
ID with named RED and GREEN assertions that execute its owning path. A
principle-level label, marker, truthy symbol reference, or unrelated passing
test is not evidence. New or changed skills follow the `writing-skills`
RED/GREEN/refactor loop.

## Change review

Planning and implementation Review evaluate charter compliance against the
exact artifact fingerprint or target-base diff and HEAD. A missing owner,
contradictory durable source, unproved deviation, stale behavior scenario, or
failed pressure test blocks handoff. Project policy may strengthen this charter
but must not weaken it without explicit user direction.
