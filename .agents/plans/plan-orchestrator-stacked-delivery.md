# Plan Orchestrator Stacked Delivery

## Goal

Make `plan-orchestrator` a deterministic long-running workflow coordinator for
reviewed planning plus stacked implementation delivery. The workflow should
remove the current two-mode routing, use stacked PRs or MRs as the only
implementation path, and block advancement until Nitro feedback for the current
artifact is fully addressed.

## Problem

The current plan workflow splits behavior across `ship_then_continue` and
`stack_when_ready`. That creates ambiguous routing in long-running threads:

- agents can stop after the first OpenSpec task instead of finishing the
  requested change;
- a later "continue" prompt can deliver several tasks but still miss the final
  tasks;
- agents can move to the next task before hosted feedback on the current MR is
  addressed;
- recovery from ready plans, OpenSpec blueprints, and partially prepared
  planning artifacts is underspecified.

The long-term fix is to simplify the routing model and make the orchestrator
responsible for a single resumable stack workflow.

## Decisions

- Use one implementation mode: stacked PRs or MRs.
- Remove `ship_then_continue` from the plan workflow for now.
- A single plan file gets one planning MR, then one implementation MR stacked
  on the reviewed planning MR.
- An OpenSpec change gets one planning MR for the spec, then one stacked
  implementation MR per deliverable OpenSpec task.
- The orchestrator does not create an implementation MR until the planning MR
  has no unresolved actionable Nitro feedback on its latest head.
- The orchestrator does not move to the next OpenSpec task until the current
  implementation MR has no unresolved actionable Nitro feedback on its latest
  head.
- After every push that addresses Nitro feedback, the workflow requests fresh
  Nitro feedback for the new head and waits again.
- The default Nitro review-start wait is 10 minutes, polling every 5 minutes.
  This timeout covers Nitro acknowledging or starting a review, not full review
  completion.
- Once Nitro starts reviewing, the workflow waits for Nitro to complete and
  does not advance until actionable feedback is addressed or explicitly marked
  non-actionable with rationale.
- Completion means the full stack is ready: the last implementation MR in the
  stack has completed latest-head Nitro review with no unresolved actionable
  feedback, and the stack relationship remains valid.
- Merge follow-through is out of scope for `plan-orchestrator`; a separate
  merge workflow owns merging the ready stack and post-merge cleanup.

## Scope

In scope:

- Update `plan-orchestrator` to document and enforce a single stacked delivery
  path from planning review through stack-ready completion.
- Update `plan-review` so its final handoff always represents a reviewed
  planning MR that can be used as the implementation stack base.
- Update `plan-unit-sequencer` so OpenSpec sequencing always selects from the
  current stack tip after reviewed planning exists.
- Update `plan-unit-delivery` so one atomic plan or one OpenSpec deliverable
  task maps to one implementation MR stacked on the current stack tip.
- Update shared planning contracts, examples, adapter prompts, and tests to
  remove `ship_then_continue` and old two-mode behavior.
- Add a Nitro feedback gate contract that records MR URL, head SHA, request
  evidence, review-start evidence, review-completion evidence, unresolved
  actionable feedback, stale feedback ignored, and non-actionable rationale.
- Add resume behavior so `plan-orchestrator` can inspect an existing planning
  MR, stack order, current stack tip, OpenSpec task state, latest Nitro state,
  and restack requirements before taking action.
- Add stack integrity reporting for the final `stack_ready` result.

Out of scope:

- Merging the ready stack.
- Replacing GitHub, GitLab, or `glab stack` stack mechanics with a generic stack
  manager.
- Supporting direct publish as an implementation path for this workflow.
- Supporting Codex automated review as a required feedback gate.
- Supporting multiple automated feedback providers in the first cut.
- Creating two MRs per implementation task.

## Host And Reviewer Eligibility

Nitro feedback is available only for Fullscript GitLab MRs. This workflow must
not silently substitute GitHub, Codex, generic GitLab discussions, or another
review provider when Nitro is required.

Eligibility rules:

- Fullscript GitLab MR route: supported. Use the GitLab artifact adapters and
  request Nitro with `/request_review @nitro`.
