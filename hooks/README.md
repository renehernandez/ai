# Agent hooks

This directory contains versioned TypeScript hooks for the local agent runtime.
Tracked `ax.config.json` is authoritative runtime state. Hook sync replaces the
exact configured hook targets and leaves unrelated paths untouched.

`runtime.hooks.sourceDir` is the repository-relative `hooks` directory. AX
resolves it inside the immutable source snapshot used by the current sync, so
isolated feature-branch proof and post-merge live activation use the same source
model without a machine-specific checkout path.

## Synchronize hooks

Synchronize the complete runtime through top-level sync:

```bash
pnpm ax sync
```

Synchronize only the hook surface with:

```bash
pnpm ax hooks sync
```

Hook sync uses `runtime.installedProfiles` and `runtime.policyProfile` from
tracked config. It builds the complete temporary hook candidate before
replacing canonical hooks and configured harness links. Rerun hook sync after
an interrupted update.

Inspect the surface offline and read-only:

```bash
pnpm ax hooks status
pnpm ax hooks validate
```

Status and validate perform no network access and no mutation. They verify hook
path presence, configured link targets, and every AX-owned Codex and Claude
registration. Missing, duplicate, or stale owned registrations fail validation.
Codex trust remains reported as unverified because only the app owns and can
confirm its exact-definition trust hash. Status and validate do not compare hook
file contents or establish remote-ref freshness; sync restores source content.

Before merge, run hook synchronization with isolated HOME, cache, targets, and
harness config. Do not refresh the live
hook runtime from a feature branch or disposable worktree. After merge, verify
the clean merged default branch source, then run live `ax sync`.

## `startup-git-sync.ts`

The startup hook synchronizes a repository before a local agent session:

- verify that the primary worktree can fast-forward, then discard its staged,
  unstaged, and untracked changes while preserving ignored files and local
  commits;
- fast-forward the primary worktree that owns the configured default branch;
- advance a clean detached task worktree when its HEAD is already reachable
  from the fetched remote default branch;
- rebase a clean current feature worktree when safe;
- fail startup for dirty task worktrees, detached task worktrees with local
  commits, diverged primary branches, and in-progress Git operations;
- skip non-Git startup directories;
- abort a conflicted rebase and leave the checkout unchanged;
- emit structured agent-discovery metadata.

Session context and lifecycle authority remain in the shared startup rule and
each mode preflight. The hook does not choose Explore, Plan, Execute, Review, or
Finish and grants no write authority.

Inspect its metadata from a synchronized runtime:

```bash
pnpm exec tsx ~/.agents/hooks/startup-git-sync.ts --agent-discovery
```

## `block-node-modules-bin.ts`

This `PreToolUse` guard denies shell commands that execute binaries inside
`node_modules/.bin` directly. Use package-manager-mediated commands instead:

- `pnpm exec <binary> [args]` for project-local binaries;
- `pnpm dlx <package> [args]` for one-off execution;
- `pnpm run <script>` for package scripts.

Blocked examples include:

- `./node_modules/.bin/vite build`
- `node_modules/.bin/biome check`
- `/path/to/project/node_modules/.bin/tsx script.ts`

Inspect metadata or help from the synchronized runtime:

```bash
pnpm exec tsx ~/.agents/hooks/block-node-modules-bin.ts --agent-discovery
pnpm exec tsx ~/.agents/hooks/block-node-modules-bin.ts --help
```

Malformed, missing, or unsupported hook payloads write a diagnostic to stderr
and do not block an unrelated command. A matched direct binary path returns a
deny decision with the path, command excerpt, reason, and replacement guidance.

## `block-delete-outside-cwd.ts`

This `PreToolUse` guard allows supported shell deletion commands only when each
target can be proven to stay inside the hook payload's `cwd`. It covers:

- `rm`, `rmdir`, and `unlink`;
- `find` with `-delete`;
- `git clean`, including `git -C`;
- visible commands in lists, pipelines, subshells, and literal `sh -c` strings;
- standard `command`, `env`, and `sudo` wrappers.

The guard denies parent traversal, external absolute paths, dynamic variables,
command substitution, globbing, ambiguous directory changes, and traversal
through an in-root symlink to an external directory. Deleting the in-root
symlink itself remains allowed.

Inspect its metadata or help from the synchronized runtime:

```bash
pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts --agent-discovery
pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts --help
```

The hook protects supported intercepted shell calls. It does not cover
`apply_patch`, MCP deletion tools, application APIs, or child processes whose
deletion operation is not statically visible. Treat it as a guardrail, not an
operating-system security boundary.

## Codex and Claude registration

`runtime.hooks.registrations` declares AX-owned registrations and their exact
Codex and Claude settings targets. Hook sync removes stale entries owned by the
same hook identity, adds the desired entry once, and preserves unrelated hooks
and settings. Do not hand-edit managed registration or managed hook links.

Codex trust hashes remain app-owned. After a merged-main live sync, review and
trust a newly registered hook in Codex instead of editing `config.toml`.

## Focused verification

Run the hook integration suite after changing source or registration behavior:

```bash
pnpm exec tsx --test tests/integration/startup-git-sync.test.ts
pnpm exec tsx --test tests/integration/block-delete-outside-cwd.test.ts
pnpm exec tsx --test tests/integration/hook-registration-runtime.test.ts
pnpm exec tsx --test tests/unit/hook-registration.test.ts
```

Then run hook validation against isolated runtime roots before publication.

## See also

- [AX CLI](../docs/ax.md)
- [Session startup rules](../rules/session-startup.md)
