# Evidence-based Paseo delivery and adoption

## Objective and delivery

Stop the workflow runner from recording delivered assignments as failed, and
let a workflow recover a falsely failed worker through a supported, audited
runner action. Depend only on stable Paseo facts, never on the exact output of
a particular version. Deliver one atomic plan plus implementation in one
AI-repository PR.

This is the first of two changes. The second renames the `planner` role to
`orchestrator` and redesigns the tool policy (observation, runner-mediated
mutation, symmetric undo). This change keeps the `planner` role name, the
`planner-v2` state marker, and the current Pi policy.

No fillario publication or merge, cleanup, force push, dependency change, or
live runtime change before merge is authorized. Merge requires separate user
authority.

## Evidence

- `launch` in `skills/paseo-orchestration/scripts/paseo-workflow.ts` requires
  `paseo send --no-wait --json` to return `status: "sent"`. Any other result
  marks the implementer `failed` and reviewers `degraded`.
- Installed Paseo (now 0.14.0) returns `status: receipt.deliveryStatus ?? "sent"`.
  The protocol types `deliveryStatus` as optional `"queued"`. The server queues
  every message that carries a source agent, and the CLI sets the source from
  `PASEO_AGENT_ID`. Every send from a managed orchestrator therefore returns
  `queued` after Paseo accepted it: a deterministic false negative.
- The queue is in memory and flushes about two seconds after enqueue. It
  unarchives the recipient by default and has no cancel operation. A queued
  message that fails to dispatch surfaces only as an asynchronous run error.
- The session timeline records a `[Message received]` entry holding the
  delivered prompt, which includes the assignment's unique snapshot digest.
- Live reproduction: in all three planning rounds for this plan, the runner
  recorded every Sol reviewer `degraded`; each timeline shows the assignment
  received and a complete `AX_REVIEW` report.
- Paseo lifecycle statuses are `initializing`, `idle`, `running`, `error`,
  `closed`. A daemon restart turns an idle session `closed`; the runner's route
  check accepts only `idle`.
- Stranded fillario state: handoff `failed` for agent `c8002faf…`, now
  `closed`, whose last reply holds one valid `AX_REPORT` for
  `slow-pelican@eac79ad1fdb3c42fa30b16e4f08038a9e860acc6`; the worktree is
  clean at that head. No runner action can adopt it: implementation `review`
  needs handoff `complete`, `continuation` needs a known head, `retry-handoff`
  covers only a no-write misroute, and `handoff` refuses a second dispatch.
- A planning-only state that reaches the planning round bound cannot take a
  `continuation`: it requires an expected head equal to `latestHead`, which is
  undefined before implementation, and rejects an empty head.

## Reuse and ownership

Extend the existing runner owners: `paseo-workflow.ts` (launch, tick,
recovery), `paseo-workflow-state.ts` (worker states, `nextStep`, history,
continuation), and `paseo-workflow-io.ts` (transport). Reuse `recordCompletion`
and `verifiedReport` for adoption; the `retry-handoff` reservation, history
archive and idempotency pattern; the stored startup-reply digest; the existing
"idle with startup reply has not begun" rule; and the injected-transport tests.
`skills/paseo-orchestration/references/paseo-workflow.md` is the only
normative contract; `SKILL.md` routes to it and summarizes.

New: an `ambiguous` delivery record, an `adopt` action, and a `retry-launch`
action. No existing action can absorb them: `retry-handoff` is deliberately
limited to no-write misroutes and stays unchanged. No generic retry
framework, event log, or alternate launcher.

## Paseo boundary

The runner depends on these facts only, decoded in `paseo-workflow-io.ts`:

- `run --json` returns an agent ID;
- `inspect --json` exposes ID, cwd, provider, model, thinking, lifecycle
  status, archive state, and pending permissions;
- `logs` returns the last assistant reply and a timeline that includes
  received prompts;
- `send` exits zero when Paseo accepts the message.

Lifecycle status is classified as active (`initializing`, `running`), quiet
(`idle`, `closed`), errored (`error`), or unknown. Decoding fails closed: a
missing required field raises an error naming the field and the Paseo version,
before any assignment is sent. The runner records `paseo --version` in state at
each dispatch for diagnostics; it is never a gate. Raw send output is stored,
truncated, on the worker, so `status` shows what Paseo returned.

## Delivery

