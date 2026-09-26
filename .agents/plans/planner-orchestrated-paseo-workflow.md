# Planner-Orchestrated Paseo Workflow

## Goal

Make the managed Paseo planner the orchestrator of every accepted task. The
session the user talks to carries accepted work from Plan through Finish. It
wakes itself when a worker finishes or a hosted gate changes, and stops only at
real user gates. The user never has to ask "any updates?" to move work
forward, and never has to start a new session by hand to continue a run.

This applies to every project that uses AX-managed Paseo sessions. Codex and
Claude Code harnesses are out of scope.

## Problem

Task transcripts across several projects show the same failures:

- **No wake-up.** A worker finished, and the planner did not notice until the
  user asked. One run lost about eight hours overnight. At least four other
  sessions needed "status?" prompts to continue.
- **Contract mismatch.** The documented contract has the planner hand off to a
  fresh implementer, which then owns review, publication, and hosted repair,
  while the planner stays idle. Users instead expect the planner to drive the
  whole run.
- **Bypass.** To meet that expectation, planners dispatched workers with direct
  `paseo run`, `send`, and `wait` shell commands. That bypassed the runner's
  one-round limits, fresh-session rule, and recorded state. The Pi policy
  blocks MCP `create_agent`, but not those shell commands.
- **Instruction drift.** Mid-run user constraints lived only in pasted prompts
  and briefs under `/tmp`. For example: which reviewers to use, pushing
  directly to `main`, and keeping the repository private.
- **Blocking waits.** The runner's `review` and `monitor` actions block the
  caller for up to an hour. The orchestrator cannot talk to the user while
  work is in flight.

The failures happen between phases, not inside one. Better planning prose does
not fix them; a wake loop and a single orchestration owner do.

## Selected approach

The planner becomes the orchestrator. The runner owns the wake loop, and the
model owns judgment.

### Roles

| Role | Owns | Never does |
| --- | --- | --- |
| Planner (orchestrator) | Explore and Plan, the planning artifact, every worker dispatch, triage, gate decisions, Finish provider actions, and the user conversation | Edits implementation files, or dispatches outside the runner |
| Implementer (worker) | One fresh-session Execute assignment: an implementation, or one repair batch. It verifies, commits through native hooks, reports, and stops | Dispatches reviewers, publishes, or starts other workers |
| Reviewers (workers) | One read-only lens assignment on an exact artifact | Anything else (unchanged) |

Workers keep no context between assignments. A repair batch goes to a fresh
implementer session with a brief the orchestrator writes from the triaged
findings. It never goes to the earlier session through `send`.

### Runner-owned wake loop

- **Non-blocking dispatch.** Review, implementation, and repair dispatch return
  after the verified launch. They no longer wait for completion.
- **Tick.** A new `tick` action inspects every in-flight worker and any pending
  hosted gate without blocking, and records each completion. A worker that is
  still busy past its configured timeout becomes degraded evidence, as today.
  The tick then returns one compact result: `unchanged`, `changed` with the
  next ready step, `awaiting-user` with the open gate, or `finished`. The tick
  never dispatches. The orchestrator takes the named step in the same turn,
  because a dispatch needs a brief or artifact that only the orchestrator
  writes. Hosted monitoring becomes one probe per tick against a recorded
  deadline, which replaces the blocking poll loop.
- **One advancement path.** For orchestration-marked states, `tick` is the only
  way to record completions and advance. `collect` and the blocking `monitor`
  reject those states. Legacy states keep their existing actions.