- Non-Fullscript GitLab route: unsupported for this first cut. Return
  `nitro_route_unsupported` with the artifact URL and routing evidence.
- GitHub PR route: unsupported for this first cut. Return
  `nitro_route_unsupported` instead of selecting Codex or another reviewer.
- Ambiguous remotes or artifact URLs: block and ask for the intended hosted
  review target instead of guessing.

The implementation should keep artifact hosting separate from review feedback:
GitLab owns MR metadata, branch state, discussions, and pipelines; Nitro owns
the required automated feedback gate.

## Planning Review Contract Changes

The implementation should replace the current two-mode `planning_review.mode`
contract with a single explicit stacked-delivery value.

Schema changes:

- Replace `PLANNING_REVIEW_MODES = ["ship_then_continue", "stack_when_ready"]`
  with `PLANNING_REVIEW_MODES = ["stacked_delivery"]`.
- Keep `planning_review.mode` required and set it to `stacked_delivery`.
- Keep `planning_review.gate_outcome` required and set it to
  `ready_for_stack`.
- Add a workflow-scoped delivery contract that rejects `direct_publish` for
  orchestrated plan delivery. Existing lower-level helpers may keep
  `direct_publish` only for non-orchestrated workflows if validators can prove
  the current route is outside `plan-orchestrator`.
- Require `planning_review.stack_base_ref` and
  `planning_review.stack_base_evidence` for every reviewed planning handoff.
- Keep `planning_review.target_branch`, `target_base_sha`, `planning_branch`,
  `reviewed_head`, and `task_state_fingerprint` required.
- Add stack identity fields to handoffs and ledgers that create or consume
  implementation units:
  - expected stack base ref;
  - expected stack base SHA;
  - predecessor MR URL or ref;
  - selected task base SHA;
  - implementation MR URL;
  - implementation MR head SHA;
  - restack-required evidence.
- Reject `ship_then_continue` and `stack_when_ready` as legacy values with a
  clear rerun or update message.

Result shape:

```yaml
planning_review:
  status: reviewed
  artifact_type: plan | openspec | linear
  artifact_ref: <plan file, OpenSpec change, or Linear ref>
  review_artifact: <planning MR URL>
  mode: stacked_delivery
  gate_outcome: ready_for_stack
  target_branch: <target branch>
  target_base_sha: <target branch sha used for planning>
  planning_branch: <planning branch>
  reviewed_head: <planning MR latest head sha>
  stack_base_ref: <planning MR branch or MR URL usable as stack base>
  stack_base_evidence: <Nitro-clean latest head and stack-base evidence>
  stack_identity:
    expected_base_ref: <planning MR ref>
    expected_base_sha: <planning MR latest head sha>
    predecessor_artifact:
    restack_required: false
  task_state_fingerprint: <sha256 of reviewed plan or OpenSpec task state>
  validation:
    evidence:
      - <plan or OpenSpec validation evidence>
  review:
    evidence:
      - <Nitro request, start, completion, and no unresolved actionable findings>
  blockers: []
```

## Required Behavior

### Plan Orchestrator

`plan-orchestrator` must route all ready planning inputs into the same stacked
workflow:

1. If the request is fuzzy, use brainstorming and write or update a plan under
   `.agents/plans/`.
2. Run `plan-ready`.
3. If `plan-ready` emits `plan_delivery_handoff`, create a planning MR for the
   plan file and run `plan-review`.
4. If `plan-ready` emits `openspec_blueprint`, create the OpenSpec change, run
   strict OpenSpec validation, create a planning MR for the OpenSpec change,
   and run `plan-review`.
5. Wait until the planning MR has latest-head Nitro feedback completed with no
   unresolved actionable feedback.
6. Use the reviewed planning MR head as the implementation stack base.
7. For an atomic plan, create one implementation MR stacked on the reviewed
   planning MR.
8. For OpenSpec, select the first unchecked deliverable task from the stack tip
   and create one implementation MR for that task.
9. Wait until the current implementation MR has latest-head Nitro feedback
   completed with no unresolved actionable feedback.
