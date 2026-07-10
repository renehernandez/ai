# Agent hooks

This directory contains versioned TypeScript hooks for the local agent runtime.
Tracked `ax.config.json` is desired state; local
`~/.agents/runtime/managed-runtime.json` records managed ownership and hashes;
the runtime filesystem is observed state.

`runtime.hooks.sourceDir` is the repository-relative `hooks` directory. AX
resolves it inside the immutable source snapshot used by the current sync, so
isolated feature-branch proof and post-merge live activation use the same source
model without a machine-specific checkout path.

## Synchronize hooks

Initialize the complete runtime through top-level sync:

```bash
pnpm ax sync
```

After initialization, synchronize only the hook surface with:

```bash
pnpm ax hooks sync
```

Hook sync consumes the installed and workflow-policy profile selection from
`~/.agents/runtime/managed-runtime.json`. It builds hook payloads and startup
registration from one immutable source snapshot, applies them through the
runtime transaction, writes ownership state last, and retains verified backups.

Inspect the surface offline and read-only:

```bash
pnpm ax hooks status
pnpm ax hooks validate
```

Status and validate perform no network access and no mutation. They compare
`ax.config.json` desired state with managed ownership and observed hook files,
links, Codex/Claude registration, Codex trust state, selected remote, locks, and
recovery state. Missing remote-ref freshness is resolved only by sync.

Before merge, run hook synchronization with isolated HOME, manifest, cache,
transactions, backups, targets, and harness config. Do not refresh the live
hook runtime from a feature branch or disposable worktree. After merge, verify
the clean merged default branch source, then run live `ax sync`.

## `startup-git-sync.ts`

The startup hook performs conservative repository synchronization before a
local agent session:

- fast-forward the primary worktree that owns the configured default branch;
- rebase a clean current feature worktree when safe;
- skip dirty, detached-with-local-commits, non-Git, and in-progress-operation
  states;
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

## Codex and Claude registration

Hook sync manages startup registration in the configured Codex and Claude
settings targets. Do not hand-edit managed registration or managed hook links.
Codex trust hashes remain app-owned; report an untrusted status and let the app
record trust.

## Focused verification

Run the hook integration suite after changing source or registration behavior:

```bash
pnpm exec tsx --test tests/integration/startup-git-sync.test.ts
```

Then run hook validation against isolated runtime roots before publication.

## See also

- [AX CLI](../docs/ax.md)
- [Session startup rules](../rules/session-startup.md)
