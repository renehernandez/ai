## Why

`ax` is currently exposed as a repo-local package script. That works
inside the AI repo, but it pushes agents working in other projects toward ad
hoc direct script invocations against the AI checkout. The centralized runtime
should instead have a first-class global command whose implementation and
default config resolve to the durable AI repo while repo-local operations target
the caller's current project.

`ax openspec install` also currently runs upstream OpenSpec
non-interactively with explicit tools, which skips the project-context
configuration that makes OpenSpec useful for future artifact generation. It
also inherits ambient OpenSpec global config for workflow generation, so the
same repo command can produce different generated assets on different machines.

## What Changes

- Make `ax openspec install` a first-time setup command that runs
  only for missing OpenSpec state.
- Add globally linked `ax` packaging and explicit source root,
  config path, target root, and executable path resolution.
- Add a read-only top-level `ax status` command for global runtime
  installation health and current target OpenSpec readiness.
- Add shared OpenSpec state classification for missing, configured, and partial
  setup, with path-level repair findings before backup or mutation.
- Add guided first-time config confirmation with a headless
  `--context-file` path.
- Keep normal `ax openspec update` asset-focused and quiet, while
  supporting optional config review with `--review-config`.
- Run upstream OpenSpec generation with deterministic runtime inputs isolated
  from ambient global OpenSpec config.
- Extend validation to cover repo-local config quality as well as generated
  asset normalization.
- Update docs, CLI help, and runtime guidance for the new lifecycle.

## Capabilities

### New Capabilities

- `ax-cli`: expose and resolve a globally linked runtime command.
- `ax-status`: report global runtime health and target project
  readiness.

### Modified Capabilities

- `ax-openspec`: refine install/update semantics, deterministic
  generation inputs, guided repo-local config handling, and validation.

## Impact

- `package.json`
- any new executable wrapper used by the global `ax` bin
- `scripts/ax.ts`
- `agent-runtime.config.json`
- `tests/unit` and `tests/integration` runtime fixtures
- `AGENTS.md`, `skills/ax-cli/SKILL.md`, and possibly shared
  command/runtime rules
- OpenSpec runtime validation and status output
