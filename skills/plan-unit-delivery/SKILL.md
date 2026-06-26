---
name: plan-unit-delivery
description: Use when one validated plan_delivery_handoff approved unit should be implemented through local verification, review gates, Nitro feedback, CI, and stacked PR/MR delivery.
---

# Plan Unit Delivery

## Overview

Implement exactly one approved unit. The unit is either an atomic plan or one
OpenSpec delivery-unit heading with nested work items selected by
`plan-unit-sequencer`.

This skill does not brainstorm, author plans, manage OpenSpec sequences, or keep
a followthrough ledger.

## When To Use

Use when the user provides a valid `plan_delivery_handoff`, or when
`plan-unit-sequencer` passes one approved atomic unit or OpenSpec delivery unit.

Do not use for fuzzy ideas, unreviewed plans, OpenSpec proposal creation, Linear
tickets that still need planning, or legacy handoff shapes.

## Handoff Rules

Run `scripts/plan-unit-delivery.ts validate-handoff --file <handoff>` before editing.

Legacy `plan_ready_handoff`, `plan_followthrough_slice_handoff`,
`reviewed_slices`, `slice_plan_review`, and followthrough-ledger inputs are
unsupported. Return `needs_plan_ready`.

For OpenSpec delivery units, the implementation PR/MR must change only nested
work-item checkboxes inside the selected unit from `[ ]` to `[x]` in the same
branch that implements the unit. Do not create a follow-up bookkeeping commit
for task completion.

Each OpenSpec delivery unit must be delivered in its own PR/MR. A delivery unit
may require multiple nested work-item commits inside that PR/MR. Do not combine
multiple delivery units in one PR/MR.

Before finishing an OpenSpec delivery unit, validate the delivery-unit delta:

```bash
scripts/plan-unit-delivery.ts validate-task-delta --base <base-tasks.md> --head <unit-tasks.md> --unit <unit-id>
```

The delta is valid only when exactly one expected delivery unit becomes complete
relative to the base branch and no work items outside that unit are checked.

Record the delivery-unit delta command and output in the final
`delivery_gate_ledger`. The same ledger must also record the selected unit ID,
completed nested work-item IDs, selected unit base SHA, predecessor artifact,
implementation artifact URL/ref, implementation head SHA, CI evidence, Nitro
evidence, and whether restacking was required.

Reviewer execution is a required delivery gate. A valid handoff authorizes
launching implementation reviewers as internal subagents in the current
harness; do not ask for separate confirmation. If internal subagents are
unavailable, block with evidence instead of substituting a different review
path.

## Workflow

1. Validate the `plan_delivery_handoff`.
2. Inspect live repo, branch, remotes, and artifact-host routing.
3. Implement only `approved_unit`.
4. If the approved unit is an OpenSpec delivery unit, check off only nested work
   items inside that unit in `tasks.md` in the same commits as their
   implementation.
5. Confirm the approved delivery unit is delivered as one separate PR/MR. If
   the diff includes another unit's implementation or checkbox update, split it
   into a separate PR/MR before continuing. Multiple nested work-item commits
   inside the selected unit's PR/MR are allowed.
6. Run local verification named in the handoff, plus the narrowest useful tests
   for touched code.
7. For OpenSpec delivery units, validate the unit delta against the unit base.
8. Launch implementation reviewers through internal subagents.
9. Reconcile reviewer outcomes.
10. Validate `reviewer_launch` and `reviewer_report`; the launch must include
    the staged diff hash given to implementation reviewers, and the report must
    include the same staged diff hash reviewed by the reviewers.
    `not_applicable` skipped reviewers must remain explicit evidence in
    source provenance, but must not become required local gate passes.
11. For every workflow-owned implementation commit, run the implementation
    commit helper so gate activation and commit delegation happen as one
    required-gate step:

    ```bash
    scripts/plan-unit-delivery.ts commit-implementation --file <delivery-evidence> --source-ref <handoff-or-report-ref> --message "<commit message>"
    ```

    If activation is blocked, gate writing fails, validation fails, reviewer
    evidence is missing or stale, or blocking findings remain, the helper must
    not commit; resolve the blocker and rerun reviewers or activation.

    The helper delegates to the required-gate commit path. If Git creates the
    commit but the helper reports that the review gate was not consumed or
    failed to consume, treat the created head as not locally reviewed for this
    workflow. Inspect the commit, rerun required local reviewers for the
    current gate state, activate a fresh gate, and retry the workflow step
    before pushing or requesting hosted review.
    The local review gate blocks the commit boundary only. After it passes,
    hosted gates remain required: artifact creation, artifact-host inspection,
    CI or no-pipeline inspection, explicit `/request_review @nitro`, latest-head
    Nitro feedback, and actionable-feedback resolution still block stack
    advancement and delivery completion.
12. Run review-feedback routing.
13. Open or update one routed implementation PR/MR stacked on the expected
    stack tip from the handoff.
14. Prove the implementation artifact is separate from the planning-review
    PR/MR. If the same hosted artifact would be reused, block and split the
    implementation to a separate PR/MR.
15. Run the hosted-description gate through the selected description policy
    owner (`change-request-create`, `glab-mr-create`, `github-pr-create`, or an
    equivalent provider adapter in harnesses where the named skill is
    unavailable). For existing PRs/MRs, read the current hosted body before
    updating and retain enough pre-update evidence to restore manual sections,
    links, checklist state, reviewer-authored notes, and template content if
    readback shows damage. The implementation body must describe the approved
    unit, current behavior, review focus, targeted evidence, hosted status, and
    stack relationship that changes reviewer confidence. It must omit routine
    local validation, private workflow artifacts, raw ledgers, local paths,
    subagent gates, and author-only plan iteration. Read the hosted body back
    for the current implementation head before artifact-host review, Nitro
    request, pipeline monitoring, or final delivery reporting. If readback
    finds lost manual content, wrong-section updates, stale prior-head content,
    or a less accurate body, restore through the selected policy owner or block
    with recovery evidence. Metadata-only reuse is allowed only when the
    existing body remains accurate for the current head and the ledger records a
    metadata-only materiality decision plus reuse rationale.
