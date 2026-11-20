# Migrate from Paseo to Herdr desktop and mobile

## Objective

Replace Paseo as the session host for the managed Pi workflow with herdr-core
(`hc`) and the Herdr desktop app on both the personal and work laptops, and
make every orchestrator, worker, and planner session visible and controllable
from Herdr Mobile. The five-mode workflow, the four-reviewer roster, the
bounded head-keyed review loop, and Ready publication do not change.

## Accepted decisions

- Complete cut-over. No parallel Paseo period on either laptop.
- Both the `personal` and `work` profiles move in the same change. The work
  route's GitLab origin, Nitro reviewer, and Finish probe never touched Paseo
  and are unaffected.
- The orchestrator's cwd is the worktree the user opened the Herdr space in.
  The Herdr app's worktree directory setting stays user-owned.
- Workflow states written under Paseo stay readable through `status` and
  refuse `tick` and every dispatch with a message naming herdr-core, following
  the existing legacy-marker precedent. Stranding in-flight workflows at
  cut-over is accepted.
- There is no rollback. The migration rolls forward only; a defect after the
  merge is fixed by a new PR, not a revert to Paseo.

## Delivery shape

One atomic plan and one Ready GitHub PR from
`plan-herdr-desktop-mobile-migration` to `main` on `origin`, carrying this plan
and the whole migration. No other human reviews it. Merge needs separate user
authority.

### Size exception

The user approved one PR above this repository's targets (standing order
`single-pr`). Forecast: about 40 files (34 files reference Paseo today, plus
`hooks/pi/routes.json`, `hooks/README.md`, and this plan) and 4,000 to 6,000
changed lines, most of them in the runner and its tests. Rationale bound to
this artifact: the accepted outcome is a single cut-over with no parallel
period and no rollback, and every intermediate split was a hybrid runtime
built only to be removed. The 50-file hard cap still applies: a measured diff
above 50 files returns to Plan. Git renames count once.

### Implementation order

One implementer works on one branch, in commit order. Each first proof gates
the commits after it. Every commit passes the native hooks; that is a hooks
guarantee, not a runnable-runtime guarantee. Commits 1 and 2 leave the Paseo
runner fully working and are safe stopping points. Commits 3 and 4 are one
non-runnable span: from commit 3 the runner launches through `hc` while
wake-up still needs step 4. Only the end-to-end proof validates that span,
and after step 2 the PR as a whole is the only runnable boundary. The branch
is never merged or synced partway.

1. **Launcher, routes, and policy.** `hooks/pi/routes.json` is created and
   the launcher reads it; the runner keeps reading `~/.paseo/config.json`
   until step 3. The launcher gains an interactive mode for `hc` terminals
   beside its existing RPC mode, so the Paseo runner keeps working on every
   intermediate commit; step 3 removes the RPC-only path. The
   `hc` and `herdr-app` allow-lists are added beside the Paseo denial, which
   stays until step 5. First proof 1 depends only on this step and gates the
   rest.
2. **Install and templates.** Brewfile, bootstrap, and templates generated
   from `routes.json`.
3. **Runner transport.** Launch, verification, send, delivery evidence,
   session-JSONL replies, and timeout kills through `hc`; `HC_TERMINAL_ID`
   identity; `ax.workflow` and `ax.role` labels on every launch; deletion of
   Paseo workspace binding and registration; and removal of the launcher's
   RPC-only path. First proof 2, driven by a manually run tick.
4. **Wake-up and cleanup.** The workflow watcher, label-based terminal
   cleanup, and worktree cleanup. First proof 4's observations are appended
   to the `Observed herdr-core behavior` section below and committed before
   the watcher's change detection is written; the end-to-end proof closes
   this step. That section records facts only. It changes no accepted
   contract and does not reopen planning review; implementation review checks
   it with the diff. An observation that contradicts this plan's contract
   stops the implementer and returns to Plan.
5. **Remove and rename.** Paseo config target, Paseo-specific code and docs,
   and the skill rename to `herdr-orchestration`. The drift proof closes it.

