---
name: ax-cli
description: Use when managing local Agents Experience assets with the ax CLI, including shared skills, AGENTS.md/rules instructions, hooks, runtime profiles, repo-local OpenSpec scaffolding, or validation after changing shared agent assets.
allowed-tools: Read, Grep, Bash(git:*), Bash(pnpm:*)
---

# AX CLI

## Overview

Use the runtime CLI as the entrypoint for shared runtime assets. Inside this AI
repo, use `pnpm ax ...`. From another target project, use the AX-managed
`~/.local/bin/ax` shim when available. Prefer the wrapper over direct script
execution, direct filesystem edits to installed runtime copies, or raw upstream
OpenSpec setup.

## First Move

1. Inspect live state before mutation:
   ```bash
   git status --short --branch
   ```
2. Choose the narrowest runtime scope that matches the work.
3. Inspect that scope before mutating it:
   - whole runtime from any target repo: `ax status`;
   - profile-managed runtime assets: `pnpm ax status --profile <name>`;
   - skills only: `pnpm ax skills status --profile <name>`;
   - instructions only: `pnpm ax instructions status --profile <name>`;
   - hooks only: `pnpm ax hooks status`;
   - OpenSpec only: `pnpm ax openspec status`.
4. Run `validate` after every install or update.
5. For unfamiliar options, check current help instead of guessing:
   ```bash
   pnpm ax <scope> <command> --help
   ```

## Command Selection

| Need | Scope |
| --- | --- |
| All profile-managed runtime assets | top-level `install|update|status|validate --profile <name>` |
| Shared skills | `skills` |
| AGENTS.md/rules instructions | `instructions` |
| Hooks | `hooks` |
| Repo-local OpenSpec scaffolding | `openspec` |
| Commit through the local review gate | `commit` |
| Inspect or validate local review-gate state | `review-gate` |
| Private plan workflow support artifacts | `plans artifact` |
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
| `hooks` | No | Hook targets come from `ax.config.json`. |
| `openspec` | No | OpenSpec scaffolding is repo-local, not profile-local. |

`--config <path>` is the shared override when a non-default
`ax.config.json` is required.

When invoked through the managed `~/.local/bin/ax` shim, source root and default
config path resolve to the durable AI repo. Repo-local scopes such as `openspec`
target the current working directory. Do not silently run AI repo package
scripts against a target repo to simulate global usage; use the managed shim or
explicitly explain the source/config/target roots before proceeding.

## Commit And Review Gate

Agents should commit through `ax commit`, not raw `git commit`:

```bash
ax review-gate status
ax review-gate validate-commit
ax commit -m "Commit message"
```

`ax commit` validates the local review gate for the current staged diff before
delegating to Git. When no active review gate exists, validation allows the
commit with a note. When a gate is active, required review-pass evidence must
match the staged diff.

Workflow-owned commits with a required local review gate must use:

```bash
ax commit --require-review-gate -m "Commit message"
```

In required-gate mode, `ax commit` snapshots the reviewed staged diff, required
review passes, and active gate evidence before delegating to Git. After Git
creates the commit, it verifies the created commit diff and atomically
compare-and-consumes the same active gate. If the command reports `committed
successfully but review gate was not consumed` or `failed to consume review
gate`, treat the created head as not locally reviewed for automation purposes:
inspect the commit, rerun the required local reviewers for the current gate
state, activate a fresh gate, and retry the workflow step.

V1 supports normal staged commits with `-m` or `--message`. It rejects
commit-shape-mutating or bypass modes such as `--amend`, `-a`, `--all`,
`--include`, `--only`, pathspec commits, and `--no-verify`.

## Private Plan Support Artifacts

Use `plans artifact` when a plan workflow needs file-backed recovery or
correlation for support workflow artifacts that must not be committed under
`.agents/plans/**`.

```bash
ax plans artifact record --plan .agents/plans/example.md --kind <kind> --file <path>
ax plans artifact list --plan .agents/plans/example.md
```

`--plan` must be the repo-relative primary markdown plan under
`.agents/plans/**`. `--file` can be either a repo-relative path inside the
invocation target repo or an absolute path to a local temporary/thread support
artifact. `--kind` must be one of `review_request`, `reviewer_selection`, `handoff`,
`blueprint`, `ledger`, `report`, `validation_input`, or `validation_output`.
Keep support artifacts in the thread by default; record them only when
file-backed recovery or correlation is needed.

The command keys records to the invocation target repo identity, normalized plan
path, plan path hash, plan slug, and plan content fingerprint. It writes
immutable private blobs plus manifest, revision metadata, and append-only index
records under the private AX plan workspace. Do not commit those private files,
and do not expose local private workspace paths in PR/MR descriptions; use the
printed JSON record data, hashes, note IDs, discussion IDs, or stable
correlation IDs when hosted review needs evidence.

