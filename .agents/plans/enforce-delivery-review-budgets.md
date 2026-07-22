# Enforce Delivery Review Budgets

## Goal

Keep atomic and final OpenSpec MRs reviewable: plan for 10 files/500 lines and block
above 15 files/1,000 lines. Stat MR !124 must split into more tasks and final MRs.

## Decisions

- Plan for 10 changed files/500 changed lines; cap at 15 files/1,000 lines.
- Count additions plus deletions across every file category and each dimension independently.
- Above a target, justify why another safe semantic split is impractical.
Only the user can approve an above-cap effective diff. Bind its artifact, HEAD,
base SHA, counts, rationale, consequences, and evidence; never transfer it.
Plan forecasts each final unit against its predecessor and accepted POC footprint.
Execute measures before publication; Finish remeasures after effective-diff changes.
An over-cap diff without a current exception returns to Plan.
The limits are outer constraints, not an automatic partitioner. Each MR still needs
a coherent outcome, safe stop, local proof, and aligned boundaries. The POC is exempt.

## Reuse And Deviation Contract

- Extend existing Plan, OpenSpec-task, Review, Execute, and Finish owners.
- Reuse top-level OpenSpec units as the task-to-final-MR boundary.
- Replace the qualitative-only rule exposed by Nitro-ineligible Stat MR !124.
- Add no automatic splitter, planning-only MR, or inferred exception.
- Exclude Stat/Nitro changes, automatic splitting, POC budgets, and AX refresh.

## Implementation Tasks

- [x] 1. Align planning and shared guidance with the budgets and POC exemption.
- [x] 2. Add deterministic classification, exception identity, and unit tests.
- [x] 3. Remeasure before publication, review, and effective-diff changes.
- [x] 4. Add lifecycle tests, `writing-skills`, and AI-readiness review.

## Acceptance

- Final MRs plan for 10 files/500 lines; forecasts above 15/1,000 block.
- Over-budget units need rationale; over-cap effective diffs need an exact,
  artifact-bound user exception.
- Checks count the complete effective diff and rerun after repairs or restacks.
- More cohesive tasks/MRs are valid; the POC remains exempt.
- Unit/lifecycle tests, `writing-skills`, AI-readiness, and hooks pass.

## Recommended Delivery

Deliver one final draft MR. Its 13 shared owners exceed the file target but stay
under both hard caps; splitting them creates contradictory budget policy.
