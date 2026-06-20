# Review-First Plan Orchestration

## Goal

Create a review-first planning workflow with `plan-orchestrator` as the
end-to-end entrypoint from fuzzy idea to completed delivery when no blockers
appear.

Every normal workflow publishes a planning-only PR or MR before implementation.
For atomic plans, the planning artifact is the plan. For complex work, the
planning artifact is the OpenSpec change created from the reviewed
`openspec_blueprint`. Implementation uses a separate PR or MR.

## Decisions

- `plan-orchestrator` is the top-level skill. It owns the end-to-end workflow:
  run the configured brainstorming entrypoint when needed, write or update a
  plan, run `plan-ready`, create OpenSpec when needed, publish planning review,
  and continue into delivery after the review gate passes.
- The current sequencing responsibilities in `plan-orchestrator` move to
  `plan-unit-sequencer`.
- `plan-to-review` is renamed to `plan-review`.
- `plan-review` emits the single reviewed-planning handoff consumed by
  `plan-orchestrator` and `plan-unit-sequencer`.
- `plan-ready` remains a readiness gate. It does not create OpenSpec files,
  publish PRs or MRs, or start implementation.
- Planning review is mandatory for both atomic plans and OpenSpec changes.
- Implementation starts only after the planning PR or MR is merged in
  `ship_then_continue`, or after planning feedback is addressed and the
  planning PR or MR is ready for merge in `stack_when_ready`.
- No dedicated ledger is introduced. OpenSpec `tasks.md` remains durable state
  for multi-task work.
- Old names and old input shapes are rejected explicitly. The reused
  `plan-orchestrator` skill name is not rejected; only its old direct-sequencing
  semantics are retired.

## Scope

In scope:

- Add shared planning-contract helpers so renamed skills do not duplicate YAML
  parsing and validation logic.
- Update repo-level rules so the review-first plan workflow is an explicit
  exception to direct-publish repo guidance.
- Rename `plan-to-review` to `plan-review`.
- Rename the current implementation sequencing skill to `plan-unit-sequencer`.
- Add the top-level `plan-orchestrator` workflow contract.
- Update `plan-ready` wording so atomicity is about implementation scope, not
  the mandatory planning-review PR or MR.
- Update `plan-unit-delivery` guidance so implementation artifacts are separate
  from planning artifacts.
- Update adapter prompts, scripts, tests, runtime lock metadata, and installed
  runtime cleanup behavior for renamed skills.

Out of scope:

- Changing `plan-unit-delivery` from one implementation unit per run.
- Reintroducing plan slices, followthrough ledgers, or tags.
- Building a generic PR stack manager.
- Changing OpenSpec schema.
- Writing OpenSpec files directly instead of using the configured OpenSpec
  propose entrypoint.
- Allowing direct implementation from an unreviewed plan or OpenSpec change.

## Required Workflow

### Top-Level Plan Orchestrator

`plan-orchestrator` accepts a fuzzy idea, feature request, Linear ticket, plan
request, existing plan file, or OpenSpec change request.

It runs the following workflow:

1. Run the configured brainstorming entrypoint when the request is fuzzy, such
   as `/brainstorm` in Claude Code or the equivalent skill in another harness.
2. Write or update the plan under `.agents/plans/` when the input is not
   already a concrete artifact.
3. Run `plan-ready` against the plan, ticket, or OpenSpec request.
4. If `plan-ready` emits `blocked_readiness`, stop and return the blockers.
5. If `plan-ready` emits `plan_delivery_handoff`, create a
   `plan_review_request` for the plan artifact.
6. If `plan-ready` emits `openspec_blueprint`, invoke the configured OpenSpec
   propose entrypoint, `/opsx:propose` where available. The proposal flow must
   use the validated blueprint, create the OpenSpec change files, collect
   `openspec status --change change-id --json` evidence, and run strict validation.
7. Run `plan-review` to publish the planning-only PR or MR and wait for routed
   automated feedback and developer review policy.