10. For OpenSpec, repeat task selection and implementation MR delivery until no
    unchecked deliverable tasks remain.
11. Finish with `stack_ready` only after the planning MR and every open
    implementation MR in stack order have clean latest-head Nitro review and
    the stack integrity report passes.

The orchestrator must not advance from one MR to the next while Nitro feedback
for the current MR is unresolved, stale, missing, or only requested.

### Nitro Feedback Gate

The workflow must treat Nitro as the only required automated feedback provider
for this first cut. Nitro feedback closure must be represented by a shared
`nitro_feedback_gate` template and validator before individual skills consume
the result.

Nitro states:

- `requested`: the workflow asked Nitro to review the latest head.
- `started`: Nitro acknowledged or started review for the latest head.
- `completed`: Nitro finished review for the latest head.
- `actionable_feedback`: Nitro reported findings that must be addressed before
  advancement.
- `clean`: Nitro completed review with no actionable feedback.
- `non_actionable`: a finding is explicitly documented with rationale and does
  not block advancement.
- `stale`: feedback belongs to an older head and cannot satisfy the current
  gate.
- `unavailable`: Nitro cannot be reached or does not start within the configured
  wait window.

Default wait configuration:

```yaml
nitro_feedback_wait:
  request_required_after_each_push: true
  start_ack_timeout_minutes: 10
  poll_interval_minutes: 5
  start_timeout_outcome: nitro_review_start_blocked
  full_review_timeout_minutes:
```

Gate rules:

- Request Nitro feedback after creating an MR.
- Request Nitro feedback after every material head-changing push, including
  feedback fixes, restacks, conflict fixes, pipeline fixes, user edits, rebases,
  and plan or documentation feedback fixes.
- Poll every minute for Nitro to acknowledge or start latest-head review.
- If Nitro does not acknowledge or start within 10 minutes, stop with
  `nitro_review_start_blocked`.
- Once Nitro starts reviewing, wait for the review to complete.
- If Nitro has started but has not completed yet, report
  `nitro_review_completion_pending` and keep the workflow resumable against the
  same MR and head SHA. Do not treat this as a pass or a failure.
- Treat older-head feedback as stale unless fresh Nitro feedback has been
  requested and completed for the latest head.
- Continue only when latest-head Nitro feedback is completed and has no
  unresolved actionable findings.

Shared gate shape:

```yaml
nitro_feedback_gate:
  artifact: <MR URL>
  head_sha: <latest head sha>
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - <request command, note URL, or discussion evidence>
  start:
    status: started | blocked | pending
    timeout_minutes: 10
    poll_interval_minutes: 5
    evidence:
      - <Nitro pending review, acknowledgement, or start evidence>
  completion:
    status: clean | findings | stale | unavailable | pending
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback:
    - <finding plus rationale>
  stale_feedback_ignored:
    - <old head sha plus evidence>
  gate_outcome: passed | blocked | pending
```

`planning_review`, `plan-unit-delivery` success, and final `stack_ready` must
consume this normalized gate. Generic "routed automated feedback" timeout or
unavailable evidence is not sufficient when Nitro is the required gate.

Normalize the existing `nitro-review-feedback` output into the gate states:

| Nitro skill status | Gate meaning | Can advance? |
| --- | --- | --- |
| `pending` | Nitro has acknowledged or started review for the latest head, but has not completed | No |
| `no issues` | Nitro completed latest-head review with no actionable findings | Yes |
| `findings` | Nitro completed latest-head review with findings | No, unless every finding is fixed or explicitly non-actionable and fresh Nitro feedback confirms the latest head |
| `unavailable` | Nitro could not be reached or the request could not be verified | No |
| `stale` | Feedback belongs to an older head | No |

`pending` satisfies the review-start acknowledgement requirement, but it does
not satisfy the completion gate. `no issues` is the normal clean completion
state. `findings` can advance only after fixes are pushed, Nitro is requested
again, and latest-head feedback completes cleanly or with only documented
non-actionable findings.

### Plan Review

`plan-review` must produce a planning review handoff for a planning MR that is
ready to become the implementation stack base.

For a single plan file:

