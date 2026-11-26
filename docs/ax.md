# AX CLI

`ax` synchronizes shared local Agents Experience assets from this durable AI
repository. Inside this repository, run commands through the package script:

```bash
pnpm ax <command>
```

From another project, use the managed `~/.local/bin/ax` shim. The shim keeps the
durable AI repository as its source/config root. Repo-local scopes such as
OpenSpec target the current working directory.

## Set up a machine

On macOS with Homebrew installed, set up or refresh the whole AI toolchain from
the clean `main` checkout:

```bash
bin/bootstrap personal
```

Use `work` for the work profile. The script is safe to re-run and stops at the
first failing step, naming it. In order, it:

1. installs the `Brewfile`: mise, plus the Herdr, Claude Code, and Codex apps.
   Homebrew does not pin these; they update to the latest release.
2. installs herdr-core (`hc`) into `~/.local/bin` with its vendor installer
   when `hc` is missing or older than the recorded minimum. The installer
   verifies the release checksum and Apple code-signing identity; bootstrap
   downloads it to a temporary file instead of piping it into a shell. It then
   requires `~/.local/bin` on PATH and a working `hc server status`.
3. installs this repository's mise tools and runs `mise run setup`.
4. installs the `ax` shim and runs `ax sync --profile <profile>`. This also
   writes the pinned Node, pnpm, Pi, and OpenSpec versions into
   `~/.config/mise/config.toml`.
5. installs those global mise tools.
6. installs Pi's configured packages and pre-downloads the managed launcher's
   pinned extensions (`pnpm run pi:packages-install`).
7. runs `ax validate` and checks that Node, pnpm, Pi, and OpenSpec run at
   their pinned versions. It fails when another copy shadows a pin, such as a
   global npm package inside a mise Node install, and lists any other copy on
   PATH, each with a suggested removal command. It never uninstalls anything.

Afterwards, run `hc server restart` after any PATH change (running terminals
keep going), and sign in where needed: Claude Code, `codex login`, and Pi's `/login`. To change a version,
edit its pin (`runtime.configs.mise` in `ax.config.json`, the repo
`mise.toml`, or `packageManager`) and re-run bootstrap from `main`. pnpm is
pinned in all three places; a unit test keeps them in agreement.

## State model

Tracked `ax.config.json` is authoritative for available profile definitions,
source refs, exact targets, instructions, hooks, managed tool-config leaves,
and `runtime.retiredSkills`. Each machine stores one selected profile in
`<runtime-root>/selected-profile.json`; that profile controls both installed
assets and workflow policy.

AX replaces declared targets on every sync and leaves unrelated filesystem
paths untouched. It stores a disposable remote-source cache under
`~/.agents/runtime/cache` and temporary recovery journals plus verified backups
under `~/.agents/runtime/transactions` and `~/.agents/runtime/backups`.

## Synchronize runtime profiles

Initialize a machine by selecting one available profile:

```bash
pnpm ax sync --profile personal
```

The selection is persisted locally. Later syncs reuse it:

```bash
pnpm ax sync
```

Switch profiles explicitly with `pnpm ax sync --profile work`. AX builds the
new candidate before mutation, removes paths owned only by the previous
profile, and commits the new selection last. A failed switch restores the
previous profile-owned runtime and selection. An uninitialized sync never
chooses a profile or contacts a profile source.

Scoped synchronization uses the same config without initialization state:

```bash
pnpm ax skills sync
pnpm ax instructions sync
pnpm ax hooks sync
pnpm ax configs sync
```

Each distinct configured source/ref pair resolves once per invocation. Every
selected entry from that source uses one immutable snapshot, preventing mixed
source versions inside one candidate. AX validates the full temporary candidate
before replacing exact live targets. If a run is interrupted, run sync again.

## Inspect local state offline

Status and validate are offline, read-only commands. They perform no network
access, source fetch, or target mutation.

```bash
pnpm ax status
pnpm ax validate
```

Status reports source/config roots, cache state, the selected profile,
missing targets, invalid links, and retired paths that remain present. Validate
checks the same structural contract and exits non-zero on findings. Neither
command compares file contents or proves remote-ref freshness. Run sync to
restore authoritative content and resolve current remote refs.

When offline inspection includes OpenSpec, AX locates the configured
`openspec` executable or the first executable on `PATH` through filesystem
checks. Status and validate never execute that CLI or probe its version. Only
`ax openspec sync` runs `openspec --version`.