Steps 1 to 3 are done on the branch (`1179734`, `5dea338`, `87c2b4a`), with
the label-reading fix and first proof 3's observations in `d904dc0`. The
first ticker-chain design for step 4 was contradicted by those observations
and is replaced by the watcher below. The next implementer starts from
`d904dc0` with step 4; it also adds `--outlive-parent` to worker launches
(see Sessions).

### Per-laptop precondition

Before merge authority is requested, both the personal and the work laptop
have installed herdr-core through the vendor installer or this branch's
bootstrap, and each shows `hc -V` at or above the minimum and a successful
`hc server status`. If the work laptop cannot meet it, for example because
work-machine policy blocks the installer or its signing identity, the PR stays
unmerged and the plan returns to Plan.

## Behavior

### Install

- `cask "herdr-app"` replaces `cask "paseo"` in the Brewfile. The cask
  installs only `Herdr.app` and the `herdr-app` binary; it does not install
  herdr-core, and Homebrew has no herdr-core formula (observed with
  `herdr-app` 0.1.16).
- herdr-core comes from its vendor installer,
  `https://releases.herdr.dev/core/install.sh`, into `~/.local/bin`, at the
  latest published version. Bootstrap downloads it to a fresh temporary file
  and runs it with `sh` only when `hc` is missing or below the minimum. The
  installer verifies the release checksum and the Apple code-signing identity
  `dev.herdr.core` / team `2W9652Q7QR`, and updates in place without stopping
  terminals. Bootstrap fails with the installer's message when either check
  fails, and never pipes the download straight into a shell.
- Bootstrap verifies that `~/.local/bin` is on PATH, that `hc -V` meets the
  recorded minimum (0.1.21, the latest release when this plan was written),
  and that `hc server status` succeeds. Its closing note tells the user to run
  `hc server restart` after a PATH change, which keeps terminals running.
- No version pin for herdr-core or the app; both update themselves. Bootstrap
  enforces a minimum, not an exact version, and never uninstalls Paseo.

### Routes and templates

- The route table moves from `~/.paseo/config.json` into tracked
  `hooks/pi/routes.json`, installed by the existing hooks sync and read by the
  launcher and the runner.
- AX gains a managed file target for `~/.config/herdr-core/templates/ax-*.md`:
  orchestrator on Opus, orchestrator on Astra, and both consult planners, so a
  person can start a session by name with `hc run ax-orchestrator "task"` or
  from a Herdr tab. Config sync generates each template from `routes.json`,
  so templates and routes cannot drift.
- The Paseo managed config target, its `ax-*` providers, its five
  `daemon.relay` leaves, and the `paseo` config name in config sync are
  removed.

### Sessions

- The runner launches every worker with explicit argv, not a template, so it
  can pass a per-worker `--session <scratch>/<worker>.jsonl` and labels
  `ax.workflow=<id>` and `ax.role=<role>`:
  `hc run --bg --json --name ax-<role>-<n> --cwd <cwd> --label ... -- node ~/.agents/hooks/pi/launch.ts <role> <route...> --session <path>`.
- The parent defaults to the orchestrator's own terminal, so workers appear as
  sub-agents under it in the desktop app and in the mobile Inbox. Workers,
  consult planners, and reviewers launch with `--outlive-parent`, so a
  closed or crashed orchestrator does not kill them, matching Paseo, where
  workers outlived the orchestrator session. Their session JSONL and
  worktree stay intact, and a new orchestrator in the same cwd resumes the
  workflow with an ordinary tick, which re-arms the watcher under its own
  `HC_TERMINAL_ID`. Workers left running are bounded by the reviewer
  timeout on the next tick and by label-based cleanup. A worker that still
  ends unexpectedly is recorded by the existing `failed` or `undelivered`
  paths, and `adopt` and `retry-launch` read its session JSONL and the
  recorded worktree baseline, never a live terminal; a unit test covers
  adoption of a report from a `finished` worker terminal. Only the watcher
  keeps the default die-with-parent behavior. The runner
  copies the orchestrator's `herdr.space` and `herdr.tab` labels onto workers
  so they land in the same space.
- Templates exist for humans only. The runner never starts a template.
- The launcher's RPC-only requirement is removed; managed Pi runs
  interactively in an `hc` terminal.

### Identity and verification

