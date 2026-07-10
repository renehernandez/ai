---
name: ax-cli
description: Use when managing local Agents Experience assets with the ax CLI, including runtime sync, profiles, adoption, recovery, shared skills, instructions, hooks, repo-local OpenSpec scaffolding, or runtime validation.
allowed-tools: Read, Grep, Bash(ax:*), Bash(git:*), Bash(pnpm:*)
---

# AX CLI

## Overview

AX converges reusable agent assets from declared source state. Inside the AI
repo, use `pnpm ax ...`; from another project, use the AX-managed
`~/.local/bin/ax` shim. `sync` is the only runtime-content mutation command.
`status` and `validate` are offline and read-only.

Shim `install`, `status`, and `uninstall` manage only the executable shim; they
never synchronize runtime content.

## First Move

1. Run `git status --short --branch` and `ax status` before mutation.
2. Choose the narrowest applicable command from the table below.
3. Inspect unfamiliar flags with `pnpm ax <scope> <command> --help`.
4. Run the matching `validate` command after every successful sync.

| Need | Command in this repo | Command through the shim |
| --- | --- | --- |
| All selected runtime surfaces | `pnpm ax sync` | `ax sync` |
| Skills only | `pnpm ax skills sync` | `ax skills sync` |
| Instructions and rules only | `pnpm ax instructions sync` | `ax instructions sync` |
| Hooks only | `pnpm ax hooks sync` | `ax hooks sync` |
| Repo-local OpenSpec | `pnpm ax openspec sync` | `ax openspec sync` |
| Inspect without mutation | `pnpm ax status` / `pnpm ax validate` | `ax status` / `ax validate` |
| Manage the executable shim | `pnpm ax shim <command>` | Use the durable AI repo |

Scoped skills, instructions, and hooks syncs require an existing valid runtime
manifest. They reuse its installed profiles and policy profile, cannot change
that selection, and report `runtime_not_initialized` before first top-level
sync. OpenSpec is repo-local and targets the invocation working directory.
Top-level runtime sync never mutates OpenSpec files.

## Desired State And Local Ownership

Tracked `ax.config.json` is desired state. Local
`~/.agents/runtime/managed-runtime.json` is AX ownership state. The filesystem
is observed state.

The local manifest stores its schema and canonical hash versions, installed
profiles, one `policyProfile`, AX-owned paths, and content hashes. It does not
duplicate source URLs, refs, resolved SHAs, timestamps, cache paths,
transactions, or tracked configuration. Do not create or consult a tracked
runtime lock file.

Every identity-bearing manifest, authorization file, journal, backup, and
recovery file uses `sha256-tree-v1`; an unknown hash version blocks before
mutation.

AX resolves each latest configured remote ref once per invocation and builds
all matching entries from one immutable snapshot. A resolved SHA is diagnostic
output and is not persisted. Local clean sources use their Git tree; dirty or
arbitrary sources must remain content-identical before, during, and after the
candidate copy. Runtime caches are disposable and never prove ownership.

## Profiles And Policy

The first interactive `ax sync` previews available profiles and records the
confirmed installed set plus one policy profile from that set. First headless
sync must provide `--profile <name>` or `--all-profiles` together with
`--policy-profile <name>`.

Repeat `--profile` to select several profiles, for example:
`pnpm ax sync --profile personal --profile work --policy-profile work`. Use
`--all-profiles` only when every configured profile is intended.

Later interactive selection changes require confirmation. Later headless
changes require `--profile-selection-file <path>` bound to the current manifest
hash and containing the complete replacement installed set and one policy
profile. A missing, duplicated, or uninstalled policy profile blocks with
`policy_profile_ambiguous`.

## Adoption And Recovery

When no manifest exists but legacy content does, top-level sync previews
exact-hash `manage`, `replace-managed`, and `remove` actions. Confirm every
action interactively or pass `--adoption-file <path>` with exact paths, hashes,
and actions. Hash drift or an unapproved occupied path remains an unmanaged
collision; replacement and removal create verified backups first.

Read-only inspection reports incomplete transactions without recovering them.
The next mutating sync recovers hash-matching old or candidate state. If AX
reports `recovery_conflict` or `recovery_failed`, use
`ax sync --recovery-file <path>` with exact current hashes and an action for
every affected path. OpenSpec recovery uses
`ax openspec sync --recovery-file <path>`. Never overwrite content whose hash
matches neither journal state. Successful changes retain seven verified
backups per asset and target.

## Repo-Local OpenSpec

Run `ax openspec status` to classify the current repository as missing,
configured, repairable partial, or context-required partial. Use
`ax openspec sync` for every mutating state:

- Missing or context-required partial state previews inferred context in a TTY;
  headless use requires `--context-file <path>`.
- Configured state refreshes only drifted assets. Use `--review-config`, plus
  `--accept-config-changes` only for an authorized headless config change.
- Repairable partial state reconstructs generated assets from valid config.

AX resolves `openspec` from PATH, reports its version, and does not manage that
CLI package. It validates the complete candidate before a repository-scoped
transaction, refuses unrelated dirty-path overwrites, and keeps repository
paths out of the local runtime manifest. Finish with `ax openspec validate`.

## Feature Work And Activation

Pre-merge feature work must bind both HOME-expanded targets and AX state to
isolated runtime roots. Keep the same values for every proof command:

```bash
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> status
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> sync --all-profiles --policy-profile work
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> validate
```

This isolates manifests, caches, transactions, backups, profiles, skills,
instructions, and hooks when configured targets use `~`. If a target is
absolute, point `--config <path>` at a proof-only config whose targets are also
isolated. AX rejects live-root mutation from a feature branch, dirty source, or
disposable worktree with `unverified_live_source`.

After merge, verify a clean default-branch source; post-merge activation is an
ordinary `ax sync`. Candidate validation, transactional apply or rollback, and
post-apply validation are the activation gate.

## Portable Skill Boundary

Keep AX command and runtime-path steering in this skill. Other portable skills
keep runnable helpers inside their own directory or use a real package
dependency; they do not depend on unrelated repo-root workflow scripts.

## Common Mistakes

| Mistake | Correct action |
| --- | --- |
| Editing installed runtime copies | Edit source, then run the matching sync and validate commands. |
| Passing profile flags to a scoped sync | Change selection only through top-level sync. |
| Expecting status to fetch a remote | Treat freshness as unknown until sync; status stays offline. |
| Running raw upstream OpenSpec setup | Use repo-local `ax openspec sync`. |
| Activating live roots from feature work | Use isolated runtime roots; activate only after merge. |