16. Run artifact-host review.
17. Monitor artifact-host pipelines for the latest head until they pass, fail,
    block, or are unavailable with evidence. Include child or downstream
    pipeline state when the host exposes it.
18. Request Nitro feedback after MR creation and after every material
    head-changing push, including feedback fixes, restacks, conflict fixes,
    pipeline fixes, user edits, rebases, and plan or documentation feedback
    fixes. Refresh the hosted-description gate before the request whenever the
    change affects reviewer understanding.
19. Wait for the shared latest-head `nitro_feedback_gate` to pass. A requested,
    pending, stale, unavailable, or findings gate is blocking.
20. Finish only when the unit implementation MR is stack-ready with passed
    description-policy and Nitro gates, or blocked with evidence.

Block with `implementation_scope_escape` when the selected unit requires
unrelated task edits, new OpenSpec tasks, or broadening the approved scope.

## Delivery Gate Ledger

`nitro_feedback_gate` and `delivery_gate_ledger` remain session-only evidence
for this delivery loop. They are not durable sequence state and must not
replace OpenSpec `tasks.md`.

When writing `delivery_gate_ledger`, `reviewer_launch`,
`reviewer_report`, `refactoring_execution`, or the final delivery
state back to the thread, include a concise `## Readable Summary` first. Keep
it to 3-6 bullets with approved unit, artifact, verification result, reviewer
state, pipeline or feedback state, and finish state. Do not replace the YAML;
the YAML remains the auditable delivery contract.

Use:

```bash
scripts/plan-unit-delivery.ts gate-template
scripts/plan-unit-delivery.ts validate-ledger --file <ledger> --expected-artifact <hosted-url> --expected-head-sha <current-hosted-head>
```

The expected artifact and head values must come from the latest host inspection
or live branch/head inspection, not from the ledger being validated.

The final ledger must include a passed `nitro_feedback_gate`. `validate-ledger`
rejects missing, pending, stale, unavailable, findings, or unresolved Nitro
feedback gates. It also rejects missing, blocked, stale, unavailable, or
prior-head `description_policy` evidence. The ledger rejects omissions of
one-unit delivery evidence:
selected unit identity, completed nested work-item IDs, selected unit base SHA,
predecessor artifact, implementation artifact, implementation head SHA,
`validate-task-delta --unit` command, validator output containing
`delivery_unit_delta_valid`, pipeline evidence, Nitro evidence, description
readback evidence, and restack state. For atomic plan units, record
`stack_identity.selected_unit_id: atomic` and
`delivery_unit_delta.status: not_applicable` with evidence that no OpenSpec
checkbox delta exists.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Implementing without `plan_delivery_handoff` | Return `needs_plan_ready` |
| Accepting legacy slice/followthrough handoffs | Return `needs_plan_ready` |
| Combining multiple delivery units in one PR/MR | Split into one PR/MR per unit |
| Checking OpenSpec work items in a follow-up commit | Check the work items in the implementation PR/MR |
| Reusing the planning-review PR/MR for implementation | Create a separate implementation artifact and record separation evidence |
| Implementing multiple delivery units at once | Return to OpenSpec or `plan-unit-sequencer` |
| Finishing without proving the delivery-unit delta | Run `validate-task-delta --unit` against base and unit `tasks.md` |
| Fabricating delivery-unit delta proof for an atomic plan | Mark `delivery_unit_delta` not applicable with `selected_unit_id: atomic` |
| Recording delta proof only in chat prose | Put the command and `delivery_unit_delta_valid` output in `delivery_gate_ledger.delivery_unit_delta` |
| Committing without the implementation helper | Run `commit-implementation` so gate activation and the required-gate commit path stay in one workflow step |
| Reusing reviewer evidence after staging new changes | Rerun reviewers and update both `reviewer_launch.staged_diff_hash` and `reviewer_report.reviewed_diff_hash` |
| Treating a passed local review gate as hosted approval | Continue through artifact creation, artifact-host inspection, CI or no-pipeline inspection, explicit `/request_review @nitro`, latest-head Nitro feedback, and actionable-feedback resolution |
| Treating delivery gate evidence as durable state | Keep sequence state in OpenSpec |
| Treating an open PR/MR as done before pipelines settle | Keep monitoring latest-head pipelines |
| Assuming Nitro feedback is absent immediately after push | Request Nitro for the latest head, wait up to 10 minutes for review start, then wait for completion |
| Requesting Nitro or reporting stack readiness before current-head description readback | Run the description policy gate first and record it in `delivery_gate_ledger.description_policy` |
| Reusing a prior implementation description after a material push | Refresh the hosted description, or record current-head metadata-only reuse with rationale |
| Exposing raw ledgers, local paths, subagent gates, or author-only plan iteration in the MR body | Rewrite through the description policy owner so the body describes the approved unit and reviewer-facing evidence |
| Moving on after restacking descendants | Rerun the full Nitro gate for every changed descendant head |
| Returning gate YAML without a readable thread summary | Add `## Readable Summary` before the YAML |

## Test Evidence

- RED: previous workflow accepted direct `plan_ready_handoff` and
  `plan_followthrough_slice_handoff`.
- GREEN: the validator now accepts only `plan_delivery_handoff` and rejects
  legacy shapes.
- GREEN: `delivery_gate_ledger` validation requires passed, current-head
  `description_policy` evidence before stack-ready delivery.