- publish one planning MR reviewing the plan file;
- request Nitro feedback after every push;
- address or classify Nitro feedback before emitting `planning_review`;
- emit a reviewed planning head that the implementation MR can stack on.

For OpenSpec:

- publish one planning MR reviewing the OpenSpec change;
- request Nitro feedback after every push;
- address or classify Nitro feedback before emitting `planning_review`;
- emit a reviewed planning head that the first task MR can stack on.

### Plan Unit Sequencer

`plan-unit-sequencer` must sequence implementation from stack-tip state only.

For a single plan file:

- derive one implementation unit;
- hand it to `plan-unit-delivery`;
- stop after the implementation MR passes the Nitro gate and stack integrity
  checks.

For OpenSpec:

- read `tasks.md` from the current stack tip;
- select the first unchecked deliverable task in document order;
- hand exactly that task to `plan-unit-delivery`;
- after the MR passes the Nitro gate, read the new stack tip and repeat;
- stop only when no unchecked deliverable tasks remain, or when manual/external
  tasks are the only remaining work.

### Plan Unit Delivery

`plan-unit-delivery` must implement exactly one unit:

- one implementation MR for an atomic plan; or
- one implementation MR for one OpenSpec deliverable task.

For OpenSpec tasks, the task checkbox must be checked in the same implementation
MR that delivers the task. The MR must add exactly one deliverable checkbox
relative to its base.

Before returning success, `plan-unit-delivery` must:

- prove the MR is stacked on the expected stack tip;
- run required local and hosted verification;
- request Nitro feedback on the latest head;
- address all actionable Nitro feedback;
- request fresh Nitro feedback after every feedback-fix push;
- prove latest-head Nitro review is completed with no unresolved actionable
  feedback.

### Resume And Restack

On restart or "continue", `plan-orchestrator` must inspect:

- the planning MR and its latest Nitro gate state;
- the implementation stack order;
- the current stack tip;
- the latest head SHA and latest Nitro gate state for every open MR in the
  stack;
- `tasks.md` state at the current stack tip;
- whether any earlier MR changed after descendants were created.

If an earlier MR changes after descendants exist, the orchestrator must restack
affected descendants and rerun the full Nitro gate for every MR whose head
changed before reporting `stack_ready`.

This should be a recovery path, not the normal flow. Normal sequencing waits
for Nitro closure on each MR before creating the next MR.

## Failure Routing

| Status | Meaning | Next step |
| --- | --- | --- |
| `needs_plan_ready` | Input is stale, fuzzy, or legacy-shaped | Run `plan-ready` |
| `needs_reviewed_planning` | No validated `planning_review` exists | Run `plan-review` |
| `openspec_proposal_blocked` | OpenSpec change creation or validation failed | Repair the proposal path |
| `planning_review_blocked` | Planning MR still has unresolved Nitro or review feedback | Continue the planning MR |
| `nitro_review_start_blocked` | Nitro did not acknowledge or start within 10 minutes | Report request evidence and stop |
| `nitro_review_completion_pending` | Nitro started but has not completed latest-head review | Keep waiting or resume later from the same MR/head |
| `nitro_feedback_unresolved` | Latest-head Nitro feedback has actionable findings | Address feedback before advancing |
| `nitro_feedback_stale` | Only older-head Nitro feedback is available | Request fresh latest-head feedback |
| `nitro_route_unsupported` | Required Nitro feedback cannot run on the artifact host | Move to a Fullscript GitLab MR route or stop |
| `stack_relationship_missing` | The next MR is not based on the expected stack tip | Repair or recreate the stack link |
| `stack_base_changed` | An earlier MR changed after descendants were created | Restack affected descendants |
| `stack_task_state_invalid` | Stack tip task state is non-cumulative or checks future tasks | Repair task state |
| `manual_task_pending` | Only manual or external tasks remain | Report required human action |
| `stack_ready` | Full stack is reviewed and ready for merge | Hand off to merge follow-through |

## Acceptance Criteria

- `ship_then_continue` is removed from plan workflow docs, examples, scripts,
  validators, and tests.
- `planning_review.mode` no longer accepts multiple implementation modes; the
  workflow uses stacked delivery only.
