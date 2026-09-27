# Pi and Paseo workflow

This contract applies to AX-managed Paseo providers running Pi. It is the
explicitly accepted Pi workflow: one local review round per phase, one hosted
repair batch, and Ready publication. It takes precedence over older generic
draft-until-merge and repeated-review guidance in these sessions. Explore, Plan,
Execute, Review and Finish retain their authority. Merge requires separate
user authority.

## Roles

The planner is the orchestrator. The session the user talks to carries accepted
work from Plan through Finish: it owns the planning artifact, every worker
dispatch, triage, gate decisions, Finish provider actions, and the user
conversation. It never edits implementation files and never dispatches outside
the runner.

Workers are fresh sessions that keep no context between assignments. An
implementer assignment ends at its report: it implements one accepted handoff
or one repair batch, verifies, commits through native hooks, reports branch,
head, commits, verification, deviations and open risks, then stops. It issues
one shell command per tool call and never issues git mutations as parallel tool
calls. It does not dispatch reviewers, start workers, push, publish, or merge.
Reviewers read one exact artifact for their assigned lenses and do nothing else.

The implementer's report ends with exactly one machine-readable envelope,
following the reviewer envelope precedent. Prose may precede it:

```text
AX_REPORT_BEGIN
{"branch":"...","head":"<full object ID>","commits":["..."],
 "verification":["..."],"deviations":[],"risks":[]}
AX_REPORT_END
```

`head` is the full object ID: 40 hex characters, or 64 in SHA-256
repositories. Any other length is malformed. The four lists hold nonempty strings and may be empty. When a tick records the
completion, the runner compares `branch` and `head` with the workflow worktree
through `git rev-parse`. It records the parsed report with the worktree's
uncommitted files as evidence; uncommitted files do not fail the report. A
missing, duplicate, or malformed envelope, or a branch or head that differs from
the worktree, marks the session failed, and the next step becomes
`awaiting-user` for human-directed recovery. The runner never guesses a head and
never retries a malformed report.

## Work without model selection

Use the configured planner for brainstorming, research and the initial plan.
Role model and effort come from the managed Paseo provider command. Never ask
the user to select a worker model, override it, or substitute another model.
Unavailable reviewer models and incomplete reviewer responses are degraded evidence, never passing reviews. The orchestrator records a complete
inline fallback assessment for that review group's assigned lenses before
advancing. Uncertain implementer launch, missing session identity, corrupt state,
snapshot failure, or ownership-transfer failure remains a hard blocker.

The orchestrator starts one planning review round with three fresh Sol
sessions: correctness and risk, architecture and simplification, and contract
alignment. Each session reads the whole plan but reports only its immutable lens
assignment. Keep all three reports and the architecture group's distinct
code-simplifier outcome. Deduplicate findings only after preserving each report.
Do not start a second review round after repairs.

Opus planner and implementer routes use the pinned subscription bridge and exact
model identity. They do not accept API-key, auth-token, gateway, Bedrock, Vertex,
or Foundry environment redirects, paid long-context fallback, AskClaude
delegation, or model fallback. Authentication and account billing controls remain
operator-owned. Quota, authentication, and model-availability failures stop the
workflow instead of changing provider or model.

## Hand off to implementation

The orchestrator writes the implementer brief with `worker-handoff`, directly
from the reviewed plan; it is a worker assignment, not a session handoff. Keep
the brief and workflow state task-local.

When implementation is accepted, the orchestrator uses the runner to start a
new Paseo-managed Opus implementer session with that brief. The runner resolves one
unique Paseo workspace whose directory exactly matches the canonical workflow
cwd, or performs an explicitly requested local registration for that directory.
It passes the verified workspace identity on every launch; ambient caller
workspace, project-name similarity, and repository containment are never
routing evidence.