- `HC_TERMINAL_ID` replaces `PASEO_AGENT_ID` as the orchestrator's identity.
  The runner refuses a dispatching caller without it.
- `hc get --json` replaces `paseo inspect`. Required fields: exact `cwd`,
  `argv` equal to the fixed route, `state: live`, `status.state`, `turn`,
  `reported: true`, `parent`, `labels`. A missing field stops the launch
  before any send, naming the field and the `hc -V` output.
- Paseo workspace binding and registration are deleted. cwd equality on the
  terminal is the binding.

### Delivery evidence

- Inert startup is `reported: true` with `status.state: idle`.
- Assignments go through `hc send --if idle <terminal> <text>`; a zero exit
  releases the worker and the body is never interpreted.
- Delivered: `turn` advanced, status became `working`, or the session JSONL
  holds the user message carrying the assignment digest. Undelivered: the
  queue window passed, the terminal is live and idle, no digest, `turn`
  unchanged. Otherwise nothing is decided.
- The last reply is the last assistant message in the worker's session JSONL,
  replacing `paseo logs`. The reader ignores an unparseable trailing line, so
  a partial write, an unflushed reply, or a file cut short by `hc kill` means
  "no reply yet", never a malformed report. The digest search applies the
  same rule.
- A reviewer still busy past the timeout is stopped with `hc kill` and
  recorded as degraded evidence.

### Wake-up

herdr-core types a parent note only when a child is blocked, errors, or
exits, and a `--rm` child types none, so parent notes cannot wake the
orchestrator (see `Observed herdr-core behavior`). One watcher process per
workflow replaces the Paseo heartbeat and types the tick prompt itself.

- Lifetime: whenever a worker, consult planner, ambiguous delivery, or
  hosted gate is in flight, the runner keeps one watcher terminal, a child of
  the orchestrator, started with
  `hc run --bg --rm --no-notify --json --label ax.workflow=<id> --label ax.role=watcher -- node <runner dir>/watch.ts <state> <orchestrator address> <generation>`.
  A dispatch or tick with work in flight and no live watcher starts one. The
  runner stops it when nothing is in flight, at `awaiting-user`, and at
  finish.
- Change detection: the watcher follows `hc events` and reacts to any
  terminal whose address the state records as an in-flight worker, so
  workers started under an earlier orchestrator terminal are still seen,
  when its turn ends, or it becomes blocked, errors, or finishes. If first proof 4 shows the
  event stream does not report an ordinary turn end, it instead polls
  `hc get` on the workflow's live children every 15 seconds and compares
  `turn`, `status.state`, and `state`, which `hc get` was observed to update.
  Bursts within 5 seconds are coalesced into one tick.
- One unconsumed prompt: the watcher records when it last sent a tick
  prompt and sends no further prompt, change-triggered or periodic, while
  that send is newer than the state's `lastTickAt`, so a long orchestrator
  turn queues at most one tick prompt. If a sent prompt is still unconsumed
  after 15 minutes, it is treated as dropped and one prompt is sent again. A
  scripted-`hc` unit test sends several changes and an interval during one
  long turn and checks that exactly one prompt is queued.
- Periodic tick: the watcher also types the tick prompt every 5 minutes,
  the heartbeat interval, so a hung worker, an inert worker past the queue
  window, a reviewer past its timeout, and a pending hosted gate are
  evaluated without user input. It skips a periodic tick when the state's
  `lastTickAt`, which every tick records, falls within the interval.
- Delivery: the watcher sends the runner's fixed tick prompt, with the
  effective standing orders, through `hc send <orchestrator address>`. A
  prompt typed while the orchestrator is mid-turn is queued as Pi's next turn
  (observed), so mid-turn sends stay allowed.
- Blocked guard: the watcher reads the orchestrator's `hc get` status before
  each send and skips the send while it is `blocked`, for example at a
  permission prompt. `hc send` itself also refuses a blocked terminal unless
  `--force` (`hc` manual, exit 9); the watcher never passes `--force`. A
  skipped or refused send is retried at the next change or interval. A
  scripted-`hc` unit test shows a blocked orchestrator gets no send and the
  tick is sent after it unblocks. First proof 4 also records what `hc send`
  does to a blocked Pi under `Observed herdr-core behavior`.
