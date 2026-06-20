## Context

`agent-runtime` already has an OpenSpec scope that invokes upstream
`openspec init . --tools codex,claude`, normalizes generated skills into
`.agents/skills`, normalizes Claude commands into `.agents/commands`, and
validates symlink state.

The gap is first-time project setup quality. Passing `--tools` disables
upstream interactivity, and non-interactive upstream init skips
`openspec/config.yaml` unless forced. Without a real config file, future
`openspec instructions` calls do not receive project context or artifact rules.
The current wrapper also inherits user-level OpenSpec global config for profile,
delivery, and workflows.

## Goals / Non-Goals

**Goals:**

- Add shared OpenSpec state classification for missing, configured, and partial
  setup.
- Make `install` first-time only.
- Keep `update` as configured-project reconciliation and optional config review.
- Create repo-local `openspec/config.yaml` from confirmed setup values.
- Isolate upstream OpenSpec generation from ambient global config.
- Validate config quality and generated asset normalization.
- Update docs and CLI help for the new lifecycle.

**Non-Goals:**

- Install or update the global `@fission-ai/openspec` package.
- Manage multiple repositories in one command.
- Create project-local OpenSpec schemas.
- Change upstream OpenSpec templates.
- Add a separate `configure` command.
- Start implementation before planning review is complete.

## Decisions

### Use A Shared State Report

Add one `inspectOpenSpecState` helper that returns an `OpenSpecStateReport`.
`install`, `update`, `status`, and `validate` should consume that report instead
of re-deriving setup state independently.

Alternative considered: keep local checks inside each command. That is simpler
initially, but the install/update/status/validate boundary is central to this
change and would drift quickly.

### Treat Assets-Only And Config-Only As Partial

Configured state requires both `openspec/config.yaml` and normalized generated
assets for the selected tools. Any OpenSpec footprint that fails required
invariants is partial and must produce repair-oriented findings.

Alternative considered: treat existing managed assets as configured. That keeps
the current wrapper closer to its existing behavior, but it preserves the
missing-config problem that triggered this change.

### Keep Normal Update Quiet

`update` should refresh generated assets and validate. It should not propose
context or artifact-rule changes unless `--review-config` is passed.

Alternative considered: always infer config improvements on update. That would
make update noisy for repos with intentionally minimal config and would require
durable skip/provenance tracking in the first slice.

### Use Explicit Headless Acceptance Flags

Use `install --accept-inferred-config` for non-interactive first-time setup and
`update --review-config --accept-config-changes` for non-interactive config
review. Without those flags, headless commands must not block on prompts or
write inferred config changes.

Alternative considered: reuse `--yes`. The more specific flags are clearer
because they describe exactly which inferred writes are being accepted.

### Isolate Upstream Global Config

Build upstream OpenSpec invocations through a helper that writes a temporary
OpenSpec global config under a temporary `XDG_CONFIG_HOME`. Pass upstream flags
only where the current CLI supports them, such as `init --tools` and
OpenSpec's own `--profile`; rely on isolated global config for delivery and
workflow selection.

Alternative considered: mutate the user's real `~/.config/openspec/config.json`
before generation and restore it afterward. That touches user-level state and is
unnecessary for deterministic repo-local generation.

### Keep Command Handler Thin

Keep `runOpenSpec` as orchestration and extract helpers for state inspection,
project-signal collection, default inference, config review, config merging,
and upstream invocation construction.

Alternative considered: implement all logic inline in `runOpenSpec`. That would
make the command path harder to test and would duplicate logic between command
modes.

## Risks / Trade-offs

- Prompt UX can become noisy -> show one review screen and require explicit
  config-review mode on update.
- Upstream OpenSpec CLI can change -> use an argv/env-recording fake in tests
  and keep current CLI behavior covered.
- Generated context can become stale -> preserve non-empty confirmed values by
  default and require current-run confirmation for replacements.
- Failed generation can leave partial state -> stage config writes and report
  partial setup with repair findings.
- Tool selection is configurable -> validation must resolve expected assets from
  config instead of assuming Codex and Claude always exist.

## Migration Plan

1. Land the plan as an OpenSpec change and complete planning review before
   implementation.
2. Implement state classification first so command boundaries are explicit.
3. Add guided install config and deterministic generation.
4. Add bounded context/rule inference and optional update config review.
5. Extend validation and docs after command behavior stabilizes.

Rollback is local to the repo: revert the implementation commits and regenerate
OpenSpec assets through the current `agent-runtime openspec install|update`
behavior.

## Open Questions

- Whether project context should eventually record generated provenance remains
  deferred. This change uses preserve-by-default without durable ownership
  metadata.