8. Continue only when `plan-review` emits a valid `planning_review` handoff
   whose `gate_outcome` permits implementation:
   - `ship_then_continue`: planning PR or MR merged into the target branch.
   - `stack_when_ready`: planning PR or MR feedback addressed, approved or
     waived by policy, mergeable, and usable as the implementation stack base.
9. Invoke `plan-unit-sequencer` with the reviewed planning evidence.
10. Continue until the requested delivery goal completes or a blocker appears.

`plan-orchestrator` must stop before implementation when planning validation,
OpenSpec validation, planning-only review, automated feedback, developer review
policy, mergeability, or stack readiness blocks.

### Plan Ready

`plan-ready` continues to route work into one of three outputs:

- `plan_delivery_handoff`
- `openspec_blueprint`
- `blocked_readiness`

Its atomicity gate distinguishes implementation scope from the mandatory
planning-review artifact. Atomic work may require two PRs or MRs in the new
workflow: one planning review artifact and one implementation artifact. Atomic
work must not require multiple implementation PRs or MRs.

### Plan Review

`plan-review` publishes planning-only review artifacts and emits the reviewed
planning handoff.

Valid inputs:

- `plan_review_request`
- `plan_delivery_handoff` converted into a plan review request by
  `plan-orchestrator`
- OpenSpec change created from `openspec_blueprint`

Rules:

- The review branch contains planning artifacts only.
- Implementation files are blocked unless explicitly split out.
- Automated review feedback is requested and monitored on the latest head.
- Developer review must be approved or waived by policy before implementation
  may continue. Pending developer review is `planning_review_blocked`.
- Implementation feedback is converted into plan changes or follow-up notes.
- The final output includes a concise `## Readable Summary`, then the
  validated `planning_review` YAML. `plan_review_gate_ledger` may remain
  internal evidence or be embedded under `planning_review.evidence`.

### Reviewed Planning Handoff

`planning_review` is the single handoff from planning review into implementation
sequencing:

```yaml
planning_review:
  status: ready_for_implementation
  artifact_type: plan | openspec
  artifact_ref: .agents/plans/example.md | openspec/changes/example
  review_pr_or_mr: https://example.invalid/repo/pull/123
  mode: ship_then_continue | stack_when_ready
  gate_outcome:
    mergeability: merged | ready_for_merge
    ci_status: passed
    automated_feedback: resolved | waived_with_evidence
    developer_review: approved | waived_by_policy
  target_branch: main
  target_base_sha: abcdef123456
  planning_branch: plan/review-first-example
  reviewed_head: 0123456789ab
  stack_base_ref: plan/review-first-example
  stack_relationship_evidence: implementation branches must descend from reviewed_head
  tasks_state_fingerprint: sha256-or-not-applicable
  evidence:
    validation:
      - exact validation command or artifact inspection
    review:
      - PR/MR URL and latest-head feedback evidence
  blockers: []
```

For `ship_then_continue`, `mergeability` must be `merged`. For
`stack_when_ready`, `mergeability` must be `ready_for_merge`, and stack evidence
must prove that implementation branches will be based on the reviewed planning
head.

### Plan Unit Sequencer

`plan-unit-sequencer` owns the implementation sequence after planning review.

Rules:

- Reject unreviewed plans or OpenSpec changes with `needs_reviewed_planning`.
- For `ship_then_continue`, select work only after the planning PR or MR is
  merged and the target branch is refreshed.
- For `stack_when_ready`, select work only after planning feedback is addressed,
  developer review is approved or waived by policy, and the planning PR or MR is
  ready for merge.
- Atomic plans produce exactly one implementation unit.
- OpenSpec changes select one unchecked deliverable task at a time.
- Each OpenSpec task maps to one `plan-unit-delivery` run and one
  implementation artifact.
- Stack-tip OpenSpec task state is cumulative. Target branch state remains the
  source of truth for landed work.

### Plan Unit Delivery

`plan-unit-delivery` remains responsible for one implementation unit:

- one atomic plan implementation, or
- one OpenSpec checkbox task.

