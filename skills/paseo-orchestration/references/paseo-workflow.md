# Pi and Paseo workflow

This contract applies to AX-managed Paseo providers running Pi. It is the
explicitly accepted Pi workflow: a fresh review round for every new head or
revised plan, bounded at three rounds per phase and three hosted repair
batches, and Ready publication. It takes precedence over older generic
draft-until-merge and review-loop guidance in these sessions. Explore, Plan,
Execute, Review and Finish retain their authority. Merge requires separate
user authority.

## Roles

The orchestrator is the session the user talks to. It carries accepted work
from Plan through Finish: it owns the planning artifact, every worker
dispatch, triage, gate decisions, Finish provider actions, and the user
conversation. It never edits implementation files and never dispatches outside
the runner. When the accepted-proposal contract in
`rules/investigation-and-implementation.md` selects Execute, the orchestrator
hands the work to a fresh implementer through the runner `handoff`, whatever the
wording of the acceptance and however small the change. Merging a moved target
base, resolving conflicts, and every other change to branch content are
implementer tasks too. `planner` is the orchestrator's earlier role name; it
keeps identical policy and runner access so sessions launched under it keep
working.

Workers are fresh sessions that keep no context between assignments. An
implementer assignment ends at its report: it implements one accepted handoff
or one repair, verifies, commits through native hooks, reports branch,
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
`awaiting-user` naming `adopt`. The runner never guesses a head and never
retries a malformed report.

## Work without model selection

Use the orchestrator for brainstorming, research and the initial plan.
Role model and effort come from the managed Paseo provider command. Never ask
the user to select a worker model, override it, or substitute another model.
Only the Orchestrator profile offers a choice: Opus 5.5, the default, or
Astra, both at medium thinking, picked when the tab opens. The launcher fixes
the route matching the model and thinking Paseo passes, uses Opus when none is
passed, and refuses any other; the chosen route then stays fixed for the
session.
Unavailable reviewer models and incomplete reviewer responses are degraded evidence, never passing reviews. The orchestrator records a complete
inline fallback assessment for that review group's assigned lenses before
advancing. Uncertain implementer launch, missing session identity, corrupt state,
snapshot failure, or ownership-transfer failure remains a hard blocker.

Each review round uses four fresh reviewer sessions on two model families, all
at medium thinking: GPT-6.1 Sol for correctness, Sonnet 5.5 for risk and
quality, GPT-6.1 Terra for architecture and simplification, and Sonnet 5.5 for
contract alignment. The orchestrator starts each planning review round with
those four sessions. Each session reads the whole plan but reports only its
immutable lens assignment. Keep all four reports and the architecture group's
distinct code-simplifier outcome. Deduplicate findings only after preserving each report.
When triage keeps a `fix`, the orchestrator revises the plan and the changed
plan receives a fresh round. Handoff requires a clean planning verdict: no open
question and no unwaived fix. The runner refuses a round on an unchanged plan.

