---
name: ax-cli
description: Use when managing local Agents Experience assets with the ax CLI, including authoritative runtime sync, managed tool configs, shared skills, instructions, hooks, profiles, repo-local OpenSpec scaffolding, or runtime validation.
allowed-tools: Read, Grep, Bash(ax:*), Bash(git:*), Bash(pnpm:*)
---

# AX CLI

Route Agents Experience runtime inspection and authorized synchronization.
Tracked `ax.config.json` is desired state; one persisted selected profile owns
installed assets and workflow policy. In this repository use `pnpm ax`; in
other repositories use the managed `ax` shim.

## Authority and Safety

- `status` and `validate` are offline, structural, and read-only. They do not
  fetch refs or compare installed content with source.
- `sync` is the only runtime-content mutation. It converges exact declared
  targets, removes retired/profile-owned targets, preserves unrelated paths and
  unowned config values, and commits profile selection last.
- Shim install/status/uninstall manages only the executable shim.
- Repo-local OpenSpec is a separate invocation-repository scope.

Load `references/command-routing.md` only when selecting or running a command.
Treat current CLI help as authoritative when a flag or recovery path is not in
that reference.

## Route the Request

Use top-level sync to initialize/switch a profile or converge all surfaces.
Use the skill, instruction, hook, or config scope only when the requested
surface and persisted profile are already known. Use the OpenSpec scope only
for repository-local scaffold/config convergence.

An uninitialized command that needs a profile stops and reports available
profiles; never select silently. Missing CLI/package coverage is a blocker, not
permission to hand-edit installed runtime state.

## Feature-Branch Boundary

Before merge, prove AX behavior with both an isolated HOME and isolated runtime
root. `--runtime-root` does not redirect tool configuration, so either boundary
alone is insufficient. Absolute targets require an isolated proof config.

AX rejects live-root mutation from a feature branch, dirty source, or
disposable worktree. Activate merged changes only from the verified clean
default-branch source according to repository Finish policy. Do not use this
skill to widen merge or deployment authority.

## Escalation and Evidence

Stop before mutation when profile choice, target root, source cleanliness,
OpenSpec context/config acceptance, or exact managed config ownership is
unclear. After an authorized sync, run the matching validation and report the
selected profile, source/ref evidence, scopes changed, validation result, and
unowned state preserved.

Other portable skills keep helpers within their own package; AX command and
runtime-path steering stays here.