When invoked from another project through the managed `~/.local/bin/ax` shim,
the target repo is the current working directory. From this AI repo, use
`pnpm ax plans artifact ...`. Use `list` to recover prior records for a plan
before assuming thread-only evidence is lost.

## OpenSpec Setup

Do not run raw `openspec init` for repo-local managed setup. Use:

```bash
ax openspec status
ax openspec install --context-file ./openspec-context.md
ax openspec update
ax openspec validate
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

First-time install writes confirmed `openspec/config.yaml` before upstream
generation. In headless mode, provide `--context-file <path>`; do not invent or
accept inferred context with an `--accept-inferred-config` flag. Interactive
install previews tools, schema, profile, delivery, workflows, context, and rules
before asking for confirmation.

Normal update is asset-focused and exits without mutation when generated assets
validate as current. To review inferred config context/rule changes, opt in with
`--review-config`; in headless mode add `--accept-config-changes` only when the
proposed merged config should be written.

`openspec validate` checks repo config quality, generated asset targets,
portable skill boundaries, and symlink normalization. Run it after install,
update, or accepted config review.

## After Shared Asset Changes

Refresh every affected installed surface before treating source edits as live:

- `skills/**`: update and validate both `personal` and `work` with
  `pnpm ax skills ... --profile <name>`.
- `instructions/**`, `rules/**`, or `AGENTS.md`: update and validate both
  profiles with `pnpm ax instructions ... --profile <name>`.
- `hooks/**`: use `pnpm ax hooks update`, then
  `pnpm ax hooks validate`.
- generated OpenSpec skills or commands: use `pnpm ax openspec
  update`, then `pnpm ax openspec validate`.

## Portable Skill Boundary

The `ax-cli` skill is the only shared skill that should teach AX commands,
runtime profile mechanics, installed runtime paths, private plan-artifact
commands, or managed symlink behavior. Other shared skills must be reusable from
their own directories.

For portable skills:

- keep runnable helper logic inside the skill folder, usually under
  `scripts/`;
- call helpers relative to the skill directory in examples and instructions;
- use a real package dependency when helper code must be shared across skills;
- do not import repo-root workflow scripts from skill scripts;
- do not tell agents to repair portability with `runtime.reusableScripts`.

`runtime.reusableScripts` is not the supported portability mechanism for shared
skills. If validation finds a skill reaching outside its directory, package the
needed helper in that skill instead of wiring a top-level runtime script into
the profile.

If an update changes installed files, rerun the matching `status` or `validate`
command before finishing.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Running raw `openspec init` in a managed repo | Use `pnpm ax openspec install` only for missing setup. |
| Recommending `pnpm link` for global access | Use `pnpm ax shim install` and verify with `ax status`. |
| Running headless OpenSpec install without confirmed context | Provide `--context-file <path>`; do not use unsupported `--accept-inferred-config`. |
| Passing `--profile` to `openspec` or `hooks` | Use profile flags only on top-level, `skills`, and `instructions` commands. |
| Running `install` on an existing OpenSpec footprint | Run `status` and `validate`; use `update` for configured scaffolding. |
| Expecting normal `openspec update` to rewrite config | Use `update --review-config`, and add `--accept-config-changes` only for accepted headless writes. |
| Editing installed runtime copies directly | Edit source in this repo, then run the matching `ax ... update`. |
| Calling work complete after source edits only | Refresh installed copies and run profile validation. |
| Guessing flags from memory | Run `pnpm ax <scope> <command> --help`. |
| Making a portable skill depend on repo-root scripts | Package helper logic under that skill or use a real package dependency. |
| Using `runtime.reusableScripts` as a portability fix | Move the helper into the owning skill; keep this field out of shared-skill portability guidance. |
| Committing plan workflow support sidecars under `.agents/plans/**` | Keep them in thread evidence or record them with `ax plans artifact record`. |
| Treating private artifact paths as hosted evidence | Use summaries, hashes, note IDs, discussion IDs, or stable correlation IDs instead. |
| Running `plans artifact record` against the wrong repo | Invoke `ax` from the target repo so records key to the correct target identity. |

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
- RED: baseline commit pressure treated `git commit -m` as the obvious agent
  path and did not inspect local review-gate state before committing.
- GREEN: with this skill loaded, commit pressure used `ax review-gate status`
  or `ax review-gate validate-commit` for diagnostics, used
  `ax commit --require-review-gate -m` for workflow-owned commits, and rejected
  bypass or shape-changing flags.
- GREEN: with this skill loaded, plan workflow support artifacts use
  `ax plans artifact record|list` for private file-backed recovery while
  avoiding committed `.agents/plans/**` sidecars and hosted local-path leaks.