It must ensure the implementation PR or MR is separate from the planning PR or
MR. For OpenSpec task units, the selected checkbox must be marked complete in
the same implementation PR or MR as the code change.

### Result Shape

Every YAML or JSON handoff, gate report, delivery state, or validator output
written back to the thread must include a concise `## Readable Summary` first.
The readable summary must not replace the machine-readable block.

This applies to `plan_review_request`, `planning_review`,
`plan_review_gate_ledger`, `plan_delivery_handoff`, `openspec_blueprint`,
`delivery_gate_ledger`, and sequencer status reports.

## Failure Routing

| Status | Meaning | Next step |
| --- | --- | --- |
| `blocked_readiness` | `plan-ready` lacks required decisions | Answer blockers and rerun |
| `openspec_change_exists` | Proposed OpenSpec change already exists | Select existing change or choose a new id |
| `openspec_proposal_failed` | OpenSpec propose could not create files from the blueprint | Repair blueprint or OpenSpec setup |
| `openspec_artifact_incomplete` | OpenSpec status reports missing required files | Complete the proposal artifacts |
| `openspec_invalid` | OpenSpec validation failed | Repair OpenSpec files |
| `planning_review_blocked` | Planning PR or MR feedback, CI, routing, or developer policy blocks | Resolve inside `plan-review` |
| `planning_review_not_ready` | Planning artifact is not merged or stack-ready | Continue planning review |
| `needs_reviewed_planning` | Implementation sequencing was invoked without valid planning review evidence | Run `plan-orchestrator` or `plan-review` |
| `stack_base_not_ready` | Planning PR or MR is not usable as stack base | Continue planning review |
| `stack_base_changed` | Target branch moved after planning review evidence was captured | Refresh and revalidate planning review |
| `stack_relationship_missing` | Implementation branch does not descend from reviewed planning head | Repair stack relationship |
| `stack_task_state_invalid` | Stack tip task state is non-cumulative or checks future tasks | Repair the stack branch |
| `delivery_blocked` | Implementation unit failed delivery gates | Continue inside `plan-unit-delivery` |

## Expected OpenSpec Tasks

This plan is multi-deliverable and should become an OpenSpec change before
implementation.

### Task 1.1: Extract Shared Planning Contract Helpers

Deliverable: Add shared script helpers for planning-contract parsing and
validation without changing skill behavior.

Files or areas:

- `skills/*/scripts`
- `tests/unit/*script.test.ts`

Acceptance:

- Common helpers cover fenced YAML extraction, scalar/list/map parsing, legacy
  input rejection, `plan_delivery_handoff` validation, `plan_review_request`
  validation, and `planning_review` validation.
- Existing plan skill tests still pass through the shared helper surface.
- No skill names or user-facing behavior change in this task.

Verification:

- `pnpm exec node --import tsx --test tests/unit/plan-ready-script.test.ts tests/unit/plan-to-review-script.test.ts tests/unit/plan-orchestrator-script.test.ts tests/unit/plan-unit-delivery-script.test.ts`
- `pnpm run biome:check:all`

Dependencies: []

### Task 1.2: Update Review-First Repo Rules

Deliverable: Update repo and installed instruction rules so hosted planning
review is an explicit exception to direct-publish guidance.

Files or areas:

- `AGENTS.md`
- `instructions/AGENTS.md`
- `rules/feature-delivery.md`
- related rule tests if present

Acceptance:

- The rules state that plan workflow skills may require planning-only PRs or MRs
  before implementation, even in repos that otherwise direct-publish routine
  file changes.
- The rules preserve the existing direct-publish behavior for ordinary
  non-plan-workflow edits in this repo.
- The rules keep `## Readable Summary` before machine-readable YAML or JSON
  contracts.

Verification:

- `pnpm exec node --import tsx --test tests/unit/agent-instructions.test.ts`
- `pnpm run biome:check:all`

Dependencies: []

### Task 1.3: Rename Plan Review Skill And Emit Reviewed Planning Handoff

Deliverable: Move `plan-to-review` to `plan-review` and make the renamed skill
emit the validated `planning_review` handoff.