Scoped `skills`, `instructions`, `hooks`, and `configs` status/validate
commands apply the same offline boundary to one surface.

The `configs` scope compares tracked leaf values with the local tool config.
`configs validate` additionally runs the installed Codex config loader
against a temporary candidate home. It does not mutate the target.

## Synchronize managed tool configs

`runtime.configs` owns selected values inside mixed machine-local config files.
The first handler manages these exact TOML leaves in
`~/.codex/config.toml`:

| Managed leaf | Value |
| --- | --- |
| `features.memories` | `true` |
| `features.multi_agent_v2.enabled` | `true` |
| `features.multi_agent_v2.max_concurrent_threads_per_session` | `10` |
| `agents.max_depth` | `1` |
| `memories.generate_memories` | `true` |
| `memories.use_memories` | `true` |

Parent tables are grouping only. AX preserves every unowned value and unowned
source text, including project trust entries, plugins, MCP servers, providers,
and machine-specific paths. Do not hand-edit a managed config leaf; change its
tracked value in `ax.config.json` and run:

```bash
pnpm ax configs status
pnpm ax configs sync
pnpm ax configs validate
```

Status reports each missing or differing leaf. Sync starts from the existing
file, constructs a source-preserving candidate, parses the complete TOML, and
runs `codex features list` against a temporary `CODEX_HOME`. This loads the
complete config schema and types without requiring auth or connectivity. AX then
verifies that Codex Desktop has not changed the original bytes and uses a
recoverable transaction. A matching file is not rewritten. Validate is
read-only and requires both convergence and a successful Codex load.

`runtime.configs.mise` manages the `[tools]` pins in
`~/.config/mise/config.toml` the same way, leaving other tools and comments
untouched. Keys outside the bare-key set, such as
`"npm:@earendil-works/pi-coding-agent"`, are written quoted. Its validator runs
`mise ls --global --offline` against the candidate with isolated mise
directories and requires mise 2026.11.0 or newer, because older releases read
the live config instead of the candidate.

A missing config is ordinary drift; sync creates the minimum managed document.
AX rejects alternate targets, symlinked config paths, unsafe parent paths,
ambiguous TOML representations, validator failures, and concurrent target
changes without replacing the original file.

Pi settings and Pi model overrides use JSON `managedPaths` at
`~/.pi/agent/settings.json` and `~/.pi/agent/models.json`.
Each entry names a path and value. An object or array at that path is replaced
as a whole; other JSON values survive, although formatting may change.
`expandHome: true` expands strings beginning with `~/` within that entry.

`runtime.configs.herdrTemplates` owns the `ax-*.md` files in
`~/.config/herdr-core/templates`: one orchestrator template per orchestrator
route (`ax-orchestrator` on the default route) and one per consult planner.
AX generates each from `hooks/pi/routes.json`, so a person can start
`hc run ax-orchestrator "task"` on exactly a tracked route. Each template has
an empty body, because herdr-core sends a nonempty body as a first prompt.
Other templates in that folder are unowned.

### Herdr app projects sidebar

Two targets install a personal Herdr app sidebar that groups spaces into
projects. `runtime.configs.herdrApp` owns, whole, each file under `herdr-app/`
in this repository at the same path below `~/.config/herdr-app`:

- `mods/projects/`: the sidebar. Each project lists its repos, and each repo
  lists its worktree spaces. Every other space is under **Other**.
- `mods/projects-edit/`: the Projects dialog and the sidebar's menus.
- `layouts/projects.json`: a copy of Herdr's `main` layout with the `spaces`
  block showing the `projects` mod instead.

Status reports a changed or missing owned file as `content` drift, and sync
replaces it, just as with `herdrTemplates`. AX never deletes: a file removed
from `herdr-app/` stays in the Herdr home until you delete it by hand. Source
may name only files in mod folders Herdr doesn't ship and layouts Herdr
doesn't ship. Sync refuses anything else.

`runtime.configs.herdrKeys` manages one JSON path in
`~/.config/herdr-app/keys.json`: `global."cmd-k p"` =
`"mod.open:projects-edit"`, which toggles the Projects dialog. Every other key
stays as it is. Once `keys.json` is edited, Herdr stops upgrading its default
shortcuts in it. When `keys.json` is missing, status and validate report drift
and sync does not create the file. A file with only this key would replace
Herdr's whole default key table, so start Herdr once to create it, then sync.

