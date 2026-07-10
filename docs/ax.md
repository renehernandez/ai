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

AX separates three kinds of state:

Tracked `ax.config.json` is desired state,
`~/.agents/runtime/managed-runtime.json` is ownership state, and the filesystem
is observed state.

| State | Location | Purpose |
| --- | --- | --- |
| Desired | tracked `ax.config.json` | Profiles, source refs, selected assets, targets, instructions, hooks, and OpenSpec settings |
| Managed | `~/.agents/runtime/managed-runtime.json` | Installed profiles, one policy profile, AX-owned paths, and content hashes |
| Observed | live filesystem | Current files, directories, symlinks, executable bits, collisions, and drift |

The local manifest uses `sha256-tree-v1` and does not duplicate desired source
configuration. Runtime support state lives under:

- `~/.agents/runtime/cache` for disposable source caches;
- `~/.agents/runtime/transactions` for recoverable mutation journals and
  retained candidate payloads;
- `~/.agents/runtime/backups` for the latest seven verified backups per changed
  asset and target.

## Synchronize runtime profiles

Run top-level sync to initialize or converge selected profiles:

```bash
pnpm ax sync
```

The first interactive run previews installed profiles and exactly one
workflow-policy profile. A first headless run supplies `--profile` or
`--all-profiles` plus `--policy-profile <name>`. Later headless profile changes
use a profile-selection file bound to the current manifest hash.

Scoped synchronization requires an initialized valid manifest and retains its
profile selection:

```bash
pnpm ax skills sync
pnpm ax instructions sync
pnpm ax hooks sync
```

Each distinct configured source/ref pair resolves once per invocation. Every
selected entry from that source uses one immutable snapshot, preventing mixed
source versions inside one candidate. AX validates the full candidate before
mutation, writes the local manifest last, and recovers interrupted changes from
retained hashes and payloads.

## Inspect local state offline

Status and validate are offline, read-only commands. They perform no network
access, source fetch, target mutation, recovery, backup creation, or manifest
write.

```bash
pnpm ax status
pnpm ax validate
```

Status reports source/config roots, manifest, cache, transactions, backups,
shim health, installed/policy profiles, desired/managed/observed differences,
collisions, locks, and recovery state. Validate exits non-zero when local state
violates the contract. Neither command proves remote-ref freshness; sync does
that while constructing its candidate.

When offline inspection includes OpenSpec, AX locates the configured
`openspec` executable or the first executable on `PATH` through filesystem
checks. Status and validate never execute that CLI or probe its version. Only
`ax openspec sync` runs `openspec --version`.

Scoped `skills`, `instructions`, and `hooks` status/validate commands apply the
same offline boundary to one surface.

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

Before merge, run AX behavior only with isolated HOME, manifest, cache,
transactions, backups, skill, instruction, hook, and profile roots. Feature
branches, dirty source, and disposable worktrees cannot target canonical live
runtime roots.

After merge, verify the clean merged default branch source matches the hosted
default branch. Then run live `ax sync`. Candidate
validation, recoverable apply, and post-apply validation form the activation
gate.

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
