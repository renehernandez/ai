## Context

The current review-first workflow already has stacked delivery, planning review,
and one-task delivery constraints. The gap is narrower: a top-level
`plan-orchestrator` run can inherit `plan-unit-sequencer`'s direct `next_task`
route and report success after one OpenSpec task. A second gap is that
`stack_ready` can currently trust a claimed task-state boolean instead of
checking concrete task and artifact evidence.

## Design

### Orchestrator terminal states

`plan-orchestrator` has two terminal states:

- `stack_ready`: the full planning plus implementation stack is ready for merge
  follow-through.
- `delivery_blocked`: the workflow cannot continue because required evidence,
  gates, host capabilities, credentials, manual work, or session continuity is
  missing.

Partial delivery is not terminal success. Budget exhaustion or session handoff
is `delivery_blocked` with durable resume evidence, not completion.

### Caller-aware sequencing

`plan-unit-sequencer` keeps direct invocation goals:

- `next_task`;
- `bounded_sequence`;
- `complete_change`.

The sequencer input and output need a caller context:

- `caller: direct` can use any direct sequencer goal.
- `caller: plan_orchestrator` is normalized to full-stack delivery and cannot
  emit terminal completion while unchecked deliverable tasks remain.

This makes the behavior mechanical instead of relying on prompt wording.

### Shared stack-state evidence

The implementation should avoid parallel YAML parsers and subtly different
task-delta semantics in each skill script. Add or extract shared helpers for:

- parsing OpenSpec `tasks.md` deliverable task inventory;
- validating one-task checkbox deltas;
- parsing stack artifact records;
- normalizing gate evidence needed by resume and `stack_ready`.

`plan-unit-delivery` should keep the one-unit delivery invariant, but its
ledger/handoff output must expose enough structured evidence for downstream
resume and stack-ready checks:

- selected task ID;
- selected task base SHA;
- predecessor artifact or base ref;
- implementation artifact URL or ref;
- implementation head SHA;
- task-delta validation command/output;
- latest-head CI evidence;
- latest-head Nitro evidence;
- restack state.

### Stack-ready validation

`validate-stack-ready` must not accept `all_deliverable_tasks_checked: true` as
proof. It must read or receive concrete stack-tip `tasks.md` content or a path,
parse deliverable tasks, and compare that inventory with implementation
artifact evidence.

Validation rejects:

- an unchecked deliverable task;
- a checked future task with no matching implementation artifact;
- an implementation artifact missing selected task ID or task-delta evidence;
- missing or non-passed latest-head CI/Nitro evidence;
- missing stack relationship evidence;
- `restack_required: true`.

### Planning feedback disposition

The planning-review gate has its own historical-feedback requirement. A
latest-head Nitro clean note proves the current planning head has no new
critical issues, but it does not prove every prior Nitro planning discussion was
handled. The planning-review ledger must enumerate all Nitro-authored planning
comments and discussions on the planning MR, including earlier review rounds,
and record a disposition for each item:

- fixed in the planning artifact;
- deferred to a specific implementation task;
- non-actionable with rationale;
- blocked.

Each item should carry the Nitro note ID, discussion ID when present, current
resolvable/resolved state from the artifact host, and evidence for the
disposition. If a resolvable discussion remains unresolved in GitLab, the gate
can pass only when the ledger explicitly explains why it is non-actionable or
deferred. Unresolved actionable planning feedback blocks implementation
sequencing even when the latest-head Nitro summary is clean.

### Resume predecessor verification

Resume validation splits inspection from continuation:

- `resume_ready`: every checked predecessor task has a matching artifact,
  valid task delta, passed CI/Nitro gates, cumulative task state, and no restack
  requirement.
- `delivery_blocked`: any predecessor evidence is missing, stale, pending,
  failed, or inconsistent.

The sequencer may select the next unchecked task only from `resume_ready`.

### Runtime compatibility

Runtime skill validation/status can miss installed script import failures. The
delivery must refresh installed skills and then execute touched installed
planning scripts, including the `plan-unit-delivery` script that imports shared
Nitro feedback helpers. If shared helper imports remain, the runtime config
must install those helpers as reusable scripts.

## Alternatives Considered

- Remove `next_task` entirely from `plan-unit-sequencer`. Rejected because
  direct sequencer usage still needs a one-task route.
- Trust `tasks.md` fingerprints and a boolean in `stack_ready`. Rejected because
  it preserves the original partial-success failure under a different name.
- Build a generic stack manager. Rejected because the fix only needs task
  inventory, task-delta, gate, and stack-order evidence.

## Rollout

Implement as separate OpenSpec tasks. Keep runtime refresh last so updated
installed surfaces are validated after all skill/script changes land.