These files are never AX targets:

- Herdr's own data: `projects.json` (your projects, written by the sidebar and
  the dialog), `settings.json`, `shared.json` and `layouts/.state/`.
- Herdr's shipped mods and layouts, and the files Herdr writes into mod
  folders (`jsconfig.json`, `gpui-kit.d.ts`, `herdr.d.ts`).

After the first sync, show the sidebar once: run
`layout.switch {name: "projects"}`, or pick the layout in Herdr. Herdr
remembers the shown layout in `shared.json`, so sync never switches it.
Rollback: `layout.switch {name: "main"}`, `cmd-shift-l`, or
`ctrl-alt-shift-escape` brings back Herdr's own sidebar at once, and a later
sync does not undo that.

The `projects` mod is derived from Herdr 0.1.16's shipped `spaces` mod
(Apache License 2.0; the license and a change notice are in the mod folder),
and the layout copies that version's `main` layout. Neither follows Herdr
upgrades. When an upgrade changes the `spaces` mod, the `main` layout or the mod
API, re-derive both in a follow-up change. Until then, switch back to `main` if
the sidebar misbehaves. Herdr keeps the last working copy of a mod running when
a new one fails to load, and writes the error next to it.

Role routes live in `hooks/pi/routes.json`, which the launcher reads and the
templates derive from. Change a route there, in source. Credentials, sessions
and Pi's `auth.json` are never AX targets. Top-level sync applies configs,
instructions, skills, hooks and selected profile through the same runtime
transaction. Use it for migrations that change both routes and their adapters.

## Use Pi with herdr-core