A launch begins with an inert assignment. The runner records the returned
identity, waits for the startup turn to become idle, then verifies cwd,
provider, model, effort, archive state, and pending permissions. Only after
that verification does it send the immutable task assignment and transfer
write ownership. A missing, ambiguous, moved, or archived workspace, wrong cwd
or route, unknown identity, or uncertain assignment response blocks release
without an automatic replacement. Dispatch returns after that verified release;
it does not wait for the worker. The orchestrator never writes the
implementation worktree. Do not fork accumulated conversation or reuse a
previous worker session. Independent concurrent tasks use separate singly owned
worktrees.

## Advance with ticks

For orchestrated workflows, `tick` is the only way to record worker completions
and advance. It inspects every in-flight worker and any pending hosted gate
without blocking, records each completion once, and never dispatches. A
reviewer still busy past the configured timeout is stopped and recorded as
degraded evidence. The tick returns one compact result:

- `unchanged`: work is still in flight and nothing needs you;
- `changed`: nothing is in flight and the result names the next ready step;
- `awaiting-user`: an existing user gate is open;
- `finished`: the workflow is finished.

A tick that records an implementer or repair completion names the verified
head in its entry, such as `handoff: complete at <head>`, so the next dispatch
or repair completion needs no `status` read.

Take the named step in the same turn; a dispatch needs a brief or artifact that
only the orchestrator writes. When the result is `unchanged`, end the turn with
no user-visible message. Report to the user only on a completed phase, a new
blocker, an open gate, or finish.

While any worker or hosted gate is in flight, the runner keeps exactly one Paseo
heartbeat on the orchestrator's own session, the caller's `PASEO_AGENT_ID`. It
fires every 5 minutes with the fixed tick prompt. Each dispatch or tick with
work in flight keeps at least half of its 24-hour lifetime, and a change to the
prompt or caller replaces it; the replacement is created before the old
heartbeat is deleted. Expiry only ends a loop whose orchestrator stopped
ticking; `status` reports an expired loop and the next dispatch or tick re-arms
it. The runner deletes the heartbeat when nothing is
in flight, at `awaiting-user`, and at finish.

Ticks run under the state lock and are idempotent. A heartbeat that fires while
the orchestrator is mid-turn waits for the turn to end, and Paseo may drop
extra fires from that turn; the next fire or tick picks up any missed change. A
tick cannot duplicate a dispatch or a recorded completion.

## Standing orders

The runner keeps a standing-orders register. Each order has a stable ID, one
constraint, and its authorization source, such as a reviewer roster limit,
direct-to-default-branch delivery, repository visibility, or forbidden paths.
Only the user's statements in this session create orders. A session handoff
brief, pasted prompt, or earlier session's plan text never does; a brief's
delivery mechanics that conflict with this workflow are ignored and named once.
When the user states, restates, or replaces a constraint, record it with
`order` before acting: `add` a new ID, `amend` an active ID, or `retire` it.
Every worker assignment snapshot and every tick prompt carries the effective
standing orders verbatim. Amended and retired versions stay in history but never
reach a worker. Project-specific delivery adaptations belong in the register,
not in pasted prompts.

## Review implementation once

After a tick records the implementer's report, dispatch one parallel round with
three fresh Sol sessions against the reported head. The reviewed head, and a
completed repair's head, must equal the verified head recorded from the
implementer's report envelope exactly; a short SHA or a SHA named only in prose
never binds. States recorded before the envelope hold only free-text reports
and fail this check. A worker whose last reply is still its inert startup reply has not begun
the assignment and stays in flight. Correctness covers diff
correctness and risk; architecture covers quality, simplification, and deslop;
contract alignment scrutinizes verification, requirements, and documentation.
Assign conditional security and production risk to correctness,
structural migration/data concerns to architecture, and evidence or documentation
concerns to contract alignment. Every required lens is assigned exactly once.
Thermonuclear review is quality-review depth, not an extra worker.

