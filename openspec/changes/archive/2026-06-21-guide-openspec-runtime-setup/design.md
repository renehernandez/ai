## Context

`ax` is currently invoked as a package script from the AI repo:
`pnpm ax ...`. That makes centralized runtime behavior easy inside
the repo but awkward from arbitrary target projects, where agents can drift
into direct script execution against the AI checkout.

`ax` already has an OpenSpec scope that invokes upstream
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

- Add globally linked `ax` packaging backed by the durable AI repo.
- Resolve source root, config path, target root, and executable path explicitly.
- Add read-only top-level `ax status` for global installation health
  and current target project readiness.
- Add shared OpenSpec state classification for missing, configured, and partial
  setup before any backup or mutation.
- Make `install` first-time only.
- Keep `update` as configured-project reconciliation and optional config review.
- Create repo-local `openspec/config.yaml` from confirmed setup values.
- Isolate upstream OpenSpec generation from ambient global config.
- Validate config quality and generated asset normalization.
- Update docs and CLI help for the new lifecycle.

**Non-Goals:**

- Install or update the global `@fission-ai/openspec` package.
- Manage multiple repositories in one command.
- Discover or honor per-repo `agent-runtime.config.json` by default.
- Publish `ax` to a package registry.
- Compile a `dist` build for the global CLI.
- Create project-local OpenSpec schemas.
- Change upstream OpenSpec templates.
- Add a separate `configure` command.
- Start implementation before planning review is complete.

## Decisions

### Use A Globally Linked Runtime Command

Expose `ax` as a globally linkable package bin from the durable AI
repo. Global invocations use the AI repo implementation and default
`agent-runtime.config.json`, while repo-local scopes such as `openspec` target
`process.cwd()`.

Alternative considered: continue using `pnpm exec tsx /path/to/ai/scripts`.
That is technically centralized, but it is invisible as an installed runtime
surface and easy for agents to invoke with the wrong config or target root.

### Keep Source, Config, And Target Roots Separate

Add a runtime invocation context that records:

- source root: the linked AI repo package root;
- config path: source root `agent-runtime.config.json` unless `--config` is
  passed;
- target root: current working directory for repo-local scopes;
- executable path: the invoked global command path when available.

The CLI must not auto-discover a target repo's config in this slice. That keeps
the mental model simple and avoids hidden per-repo behavior.

### Add A Top-Level Runtime Status

Top-level `ax status` should be read-only and report global runtime
health: roots, executable/link state, profiles, instructions, skills, reusable
scripts, hooks, and current target OpenSpec state. Missing OpenSpec in the
target project is actionable target readiness, not a broken global runtime.

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

### Use A Context File For Headless First-Time Install

Use `install --context-file <path>` for non-interactive first-time setup and
`update --review-config --accept-config-changes` for non-interactive config
review. A context file preserves the invariant that project context is confirmed
before files are written. Without confirmed context, headless install must fail
before mutation.

Alternative considered: `install --accept-inferred-config`. That accepts
machine-generated project context without a human confirmation artifact, which
weakens the behavior that triggered this change.

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
- Failed generation can leave partial state -> stage writes, stabilize or
  restore config/assets/symlinks where possible, and report repair findings.
- Tool selection is configurable -> validation must resolve expected assets from
  config instead of assuming Codex and Claude always exist.
- Global binary can point at a stale checkout -> top-level status reports link
  health and source root.
- Source/config/target roots can be confused -> print them in status and install
  previews and test linked invocation from fixture targets.

## Migration Plan

1. Land the plan as an OpenSpec change and complete planning review before
   implementation.
2. Implement global CLI packaging and runtime root resolution first.
3. Add top-level runtime status.
4. Implement state classification so command boundaries are explicit before
   mutation.
5. Add guided install config and deterministic generation.
6. Add bounded context/rule inference and optional update config review.
7. Extend validation and docs after command behavior stabilizes.

Rollback is local to the repo: revert the implementation commits and regenerate
OpenSpec assets through the current `ax openspec install|update`
behavior.

## Open Questions

- Whether project context should eventually record generated provenance remains
  deferred. This change uses preserve-by-default without durable ownership
  metadata.