- Draft guard, fail-closed: herdr-core holds sends while a person has an
  unfinished draft, up to 60 seconds after their last key (`hc` manual,
  `draft_wait`). The end-to-end proof leaves unsent composer text in the
  idle orchestrator for longer than that window while the watcher sends, and
  records whether the text is preserved, unmodified and unsubmitted. If it
  is not preserved, automatic delivery is not enabled: the implementer stops
  and returns to Plan. There is no weaker fallback.
- Ticks stay idempotent under the
  state lock, so a duplicate or late tick changes nothing.
- Stop: the runner first records a newer generation in a stop file in the
  scratch folder, then kills the watcher by label and sweeps once more. A
  watcher whose generation is older than the stop file sends nothing and
  exits.
- Recovery: a watcher that receives a hang-up or termination signal while
  its generation is current first writes a retiring marker naming its
  generation and terminal address to the scratch folder, then types one tick
  prompt and exits. A tick treats a watcher whose generation has a retiring
  marker as absent even while its terminal is still live: it kills that
  terminal, records a newer generation, and starts exactly one replacement.
  A unit test runs the recovery tick before the old watcher exits and checks
  that exactly one watcher survives. If the orchestrator is `blocked` when
  the watcher is terminated, or the final send is refused or fails, the
  blocked guard still holds: the watcher sends nothing, records
  `recoveryPending` in its retiring marker, and exits. Automatic recovery
  does not survive that case; `status` and every tick line report the
  missing watcher, and the next tick from the user or Herdr Mobile, which a
  blocked orchestrator already needs a person for, starts a replacement. A
  scripted-`hc` unit test terminates the watcher while the orchestrator is
  blocked, checks that no send happens and `recoveryPending` is recorded,
  unblocks, and checks that the next tick starts exactly one replacement.
  An event stream that ends, for example across
  `hc server restart`, is reopened with backoff, and the watcher polls
  meanwhile. Only an uncatchable kill ends a watcher silently; then `status`
  and every tick line report the missing watcher, and the next tick from the
  user or Herdr Mobile starts one.
- Orphan bound: the watcher is a child of the orchestrator, and children end
  with their parent (observed), so a closed or crashed orchestrator ends its
  watcher. A watcher also exits after 24 hours, the old heartbeat lifetime;
  a tick that finds its watcher older than 12 hours replaces it.
- The watcher is a runner-owned process, not an agent tool call, so the
  managed-role `hc` allow-list does not apply to it. The orchestrator's
  injected system section names the watcher's tick prompt as the workflow
  heartbeat, not a child report.

### Policy

- For every managed role, `hc` and `herdr-app` are default-deny allow-lists.
  Only the listed forms run; every other subcommand, including one a future
  release adds, an alias, or an unrecognized option before the subcommand, is
  denied. Invocation through `herdr-core`, a path, a variable such as `$H`,
  or a nested `sh -c` payload gets the same check, and a dynamic executable
  that cannot be resolved is denied.
- `hc` allowed: `ls`, `get`, `read`, `wait`, `events`, `templates`, `schema`,
  `machine ls`, `file read`, `server status`, `--help`, `--skill`, and `-V`.
  Everything else is denied, including `run`, `send`, `keys`, `interrupt`,
  `kill`, `rm`, `label`, `keep`, `put`, `exec`, `file write`, `file edit`,
  `server stop`, `server restart`, `update`, and `machine` mutations.
- `herdr-app` allowed: `ls`, `status`, `commands`, `shot`, `--help`,
  `--skill`, and `--version`. Everything else is denied, including `do`, bare
  `herdr-app` (it opens the window), `check`, and `feedback`.
- The injected system section tells managed roles that the herdr-core skill's
  sub-agent advice does not apply to them; the runner is the only dispatcher.
- The Paseo shell denial and the Paseo MCP denial for consult planners are
  removed with Paseo; the generic agent-creation tool denial stays.

### Cleanup

- Cleanup stops the watcher as described above, then kills and removes
  terminals carrying the workflow label, children before parents, and deletes the scratch folder
  under today's guards. The caller's own `HC_TERMINAL_ID` is always excluded,
  even when it carries the workflow label. A unit test covers that case.