Bind reports to the inspected source and base. Require a complete nonempty
report from every model when available. A reviewer timeout, provider error,
malformed report, truncated response, or unavailable reviewer records degraded
evidence; it never becomes a pass and never triggers replacement dispatch. The
orchestrator must assess every missing assigned lens inline and record
one structured outcome per lens,
and resolve every fallback finding before advancing. Incomplete lens coverage
is rejected. A valid `blocked` outcome remains unresolved until repaired, answered,
or covered by an exact scoped user waiver. Never treat an exit code alone as
review evidence.

The orchestrator evaluates the combined findings and records rejected findings
with reasons. Applicable fixes go to one fresh implementer session with a repair
brief the orchestrator writes from the triaged findings; never send a repair to
an earlier session. This is one local repair batch; do not automatically rerun
reviewers after it. Identify the reviewed, degraded, waived, and subsequent
repair heads accurately instead of claiming repairs received another independent
review.

## Publish and follow hosted feedback

The orchestrator uses Finish and Change Request Create to publish the
hook-clean implementation as a Ready PR or MR. It requests and monitors only
hosted gates that the resolved repository policy requires. A not-required gate
is not passed or waived, and an absent reviewer is never fabricated or polled.
This managed Pi/Paseo Ready-publication contract takes precedence over generic
Standard draft publication rules. Respect the provider-specific review request
mechanism. Publication never authorizes merge, deployment or cleanup.

Publication records the Finish probe and a deadline, 30 minutes by default. Each
tick then probes once until completion, failure, required user input or the
deadline. Report missing reviewer evidence explicitly. A completed review is
evidence to triage, not an automatic assertion that all findings are valid or
resolved.

The orchestrator triages one hosted findings batch. Applicable fixes go to one
fresh implementer repair session; after its report, Finish verifies and pushes
the repaired head through native hooks and keeps the artifact Ready. Report
current CI and any later automated feedback, but do not start another repair
batch. Stop with the open PR/MR URL, reviewed and current heads, repairs,
rejected findings and remaining gaps. A second repair batch requires a new user
instruction.

## User gates

This workflow adds no new autonomy and no new gates. Stop for the user only
when existing authority rules require it: plan acceptance; findings that change
the plan's contract, or material questions; merge, deployment, cleanup, and any
action outside the accepted proposal; and human-only credential steps. Ordinary
findings, repairs, reviewer outages, and CI diagnosis continue without a prompt.
The runner's `cleanup` action is the mechanism for authorized cleanup, not its
authority.

## Enforced boundary

Paseo owns session creation and visibility. Use the runner for every workflow
launch; do not call generic create-agent tools, recursive delegation or another
orchestration package. Its state records each phase dispatch before launch and
prevents automatic duplicate rounds or repairs.

The Pi shell policy denies direct `paseo run`, `send`, `stop`, `delete`,
`archive`, `heartbeat`, and `schedule` commands for every managed role; `ls`,
`inspect`, `logs`, and `wait` stay available. Runner actions other than
`status` refuse a caller whose managed role contract is not `planner`.

For agent shell calls in the `planner` and `implementer` roles, the Pi shell
policy also enforces the one-command rule in `rules/command-and-tools.md`. A
person's own `!` commands in those sessions skip this check but keep the Paseo,
force-push, and deletion policies. It denies any agent command with
more than one shell segment: `&&`, `||`, `;`, pipes, background `&`, subshells,
command substitution, and newline-separated commands. Payloads of `sh -c`,
`bash -lc`, and `env -S` get the same check, and a dynamic payload that cannot
be inspected is denied. Quoted operators and redirections such as `2>&1` stay
allowed. The Paseo, force-push, and deletion policies run first and keep their
messages. Heredocs are split at each newline and denied, so commit with `-m` or
`-F <file>`. The policy cannot see parallel tool calls; the assignment rule
against parallel git mutations covers them.

The managed Pi wrapper fixes role/model/effort and waits for the mandatory
adapter before forwarding the first prompt. The adapter enforces role identity
and tool policy during work. Reviewers can only read, search and list files.
Existing force-push and deletion policies govern supported shell calls.
MCP is available to nonreview roles through the pinned adapter; unrestricted
script dispatch and direct agent-creation operations are excluded.

