## Context

The existing review-first workflow treats every deliverable OpenSpec checkbox
as an implementation MR unit. The relevant contracts are spread across
`plan-ready`, `openspec-tasks`, `plan-review`, `plan-orchestrator`,
`plan-unit-sequencer`, `plan-unit-delivery`, stack-state helpers, adapter
prompts, and hosted review body conventions.

That contract made delivery auditable, but it produced excessive MR stacks for
larger changes. The new model keeps review evidence and cumulative task state,
while changing the hosted-review unit to a reviewable phase.

## Goals / Non-Goals

**Goals:**

- Make phase headings the implementation MR unit for OpenSpec delivery.
- Keep nested sub-tasks as commit-sized evidence inside a phase MR.
- Centralize phase/sub-task parsing and validation in `openspec-tasks`.
- Preserve planning review, Nitro, CI, reviewer, stack integrity, and resume
  gates.
- Catch stale prompt/template/ledger wording that still instructs per-task MRs.

**Non-Goals:**

- Implementing a product feature that uses the new workflow.
- Removing hosted review, Nitro review, CI inspection, or implementation
  reviewer gates.
- Changing GitLab/GitHub routing or merge-follow-through behavior.
- Refreshing installed runtime copies before source changes are implemented and
  explicitly approved for installation.

## Decisions

### Shared Phase Model Lives In `openspec-tasks`

`openspec-tasks` should expose the canonical phase/sub-task parser,
classification result, phase sizing checks, merge-smell checks, and legacy-flat
normalization. `plan-ready`, `plan-review`, `plan-unit-sequencer`,
`plan-unit-delivery`, and stack-state validation should consume that API.

Alternative considered: duplicate phase parsing in each planning script. That
would be faster locally but creates split-brain behavior when one script accepts
a phase shape another script rejects.

### Phase MR Is The Delivery Unit

The selected implementation unit becomes a phase, not a leaf checkbox. A phase
MR may complete multiple nested sub-task checkboxes inside the selected phase,
but phase-delta validation rejects changes to another phase or future sub-task.

Alternative considered: one MR per reviewable outcome without naming phases as
the concrete unit. That is semantically clean, but harder for agents and
validators to apply consistently.

### Legacy Flat Tasks Normalize Only When Independently Reviewable

Legacy flat task lists should not be stranded automatically. A flat task can be
treated as a single-sub-task phase only when it represents one independently
reviewable outcome. Flat tasks hiding multiple outcomes block with
`needs_spec_redesign`.

Alternative considered: convert all flat tasks automatically. That would
preserve momentum but risks smuggling broad work into a single phase MR.

### Contract Tests Cover Prompt And Template Drift

The change must include focused assertions that fail if active prompt, template,
ledger, or installed-surface text still instructs one MR per OpenSpec task
outside a clearly marked legacy context.

Alternative considered: rely on search during implementation. That is too easy
to miss because the old language appears in prompts, scripts, ledgers, and
skill docs.

## Risks / Trade-offs

- Phase parsing may temporarily need to support both current flat task files and
  new phase/sub-task files. Mitigation: add an explicit legacy migration matrix
  before downstream consumers switch behavior.
- Phase sizing heuristics can become too rigid. Mitigation: allow explicit
  justification for coherent phases with 7-8 sub-tasks while blocking more than
  8 without redesign.
- Resume and stack-ready validation can regress if only happy-path phase
  delivery is tested. Mitigation: include legacy one-checkbox stacks,
  interrupted phase MRs, in-flight flat-task delivery, and rollback/downgrade
  fixtures.
- Stale runtime prompts can keep agents producing per-task MRs after validators
  change. Mitigation: add prompt/template/ledger contract checks and run skill
  validation before any runtime refresh.

## Migration Plan

1. Add shared phase/sub-task parsing and validation while preserving legacy flat
   task compatibility.
2. Move readiness and planning review onto the shared phase model.
3. Move sequencing, delivery, stack-state, resume, and stack-ready validation
   onto phase-delta evidence.
4. Update runtime-facing prompts and contract tests.
5. Refresh installed runtime copies only after source validation passes and the
   user explicitly asks for live installation.

## Open Questions

None. The plan chooses a shared `openspec-tasks` model and a legacy-flat
compatibility rule before implementation begins.