- **Heartbeat lifecycle.** While any worker or hosted gate is in flight, the
  runner keeps exactly one Paseo heartbeat on the orchestrator's own session
  (the caller's `PASEO_AGENT_ID`). It fires every 5 minutes. Its 24-hour
  lifetime is renewed by every tick that still has work in flight, so expiry
  only ends a loop whose orchestrator stopped ticking. The runner records the
  heartbeat identity and expiry in workflow state, and arming is idempotent.
  `status` reports an expired loop, and the next dispatch or tick re-arms it.
  The runner deletes the heartbeat when nothing is in flight, when the
  workflow reaches `awaiting-user`, and when it finishes.
- **Fixed tick prompt.** The heartbeat prompt tells the orchestrator to run
  `tick`, take the next step the tick names, and end the turn with no
  user-visible message when the result is `unchanged`. The orchestrator
  reports to the user only on a completed phase, a new blocker, an open gate,
  or finish.
- **Concurrency.** Ticks run under the existing state lock and are idempotent.
  A heartbeat that fires while the orchestrator is mid-turn, or a user message
  that arrives during a tick, cannot duplicate a dispatch or a recorded
  completion.

### Standing orders

The runner keeps a standing-orders register in workflow state. Each order has
a stable ID, one constraint, and its authorization source. Examples: reviewer
roster limits, direct-to-default-branch delivery, repository visibility, and
forbidden paths. The orchestrator can add, amend, or retire an order, and each
change records its authorization source. Every worker assignment snapshot and
every tick prompt includes the effective set of orders verbatim. Retired and
superseded versions remain in history but never reach a worker. When the user
restates or replaces a constraint, the orchestrator records it before acting.
Project-specific delivery adaptations belong in the register, not in pasted
prompts.

### Enforcement

- Pi shell policy denies direct Paseo dispatch and lifecycle commands (`run`,
  `send`, `stop`, `delete`, `archive`, `heartbeat`, `schedule`) for every
  managed role. Read-only `ls`, `inspect`, and `logs` stay available. The
  runner is the only dispatch path.
- Runner dispatch, triage, gate, and Finish actions refuse any caller whose
  managed role contract is not `planner`. Workers can still read `status`.
- The implementer's assignment ends at its report. The one-round,
  one-repair-batch, degraded-evidence, waiver, and terminal-authority rules
  still apply unchanged, now enforced for the orchestrator.

### User gates

This change adds no new autonomy and no new gates. The orchestrator stops for
the user only when existing authority rules require it:

- plan acceptance;
- review findings that change the plan's contract, or material questions;
- merge, deployment, cleanup, and any action outside the accepted proposal;
- human-only credential steps.

Everything else continues without a prompt. That includes ordinary findings,
repairs, reviewer outages, and CI diagnosis.

### Existing workflow states

States that were created before this change have no orchestration marker.
They stay readable through `status`, but `tick` and orchestrator dispatch
refuse them with an explicit message. This follows the precedent set by the
Sol-roster `reviewMode` change. Nothing migrates or edits old state.

## Reuse and deviation contract

- **Inspected precedents:**
  - `skills/handoff-brief/scripts/paseo-workflow.ts` and
    `paseo-workflow-state.ts` (runner, state, snapshots, launch verification);
  - `skills/handoff-brief/references/paseo-workflow.md` (injected session
    contract);
  - `hooks/pi/policy.ts` and `launch.ts` (role tools and shell policy);
  - the `ax-planner` provider in `ax.config.json`;
  - the plans `self-driving-paseo-user-override.md`,
    `paseo-policy-and-authorized-continuation.md`, and
    `revert-organizational-agent-workspaces.md`;
  - the retired `plan-orchestrator` skill family;
  - pstack's Orchestrate and Autonomous-run playbooks, used as an external
    reference.
- **Extended:** the runner and its state become the orchestration owner. The
  injected contract, Pi policy, and planner provider change to match. Paseo
  remains the only session and heartbeat provider.
- **New mechanisms:** the `tick` action, heartbeat lifecycle, and
  standing-orders register. No current owner provides a wake-up or a
  constraint register. They live inside the existing runner, not in a new
  package, daemon, or skill.
- **Deliberate deviations:**
  - The planner no longer hands off and goes idle. Review dispatch,
    publication, and hosted follow-through move from the implementer to the
    orchestrator.
  - `review` and `monitor` stop blocking.
  - Repairs use a fresh implementer session instead of the implementing
    session.
- **Rejected:**
  - a separate orchestrator session created at plan acceptance;
  - a playbook-only loop that depends on the model remembering to re-check;
  - sub-coordinators or any persistent hierarchy (the reverted organizational
    agents and pstack's parked trees);
  - pstack's multi-track program machinery, verdict ledger, and pilot phase,
    which exceed current run sizes.

## Out of scope

- Retiring Codex and Claude Code instructions, automations, and symlink
  targets. That is a separate change.
- Changing reviewer rosters, lens catalogs, review-round limits, or model
  routes.
- Merge follow-through and post-merge cleanup.
- Multi-unit OpenSpec program orchestration beyond one run at a time.

## Acceptance

Behavior tests with a fake Paseo transport prove each scenario:

1. **Unattended continuation.** An implementer finishes while no user message
   arrives. The next tick records the completion and names implementation
   review as the next step. The orchestrator dispatches review in that same
   heartbeat turn. After review completes, a later tick names the triage step,
   all without a user prompt.
2. **Quiet ticks.** A tick with no change returns `unchanged`, and the contract
   requires no user-visible message.
3. **Heartbeat lifecycle.** The first in-flight dispatch arms exactly one
   heartbeat for the caller. Repeated or concurrent ticks never create a
   second one. Ticks with work in flight renew its lifetime. An expired
   heartbeat is reported by `status` and re-armed by the next tick.
   `awaiting-user`, finish, and an empty in-flight set delete it.
4. **Bypass closed.** A planner shell command `paseo run …` or `paseo send …`
   is denied. An implementer calling a runner dispatch action is refused.
5. **Standing orders.** An order recorded before a dispatch appears verbatim in
   that dispatch's assignment snapshot and in the tick prompt. An amended or
   retired order is absent from later snapshots and remains in history.
6. **User gates.** A finding that changes the plan's contract, or a pending
   terminal action, makes the tick return `awaiting-user` and deletes the
   heartbeat.
7. **Fresh repair.** A repair batch launches a new verified implementer
   session. It never reuses the prior session.
8. **Limits preserved.** Ticks never start a second review round or a second
   repair batch. Degraded evidence and waivers behave as before.
9. **Hosted gate.** After publication, ticks probe once each until completion,
   failure, awaiting-user, or deadline. None of these outcomes is recorded as a
   pass that wasn't observed.
10. **Legacy state and single path.** `status` still reads a pre-change
    state, and `tick` refuses it explicitly. `collect` and `monitor` reject an
    orchestration-marked state.

Live proof separates what the fakes cannot show. A disposable scratch Paseo
agent confirms that a heartbeat created from a runner child process targets its
calling agent, and shows how a heartbeat behaves when it fires during a busy
turn. The scratch agent uses no AX runtime changes. After merge and live sync,
one small real task in a scratch repository proves that an implementer
completion triggers review within one tick, without a user message.

## Verification

- `pnpm run biome:lint-format`
- `pnpm run charter:validate`
- `pnpm run skills:validate`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `writing-skills` validation of the changed injected contract, Pi policy
  behavior, and runner-facing instructions.
- AX sync exercised only with isolated HOME and runtime roots. The live
  runtime stays unchanged before merge.

## Delivery

One atomic plan and one final PR on the personal GitHub `origin`. The branch is
`brainstorm/agent-orchestrator`. Repository policy requires no hosted CI and no
automated hosted reviewer on this route. Merge requires separate authority.
After merge, live `pnpm ax sync` and `pnpm ax validate` run from the verified
clean main worktree.

## Risks

- **Busy-turn heartbeats.** Paseo's behavior when a heartbeat fires during an
  active turn is unverified. It might queue, drop, or interleave the prompt.
  Idempotent ticks under the state lock contain all three cases, and the live
  scratch proof decides whether the contract needs extra wording.
- **Context growth.** A long-lived orchestrator accumulates context across
  ticks. Compact tick output and quiet unchanged ticks limit it. If
  compaction still happens, the state file and standing orders are the resume
  point.
- **Shell-policy false positives.** The command matcher must not block
  unrelated text that mentions `paseo`. Policy tests cover quoted arguments
  and non-dispatch subcommands.

[confidence: 0.85 - likely | reason: runner, policy, and transcript evidence
support every mechanism; busy-turn heartbeat semantics are the one unverified
provider behavior and have a scheduled live proof]