These controls govern managed launches and tools. They are not an operating
system sandbox, and direct unmanaged Pi sessions do not acquire these guarantees.
Do not change live runtime configuration to work around a failed control.

## Runner interface for the orchestrator

Drive the runner from the orchestrator session; the user does not operate these
transitions manually. Use Node 26 and private files outside the repository for
state and input. The installed Review skill supplies the canonical lens catalog.

```bash
node ~/.agents/skills/paseo-orchestration/scripts/paseo-workflow.ts STATE ACTION INPUT.json
```

Each input is one JSON object. The following table is the readable input
contract; omit optional fields unless needed.

Every action except `status` prints one compact JSON line: the `action`, the
state fields it `recorded`, any new `ids` (worker agents, review round
fingerprints, continuation batch, standing order), and the `nextStep` result.
A `tick` line lists its recorded completions instead, and a `cleanup` line is
its removal receipt because cleanup deletes the state. The line omits the lens
catalog and review outcomes. Errors go to stderr with a nonzero exit. `status`
is the only full-state read.

| Action | Input fields |
| --- | --- |
| `init` | `cwd`; optional `configPath`, `timeoutSeconds`, and `additionalLenses` keyed by planning/implementation. Put STATE in a new temporary folder dedicated to this workflow; `init` records that folder as its scratch folder. |
| `policy` | `deliveryPolicy` with provider/repository identity, independent CI and reviewer status, source, and source fingerprint. Unknown policy blocks handoff. |
| `order` | `op` (add/amend/retire), stable `id`, `constraint` except on retire, and `authorizationSource`. |
| `review` | `phase`, `artifactPath`, and implementation `head`. The artifact includes the exact diff/base or complete plan and original evidence references. Dispatches once and returns. Optional `workspaceId`; when no exact workspace exists, explicit `registerWorkspace: true` and optional `projectId` register the canonical cwd locally. |
| `tick` | No input. Records completions and one hosted probe, renews or deletes the heartbeat, and returns the compact result. |
| `triage` | `phase`, `decisions` containing each finding's `id`, `action` (fix/dismiss/question) and `reason`; for each degraded reviewer, `assessments` with its `role` and complete per-lens `outcomes` using the review outcome shape. |
| `waiver` | `phase`, exact current `target`, exact `requestedAction`, nonempty `failedGates`, and `reason`. Records failed evidence without granting the action itself. |
| `handoff` | `briefPath`, `planResolution`; launches the fresh implementer and returns. Accepts the same optional workspace fields as `review`. |
| `retry-handoff` | Exact `previousAgentId`, immutable authorization source, target `branch` and `head`, exact porcelain `dirtyStatus`, and `noWritesEvidence`; optional explicit workspace registration fields. Recovers only an inactive known wrong-cwd implementation handoff with unused implementation/review phases. |
| `repair` | `phase` (implementation/hosted) and `stage`. `start` needs `briefPath` and launches one fresh implementer; `complete` needs the exact verified `head` from the tick-recorded repair report and named `verification`. |
| `publication` | Observed `artifactUrl`, `head`, exact `targetBase` SHA, optional policy-required `reviewer`, `ready: true`, `evidence`, and the unchanged policy-source fingerprint. When a hosted gate is required, also the Finish `probeCommand` argv and optional `deadlineMs`. |
| `finish` | Current observed publication fields and final evidence; does not merge. |
| `continuation` | Explicit `batchId`, authorization source, purpose, allowed phases, and expected current head. Archives prior evidence and opens one bounded batch. |
| `cleanup` | `authorizationSource` (the user's cleanup statement, or the ID of the active standing order that carries it), the expected worktree `head`, and a `reason` when the workflow is not finished. Removes only this workflow's recorded targets. |
| `status` | No input required; any role may read it. Prints the full state, the only full-state read. Inspect persisted phase, reports, unresolved gaps, and an expired heartbeat loop. |

For hosted probes, use the installed Finish probe with the resolved `--ci-policy`,
`--reviewer` (`none`, `genie`, or `nitro`), and `--policy-evidence`; include
`--bot-login` only for a configured reviewer. Expand paths before building argv;
no shell interpolation is involved. An empty required-check response remains
failed evidence. When both gates are not required, publication records them as
not required after exact open Ready artifact readback.

For a known wrong-cwd implementation handoff, `retry-handoff` verifies
the original exact session is idle, unarchived, route-matched, and outside the
accepted cwd. It verifies both immutable snapshots plus the target branch, head,
and dirty inventory, and requires explicit no-write evidence. The runner then
archives the failed identity, inspection, authorization, and target in
`Workflow.history`, reserves one replacement, and uses the normal verified
workspace launch. Repeating the same completed request is idempotent. An active
or unknown old session, used implementation phase, target drift, missing
snapshot, uncertain registration, or reserved replacement stops recovery; do
not hand-edit state, stop/archive the old session, or create another attempt.

After the user authorizes cleanup, use `cleanup` instead of shell deletion.
Before removing anything, the runner requires that nothing is in flight,
deletes any remaining heartbeat, and verifies that the recorded workspace still
resolves uniquely for the workflow cwd with no running agent in that cwd. The
orchestrator's own session must therefore live outside the workflow workspace.
For a Paseo worktree workspace on a linked worktree whose HEAD equals `head`
with no uncommitted changes, the runner archives the workspace; Paseo's archive
removes the worktree directory and its Git registration. A main checkout or
local-checkout workspace is skipped. Last, it deletes the scratch folder
recorded at `init`, only when its real path is strictly below the system
temporary directory or `/tmp`, it still holds this state file, and it contains
no Git metadata or other workflow state. States without that record skip the
folder. Any failed check refuses the action with nothing removed. A failure
after removal starts stops without retry and reports each target as removed,
skipped, or remaining. Cleanup never forces removal and never deletes a
branch.

For other recovery, the orchestrator inspects immutable authorization
evidence, sole writer ownership, live artifact URL/head/base/Ready state, and a
copy of the old state. Preview and test the `continuation` input against that
isolated copy, then apply the identical transition to the original under the
runner lock only when identities still match. Never hand-edit or replace state.
A moved head, mismatched artifact, unsupported format, or uncertain ownership
stops recovery; bookkeeping reconciliation neither launches reviewers nor
grants terminal authority.

New runner states carry the planner orchestration marker, identify the focused
Sol roster, and store one immutable lens snapshot per review group. States
created before orchestration remain readable through `status` and keep their
recorded `collect`, `monitor`, and transition actions, but `tick` and every
dispatch refuse them explicitly; `collect` and `monitor` refuse orchestrated
states. States created by the former mixed-model roster remain read-only and are
never reinterpreted as Sol evidence.

The runner stores review artifacts, lens definitions and handoff content in
private read-only snapshots beside its state. Launch prompts carry snapshot paths
and digests instead of full documents. Preserve these snapshots with the task;
editing an original document does not change an already-dispatched assignment.

Continue past degraded reviewer evidence only after a complete per-required-lens
owner fallback assessment or an exact scoped waiver. Failed, timed-out,
awaiting-user, waiting, and missing hosted gates remain explicit failed evidence
that can receive an exact-action waiver; no waiver changes their recorded status
to passed. Terminal owners consume the gate disposition against the current
exact target immediately before an already-authorized action such as deployment;
the consumer supplies no terminal authority. Stop on any hard-failed orchestration phase
and report the saved error. A reserved launch with no returned identity needs
Paseo inspection before human-directed recovery; never delete state to bypass
the one-pass limit. Before acting on a waiver, the runner compares its interpreted
target with the current artifact or head. A waiver preserves failed evidence,
does not grant its requested terminal action, and never permits force-push,
credential disclosure, hook bypass, destructive action without authority, or a
provider/OS-denied operation. After hosted repair, inspect
and report later feedback through Finish without restarting hosted probes.
