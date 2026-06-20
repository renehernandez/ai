## Why

`agent-runtime openspec install` currently runs upstream OpenSpec
non-interactively with explicit tools, which skips the project-context
configuration that makes OpenSpec useful for future artifact generation. It
also inherits ambient OpenSpec global config for workflow generation, so the
same repo command can produce different generated assets on different machines.

## What Changes

- Make `agent-runtime openspec install` a first-time setup command that runs
  only for missing OpenSpec state.
- Add shared OpenSpec state classification for missing, configured, and partial
  setup, with path-level repair findings.
- Add guided first-time config confirmation with a headless
  `--accept-inferred-config` path.
- Keep normal `agent-runtime openspec update` asset-focused and quiet, while
  supporting optional config review with `--review-config`.
- Run upstream OpenSpec generation with deterministic runtime inputs isolated
  from ambient global OpenSpec config.
- Extend validation to cover repo-local config quality as well as generated
  asset normalization.
- Update docs, CLI help, and runtime guidance for the new lifecycle.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-runtime-openspec`: refine install/update semantics, deterministic
  generation inputs, guided repo-local config handling, and validation.

## Impact

- `scripts/agent-runtime.ts`
- `agent-runtime.config.json`
- `tests/unit` and `tests/integration` runtime fixtures
- `AGENTS.md` and possibly shared command/runtime rules
- OpenSpec runtime validation and status output