- A Paseo-marked state refuses every action except `status`, including
  `cleanup`. The refusal names the manual steps: archive its Paseo workspace,
  remove its linked worktree with plain `git worktree remove`, and delete its
  scratch folder. A unit test covers it.
- Paseo workspace archival is replaced: cleanup removes a linked worktree with
  plain `git worktree remove` only when it is clean at the recorded head, no
  live `hc` terminal other than the caller has its cwd inside it, and the
  caller's own cwd is outside it; otherwise it skips the worktree and reports
  why. It never forces removal and never deletes a branch. A main checkout is
  always skipped.

### Rename

- `skills/paseo-orchestration` becomes `skills/herdr-orchestration`, with a
  `runtime.retiredSkills` entry for `paseo-orchestration`. Its scripts,
  reference, and tests drop the `paseo` prefix, as do the Finish hosted-probe
  and GitHub-feedback scripts and their test.
- Charter-validator contract names, `rules/investigation-and-implementation.md`,
  `skills/finish/SKILL.md`, `skills/ax-cli/references/command-routing.md`,
  `docs/ax.md`, `hooks/README.md`, and eval scenarios name herdr-core.

### Mobile

- Documentation only. Enable macOS Remote Login, use SSH keys, reach the Mac
  over Tailscale or the local network, and add the machine in Herdr Mobile.
- AX owns no relay, pairing, or SSH configuration.
- If a work-machine policy forbids Remote Login, desktop and orchestration
  still work; only mobile access is lost on that machine.

## Reuse and deviation

Carried over unchanged: the `Transport` function type, the `observe` retry
wrapper, snapshot digests, standing orders, the `locked` state writer, the
legacy-marker refusal, the hosted probe behavior, and the review and consult
envelopes.

New mechanisms, each justified:

- A managed file target for templates, because the templates directory holds
  Markdown files rather than JSON or TOML leaves. Templates are generated from
  `routes.json` instead of tracked as separate sources.
- The herdr-core vendor installer in bootstrap, because herdr-core has no
  Homebrew formula or mise plugin and the app cask does not install it.
- The workflow watcher, because herdr-core has no scheduler or heartbeat and
  types no parent note when a live agent finishes a turn.
- Session-JSONL reply reading, because reviewers have no write tool and no
  shell, so they cannot report through a file or `hc send`.

Rejected: speaking JSON-RPC to the core socket directly, since the CLI exposes
every needed fact and keeps a scripted fake testable; screen scraping with
`hc read`, since Pi's rendered TUI is not a stable report source.

## Acceptance and proof

All live proofs run under an isolated HOME, `XDG_CONFIG_HOME`, and
`HC_SESSION`, with real `hc`.

- First proof 1: a managed Pi session started by real `hc` shows
  `reported: true` and `status.state: idle` in `hc get --json`. If it does
  not, the launcher sets `PI_PROGRAM_STATUS=1` and the proof is repeated.
- First proof 2: the runner launches a real managed Pi reviewer through real
  `hc`, verifies it, sends the assignment, and a manually run tick records its
  review envelope from the session JSONL. A second reviewer kept busy past a
  shortened timeout is stopped with `hc kill` and recorded degraded from its
  possibly truncated session JSONL.
- First proof 3 (done in `d904dc0`): parent-note text, mid-turn handling,
  killed-child and killed-parent behavior, recorded under `Observed
  herdr-core behavior`.
- First proof 4: under a real `hc` orchestrator terminal, a real managed Pi
  child finishes a turn while `hc events --children-of <orchestrator> --json`
  runs. The recorded result says whether an event reports the turn end, and
  its exact shape, before the watcher's change detection is written.
