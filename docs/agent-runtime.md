# Agent Runtime CLI

`agent-runtime` manages shared local agent runtime surfaces from this durable AI
repo. Inside this repo, use the package script:

```bash
pnpm agent-runtime <scope> <command>
```

From another project, use the globally linked `agent-runtime` binary when it is
installed. The global binary still uses this repo as the source root and this
repo's `agent-runtime.config.json` by default. Repo-local scopes such as
`openspec` target the current working directory where the command is invoked.

Run the top-level status command from any target repo to verify the whole
installation:

```bash
agent-runtime status
```

It reports source root, config path, target root, executable link health,
skills, instructions, reusable scripts, hooks, and target OpenSpec readiness.

## OpenSpec Lifecycle

Use `agent-runtime openspec install` only when the target repo has no
repo-local OpenSpec footprint. Use `agent-runtime openspec update` for already
configured repos.

Headless first-time install requires confirmed project context:

```bash
agent-runtime openspec install --context-file ./openspec-context.md
```

Interactive install shows a preview and asks before writing
`openspec/config.yaml`. The wrapper writes confirmed repo config before running
upstream OpenSpec generation, isolates upstream global config in a temporary
config home, preserves the confirmed repo config, and normalizes generated
skills and commands into managed canonical locations.

Normal update is asset-focused. If validation says generated assets and symlinks
are current, update exits without backups or upstream generation. To review
config context and artifact-rule changes, opt in:

```bash
agent-runtime openspec update --review-config
agent-runtime openspec update --review-config --accept-config-changes
```

Without `--accept-config-changes`, headless config review prints the proposed
merged config and writes nothing.

## Validation

Run validation after every install, update, or config review:

```bash
agent-runtime openspec validate
```

Validation checks repo config quality, known schema and artifact rules, bounded
context size, reusable runtime script sources, generated asset targets, and
managed symlink normalization.

For shared skills, `agent-runtime skills validate` and the top-level
`agent-runtime validate` also check local managed skill imports of reusable
runtime scripts. If a local managed skill imports `../../../scripts/<file>.ts`,
that script must be declared under `runtime.reusableScripts`.

## Refreshing Shared Runtime Surfaces

After changing shared runtime sources in this repo, refresh the installed
surface before treating the change as live:

```bash
pnpm agent-runtime skills update --profile personal
pnpm agent-runtime skills update --profile work
pnpm agent-runtime skills status --profile personal
pnpm agent-runtime skills status --profile work
```

Use the matching `instructions`, `hooks`, or `openspec` scope for other source
surfaces, then run the corresponding `status` or `validate` command.
