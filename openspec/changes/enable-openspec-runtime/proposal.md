## Why

OpenSpec is now part of the planning workflow for this repo, but its generated
Codex and Claude assets are repo-local scaffolding rather than shared global
skills. Managing that setup by hand makes each repo enablement easy to drift and
harder for agents to repeat.

## What Changes

- Add an `openspec` scope to `agent-runtime` with `install`, `update`,
  `validate`, and `status` commands.
- Run OpenSpec generation for Codex and Claude against the current repository.
- Normalize generated OpenSpec skills into repo-local `.agents/skills` and
  replace `.codex/skills` and `.claude/skills` OpenSpec entries with relative
  symlinks.
- Normalize generated Claude `opsx` commands into repo-local
  `.agents/commands` and replace `.claude/commands/opsx` entries with relative
  symlinks.
- Report missing or stale OpenSpec local scaffolding through status and
  validation output.

## Capabilities

### New Capabilities

- `agent-runtime-openspec`: repo-local OpenSpec initialization, update,
  normalization, status, and validation through `agent-runtime`.

### Modified Capabilities

None.

## Impact

- `scripts/agent-runtime.ts` gains a new runtime scope and OpenSpec-specific
  normalization helpers.
- `agent-runtime.config.json` declares the repo-local OpenSpec tool targets and
  canonical `.agents` folders.
- Tests cover command parsing, fixture-backed OpenSpec generation, symlink
  normalization, validation, and status output.
- Documentation explains that OpenSpec-generated assets are repo-local and are
  not installed into global `~/.agents/skills` or moved into this repo's shared
  `skills/` directory.
