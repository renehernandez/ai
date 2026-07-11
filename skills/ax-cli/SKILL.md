---
name: ax-cli
description: Use when managing local Agents Experience assets with the ax CLI, including authoritative runtime sync, shared skills, instructions, hooks, organizational agents, coordinator control projects, profiles, repo-local OpenSpec scaffolding, or runtime validation.
allowed-tools: Read, Grep, Bash(ax:*), Bash(git:*), Bash(pnpm:*)
---

# AX CLI

## Overview

AX treats tracked `ax.config.json` as authoritative desired state. Inside the AI
repo, use `pnpm ax ...`; from another project, use the AX-managed
`~/.local/bin/ax` shim. `sync` is the only runtime-content mutation command;
`coordinators register` records manually resolved saved-project IDs. `status`
and `validate` are offline and read-only.

Shim `install`, `status`, and `uninstall` manage only the executable shim. They
never synchronize runtime content.

## Commands

| Need | In this repo | Through the shim |
| --- | --- | --- |
| All runtime surfaces | `pnpm ax sync` | `ax sync` |
| Skills only | `pnpm ax skills sync` | `ax skills sync` |
| Instructions and rules only | `pnpm ax instructions sync` | `ax instructions sync` |
| Hooks only | `pnpm ax hooks sync` | `ax hooks sync` |
| Organizational agents only | `pnpm ax agents sync` | `ax agents sync` |
| Coordinator projects only | `pnpm ax coordinators sync` | `ax coordinators sync` |
| Record saved-project IDs | `pnpm ax coordinators register --delivery-project-id <id> --operations-project-id <id>` | `ax coordinators register --delivery-project-id <id> --operations-project-id <id>` |
| Repo-local OpenSpec | `pnpm ax openspec sync` | `ax openspec sync` |
| Inspect runtime structure | `pnpm ax status` / `pnpm ax validate` | `ax status` / `ax validate` |
| Manage the executable shim | `pnpm ax shim <command>` | Use the durable AI repo |

Run the matching `validate` command after a scoped sync. Top-level `ax sync`
validates every installed runtime surface before returning success.

## Authoritative runtime sync

Runtime selection comes from `runtime.installedProfiles` and
`runtime.policyProfile` in `ax.config.json`. Change the tracked config when the
machine should install a different profile set or policy profile. Runtime sync
has no selection, adoption, or ownership flags.

AX builds and validates every candidate before touching live targets. It then:

- replaces every exact skill, instruction, hook, agent, and coordinator target
  declared by the selected profiles;
- removes exact skill names listed in `runtime.retiredSkills`;
- recreates configured Codex and Claude symlinks; and
- leaves unrelated files and skills outside those declared targets untouched.

General runtime sync does not retain backups or require recovery decisions. The
two coordinator child targets are the exception: each carries a hashed
ownership inventory so AX can refuse unmanaged or locally modified content.
Their saved Codex project identities live in
`~/.agents/runtime/control-projects.json`. If a sync is interrupted, rerun `ax
sync`. The source cache remains disposable.

AX resolves each latest configured remote ref once per invocation and builds matching
entries from that snapshot. A resolved commit may appear in command output but
does not control later synchronization.

## Status and validation

`status` and `validate` are offline and read-only. They verify structural state:

- every configured target exists;
- configured links point to their canonical targets; and
- explicitly retired skill paths are absent.

They do not fetch remote refs. General surfaces remain structural; coordinator
validation also checks each exact child's ownership inventory, policy hash, and
optional saved-project registration. Run `ax sync` to restore authoritative
source content.

For the agents surface, sync compiles the tracked manifest, shared contract,
role charters, reviewer overlays, and schemas into Codex TOML. The configured
canonical directory owns the rendered tree. AX refuses unmanaged agent targets
before apply. Agent validate checks source semantics in addition to runtime
structure; agent status remains structural.

For the coordinator surface, sync renders pinned prompt bundles into the exact
`delivery` and `operations` saved-project roots with read-only permissions and
a standalone policy hook. AX preserves siblings of those child roots. After
post-merge sync and manual saved-project creation, resolve both IDs with Codex
`list_projects`, then run `ax coordinators register` before activation.

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

Configured `~/...` coordinator targets follow the isolated `HOME`. If another
target is absolute, use a proof-only config whose targets are isolated. AX
rejects live-root mutation from a feature branch, dirty source, or disposable
worktree. Post-merge, run `ax sync` from a verified clean default-branch source
to activate the merged runtime.

## Portable skill boundary

Keep AX command and runtime-path steering in this skill. Other portable skills
keep runnable helpers inside their own directory or use a real package
dependency.

## Test Evidence

- RED activation guidance had no saved-project registration command, so a
  coordinator could proceed from a generated directory and hand-supplied ID.
- GREEN routes both unique `list_projects` path matches through `ax
  coordinators register` and requires coordinator validation before activation.
- REFACTOR keeps feature-branch proof under isolated HOME/runtime roots and
  forbids editing generated children or registration state directly.

## Common mistakes

| Mistake | Correct action |
| --- | --- |
| Editing an installed runtime copy | Edit the AI repo source, then run `ax sync`. |
| Passing profile flags to sync | Update `runtime.installedProfiles` and `runtime.policyProfile`. |
| Expecting status to fetch a remote | Run sync when remote freshness matters. |
| Expecting general validate to compare source content | Run sync to restore general surfaces; coordinator validate separately checks its owned inventory. |
| Editing generated Codex agent TOML | Edit `agents/` in the AI repo and run agent sync. |
| Editing a generated coordinator child | Edit `coordinator-projects/` or the renderer, then run coordinator sync. |
| Hand-editing `control-projects.json` | Resolve unique ID/path matches with `list_projects`, then use `ax coordinators register`. |
| Activating before saved-project registration | Register both current project IDs and validate the coordinator surface first. |
| Running raw upstream OpenSpec setup | Use repo-local `ax openspec sync`. |
| Activating live roots from feature work | Use isolated roots and activate after merge. |
