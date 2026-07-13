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
instructions, hooks, agents, coordinator projects, managed tool-config leaves,
and `runtime.retiredSkills`.

AX replaces declared targets on every sync and leaves unrelated filesystem
paths untouched. It stores only a disposable remote-source cache under
`~/.agents/runtime/cache`. The two coordinator targets carry local ownership
markers, and their saved-project IDs live in
`~/.agents/runtime/control-projects.json`; neither file is an orchestration
database or canonical work state.

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
pnpm ax coordinators sync
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

Scoped `skills`, `instructions`, `hooks`, `agents`, `coordinators`, and
`configs` status/validate commands apply the same offline boundary to one
surface. Agent validation additionally compiles every JSON schema, checks the
exact generated output inventory, validates role/profile references, enforces
the xhigh automatic ceiling, and verifies the generated standalone validators.

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

## Synchronize organizational agents

The tracked `agents/` tree is the canonical source for role charters, reviewer
overlays, schemas, Linear templates, and model profiles. AX compiles ephemeral
outputs into Codex custom-agent TOML and pinned outputs into versioned prompt
bundles while building the candidate:

```bash
pnpm ax agents sync
pnpm ax agents status
pnpm ax agents validate
```

The canonical runtime directory is `~/.agents/agents`. The Codex target
`~/.codex/agents` is an exact symlink to its `codex/` directory. Agent sync
replaces the canonical generated directory and refuses an unmanaged file, directory, or wrong symlink at the Codex link target. Keep custom agent source
in this repository, not in the generated canonical directory. An interrupted
run with the exact expected symlink is recoverable by rerunning sync.

Status remains structural: it verifies the canonical directory and exact link.
Validate also checks the tracked semantic source contract. Use sync to re-render
content after changing the manifest, schemas, role files, or shared contract.

## Synchronize coordinator projects

The tracked `coordinator-projects/` source renders two non-Git saved-project
roots:

- `~/work/projects/rene.hernandez/agent-control/delivery`
- `~/work/projects/rene.hernandez/agent-control/operations`

Generate and inspect them with:

```bash
pnpm ax coordinators sync
pnpm ax coordinators status
pnpm ax coordinators validate
```

AX owns only those exact child directories. It preserves sibling paths under
`agent-control` and refuses a child whose hashed inventory differs from its AX
ownership marker. Each project contains a read-only permission profile,
project-local coordinator instructions, pinned prompt bundles, and a standalone
fail-closed `PreToolUse` policy hook. Project-local hooks run only after Codex
marks the saved project trusted.

AX builds both complete candidates before replacing either child. Each child is
published through a temporary sibling path; an interruption leaves the prior
valid child or a missing child, both recoverable by rerunning sync. An inventory
mismatch indicates content changed outside that publication path and requires
the drift procedure below.

After the post-merge live sync, add each child directory as a saved local Codex
project:

1. In Codex Desktop, use the local-project/open-folder action and select the
   exact `delivery` child path, then repeat for `operations`. UI labels can vary
   by app version; verify the canonical path rather than the displayed folder
   name.
2. Mark each project trusted and review the project-local hook when Codex asks.
   Project config and hooks are inactive until that trust is recorded.
3. From the existing bootstrap task, ask: `Use list_projects and return the
   unique projectId and canonical path for the delivery and operations control
   projects.` `list_projects` is a Codex app task tool, not an AX shell command.
   Zero or multiple matches for either exact path block registration.
4. Record the two returned IDs with one explicit command:

```bash
pnpm ax coordinators register \
  --delivery-project-id <delivery-id> \
  --operations-project-id <operations-id>
```

Registration validates both AX markers and records canonical path, project ID,
source fingerprint, policy hash, and registration time. AX cannot query Codex
Desktop from the shell command, so the bootstrap task must first prove each
ID-to-path association with `list_projects`; activation repeats that live check.

Finish with `pnpm ax coordinators validate`. Missing registration is a warning
before first setup; a stale or mismatched registration is a finding and exits
non-zero. A later sync whose generated fingerprint is unchanged preserves the
registration. When the fingerprint changes, rerun `list_projects`, confirm the
same unique path associations, rerun `coordinators register`, and validate
again. If `control-projects.json` is deleted, reconstruct it through this same
procedure; Linear and the generated local markers remain canonical.

If coordinator sync refuses a changed ownership inventory, do not force or
hand-edit the marker. Run `ax coordinators validate`, preserve the complete
changed child by renaming it outside the exact `delivery` or `operations`
target, rerun coordinator sync to regenerate the missing child, and compare the
preserved copy manually. Move any legitimate source change into this
repository's `coordinator-projects/` source or renderer. AX never deletes the
preserved copy.

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
instruction, hook, profile, config, and coordinator roots. Feature branches,
dirty source, and disposable worktrees cannot target canonical live runtime
roots. `--runtime-root` does not redirect `~/.codex/config.toml`; config proof
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
- [Agent workspaces](agent-workspaces.md)
- [Repository agent instructions](../AGENTS.md)
