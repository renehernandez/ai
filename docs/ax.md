# AX CLI

`ax` synchronizes shared local Agents Experience assets from this durable AI
repository. Inside this repository, run commands through the package script:

```bash
pnpm ax <command>
```

From another project, use the managed `~/.local/bin/ax` shim. The shim keeps the
durable AI repository as its source/config root. Repo-local scopes such as
OpenSpec target the current working directory.

## State model

Tracked `ax.config.json` is authoritative runtime state. It declares source
refs, `runtime.installedProfiles`, `runtime.policyProfile`, exact targets,
instructions, hooks, managed tool-config leaves, and `runtime.retiredSkills`.

AX replaces declared targets on every sync and leaves unrelated filesystem
paths untouched. It stores only a disposable remote-source cache under
`~/.agents/runtime/cache`; runtime synchronization has no ownership manifest,
content ledger, backup store, or recovery journal.

## Synchronize runtime profiles

Run top-level sync to converge the profiles selected in tracked config:

```bash
pnpm ax sync
```

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

Status reports source/config roots, cache state, installed/policy profiles,
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
same-directory atomic rename. A matching file is not rewritten. Validate is
read-only and requires both convergence and a successful Codex load.

A missing config is ordinary drift; sync creates the minimum managed document.
AX rejects alternate targets, symlinked config paths, unsafe parent paths,
ambiguous TOML representations, validator failures, and concurrent target
changes without replacing the original file.

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