Opus orchestrator and implementer routes use the pinned subscription bridge and exact
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
or route, or unknown identity blocks release. Delivery of the sent assignment
follows [delivery evidence](#delivery-evidence-and-recovery). Dispatch returns
after the send; it does not wait for the worker. The orchestrator never writes the
implementation worktree. Do not fork accumulated conversation or reuse a
previous worker session. Independent concurrent tasks use separate singly owned
worktrees.

## Delivery evidence and recovery

The runner depends only on stable Paseo facts: `run --json` returns an agent
ID; `inspect --json` exposes ID, cwd, provider, model, thinking, lifecycle
status, archive state, and pending permissions; `logs` returns the last
assistant reply and a timeline that includes received prompts; and `send`
exits zero when Paseo accepts the message. A missing `inspect` field stops the
launch before any send, naming the field and the Paseo version. Lifecycle
status is active (`initializing`, `running`), quiet (`idle`, `closed`),
errored (`error`), or unknown; an unknown status never decides anything. Each
dispatch records `paseo --version` for diagnostics only, and the worker stores
the raw send output, truncated, so `status` shows what Paseo returned.
Observation calls (`inspect`, `logs`, `wait`, `workspace ls`, `--version`)
retry transient errors up to three attempts; `run` and `send` never repeat.

Every assignment starts with its digest line, so the session timeline proves
receipt. A zero `send` exit releases the worker; the send body is never
interpreted. A non-zero exit or timeout records the worker `ambiguous`,
because Paseo may still have queued the message. One evaluator decides from
evidence:

- delivered: the timeline holds the assignment digest, the session is active,
  or the last reply differs from the startup reply. The worker returns to
  monitoring.
- undelivered: the 60-second queue window has passed since the send, and the
  session is quiet and unarchived, without the digest, still at its startup
  reply. The runner stops the session and records `undelivered`.
- otherwise, nothing is decided.

Each tick evaluates ambiguous workers, and released workers still at their
startup reply past the reviewer timeout. An ambiguous worker stays in flight
until the reviewer timeout; afterwards its gate names `tick`, `adopt`, or
`retry-launch`. No worker is ever sent its assignment twice.

A retry needs established non-delivery. A reviewer whose launch fails after
its identity is known, but before send, retries once inside the same dispatch.
An implementer launch failure before send stays `failed`. An undelivered
worker gets one automatic `retry-launch` in a fresh session. That action
re-runs the evaluator on the old session, and, for implementers, requires the
worktree branch, head, and uncommitted files to equal the baseline recorded at
the original reservation. Ticks never dispatch. A spent retry stops at
`awaiting-user`; each further `retry-launch` needs an `authorizationSource`
carrying the user's statement. A reviewer whose retry is also undelivered, or
whose report is degraded, is degraded evidence. `nextStep`, the tick line,
and the triage requirement name its reduced independence, and the
orchestrator reports that to the user in the same turn.

The replacement alone owns the worktree; every earlier attempt stays in the
worker's attempt history. Until the workflow finishes, each tick checks
superseded implementer sessions' timelines. If one received its assignment,
both attempts become `conflict` and new dispatch stops. They stay in flight
until both sessions are quiet. The gate then depends on which sessions
reported the worktree head: one names `adopt` of that attempt; both name
`adopt` of the attempt the user chooses, with an `authorizationSource`;
neither names `retry-launch` with an `authorizationSource`. That relaunch
records the observed worktree as the new baseline, and the fresh attempt gets
the original brief plus that observed state.

`adopt` records a completion for a handoff, implementation repair, or hosted
repair whose exact session produced a valid report after the runner lost track
of it. It accepts the current attempt when that attempt is `failed`,
`ambiguous`, `undelivered`, or `conflict`, and a superseded attempt only under
a conflict. It verifies everything a tick verifies: the recorded identity,
route and cwd, a quiet unarchived session without pending permissions, a reply
other than the startup reply holding exactly one valid `AX_REPORT`, a branch and
head equal to the input and the worktree, and, for a repair, a head other than
the reviewed head. A mismatch refuses with nothing recorded. On success the
worker becomes `complete`, the prior attempt is archived in `Workflow.history`,
the other conflicted attempt becomes superseded, and an identical repeat is a
no-op. Outside the both-reports conflict, adoption needs no user authorization.
It grants no review round, repair, or terminal authority.

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

## Review every head

After a tick records the implementer's report, dispatch one parallel round with
the four fresh reviewer sessions. The runner reads the workflow worktree's branch and
head with `git rev-parse` and binds the round to that committed head, whoever
produced it; a caller head that differs, a short SHA, or a SHA named only in
prose never binds. Uncommitted files are recorded as evidence and are not
reviewed. The runner refuses a round while an implementer or repair is in
flight. A completed repair's head must still equal the verified head from its
report envelope. A worker whose last reply is still its inert startup reply has
not begun the assignment; it stays in flight until the reviewer timeout, when
the delivery evaluator decides. Planning lenses go to correctness
(implementation readiness), quality (edge cases and risk), architecture
(code-simplifier and refactoring opportunities), and contract (delivery shape).
Implementation lenses go to correctness (diff review), quality (code-quality
review), architecture (code-simplifier and deslop), and contract (scrutinize
of verification, requirements, and documentation).
Assign conditional security and production risk to correctness,
structural migration/data concerns to architecture, and evidence or documentation
concerns to contract alignment. Every required lens is assigned exactly once.
Thermonuclear review is quality-review depth, not an extra worker.

Bind reports to the inspected source and base. Require a complete nonempty
report from every model when available. A reviewer timeout, provider error,
malformed report, truncated response, or unavailable reviewer records degraded
evidence; it never becomes a pass. Only established non-delivery earns a
reviewer its one fresh retry. The
orchestrator must assess every missing assigned lens inline and record
one structured outcome per lens,
and resolve every fallback finding before advancing. Incomplete lens coverage
is rejected. A valid `blocked` outcome remains unresolved until repaired, answered,
or covered by an exact scoped user waiver. Never treat an exit code alone as
review evidence.

The orchestrator evaluates the combined findings and records rejected findings
with reasons. Applicable fixes go to one fresh implementer session with a repair
brief the orchestrator writes from the triaged findings; never send a repair to
an earlier session. A repaired head has no verdict, so the next tick names a
fresh round on it, with fresh reviewers, until a round is clean. A repair that
reports no new head stops at `awaiting-user`. A clean round
has no open question and no unwaived fix; publication needs a clean verdict for
the published head.

Planning and implementation each allow three rounds before publication. When
the third round still keeps a `fix` or an open question, the runner stops at
`awaiting-user` with the open findings, reviewed heads, and repairs. It never
repairs past the bound, starts a fourth round, or downgrades findings to pass.
Only a user-authorized `continuation` opens another bounded batch. Identify the
reviewed, degraded, waived, and repaired heads accurately.

## Consult planners

Two planners give advice: Astra (`planner-astra`, GPT-6 Astra) and
Fable (`planner-fable`, Fable 5.1 through the pinned Claude bridge). Both run at
medium thinking. They read, search, and list files. They have no shell, no
edits, no Paseo tools, and launch no workers. MCP servers from the user's own
MCP configuration stay available; research-only use is an instruction, not an
enforced read-only boundary.
The orchestrator dispatches a consult when it chooses or when the user asks, for
example "ask Fable", "consult Astra", or "get both planners' take". Planners do
not review and do not write plans. Advice may inform the plan, but only the
orchestrator's own revision changes it, and that revision still needs a fresh
planning round. The planner profiles can also be opened manually in Paseo as
standalone consultants.

The orchestrator writes a consult brief that holds the question, the
constraints, and the repository paths to read. `consult` snapshots the brief and
records a fingerprint over the brief and the sorted planner list. It then
launches one fresh session per named planner, concurrently, through the normal
launch path: inert start, route verification, assignment digest, a send that
never repeats, and standing orders. Each planner returns exactly one envelope:

```text
AX_CONSULT_BEGIN
{"fingerprint":"...","summary":"...","recommendation":"...",
 "options":["..."],"risks":["..."],"questions":["..."],"draft":"optional"}
AX_CONSULT_END
```

`summary` and `recommendation` are nonempty strings. `options`, `risks`, and
`questions` are lists of nonempty strings and may be empty. An optional `draft`
is a nonempty string. The fingerprint must match the consult.

Consults are advisory and create no gates. A tick records a valid envelope as
`complete` with its advice, such as `consult:planner-fable: complete`. A
malformed envelope, fingerprint mismatch, timeout, or provider error records
`degraded (advice unavailable)`; the orchestrator reports it to the user in the
same turn. Running consults never block `review`, `handoff`, or `repair`, and
never require triage, fallback assessment, or a waiver. When only consults are
in flight, `nextStep` names the ready phase step and lists them as
`consulting`. They still count as monitored work: the heartbeat stays armed
until each is recorded, and `finish` and `cleanup` refuse while one runs.
`consult`, `finish`, and `cleanup` also refuse until every current planner is
`complete` or `degraded`, naming `tick` for an ambiguous planner and
`retry-launch` for an undelivered one. An
undelivered planner gets the one automatic `retry-launch`, and a second
non-delivery degrades it. An ambiguous planner past the reviewer timeout is not
a gate: the runner stops it and records `degraded`. `adopt` refuses planners.

There is one current consult. A new `consult` refuses while a current planner
is in flight; otherwise it archives the previous consult to `priorConsults`.
Consults do not count against review rounds or bounds and are allowed in any
phase before `finish`. A state initialized before planner routes existed
refuses `consult`, naming `init`; every other action on it is unchanged.

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

The orchestrator triages each hosted findings batch. Applicable fixes go to one
fresh implementer repair session. A moved target base is reconciled the same
way: a hosted repair started with the new `targetBase` and no findings. The
repaired head then receives fresh local rounds, which count against that hosted
batch rather than the implementation rounds. After a clean local verdict,
Finish pushes the head through native hooks, keeps the artifact Ready, and
records the republication, which re-arms the hosted probe for the next batch.
Hosted feedback allows three repair batches; open fixes after that stop at
`awaiting-user`. Finish needs a completed hosted gate with no unwaived fix on
the published head. Stop with the open PR/MR URL, reviewed and current heads,
repairs, rejected findings and remaining gaps.

## User gates

This workflow adds no new autonomy and no new gates. Stop for the user only
when existing authority rules require it: plan acceptance; findings that change
the plan's contract, or material questions; merge, deployment, cleanup, and any
action outside the accepted proposal; and human-only credential steps. Ordinary
findings, repairs, reviewer outages, and CI diagnosis continue without a prompt.
The runner's `cleanup` action is the mechanism for authorized cleanup, not its
authority. Delivery recovery asks the user only for a spent retry or a
conflict, as [delivery evidence](#delivery-evidence-and-recovery) describes.

## Enforced boundary

Paseo owns session creation and visibility. Use the runner for every workflow
launch; do not call generic create-agent tools, recursive delegation or another
orchestration package. Its state records each dispatch before launch, archives
superseded rounds with their triage and repairs, and refuses a duplicate round
for the same head or plan and a second repair for the same round.

For agent tool calls in the `orchestrator` role and its `planner` alias, the
Pi policy denies `edit` and
`write` outside `.agents/plans` in the workflow cwd, except for private task
files outside every Git work tree. It denies git commands that change branch
content: `add`, `am`, `apply`, `checkout`, `cherry-pick`, `commit`, `merge`,
`mv`, `rebase`, `reset`, `restore`, `revert`, `rm`, `stash`, `switch`, the
`commit-tree`, `update-ref`, `read-tree`, and `checkout-index` plumbing, and a
`pull` without `--ff-only`, including nested shell payloads. Read-only git,
`push`, and `gh`/`glab` publication stay available for Finish. It also denies
`pnpm` and `npm` commands that change dependencies: `install`, `add`,
`remove`, `uninstall`, `update`, `ci`, and their aliases such as `i`, `rm`,
and `up`. It finds the subcommand after leading global options, including
value options such as `npm --prefix <dir>` and `pnpm --dir`, `-C`, or
`--filter`; an unrecognized option or dynamic word before the subcommand is
denied. `pnpm run`, `pnpm exec`, `pnpm dlx`, `npm run`, and `npx` stay
available. The implementer commits the plan with the implementation. A shell
redirection or in-place edit stays outside what the policy can prove; the
commit denial keeps it from becoming an orchestrator-authored head.

The Pi shell policy denies direct `paseo run`, `send`, `stop`, `delete`,
`archive`, `heartbeat`, and `schedule` commands for every managed role; `ls`,
`inspect`, `logs`, and `wait` stay available, as do `paseo --help` or `-h`,
`paseo <subcommand> --help` or `-h` with nothing else after the subcommand,
and the global `paseo --version` or `-v`. A version flag after a subcommand,
or a help flag beside other arguments, gets no allowance. Runner actions other
than `status` refuse a caller whose managed role contract is not
`orchestrator` or `planner`.

For agent shell calls in the `orchestrator`, `planner`, and `implementer`
roles, the Pi shell
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

The managed Pi wrapper fixes role/model/effort, selecting the orchestrator's
route from its allowlist at launch, and waits for the mandatory
adapter before forwarding the first prompt. The adapter enforces role identity
and tool policy during work. Reviewers can only read, search and list files.
Consult planners can read, search, and list files, and use MCP.
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
| `review` | `phase` and `artifactPath`; optional implementation `head`, which must equal the worktree head the runner reads. The artifact includes the exact diff/base or complete plan and original evidence references. Dispatches one round and returns; a later round needs a revised plan or a repaired head. Optional `workspaceId`; when no exact workspace exists, explicit `registerWorkspace: true` and optional `projectId` register the canonical cwd locally. |
| `consult` | `briefPath` and optional `planners` (`planner-astra`, `planner-fable`; default both, distinct, nonempty). Launches one fresh planner per name and returns; advice is recorded by `tick` and never gates. Refuses on a finished workflow, a state without planner routes, or a current consult with a planner not yet `complete` or `degraded`. Accepts the same optional workspace fields as `review`. |
| `tick` | No input. Records completions and one hosted probe, renews or deletes the heartbeat, and returns the compact result. |
| `triage` | `phase`, `decisions` containing each finding's `id`, `action` (fix/dismiss/question) and `reason`; for each degraded reviewer, `assessments` with its `role` and complete per-lens `outcomes` using the review outcome shape. |
| `waiver` | `phase`, exact current `target`, exact `requestedAction`, nonempty `failedGates`, and `reason`. Records failed evidence without granting the action itself. |
| `handoff` | `briefPath`, `planResolution`; launches the fresh implementer and returns. Accepts the same optional workspace fields as `review`. |
| `adopt` | `worker` (`handoff`, `implementation-repair`, or `hosted-repair`), its recorded `agentId`, expected `branch` and full `head`, and an `authorizationSource` when both conflicted sessions reported the head. Records a verified report from a failed, ambiguous, undelivered, or conflicted attempt. |
| `retry-launch` | `worker` (a name from `status`, such as `handoff` or `planning:review-contract`), its recorded `agentId`, and an `authorizationSource` once the automatic retry is spent or for a conflict with no matching report. Relaunches established non-delivery in one fresh session. |
| `retry-handoff` | Exact `previousAgentId`, immutable authorization source, target `branch` and `head`, exact porcelain `dirtyStatus`, and `noWritesEvidence`; optional explicit workspace registration fields. Recovers only an inactive known wrong-cwd implementation handoff with unused implementation/review phases. |
| `repair` | `phase` (implementation/hosted) and `stage`. `start` needs `briefPath` and launches one fresh implementer for the current round or hosted batch; a hosted `start` with a new `targetBase` reconciles a moved base. `complete` needs the exact verified `head` from the tick-recorded repair report and named `verification`. |
| `publication` | Observed `artifactUrl`, `head`, exact `targetBase` SHA, optional policy-required `reviewer`, `ready: true`, `evidence`, and the unchanged policy-source fingerprint. When a hosted gate is required, also the Finish `probeCommand` argv and optional `deadlineMs`. After a hosted repair's clean local round, the same action records the republication of that head. |
| `finish` | Current observed publication fields and final evidence; does not merge. |
| `continuation` | Explicit `batchId`, authorization source, purpose, allowed phases, and expected current head; before any implementation head, the expected head is the current planning round fingerprint. Archives prior evidence and opens one bounded batch. |
| `cleanup` | `authorizationSource` (the user's cleanup statement, or the ID of the active standing order that carries it), the expected worktree `head`, and a `reason` when the workflow is not finished. Removes only this workflow's recorded targets; when the caller is the only running agent in the workspace, deletes only the scratch folder. |
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
resolves uniquely for the workflow cwd with no running agent in that cwd. When
the caller's own session (`PASEO_AGENT_ID`) is the only running agent there,
the runner skips the workspace archive and worktree removal and tells you to
archive that workspace from Paseo when done; it still deletes the scratch
folder. Any other running agent in that cwd refuses the action, and a caller
without `PASEO_AGENT_ID` gets no exemption. Once cleanup starts, every action
except `status` refuses. For a Paseo worktree workspace on a linked worktree whose HEAD equals `head`
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

Every `awaiting-user` result names the action that clears it. Use `adopt`,
`retry-launch`, `retry-handoff`, or `continuation` as named. For other
recovery, the orchestrator inspects immutable authorization
evidence, sole writer ownership, live artifact URL/head/base/Ready state, and a
copy of the old state. Preview and test the `continuation` input against that
isolated copy, then apply the identical transition to the original under the
runner lock only when identities still match. Never hand-edit or replace state.
A moved head, mismatched artifact, unsupported format, or uncertain ownership
stops recovery; bookkeeping reconciliation neither launches reviewers nor
grants terminal authority.

New runner states carry the head-keyed planner orchestration marker, identify
the four-reviewer roster (`focused-v2`), and store one immutable lens snapshot
per review group. States written under the earlier three-Sol roster
(`sol-focused-v1`) stay readable through `status`; `tick` and every dispatch
refuse them with a message naming the current roster.
States written with the earlier single-round planner marker stay readable
through `status`; `tick` and every dispatch refuse them, and nothing migrates
them. States created before orchestration remain readable through `status` and
keep their recorded `collect`, `monitor`, and transition actions, but `tick`
and every dispatch refuse them explicitly; `collect` and `monitor` refuse orchestrated
states. States created by the former mixed-model roster remain read-only and are
never reinterpreted as current-roster evidence.

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
the round bound. Before acting on a waiver, the runner compares its interpreted
target with the current artifact or head. A waiver preserves failed evidence,
does not grant its requested terminal action, and never permits force-push,
credential disclosure, hook bypass, destructive action without authority, or a
provider/OS-denied operation. After hosted repair, inspect
and report later feedback through Finish without restarting hosted probes.