- The orchestrated workflow rejects `direct_publish` before planning review or
  implementation delivery.
- `AGENTS.md`, `instructions/AGENTS.md`, and `rules/feature-delivery.md`
  document that `plan-orchestrator` stacked delivery overrides this repo's
  ordinary direct-main behavior.
- `plan-ready` docs, scripts, adapter prompt, and tests either stop emitting
  `direct_publish` for orchestrated plan delivery or mark it as unsupported for
  this route.
- `review-feedback-routing`, `plan-review`, and related adapter prompts
  document that this first cut is Nitro-capable Fullscript GitLab only, with
  GitHub/Codex paths blocked as `nitro_route_unsupported`.
- Shared contracts include stack identity fields needed to prove expected base,
  predecessor artifact, implementation head, and restack state.
- A shared `nitro_feedback_gate` template and validator exists before
  `plan-review` and `plan-unit-delivery` consume Nitro gate evidence.
- `plan-orchestrator` documents ready-plan, OpenSpec blueprint, existing
  OpenSpec, and continue/resume intake paths.
- `plan-orchestrator` does not create an implementation MR until the planning
  MR passes latest-head Nitro feedback closure.
- `plan-orchestrator` does not select the next OpenSpec task until the current
  implementation MR passes latest-head Nitro feedback closure.
- `plan-review` requests fresh Nitro feedback after every feedback-fix push
  before emitting `planning_review`.
- `plan-unit-delivery` requests fresh Nitro feedback after every
  feedback-fix push before reporting unit success.
- Runtime-facing instructions, prompts, and rule updates land only after shared
  validators and consumer skill tests reject `ship_then_continue`, reject
  `stack_when_ready`, reject orchestrated `direct_publish`, and accept
  `stacked_delivery`.
- `plan-unit-sequencer` treats stack tip `tasks.md` as the source of truth for
  unmerged stacked implementation state.
- OpenSpec task delivery remains one implementation MR per deliverable task.
- Final completion is reported as `stack_ready`, not merged.
- Stack-ready output includes MR order, base/head relationships, one-task delta
  evidence, Nitro feedback evidence for the planning MR and every
  implementation MR, unresolved-feedback counts, and stack tip task state.
- Merge follow-through remains separate from `plan-orchestrator`.

## Verification