Files or areas:

- `skills/plan-to-review`
- `skills/plan-review`
- `tests/unit/plan-to-review-script.test.ts`
- `tests/unit/plan-review-script.test.ts`
- adapter prompt metadata
- `agent-runtime.lock.json`

Acceptance:

- Source files use the `plan-review` skill name, folder, script, adapter prompt,
  and test names.
- `plan-review` validates and emits `planning_review`.
- Pending developer review cannot produce a continuation-ready
  `planning_review`.
- The final response shape includes `## Readable Summary` before YAML.
- Stale `plan-to-review` input shapes are rejected.

Verification:

- `pnpm exec node --import tsx --test tests/unit/plan-review-script.test.ts`
- `pnpm run biome:check:all`

Dependencies:

- 1.1

### Task 1.4: Swap Orchestrator And Sequencer Responsibilities Atomically

Deliverable: Move the current sequencing implementation to
`plan-unit-sequencer` and create the new top-level `plan-orchestrator` in the
same implementation unit so the entrypoint is never missing.

Files or areas:

- `skills/plan-orchestrator`
- `skills/plan-unit-sequencer`
- `tests/unit/plan-orchestrator-script.test.ts`
- `tests/unit/plan-unit-sequencer-script.test.ts`
- adapter prompt metadata
- `skills/plan-ready`
- `agent-runtime.lock.json`

Acceptance:

- Current `plan-orchestrator` sequencing docs, scripts, and tests are moved to
  `plan-unit-sequencer`.
- A new `plan-orchestrator` skill exists as the top-level workflow entrypoint.
- `plan-ready` points to the new top-level `plan-orchestrator` where relevant.
- `plan-unit-sequencer` rejects direct unreviewed sequencing inputs with
  `needs_reviewed_planning`.
- The new `plan-orchestrator` can route atomic handoffs and OpenSpec blueprints
  through planning review before implementation.
- The old direct-sequencing semantics under `plan-orchestrator` are not
  accepted.

Verification:

- `pnpm exec node --import tsx --test tests/unit/plan-orchestrator-script.test.ts tests/unit/plan-unit-sequencer-script.test.ts tests/unit/plan-ready-script.test.ts`
- `pnpm run biome:check:all`

Dependencies:

- 1.1
- 1.2
- 1.3

### Task 1.5: Add OpenSpec Proposal Automation To Plan Orchestrator

Deliverable: Teach the top-level `plan-orchestrator` to invoke the configured
OpenSpec propose flow from a validated `openspec_blueprint`.

Files or areas:

- `skills/plan-orchestrator`
- repo-local OpenSpec generated skill references under `.agents/skills`
- OpenSpec-related tests

Acceptance:

- `plan-orchestrator` invokes the configured OpenSpec propose entrypoint,
  `/opsx:propose` where available.
- OpenSpec creation records `openspec status --change change-id --json` evidence.
- OpenSpec creation blocks on existing change ids, incomplete artifacts, or
  strict validation failures.
- The resulting OpenSpec change becomes the planning artifact passed to
  `plan-review`.

Verification:

- `pnpm exec node --import tsx --test tests/unit/plan-orchestrator-script.test.ts`
- `pnpm agent-runtime openspec validate`
- `pnpm run biome:check:all`

Dependencies:

- 1.4

### Task 1.6: Align Plan Ready And Unit Delivery Contracts

Deliverable: Update `plan-ready` and `plan-unit-delivery` so their contracts
match the review-first workflow.

Files or areas:

- `skills/plan-ready`
- `skills/plan-unit-delivery`
- corresponding adapter prompts
- corresponding script tests

Acceptance:

- `plan-ready` atomicity checks multiple implementation PRs or MRs, not the
  mandatory planning-review PR or MR.
- `plan-ready` still stops before OpenSpec creation, hosted review, and
  implementation.
- `plan-unit-delivery` requires implementation artifacts to be separate from
  planning artifacts.
- OpenSpec task completion remains in the same implementation PR or MR as the
  code change.