A zero `send` exit releases the worker, as `"sent"` does today. The send body
is never inspected. Completion monitoring is unchanged.

A non-zero exit or timeout of the send command records the worker `ambiguous`:
Paseo may still have queued the message. A failure before the send command runs
is non-delivery and needs no evaluation.

One delivery evaluator decides from evidence. It runs on ambiguous workers, and
on released workers that are quiet and still show their startup reply past the
reviewer timeout. It returns:

- delivered, when the timeline holds the assignment digest, the status is
  active, or the last reply differs from the startup reply: the worker is
  `running` and monitored as usual;
- undelivered, when the queue window has passed since the send, the session is
  quiet and unarchived, the timeline lacks the digest, and the last reply is
  the startup reply: the runner stops the session and records `undelivered`;
- otherwise, no decision.

The queue window is a runner constant of 60 seconds, owned by the state
module. Paseo flushes its queue about two seconds after enqueue, and the window
never exceeds the reviewer timeout.

Every tick runs the evaluator on each ambiguous worker. An ambiguous worker
counts as in flight until the reviewer timeout. After that it leaves the
in-flight set, so the heartbeat can end, and its gate names `tick`, `adopt`, or
`retry-launch`. A later tick that finds delivery evidence returns it to
monitoring. A worker is never sent its assignment twice.

## Retries

A retry needs established non-delivery: a failure before send, or the
evaluator's undelivered result. Each reviewer and implementer attempt allows
one automatic retry in a fresh session. The old identity, cause, and inspection
stay in the worker's attempt history.

- Reviewers: a failure before send retries inside the same dispatch. An
  undelivered reviewer makes `nextStep` name `retry-launch`.
- Implementers: an undelivered handoff or repair makes `nextStep` name
  `retry-launch`. It also requires the worktree branch, head, and uncommitted
  inventory to equal the baseline recorded at the original reservation.
- `retry-launch` re-runs the evaluator on the old session immediately before
  reserving the replacement. Ticks never dispatch.
- When the automatic retry is spent and the replacement is also undelivered,
  the gate names `retry-launch` with an `authorizationSource` carrying the
  user's statement, which grants one more attempt under the same checks.

A reviewer whose retry is also undelivered, or whose report is degraded, is
`degraded` as before. `nextStep`, the tick line, and the triage requirement
name the reduced independence. The orchestrator reports it to the user in the
same turn; the inline fallback assessment rules are unchanged.

Once a replacement is reserved, it alone owns the worktree and can be adopted;
the old attempt is superseded. Every tick until the workflow finishes checks
each superseded session's timeline. Delivery evidence there records `conflict`
on both attempts and stops new dispatch; a conflict is never resolved
automatically. Conflicted attempts stay in flight, keeping the heartbeat and
tick monitoring, until both sessions are quiet. Then they leave the in-flight
set, the workflow stops at `awaiting-user`, and the gate depends on how many
reports match the worktree head:

- exactly one: `adopt` of that attempt;
- both: `adopt` of the attempt the user names in an `authorizationSource`;
- neither: `retry-launch` with an `authorizationSource`. It records the
  observed worktree state as the new baseline and gives the fresh attempt the
  original brief plus that observed state.

Observation calls (`inspect`, `logs`, `wait`, `ls`, `workspace ls`,
`--version`) retry transient transport errors with bounded backoff, three
attempts at most. Non-repeatable calls keep their idempotency guards: `run`
writes its reservation first and blocks on a lost identity, `send` is never
repeated, workspace creation keeps its uncertain-state inspection, and
heartbeat replacement keeps create-before-delete.

## Adoption

`adopt` records a completion for a handoff or an implementation or hosted
repair attempt whose exact session later produced a valid report. It accepts
the current attempt when it is `failed`, `ambiguous`, `undelivered`, or
`conflict`, and a superseded attempt only under `conflict`. Input names the
worker (`handoff`, `implementation-repair`, `hosted-repair`), the recorded
agent ID, the expected branch and head, and an `authorizationSource` when the
conflict gate requires one.

The runner verifies, as a tick does:
- the agent ID equals the recorded identity;
- the inspected cwd, provider, model, and thinking match the route;
- the session is quiet, unarchived, and has no pending permissions;
- the last reply differs from the startup reply and holds exactly one
  well-formed `AX_REPORT`;
- its branch and head equal both the input and the worktree's `git rev-parse`;
- a repair head differs from the reviewed head.

