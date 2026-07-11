---
name: ax-cli
description: Use when managing local Agents Experience assets with the ax CLI, including authoritative runtime sync, shared skills, instructions, hooks, organizational agents, profiles, repo-local OpenSpec scaffolding, or runtime validation.
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
| All runtime surfaces | `pnpm ax sync` | `ax sync` |
| Skills only | `pnpm ax skills sync` | `ax skills sync` |
| Instructions and rules only | `pnpm ax instructions sync` | `ax instructions sync` |
| Hooks only | `pnpm ax hooks sync` | `ax hooks sync` |
| Organizational agents only | `pnpm ax agents sync` | `ax agents sync` |
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

- replaces every exact skill, instruction, hook, and agent target declared by the
  selected profiles;
- removes exact skill names listed in `runtime.retiredSkills`;
- recreates configured Codex and Claude symlinks; and
- leaves unrelated files and skills outside those declared targets untouched.

Runtime sync does not create a local ownership manifest, retain runtime
backups, or require recovery decisions. If a sync is interrupted, rerun
`ax sync`. The runtime cache under `~/.agents/runtime/cache` is disposable.

AX resolves each latest configured remote ref once per invocation and builds matching
entries from that snapshot. A resolved commit may appear in command output but
does not control later synchronization.

## Status and validation

`status` and `validate` are offline and read-only. They verify structural state:

- every configured target exists;
- configured links point to their canonical targets; and
- explicitly retired skill paths are absent.

They do not fetch remote refs or compare installed file contents. Run `ax sync`
to restore the authoritative source content.

For the agents surface, sync compiles the tracked manifest, shared contract,
role charters, reviewer overlays, and schemas into Codex TOML. The configured
canonical directory owns the rendered tree. AX refuses unmanaged agent targets
before apply. Agent validate checks source semantics in addition to runtime
structure; agent status remains structural.

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

## Portable skill boundary

Keep AX command and runtime-path steering in this skill. Other portable skills
keep runnable helpers inside their own directory or use a real package
dependency.

## Common mistakes

| Mistake | Correct action |
| --- | --- |
| Editing an installed runtime copy | Edit the AI repo source, then run `ax sync`. |
| Passing profile flags to sync | Update `runtime.installedProfiles` and `runtime.policyProfile`. |
| Expecting status to fetch a remote | Run sync when remote freshness matters. |
| Expecting validate to detect content drift | Run sync to restore source content; validate checks structure. |
| Editing generated Codex agent TOML | Edit `agents/` in the AI repo and run agent sync. |
| Running raw upstream OpenSpec setup | Use repo-local `ax openspec sync`. |
| Activating live roots from feature work | Use isolated roots and activate after merge. |