- End-to-end proof: real managed Pi runs a planning workflow where a real
  implementer returns a valid `AX_REPORT` and a real reviewer returns a valid
  review envelope. Each completion makes the watcher type the tick prompt
  within one detection cycle, and that tick records it. With no worker in
  flight, a pending hosted gate's periodic tick drives one probe. A third
  worker that never stops working triggers no change; periodic ticks alone
  time it out and record it degraded. One tick prompt is typed while the
  orchestrator is mid-turn and runs as its next turn, and one is sent while
  unsent composer text has sat in the idle orchestrator for more than 60
  seconds; the text must survive unmodified and unsubmitted. The watcher is then
  killed with `hc kill` with work in flight, and the recovery tick starts a
  replacement. Expected record: implementer and reviewer `complete` with the
  verified head, the hung worker `degraded`, one hosted probe recorded, the
  watcher stopped afterwards, and label-based cleanup leaving no
  `ax.workflow` terminals on a second label sweep.
- Unit tests use a scripted `hc` fake for every delivery, conflict, adoption,
  watcher, and cleanup path that exists today, plus: a turn-end change
  producing one send; a burst coalesced into one send; a periodic send
  skipped after a recent tick; a stop file making an older watcher send
  nothing; a hang-up without a stop sending one recovery tick; an event
  stream that ends and is reopened; a refused send retried later; a tick with
  work in flight and no live watcher starting one; watcher replacement after
  12 hours; a session JSONL with a truncated trailing line; and cleanup with
  a labelled caller.
- Policy tests cover each allowed `hc` and `herdr-app` form, representative
  denied forms, an unknown subcommand, an unknown leading option, dynamic
  executables, and nested shell payloads.
- Drift proof: a repository search for `paseo` outside historical
  `.agents/plans/` and archived OpenSpec returns only intentional matches,
  such as the legacy-marker refusal and the retired-skill entry, listed in the
  report.
- The PR runs lint, format, typecheck, unit tests, skill and charter
  validation, native hooks, and `writing-skills` RED/GREEN scenarios for
  changed contract text.

## Cut-over per laptop

After the PR merges, on the laptop that ran this workflow, its authorized
`cleanup` runs with the still-installed Paseo runner before the live sync.
Then, user-owned on each laptop: finish or strand any other in-flight Paseo
workflow and clean it up manually as the legacy refusal describes, run
`bin/bootstrap <profile>` from the clean `main` worktree, run live
`pnpm ax sync` and `pnpm ax validate`, start orchestrators from Herdr
from then on, quit Paseo, run `brew uninstall --cask paseo`, and delete
`~/.paseo` when ready. Bootstrap never uninstalls.

## Risks

- Pi reports status only after the terminal confirms OSC 7501 support.
  Covered by first proof 1.
- Whether `hc events --children-of` reports an ordinary turn end is not yet
  observed. First proof 4 decides between the event stream and `hc get`
  polling; both are within this contract.
- `hc send` from a child arrives tagged as a child report. The
  orchestrator's system section names the watcher's prompt as the heartbeat,
  and a tick is idempotent, so a mistaken or duplicate tick is harmless.
- An uncatchable kill of the watcher, or its termination while the
  orchestrator is blocked, stops automatic ticks until the next
  manual or mobile tick, which `status` and every tick line make visible.
- The workflow carrying this PR runs under Paseo and reaches `finish` before
  the merge, and its cleanup runs before the post-merge sync, so the new
  runner never has to handle it.
- No rollback exists. A defect after the merge is repaired by a new PR and
  sync from `main`.
- The herdr-core vendor installer is a network script outside Homebrew. Its
  checksum and code-signing checks are the integrity control.

## Observed herdr-core behavior

First proof 3's observations, committed in `d904dc0`, follow. The
implementer appends first proof 4's and the end-to-end proof's
observations here during step 4.

Observed with `hc` 0.1.21 and Pi 1.5.0, under an isolated HOME and
`HC_SESSION`, with a real managed Pi orchestrator launched through the
launcher and a scripted local model:

- Parent-note text. A child that exits on its own types
  `<hc>t1d p3-child-exit exited (exit 0). Read: hc read t1d</hc>` into its
  parent. Pi submits it as an ordinary user message and runs one turn.
- Note typed mid-turn. Pi does not drop it. Pi queues it as a `Steering`
  message while the turn runs and submits it as the next user turn once the
  current turn ends; the session JSONL records it after the earlier reply.
- Externally killed child. `hc kill` on a child still notes its parent:
  `<hc>t1g p3-child-killed exited (signal 1). Read: hc read t1g</hc>`.