Any mismatch refuses with nothing recorded. On success, the worker becomes
`complete` with the parsed report and observed uncommitted files; the prior
status, error, and inspection are archived in `Workflow.history`. Adopting one
attempt of a conflict marks the other superseded. Repeating an identical
completed adoption is a no-op. Outside the both-reports conflict, adoption
needs no user authorization: it accepts only evidence a tick would accept and
grants no review round, repair, or terminal authority.

## User gates

Every `awaiting-user` gate names the supported action that clears it:

- `tick`, `adopt`, or `retry-launch` for an ambiguous worker;
- `adopt` for a failed worker, and `retry-launch` for an undelivered one;
- user-authorized `retry-launch` for a spent retry;
- `adopt` or user-authorized `retry-launch` for a conflict, by report count;
- `continuation` for round bounds and no-new-head repairs;
- `waiver` or `triage` for open questions;
- Finish for hosted user input.

A planning-bound `continuation` binds to the current planning round
fingerprint when no implementation head exists. A test enumerates every gate
string. Replacing state or publishing outside the runner is never the named
path.

## Scope, rollout, and rollback

Expected footprint: the runner, state, and io modules, their unit tests, the
workflow reference, and `SKILL.md`, at most 10 files. Ten to 15 files are
acceptable only for test fixtures of these same modules. Above 15 files or
1,000 changed lines, return to Plan.

Bootstrap: the runner's own `handoff` would hit the bug being fixed. The user
explicitly decided (2026-10-29, "I'll start a separate implementer session")
to start a separate, unmanaged implementer session for this change only. This
is a scoped exception to runner-only delivery, because the runner is the
component being repaired; it sets no precedent for other work. That
session owns Execute, Review, and Finish under the standard repository
workflow, and its local Review replaces runner implementation review. This
planning workflow state stays planning-only and is never adopted. The planner
does not write the worktree after handing it over. Exercise feature-branch
behavior only with isolated HOME and runtime roots.

Rollout: after authorized merge, fast-forward the clean worktree that owns
`main` to `origin/main`, then run live `pnpm ax sync` and `pnpm ax validate`.
Rollback: once no workflow has a worker in flight, revert the merge on `main`
through a normal PR, then repeat the same sync and validation from `main`.
States written by the new runner stay readable through `status`.

Risks:
- Late queued delivery after undelivered: the queue window is bounded and in
  memory, `retry-launch` re-verifies, and superseded attempts stay observed
  until the workflow finishes.
- Duplicate sessions after crashes: reservations stay before every launch.
- Weakened fail-closed behavior: evidence the evaluator cannot decide never
  becomes success or failure.

## Acceptance and proof

Runner unit tests through the injected transport cover:
- `queued` and `sent` send fixtures both releasing on a zero exit, and an
  unknown send body releasing without being parsed;
- a non-zero or timed-out send resolved as delivered and as undelivered, and
  an ambiguous worker returning to monitoring on a later tick, never
  re-sending;
- a released reviewer that never began, retried once before degradation, with
  reduced independence named in `nextStep`;
- `retry-launch` refused without established non-delivery or on worktree
  drift, and a spent retry cleared only by an authorized `retry-launch`;
- a superseded attempt receiving its assignment, including after its
  replacement completed, producing a conflict that stays monitored while
  either session is active and then a gate resolved for one, both, and
  neither matching reports;
- undelivered never decided before the 60-second queue window;
- adopting a falsely failed handoff, idempotent repeats, and refusal on a
  mismatched head, branch, session, cwd, or route, or a malformed or
  duplicate envelope;
- a `closed` session accepted as quiet, and an unknown status never deciding;
- decoding stopping on a missing `inspect` field before any send, with the
  field and version named;
- a planning-bound `continuation` on a planning-only state;
- every `awaiting-user` gate naming its clearing action.

Run writing-skills RED/GREEN scenarios against the changed contract. Native
hooks run the full suite on commit.

Rehearsal: on a copy of `/tmp/fillario-deps-1.6nbqM1/state.json`, under an
isolated runtime root, the feature-branch runner's `adopt` records the handoff
complete at `eac79ad…`, and the next step is "Dispatch the implementation
review round on the worktree head", with no hand edits. The original state
stays untouched.

After authorized merge and live sync, a real dispatch records reviewers and
implementers as running, not degraded or failed, and `status` shows the raw
send output.
