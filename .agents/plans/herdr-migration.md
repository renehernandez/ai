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
4. **Wake-up and cleanup.** Ticker chain, parent notes, label-based terminal
   cleanup, and worktree cleanup. First proof 3's observations are appended
   to the `Observed herdr-core behavior` section below and committed before
   the tick-prompt handling is written; the end-to-end proof closes this step.
   That section records facts only. It changes no accepted contract and does
   not reopen planning review; implementation review checks it with the
   diff. An observation that contradicts this plan's contract stops the
   implementer and returns to Plan.
5. **Remove and rename.** Paseo config target, Paseo-specific code and docs,
   and the skill rename to `herdr-orchestration`. The drift proof closes it.

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
  sub-agents under it in the desktop app and in the mobile Inbox. The runner
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

- A ticker chain replaces the Paseo heartbeat. Whenever a worker, consult
  planner, ambiguous delivery, or hosted gate is in flight, the runner keeps
  one `--rm` ticker chain labelled `ax.workflow=<id>` and `ax.role=ticker`.
  Each ticker sleeps for the 5-minute heartbeat interval, starts its
  successor with the same labels and the orchestrator as parent, and exits,
  which produces a parent note in the orchestrator terminal. The chain
  re-arms itself, so a dropped note never ends it. A tick that finds work in
  flight and no live ticker starts one; the runner kills the chain by label
  when nothing is in flight, at `awaiting-user`, and at finish. A hung
  worker, an inert worker past the queue window, or a reviewer past its
  timeout is therefore evaluated without user input while the chain lives.
- Chain recovery: a ticker whose successor fails to start still exits and
  notes the orchestrator, and that tick finds no live ticker and starts one.
  First proof 3 records whether an externally killed child notes its parent.
  If it does, that note's tick re-arms the chain. If it does not, external
  chain death is the one case that needs a person: `status` and every tick
  line report the missing ticker, and the next tick from a worker note,
  the user, or Herdr Mobile re-arms it. `hc server restart` keeps terminals
  running and does not end the chain.
- Stop marker: the runner stops a chain in two phases. It first records a
  new chain generation in a stop file in the scratch folder, then kills by
  label, then sweeps the label once more. Each ticker carries the generation
  it was started with and starts no successor when the stop file names a
  newer one, so a kill that lands during a successor start leaves no live
  ticker.
- Orphan bound: before starting its successor, each ticker runs `hc get` on
  its parent orchestrator terminal and exits without a successor unless the
  parent is live. A closed, crashed, or abandoned orchestrator therefore ends
  the chain within one interval. Each chain also stops after 24 hours, the
  old heartbeat lifetime; `status` reports the expiry and the next dispatch
  or tick re-arms it.
- Parent notes from workers that stop working are early wake-ups only. Ticks
  stay idempotent under the state lock, so a missed, dropped, or duplicate
  note changes nothing; the next ticker note picks up any missed change.
- The runner's tick-prompt handling is written against observed note text,
  not assumed text.

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

- Cleanup kills and removes terminals carrying the workflow label, including
  the ticker chain, children before parents, and deletes the scratch folder
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
- The ticker chain, because herdr-core has no scheduler or heartbeat.
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
- First proof 3: a fake child under a real `hc` orchestrator terminal stops
  working, and the observed parent-note text, plus how Pi handles a note typed
  while it is mid-turn, whether an externally killed child notes its
  parent, and what happens to a ticker when its parent terminal is killed,
  are recorded under `Observed herdr-core behavior` before the
  tick-prompt handling is written.
- End-to-end proof: real managed Pi runs a planning workflow where a real
  implementer returns a valid `AX_REPORT` and a real reviewer returns a valid
  review envelope. Each completion writes a parent note into the orchestrator
  terminal, and a tick driven by that note records it. With no worker in
  flight, a pending hosted gate's ticker produces a note that drives one probe
  tick. A third worker that never stops working sends no note; ticker notes
  alone drive the tick that times it out and records it degraded. One ticker
  note is deliberately dropped, or typed while the orchestrator is mid-turn,
  and the next ticker in the chain still drives a tick. The chain is then
  killed externally with work in flight, and the documented recovery path
  re-arms it. Expected record:
  implementer and reviewer `complete` with the verified head, the hung worker
  `degraded`, one hosted probe recorded, the ticker chain killed afterwards,
  and label-based cleanup leaving no `ax.workflow` terminals on a second
  label sweep.
- Unit tests use a scripted `hc` fake for every delivery, conflict, adoption,
  ticker, and cleanup path that exists today, plus a tick with work in flight
  and no live ticker, a failed successor start, a ticker whose parent is
  gone starting no successor, a stop landing during a successor start, a
  session JSONL with a truncated trailing line,
  chain expiry, and cleanup with a labelled caller.
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
- The parent-note text and Pi's handling of a note typed mid-turn are not yet
  observed. First proof 3 records both before the tick-prompt handling is
  written; idempotent ticks and the self-re-arming ticker cover a dropped
  note.
- The workflow carrying this PR runs under Paseo and reaches `finish` before
  the merge, and its cleanup runs before the post-merge sync, so the new
  runner never has to handle it.
- No rollback exists. A defect after the merge is repaired by a new PR and
  sync from `main`.
- The herdr-core vendor installer is a network script outside Homebrew. Its
  checksum and code-signing checks are the integrity control.

## Observed herdr-core behavior

The implementer appends first proof 3's observations here during step 4:
the exact parent-note text, how Pi handles a note typed mid-turn, whether an
externally killed child notes its parent, and what happens to a ticker when
its parent terminal is killed.
