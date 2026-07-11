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
instructions, hooks, agents, and `runtime.retiredSkills`.

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
pnpm ax agents sync
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

Scoped `skills`, `instructions`, `hooks`, and `agents` status/validate commands
apply the same offline boundary to one surface. Agent validation additionally
compiles every JSON schema, checks the exact generated-agent inventory, validates
role/profile references, enforces the xhigh automatic ceiling, and verifies the
generated standalone validators.

## Synchronize organizational agents

The tracked `agents/` tree is the canonical source for role charters, reviewer
overlays, schemas, Linear templates, and model profiles. AX compiles that source
into Codex custom-agent TOML while building the candidate:

```bash
pnpm ax agents sync
pnpm ax agents status
pnpm ax agents validate
```

The canonical runtime directory is `~/.agents/agents`. The Codex target
`~/.codex/agents` is an exact symlink to its `codex/` directory. Agent sync
refuses an unmanaged file, directory, or wrong symlink at either configured
target before replacing canonical content. An interrupted run with the exact
expected symlink is recoverable by rerunning sync.

Status remains structural: it verifies the canonical directory and exact link.
Validate also checks the tracked semantic source contract. Use sync to re-render
content after changing the manifest, schemas, role files, or shared contract.

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
instruction, hook, and profile roots. Feature
branches, dirty source, and disposable worktrees cannot target canonical live
runtime roots.

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
- [Agent workspaces](agent-workspaces.md)
- [Repository agent instructions](../AGENTS.md)
