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

1. installs the `Brewfile`: mise, plus the Paseo, Claude Code, and Codex apps.
   Homebrew does not pin these; they update to the latest release.
2. installs this repository's mise tools and runs `mise run setup`.
3. installs the `ax` shim and runs `ax sync --profile <profile>`. This also
   writes the pinned Node, pnpm, Pi, and OpenSpec versions into
   `~/.config/mise/config.toml`.
4. installs those global mise tools.
5. installs Pi's configured packages and pre-downloads the managed launcher's
   pinned extensions (`pnpm run pi:packages-install`).
6. runs `ax validate` and checks that Node, pnpm, Pi, and OpenSpec run at
   their pinned versions. It fails when another copy shadows a pin, such as a
   global npm package inside a mise Node install, and lists any other copy on
   PATH, each with a suggested removal command. It never uninstalls anything.

Afterwards, restart Paseo so it picks up the new PATH, and sign in where
needed: Claude Code, `codex login`, and Pi's `/login`. To change a version,
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

Pi settings, Pi model overrides and Paseo config use JSON `managedPaths` at
`~/.pi/agent/settings.json`, `~/.pi/agent/models.json` and `~/.paseo/config.json`.
Each entry names a path and value. An object or array at that path is replaced
as a whole; other JSON values survive, although formatting may change.
`expandHome: true` expands strings beginning with `~/` within that entry.

The tracked Paseo profile array and its `ax-` provider objects are AX-owned.
Add or modify those profiles in source. Unrelated provider objects remain
unowned. Credentials, sessions and Pi's `auth.json` are never AX targets.
Top-level sync applies configs, instructions, skills, hooks and selected profile
through the same runtime transaction. Use it for migrations that change both
provider commands and their adapters.

## Use Pi with Paseo

[Set up a machine](#set-up-a-machine) installs Pi and Paseo. Authenticate Pi's
`openai-codex` provider with your ChatGPT account, and configure the
`cloudflare-ai-gateway` provider locally for your account and Gateway. This
repository does not supply or synchronize credentials. The managed launcher
targets Pi 1.5.0 with the pinned pi-mcp-adapter 7.0.0 and pi-claude-bridge
0.9.3. Older adapter releases do not support Pi 1.x.

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
paseo reload
```

Use `work` instead of `personal` for work instructions. Both profiles default
planning and implementation to exact-model Opus 5.5 through the pinned Claude
subscription bridge. Astra remains a selectable orchestrator model. Four
focused reviewer sessions provide automatic reviews at medium thinking: GPT-6.1
Sol for correctness, Sonnet 5.5 for risk and quality, GPT-6.1 Terra for
architecture, and Sonnet 5.5 for contract alignment. Sonnet reviewers use the
same pinned Claude bridge as Opus, stay read-only, and receive no MCP. Paseo applies provider/profile
changes to new sessions; existing sessions keep their launch configuration.
Read its reload result before assuming changes were applied.

Both profiles enable Paseo's hosted relay at `relay.paseo.sh:443`, with TLS for
the daemon and public client connection. AX owns the five `daemon.relay` leaves:
`enabled`, `endpoint`, `publicEndpoint`, `useTls`, and `publicUseTls`. It leaves
daemon identity, encryption keys, pairing offers and authentication machine-local.
Relay traffic is end-to-end encrypted; see [Paseo connectivity](https://paseo.sh/docs/connectivity).

Relay enablement can reload, but endpoint or TLS changes require a restart.
After activation, inspect `restartRequiredPaths` and `overrideControlledPaths`
from `paseo reload`. Restart the selected daemon if required; remove conflicting
deployment overrides before expecting the file to control relay behavior.
Then use Paseo Desktop's **Pair a device** or `paseo daemon pair` to pair your
device. Keep the pairing link private; it is not repository configuration.

Select the **Orchestrator** profile. New tabs open on Opus 5.5; choose Astra
from the model menu for the alternative, both at medium thinking. Sync never
removes unmanaged provider entries, so the retired `ax-planner` providers stay
in your Paseo config, and sessions launched from them keep working. In the
[Pi workflow](../skills/paseo-orchestration/references/paseo-workflow.md),
the orchestrator you talk to runs the work: it hands the accepted brief to a
fresh Opus implementer, runs correctness, architecture, and contract-alignment
Sol reviews, publishes, and follows hosted feedback. A Paseo heartbeat wakes it
while work is in flight, so you do not need to ask for status. You do not
choose a model each time a reviewer or implementation worker starts.

Two consult planners, **Astra · Consult Planner** (GPT-6 Astra) and
**Fable · Consult Planner** (Fable 5.1 through the Claude bridge), give advice
at medium thinking. Ask the orchestrator to "ask Fable", "consult Astra", or
"get both planners' take"; it runs the runner's `consult` action and folds the
advice into its own plan revision. Consults never block progress. You can also
open either planner profile in Paseo as a standalone consultant.
Planners read files and have no shell, edit, write, or Paseo tools: Paseo does
not inject its tools for planner providers, and the planner policy denies Paseo
MCP calls. Other MCP servers from your own MCP configuration stay available;
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
