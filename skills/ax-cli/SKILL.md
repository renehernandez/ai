---
name: ax-cli
description: Use when managing local Agents Experience assets with the ax CLI, including authoritative runtime sync, managed tool configs, shared skills, instructions, hooks, profiles, repo-local OpenSpec scaffolding, or runtime validation.
allowed-tools: Read, Grep, Bash(ax:*), Bash(git:*), Bash(pnpm:*)
---

# AX CLI

## Overview

AX treats tracked `ax.config.json` as authoritative desired state. Inside the AI
repo, use `pnpm ax ...`; from another project, use the AX-managed
`~/.local/bin/ax` shim. `sync` is the only runtime-content mutation command.
`status` and `validate` are offline and read-only.

Shim `install`, `status`, and `uninstall` manage only the executable shim. They
never synchronize runtime content.

## Commands

| Need | In this repo | Through the shim |
| --- | --- | --- |
| Initialize or switch profile | `pnpm ax sync --profile <name>` | `ax sync --profile <name>` |
| All runtime surfaces | `pnpm ax sync` | `ax sync` |
| Skills only | `pnpm ax skills sync` | `ax skills sync` |
| Instructions and rules only | `pnpm ax instructions sync` | `ax instructions sync` |
| Hooks only | `pnpm ax hooks sync` | `ax hooks sync` |
| Managed tool configs only | `pnpm ax configs sync` | `ax configs sync` |
| Repo-local OpenSpec | `pnpm ax openspec sync` | `ax openspec sync` |
| Inspect runtime structure | `pnpm ax status` / `pnpm ax validate` | `ax status` / `ax validate` |
| Manage the executable shim | `pnpm ax shim <command>` | Use the durable AI repo |

Run the matching `validate` command after a scoped sync. Top-level `ax sync`
validates every installed runtime surface before returning success.

## Authoritative runtime sync

Tracked `ax.config.json` defines available profiles. Each machine stores one
selected profile in `<runtime-root>/selected-profile.json`; that profile owns
both installed assets and workflow policy. Initialize or switch with `ax sync
--profile <name>`. Plain `ax sync` reuses the persisted selection. Scoped sync
commands require that selection and never change it.

An uninitialized top-level sync fails before source resolution and lists the
available profile names. AX never silently selects a profile and does not
provide multiple-profile, policy-profile, adoption, or ownership flags.

AX builds and validates every candidate before touching live targets. It then:

- replaces every exact skill, instruction, and hook target declared by the
  selected profile;
- removes paths owned only by the previous profile during a switch;
- removes exact skill names listed in `runtime.retiredSkills`;
- recreates configured Codex and Claude symlinks; and
- converges exact managed Codex TOML leaves while preserving unowned values;
- leaves unrelated files and skills outside those declared targets untouched.

Runtime replacement and profile selection use the existing AX transaction
engine. The selected profile is committed last; a failed switch restores the
previous profile-owned runtime and selection. If a sync is interrupted, rerun
`ax sync`. The source cache remains disposable.

AX resolves each latest configured remote ref once per invocation and builds matching
entries from that snapshot. A resolved commit may appear in command output but
does not control later synchronization.

## Status and validation

`status` and `validate` are offline and read-only. They verify structural state:

- every configured target exists;
- configured links point to their canonical targets; and
- explicitly retired skill paths are absent.

They do not fetch remote refs. Run `ax sync` to restore authoritative source
content.

## Managed tool configs

`runtime.configs` currently manages six exact leaves inside
`~/.codex/config.toml`: `features.memories`, both
`features.multi_agent_v2` values, `agents.max_depth`, and both `memories`
values. Parent tables are grouping only. All other TOML values and unowned
source text remain machine-local and are preserved.

Use `pnpm ax configs status` to report path-specific drift,
`pnpm ax configs sync` to converge the tracked leaves, and
`pnpm ax configs validate` for read-only drift plus Codex config-loader
validation. Sync validates a complete temporary candidate, detects concurrent
Codex Desktop writes, and atomically replaces only a safe regular-file target.
Do not hand-edit a managed config leaf; update `ax.config.json` instead.

## Repo-local OpenSpec

OpenSpec remains repository-scoped and transactionally managed. Run
`ax openspec status` to classify the invocation repository, then use
`ax openspec sync` for mutation:

- Missing or context-required partial state needs `--context-file <path>` in
  headless use.
- Configured state refreshes drifted assets. Use `--review-config` and
  `--accept-config-changes` only for an authorized headless config change.
- Repairable partial state reconstructs generated assets from valid config.

AX resolves `openspec` from PATH and does not manage that package. Finish with
`ax openspec validate`.

## Feature work and activation

Before merge, use isolated HOME and runtime roots for targets and the cache:

```bash
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> status
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> sync
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> validate
```

If a target is absolute, use a proof-only config whose targets are isolated.
AX rejects live-root mutation from a feature branch, dirty source, or disposable
worktree. Post-merge, run `ax sync` from a verified clean default-branch source
to activate the merged runtime.

`--runtime-root` does not redirect tool configs. Feature-branch config proof
must use both an isolated HOME and an isolated runtime root; AX rejects an
unverified source that still resolves the Codex target under the live home.

## Portable skill boundary

Keep AX command and runtime-path steering in this skill. Other portable skills
keep runnable helpers inside their own directory or use a real package
dependency.

## Test Evidence

- RED retrieval against the prior skill routed an urgent multi-project delivery
  through organizational-agent and coordinator commands, adding a control-plane
  hop before useful work.
- GREEN retrieval exposes only the retained generic runtime surfaces while the
  shared instructions still allow semantically eligible units to run
  concurrently in singly owned worktrees.
- REFACTOR removes the obsolete command rows and recovery advice, retires the
  `agent-workspace` package through tracked config, and regression-tests that
  the removed commands and hierarchy cannot be retrieved.
- RED retrieval checks showed no command or ownership guidance for managed
  Codex config leaves.
- GREEN retrieves the three `configs` commands, exact-leaf ownership,
  installed config-loader validation, unowned-value preservation, and dual-root
  isolation from this skill.

## Common mistakes

| Mistake | Correct action |
| --- | --- |
| Editing an installed runtime copy | Edit the AI repo source, then run `ax sync`. |
| Editing tracked config to select this machine's profile | Run `ax sync --profile <name>` once, then use plain `ax sync`. |
| Passing a profile flag to scoped sync | Initialize or switch with top-level `ax sync --profile <name>`. |
| Expecting status to fetch a remote | Run sync when remote freshness matters. |
| Expecting general validate to compare source content | Run sync to restore the declared runtime surfaces. |
| Hand-editing a managed Codex config leaf | Edit `runtime.configs.codex.managed` in `ax.config.json`, then run `ax configs sync`. |
| Running raw upstream OpenSpec setup | Use repo-local `ax openspec sync`. |
| Passing only `--runtime-root` for config proof | Also set an isolated HOME; runtime-root selection does not redirect `config.toml`. |
| Activating live roots from feature work | Use isolated roots and activate after merge. |