[Set up a machine](#set-up-a-machine) installs Pi, herdr-core, and the Herdr
app. Authenticate Pi's
`openai-codex` provider with your ChatGPT account, and configure the
`cloudflare-ai-gateway` provider locally for your account and Gateway. This
repository does not supply or synchronize credentials. The managed launcher
targets Pi 1.6.1 with the pinned pi-mcp-adapter 7.0.0 and pi-claude-bridge
0.13.0. Older adapter releases do not support Pi 1.x.

Bootstrap pre-downloads both packages, so a cold download does not consume the
wrapper's 60-second startup deadline. After changing a pin, run
`pnpm run pi:packages-install` before the next managed session.

On its first start the adapter adds `-builtin:mcp` to `extensions` in
`~/.pi/agent/settings.json`, so Pi's built-in MCP does not run next to it.
AX does not own that value and preserves it.

If startup times out, inspect the package installation before requesting a new
session. The workflow does not retry a failed launch automatically.

After the migration is merged, use the clean default-branch source:

```bash
pnpm ax sync --profile personal
pnpm ax validate
```

Use `work` instead of `personal` for work instructions. Both profiles default
planning and implementation to exact-model Opus 5.5 through the pinned Claude
subscription bridge. Astra remains a selectable orchestrator model. Four
focused reviewer sessions provide automatic reviews at medium thinking: GPT-6.1
Sol for correctness, Sonnet 5.5 for risk and quality, GPT-6.1 Terra for
architecture, and Sonnet 5.5 for contract alignment. Sonnet reviewers use the
same pinned Claude bridge as Opus, stay read-only, and receive no MCP. Route
changes apply to new sessions; existing sessions keep their launch
configuration.

Start the orchestrator in the repository from a template:
`hc run ax-orchestrator "task"` opens Opus 5.5, and
`hc run ax-orchestrator-gpt-6-astra "task"` opens Astra, both at medium
thinking. In the
[Pi workflow](../skills/herdr-orchestration/references/workflow.md),
the orchestrator you talk to runs the work: it hands the accepted brief to a
fresh Opus implementer, runs the four reviews, publishes, and follows hosted
feedback. Workers appear as child terminals in the orchestrator's Herdr space
and tab. A workflow watcher wakes the orchestrator through its managed Pi
extension while work is in flight, without typing into its terminal, so you do
not need to ask for status and an unsent draft is never submitted. You do not
choose a model each time a reviewer or implementation worker starts.

### Use Herdr Mobile

AX owns no relay, pairing, or SSH configuration. To reach a Mac from Herdr
Mobile:

1. Enable **Remote Login** in macOS System Settings > General > Sharing.
2. Authorize an SSH key for your account; do not use password login.
3. Reach the Mac over Tailscale or the local network.
4. Add the machine in Herdr Mobile with that address and key.

If a work-machine policy forbids Remote Login, desktop and orchestration still
work; only mobile access is lost on that machine.

Two consult planners, **Astra · Consult Planner** (GPT-6 Astra) and
**Fable · Consult Planner** (Fable 5.2 through the Claude bridge), give advice
at medium thinking. Ask the orchestrator to "ask Fable", "consult Astra", or
"get both planners' take"; it runs the runner's `consult` action and folds the
advice into its own plan revision. Consults never block progress. You can also
start either planner as a standalone consultant with
`hc run ax-planner-astra "question"` or `hc run ax-planner-fable "question"`.
Planners read files and have no shell, edit, or write tools, and launch no
workers. MCP servers from your own MCP configuration stay available;
research-only use is an instruction, not an enforced read-only boundary.

Managed launches require Node 26, Pi on PATH, and the synchronized mandatory
adapter. Nonreview roles explicitly load the pinned MCP adapter, and Claude-model
roles (Opus, Sonnet, and Fable) also load the pinned bridge despite disabled extension discovery; a first launch can
require package download. Bridge authentication remains in the operator's
Claude profile. AX does not manage credentials, enable paid extra usage, or
permit API-key, gateway, Bedrock, Vertex, or Foundry environment redirects.
Reviewers only receive read/search tools.
Direct unmanaged `pi` launches do not acquire the managed wrapper's guarantees.

A successful config validation does not prove model availability or subscription
eligibility: the workflow rejects authentication, quota, provider, model-identity,
empty/truncated review-output, and missing-reviewer-evidence failures without a
billing or model fallback.

## Synchronize repo-local OpenSpec

`ax openspec sync` converges missing, configured, and repairable partial state
in the invocation repository:

```bash
ax openspec sync
```

For missing or context-required state, interactive sync previews inferred
project context and asks for confirmation. Headless execution requires confirmed
context:

```bash
ax openspec sync --context-file ./openspec-context.md
```

Configured repositories retain explicit config review:

```bash
ax openspec sync --review-config
ax openspec sync --review-config --accept-config-changes
```

Config review shows the full effective proposal before authorization. When the
proposal does not specify `context` or `rules`, AX preserves those values from
the current valid project config instead of replacing them with defaults.

AX parses project config through a documented, fail-closed YAML subset:

- `schema` is a scalar;
- `context` supports literal (`|`) and folded (`>`) block scalars;
- `rules` is a mapping whose quoted or unquoted artifact keys contain lists, or
  an empty mapping (`{}`) when an artifact has no rules.

Unsupported YAML constructs and malformed values produce validation findings;
AX does not reinterpret them permissively.

Sync resolves the configured `openspec` executable or falls back to `PATH`,
probes and reports its version, generates into a candidate, normalizes
explicit-only adapters and harness links, validates, then applies through a
worktree-scoped recoverable transaction. Top-level runtime sync never changes
repo-local OpenSpec state.

Use offline inspection after synchronization:

```bash
ax openspec status
ax openspec validate
```

Locally altered generated content is drift. Trigger metadata or prompts that
contradict the explicit-only invocation boundary are also drift. Status reports
these findings, validate fails, and the next authorized sync can regenerate the
managed assets.

## Prove changes without touching live runtime

Before merge, run AX behavior only with isolated HOME, cache, skill,
instruction, hook, profile, and config roots. Feature branches, dirty source,
and disposable worktrees cannot target canonical live runtime roots.
`--runtime-root` does not redirect `~/.codex/config.toml`; config proof
therefore requires an isolated HOME and an isolated runtime root. AX rejects an
unverified source that points either surface at the operating system user's
live home.

After merge, verify the clean merged default branch source matches the hosted
default branch. Then run live `ax sync`. Candidate construction and structural
post-sync validation form the activation gate.

## Manage the shim

Shim lifecycle is distinct from runtime synchronization:

```bash
pnpm ax shim install
pnpm ax shim status
pnpm ax shim uninstall
```

The shim manages only the `~/.local/bin/ax` executable entrypoint.

## See also

- [Hook runtime](../hooks/README.md)
- [Repository agent instructions](../AGENTS.md)
