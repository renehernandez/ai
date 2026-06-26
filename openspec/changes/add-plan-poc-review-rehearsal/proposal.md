## Why

Review-first delivery now keeps normal implementation bounded with one
implementation artifact per OpenSpec delivery unit, but Rene also needs a way
to rehearse the full implementation shape before final delivery. A dedicated
`plan-poc` lane lets reviewers compare OpenSpec intent against a full draft
implementation, capture learnings, close the rehearsal unmerged, and then
revise the OpenSpec before normal `plan-orchestrator` delivery.

## What Changes

- Add a new `plan-poc` skill for review-only OpenSpec implementation
  rehearsals.
- Require `plan-poc` hosted artifacts to remain draft, carry a `POC:` title
  prefix, include both OpenSpec files and implementation diffs, and state that
  they are not intended to merge.
- Define a single-branch phase loop that implements OpenSpec phases
  sequentially, updates contextual POC task state, and requests routed
  latest-head reviewer feedback after each material push.
- Define private `poc_learning_summary` evidence for reviewer findings, spec
  corrections, implementation notes, phase-shape changes, and final delivery
  boundaries.
- Require final delivery to revise the OpenSpec from POC learnings and
  reimplement through `plan-orchestrator`; POC commits are not delivery lineage.
- Keep the existing `plan-orchestrator` stack-ready contract as the normal
  shipping path.

## Capabilities

### New Capabilities

- `plan-poc`: Review-only OpenSpec implementation rehearsal workflow.

### Modified Capabilities

- `review-first-plan-orchestration`: Recognize `plan-poc` as an opt-in
  rehearsal lane that informs later OpenSpec revision without weakening normal
  `plan-orchestrator` delivery.

## Impact

- Affected skills: `skills/plan-poc`, `skills/plan-orchestrator`,
  `skills/plan-review`, `skills/plan-unit-sequencer`,
  `skills/plan-unit-delivery`, `skills/review-feedback-routing`, and
  `skills/nitro-review-feedback` where cross-references or routing language are
  needed.
- Affected rules and prompts: repo-local workflow guidance, runtime-facing
  agent prompts, and private support artifact boundaries that describe planning
  and implementation review routes.
- Affected tests: skill contract tests, prompt/template drift checks, POC state
  validation fixtures, learning-summary validation fixtures, and reviewer
  routing failure fixtures.