- Ticker whose parent is killed. Children default to
  `die_with_parent: true`. After `hc kill` on the parent, a `--rm` child
  stays `live` briefly, then ends and is removed within about ten seconds;
  `hc get` then returns `not_found`. A killed orchestrator therefore ends its
  chain without a successor, and the ticker's parent check stays the backup.
- `hc ls --json` rows carry `address`, `agent`, `cwd`, `name`, `state`,
  `turn`, and, for children, `parent` and `status`, but no `labels`. The
  `--label K=V` filter returned no terminals even for exact labels shown by
  `hc get`. The runner therefore reads each live terminal's labels through
  `hc get` and filters by `ax.workflow` itself.
- `hc send` exits before Pi reports the new turn. `hc get` can still show
  the previous `done` status and turn for several seconds after a send to an
  idle Pi. A worker still at its startup reply within the 60-second queue
  window stays undecided, so this gap does not misclassify delivery.
- A reviewer killed by the runner's timeout shows `state: finished`,
  `reason: killed`, and keeps its parent and labels in `hc get` until removed.
- A nonzero exit adds the last screen lines to the note:
  `<hc>t1k p3-pi-child exited (exit 78). Last lines:` followed by the lines
  and `Read: hc read t1k</hc>`. An exit-0 note carries none of the child's
  output.
- A live agent child that finishes a turn sends no note. A managed Pi
  implementer under the Pi orchestrator completed two turns (`status: done`,
  `turn` 1 then 2), one sent from outside and one sent as the orchestrator
  with `HC_TERMINAL_ID`, and no note reached the orchestrator. The `hc`
  manual states that hc notifies a parent only when a child cannot report:
  blocked, error, or exited. A child reports otherwise by its own
  `hc send` to the parent, tagged `<hc from="t7 name">`.
- A `--rm` child that exits types no note at all. An `echo` child started
  with `--bg --rm --parent` on the orchestrator exited, was removed at once,
  and no note reached the orchestrator; `hc read` then returns `not_found`.
  Its stdout is gone.
- `hc send` by terminal name returned `not_found` for a live child whose
  `hc get` by address showed that name. The runner addresses terminals by
  address only.

These last two facts contradict the accepted contract. Wake-up assumes each
ticker's exit notes the orchestrator, but every ticker runs with `--rm`, so
no ticker note is typed. The end-to-end proof expects every worker
completion to write a parent note, but a live worker that finishes its turn
writes none, and reviewers have no shell to report with `hc send`. Under
this plan's rule the implementer stopped here and returned to Plan. The
revised Wake-up section replaces the ticker chain with the workflow
watcher, which types the tick prompt itself.

First proof 4, observed with `hc` 0.1.21 and Pi 1.5.0 under an isolated
HOME, `XDG_CONFIG_HOME`, and `HC_SESSION`, with a real managed Pi
orchestrator and real managed Pi children launched through the launcher
with `--outlive-parent`, and a scripted local model:

- The event stream reports an ordinary turn end. While
  `hc events --children-of <orchestrator> --json` and `hc events --json`
  ran, a child that finished a turn produced, on both streams,
  `{"type":"status","terminal":"t5","data":{"status":{"app":"pi","state":"working"},"reported":true,"records":{}}}`,
  then the same shape with `"state":"done"`, then
  `{"type":"turn","terminal":"t5","data":{"state":"done","turn":1}}`.
  Each event arrives as a JSON-RPC notification
  `{"jsonrpc":"2.0","method":"event","params":{...,"seq":N}}`. The stream
  opens with one snapshot line `{"channel":null,"seq":N,"terminals":[...]}`
  of `hc get`-shaped rows and interleaves
  `{"method":"heartbeat","params":{"seq":N}}` lines. Other event types
  seen: `created` (a full `hc get` row), `foreground`, `title`, and
  `finished` (`exit_code`, `finished_ms`, `reason`, `signal`). The watcher
  therefore follows the event stream, not `hc get` polling.
