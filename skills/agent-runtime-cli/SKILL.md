---
name: agent-runtime-cli
description: Use when managing local agent runtime assets with the agent-runtime CLI, including shared skills, AGENTS.md/rules instructions, hooks, runtime profiles, repo-local OpenSpec scaffolding, or validation after changing shared agent assets.
allowed-tools: Read, Grep, Bash(git:*), Bash(pnpm:*)
---

# Agent Runtime CLI

## Overview

Use the package-managed CLI, `pnpm agent-runtime ...`, as the entrypoint for
shared runtime assets. Prefer the wrapper over direct script execution, direct
filesystem edits to installed runtime copies, or raw upstream OpenSpec setup.

## First Move

1. Inspect live state before mutation:
   ```bash
   git status --short --branch
   ```
2. Choose the narrowest runtime scope that matches the work.
3. Inspect that scope before mutating it:
   - profile-managed runtime assets: `pnpm agent-runtime status --profile <name>`;
   - skills only: `pnpm agent-runtime skills status --profile <name>`;
   - instructions only: `pnpm agent-runtime instructions status --profile <name>`;
   - hooks only: `pnpm agent-runtime hooks status`;
   - OpenSpec only: `pnpm agent-runtime openspec status`.
4. Run `validate` after every install or update.
5. For unfamiliar options, check current help instead of guessing:
   ```bash
   pnpm agent-runtime <scope> <command> --help
   ```

## Command Selection

| Need | Scope |
| --- | --- |
| All profile-managed runtime assets | top-level `install|update|status|validate --profile <name>` |
| Shared skills | `skills` |
| AGENTS.md/rules instructions | `instructions` |
| Hooks | `hooks` |
| Repo-local OpenSpec scaffolding | `openspec` |
| Drift check without file mutation | `status` or `validate` before `install`/`update` |

Use `install` for first-time runtime setup. Use `update` for already managed
assets. If state is unclear, run `status` first.

## Profile And Config Flags

Runtime profiles select installed skill and instruction surfaces such as
`personal` and `work`.

| Scope | Accepts `--profile` / `--all-profiles` | Notes |
| --- | --- | --- |
| Top-level `install|update|status|validate` | Yes | Applies to skills and instructions; hooks run as configured. |
| `skills` | Yes | Use after changing `skills/**`. |
| `instructions` | Yes | Use after changing `AGENTS.md`, `instructions/**`, or `rules/**`. |
| `hooks` | No | Hook targets come from `agent-runtime.config.json`. |
| `openspec` | No | OpenSpec scaffolding is repo-local, not profile-local. |

`--config <path>` is the shared override when a non-default
`agent-runtime.config.json` is required.

## OpenSpec Setup

Do not run raw `openspec init` for repo-local managed setup. Use:

```bash
pnpm agent-runtime openspec status
pnpm agent-runtime openspec install
pnpm agent-runtime openspec update
pnpm agent-runtime openspec validate
```

State rules:

| State | Meaning | Action |
| --- | --- | --- |
| Missing | No managed OpenSpec footprint exists | `install`, then `validate` |
| Configured | Config and normalized managed assets exist | `update` for refresh, `validate` for proof |
| Partial | Some OpenSpec footprint exists but config or generated assets are incomplete | Report findings; do not overwrite with blind `install` |

When a repo already has OpenSpec files, run `status` and `validate` before any
mutation. Run `install` only when setup is missing. Run `update` for configured
projects or after repair guidance indicates generated assets should refresh.

## After Shared Asset Changes

Refresh every affected installed surface before treating source edits as live:

- `skills/**`: update and validate both `personal` and `work` with
  `pnpm agent-runtime skills ... --profile <name>`.
- `instructions/**`, `rules/**`, or `AGENTS.md`: update and validate both
  profiles with `pnpm agent-runtime instructions ... --profile <name>`.
- `hooks/**`: use `pnpm agent-runtime hooks update`, then
  `pnpm agent-runtime hooks validate`.
- generated OpenSpec skills or commands: use `pnpm agent-runtime openspec
  update`, then `pnpm agent-runtime openspec validate`.

If an update changes installed files, rerun the matching `status` or `validate`
command before finishing.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Running raw `openspec init` in a managed repo | Use `pnpm agent-runtime openspec install` only for missing setup. |
| Passing `--profile` to `openspec` or `hooks` | Use profile flags only on top-level, `skills`, and `instructions` commands. |
| Running `install` on an existing OpenSpec footprint | Run `status` and `validate`; use `update` for configured scaffolding. |
| Editing installed runtime copies directly | Edit source in this repo, then run the matching `agent-runtime ... update`. |
| Calling work complete after source edits only | Refresh installed copies and run profile validation. |
| Guessing flags from memory | Run `pnpm agent-runtime <scope> <command> --help`. |

## Test Evidence

- RED: baseline OpenSpec initialization avoided raw `openspec init`, but still
  listed `install` after `status` despite recognizing the current checkout was
  already configured. The skill now says `install` only when state is missing.
- GREEN control: baseline OpenSpec profile pressure correctly rejected
  `--profile` for `openspec`; this skill preserves that rule in the profile
  table.
- GREEN control: baseline existing-setup pressure correctly chose
  `openspec status` and `validate` before mutation; this skill makes that the
  default path.
- GREEN control: baseline runtime-refresh pressure correctly updated both
  `personal` and `work`; this skill preserves that rule in the shared asset
  table.
- GREEN: with this skill loaded, OpenSpec setup pressure kept `install`
  conditional on missing state and used `update` for configured scaffolding.
- GREEN: with this skill loaded, OpenSpec profile pressure rejected
  `--profile personal` and used repo-local `openspec update` plus validation.
- GREEN: with this skill loaded, shared-skill refresh pressure updated and
  validated both runtime profiles before treating the source change as live.