- `writing-skills` review against changed shared agent and skill behavior
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm agent-runtime skills update --profile personal`
- `pnpm agent-runtime skills update --profile work`
- `pnpm agent-runtime skills status --profile personal`
- `pnpm agent-runtime skills status --profile work`
- `pnpm agent-runtime skills validate --profile personal`
- `pnpm agent-runtime skills validate --profile work`
- `pnpm agent-runtime instructions status --profile personal`
- `pnpm agent-runtime instructions status --profile work`
- `pnpm agent-runtime instructions validate --profile personal`
- `pnpm agent-runtime instructions validate --profile work`
- `pnpm agent-runtime openspec validate`
- `openspec validate <change-id> --strict --no-interactive`
- Search source and installed runtime surfaces for `ship_then_continue` after
  implementation.
- Search source and installed runtime surfaces for stale `direct_publish`
  permissions inside the orchestrated plan workflow.

## OpenSpec Blueprint Mapping

Suggested change:

- id: `simplify-plan-orchestration-to-nitro-reviewed-stacks`
- title: `Simplify plan orchestration to Nitro-reviewed MR stacks`
- capability: `review-first-plan-orchestration`

Proposed requirements:

- Plan orchestration shall support only stacked PR/MR implementation delivery.
- Plan orchestration shall return `nitro_route_unsupported` when a required
  Nitro feedback gate cannot be hosted on a Fullscript GitLab MR.
- Planning review shall emit `planning_review.mode: stacked_delivery` and
  `planning_review.gate_outcome: ready_for_stack`.
- Planning review shall reject legacy `ship_then_continue` and
  `stack_when_ready` modes.
- Orchestrated plan delivery shall reject `direct_publish` for planning and
  implementation artifacts.
- Shared planning handoffs shall carry stack identity evidence for expected
  base refs, expected base SHAs, predecessor artifacts, implementation heads,
  and restack-required state.
- Planning review shall request Nitro after MR creation and after every
  material head-changing push.
- Nitro feedback gates shall distinguish request evidence, review-start
  acknowledgement, review completion, actionable findings, stale feedback, and
  unavailable feedback.
- Nitro feedback gates shall use the shared `nitro_feedback_gate` contract.
- Plan unit sequencing shall advance only from the current stack tip.
- Plan unit delivery shall create one implementation MR per atomic plan or
  OpenSpec deliverable task.
- Plan unit delivery shall not finish a unit until latest-head Nitro feedback is
  completed with no unresolved actionable findings.
- Plan orchestration shall report completion as `stack_ready` only after the
  planning MR and every implementation MR pass Nitro feedback closure and stack
  integrity checks.
- Repo rules and installed user instructions shall document that
  `plan-orchestrator` stacked delivery is an exception to ordinary direct-main
  publication.

OpenSpec task outline:

1. Shared planning contract migration: replace the planning-review mode enum,
   reject direct publish inside orchestrated delivery, add stack identity
   fields, and update validator rules, templates, and tests with
   `stacked_delivery` and `ready_for_stack`.
2. Nitro route and feedback gate contracts: update review routing, add the
   shared `nitro_feedback_gate` validator/template, Nitro status normalization,
   wait defaults, evidence ledgers, unsupported-route handling, and tests.
3. Plan review stacked-base handoff: update `plan-review` docs, scripts,
   adapter prompt, and tests to produce Nitro-clean stack-base handoffs.
4. Orchestrator resume and stack-ready loop: update `plan-orchestrator` docs,
   scripts, adapter prompt, and tests for ready-plan, blueprint, existing
   OpenSpec, and continue/resume routes.
5. Sequencer stack-tip selection: update `plan-unit-sequencer` docs, scripts,
   adapter prompt, and tests so OpenSpec tasks advance only from stack-tip
   state.
6. Unit delivery Nitro closure: update `plan-unit-delivery` docs, scripts,
   adapter prompt, and tests for one-unit stacked MR delivery, one-checkbox
   deltas, fresh Nitro requests after every material head-changing push, and
   restack recovery evidence.
7. Repo rule and instruction alignment: update `plan-ready`,
   `review-feedback-routing`, `AGENTS.md`, `instructions/AGENTS.md`, and
   `rules/feature-delivery.md` only after the shared validators and consumer
   skill tests prove the new contract is enforceable.
8. Runtime refresh and cleanup: refresh installed skill surfaces, validate
   personal and work profiles, and remove stale references to retired modes and
   unsupported direct-publish paths.

## Implementation Slices

1. Update shared planning contracts and validators to remove `ship_then_continue`,
   reject orchestrated `direct_publish`, add stack identity fields, and
   represent stacked delivery as the only mode.
2. Add the shared `nitro_feedback_gate` template/validator plus Nitro status
   normalization and unsupported host routing.
3. Update `plan-review` docs, scripts, adapter prompt, and tests for reviewed
   planning MR stack-base semantics and Nitro-only latest-head feedback gates.
4. Update `plan-orchestrator` docs, scripts, adapter prompt, and tests for
   resumable stacked workflow routing, resume inspection, and stack-ready
   completion.
5. Update `plan-unit-sequencer` docs, scripts, adapter prompt, and tests so
   OpenSpec task selection always advances from stack-tip state.
6. Update `plan-unit-delivery` docs, scripts, adapter prompt, and tests for
   one-unit stacked MR delivery, one-checkbox deltas, Nitro feedback gates, and
   restack recovery evidence.
7. Update repo rules, installed instructions, `plan-ready`, and review routing
   docs/scripts/prompts for stacked Nitro-reviewed delivery only after the
   migrated validators and consumer tests reject legacy modes and orchestrated
   direct publish.
8. Refresh runtime skill surfaces and validate installed personal and work
   profiles.

## Open Questions

None. The first cut intentionally uses Nitro only, stacked delivery only, a
10-minute Nitro review-start timeout, and stack-ready completion.