- A blocked child appears on the stream as
  `{"type":"status","data":{"status":{"app":"pi","kind":"permission","msg":"Proof dialog","state":"blocked"}}}`
  and notes its parent:
  `<hc>t6 p4-blockable is blocked (permission). See: hc read t6</hc>`. Pi
  reports `blocked` while an extension dialog such as a confirm waits; a
  proof-only extension opened one.
- `hc send` to a blocked Pi types nothing. With or without `--if idle` it
  exits 9 with
  `{"error":{"kind":"blocked","message":"t6 is blocked (permission)","hint":"typing would answer its dialog; read its screen first (hc read t6), or --force"}}`;
  the dialog stays open.
- A finished turn again typed no note into the orchestrator, while a
  child killed with `hc kill` did:
  `<hc>t5 p4-child exited (exit 0). Read: hc read t5</hc>`.
- `--outlive-parent` holds. `hc get` on such a child shows
  `die_with_parent: false`. After `hc kill` on the orchestrator, the child
  stayed `live` and `blocked`, kept `parent` pointing at the finished
  orchestrator, and the `--children-of` stream stayed open.
- Right after `hc kill` returned `state: finished`, one `hc ls --all` still
  showed the killed terminal `live`; the next call showed it finished.
  Readers treat a just-killed terminal's `ls` row as eventually consistent.

The end-to-end proof, observed with `hc` 0.1.21 and Pi 1.5.0 under the same
isolated core, with a real managed Pi orchestrator `t8`, real managed
reviewers, planner, and implementer launched by the runner with
`--outlive-parent`, the step-4 watcher, a scripted local model, and a fake
hosted probe. It stopped at the draft guard:

- Draft guard: not preserved. Unsent composer text typed into the idle
  orchestrator with `hc keys` (`draft keep`) sat for more than 60 seconds.
  herdr-core's own parent note was then pasted after it and both were
  submitted as one user message:
  `draft keep<hc>t17 ax-planner-astra-49645 hit an error: terminated. See: hc read t17</hc>`.
  A second draft (`second draft`) sat about eleven minutes; the watcher's
  exact send form, `hc send --json t8 <text>`, returned
  `{"started":true,"status":"done","turn":9}` and Pi submitted
  `second draftAX orchestration tick (draft-guard probe)`. `hc send` holds
  only within `draft_wait`, then pastes into the composer and presses
  enter, so the person's draft is modified and submitted. Under this plan's
  rule automatic delivery is not enabled; the implementer stopped and
  returned to Plan before step 5.
- Detection: the implementer's completion at 05:08:19.1 made the watcher
  type the tick prompt at 05:08:24.7, and four reviewer completions within
  0.3 seconds produced one prompt 5.6 seconds after the last, each within
  one coalescing cycle. The next ticks recorded `handoff: complete at`
  the verified head and all four reviewers `complete`.
- Catch-up at stream open: the first planning round's reviewers finished
  within a second of dispatch, before the new watcher's event stream opened,
  and no event reported them. The watcher now runs one `hc get` sweep of
  watched workers when each stream opens and counts a `done`, `blocked`,
  `error`, finished, or missing worker as a change; a later watcher typed
  its prompt about 6 seconds after start this way.
- A never-ending model stream is not a hung worker under Pi: Pi ended a
  stalled stream as `error: terminated` after about five minutes, even with
  keepalive chunks every 15 seconds, and hc noted the parent
  `<hc>t9 ax-review-quality-49642 hit an error: terminated. See: hc read t9</hc>`.
  The tick recorded the reviewer `degraded (reduced independence)` and the
  planner `degraded (advice unavailable)`. The periodic-timeout case was not
  observed separately.
- An unconsumed prompt holds resends: while the orchestrator had not run
  the last typed tick, the watcher sent nothing for over ten minutes, as
  designed (`resendMs`). The first periodic tick with only the hosted gate
  in flight ran one probe.
- `hc kill` on a `--rm` watcher delivers the hang-up, the watcher types its
  recovery tick and exits, and `hc kill` itself then exits 3 with
  `{"error":{"kind":"not_found","message":"t13 was removed"}}`. Killers
  treat that error as success.
- Not reached: the recovery tick starting a replacement after a kill with
  work in flight, a prompt typed mid-turn by the watcher, and the final
  label-based cleanup sweep.