Verification:

- `pnpm exec node --import tsx --test tests/unit/plan-ready-script.test.ts tests/unit/plan-unit-delivery-script.test.ts`
- `pnpm run biome:check:all`

Dependencies:

- 1.4

### Task 1.7: Prune Stale Installed Skill Names

Deliverable: Ensure runtime update removes stale installed skill names after
renames.

Files or areas:

- `scripts/agent-runtime.ts`
- `tests/integration/agent-runtime-cli.test.ts`
- `agent-runtime.lock.json`

Acceptance:

- Runtime update prunes stale installed `plan-to-review` skill directories or
  symlinks after `plan-review` lands.
- Runtime update prunes stale old-name surfaces for moved plan skills.
- `agent-runtime.lock.json` contains `plan-review` and
  `plan-unit-sequencer`, and does not contain `plan-to-review`.
- Integration tests seed stale installed skill names, run update, and prove
  stale names are absent.

Verification:

- `pnpm exec node --import tsx --test tests/integration/agent-runtime-cli.test.ts`
- `pnpm run biome:check:all`

Dependencies:

- 1.3
- 1.4

### Task 1.8: Refresh And Validate Installed Runtime Profiles

Deliverable: Refresh installed runtime skills and verify source and installed
surfaces.

Files or areas:

- `agent-runtime.lock.json`
- installed runtime skill surfaces under user profiles

Acceptance:

- Personal and work profiles install the renamed skills.
- Status and validation pass for personal and work profiles.
- Explicit installed-path checks prove stale old skill names are absent from
  `.agents`, `.codex`, and `.claude` runtime skill directories.
- Repo and installed runtime searches find no stale user-facing references to
  retired names except explicit rejection/migration notes.

Verification:

- `pnpm agent-runtime skills update --profile personal`
- `pnpm agent-runtime skills update --profile work`
- `pnpm agent-runtime skills status --profile personal`
- `pnpm agent-runtime skills status --profile work`
- `pnpm agent-runtime skills validate --profile personal`
- `pnpm agent-runtime skills validate --profile work`
- Search repo and installed runtime surfaces for stale references to old skill
  names.

Dependencies:

- 1.7

## Acceptance Criteria

- `plan-orchestrator` is documented as the single end-to-end entrypoint.
- `plan-unit-sequencer` is documented as the implementation sequencing skill.
- `plan-review` is documented as the planning-only hosted review skill.
- Atomic and OpenSpec workflows both require a planning-only PR or MR before
  implementation.
- `ship_then_continue` and `stack_when_ready` define when implementation may
  begin after planning review.
- `planning_review` is emitted by `plan-review` and consumed by
  `plan-orchestrator` and `plan-unit-sequencer`.
- `plan-ready` no longer treats the mandatory planning-review PR or MR as proof
  that an implementation unit is non-atomic.
- `plan-unit-sequencer` rejects implementation sequencing without validated
  planning review evidence.
- Runtime update removes stale installed old-name skills.
- Tests cover renamed skill entrypoints, rejected old names, reviewed-planning
  validation, readable-summary output, and stale installed skill pruning.

## Verification

- Run focused tests listed under each OpenSpec task.
- Run `pnpm test` before final publish.
- Run profile update, status, and validation commands before final publish.
- Search repo and installed runtime surfaces for stale retired skill names.

## Quality Gate

- Completeness: Pass. The plan includes goal, decisions, scope, workflow,
  contracts, failure routing, tasks, acceptance, and verification.
- Accuracy: Pass. The plan is based on the current skill contracts, repo rules,
  OpenSpec propose convention, and reviewer findings.
- Structure: Pass. The plan is an implementation planning artifact.
- Actionability: Pass. Tasks include deliverables, files or areas, acceptance,
  verification, and dependencies.
- Tone: Pass. The document uses direct language and avoids filler.
- Formatting: Pass. Markdown headings, tables, and YAML blocks are explicit.
- Cross-links: Not applicable. The artifact is a repo-local implementation plan
  without stable neighboring references to link.
