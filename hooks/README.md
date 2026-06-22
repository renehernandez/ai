# Codex Hooks

This directory contains user-level Codex hooks shared by the Codex app and
Codex CLI. The runtime path `~/.agents/hooks` is a symlink to this folder, so
Codex can use stable hook paths while the source stays versioned in the personal
AI repo.

Source of truth:

- Repo path: `/Users/rene.hernandez/work/projects/rene.hernandez/ai/hooks`
- Runtime path: `/Users/rene.hernandez/.agents/hooks`
- Codex hooks config: `/Users/rene.hernandez/.codex/hooks.json`
- Codex trust state: `/Users/rene.hernandez/.codex/config.toml`
- Claude settings: `/Users/rene.hernandez/.claude/settings.json`

Hooks in this folder should be written in TypeScript unless a specific runtime
requirement justifies another language.

## Managed Runtime Flow

Use `ax` to manage hook symlinks and startup registration:

```sh
pnpm ax hooks update
pnpm ax hooks validate
pnpm ax hooks status
```

`hooks install` and `hooks update` replace managed hook directories with
symlinks after backup verification, then register `startup-git-sync.ts` in the
Codex and Claude startup hook configs. Config files are backed up under
`~/.agents/runtime/backups/config/<codex|claude>/` before mutation.

`hooks validate` and `hooks status` are read-only. They report hook source and
symlink state, Codex and Claude startup registration state, Codex trust state,
and the selected startup Git sync remote URL. The remote line warns when the
selected remote URL differs from `runtime.hooks.startupRemote.expectedUrl` in
`ax.config.json`; this check is evaluated in the current Git
repository where the command runs. Codex may still report untrusted until the
app records trust for the registered startup hook.

The top-level wrapper commands include hook handling:

```sh
pnpm ax update --profile personal
pnpm ax validate --profile personal
```

Scoped `hooks validate` enforces hook symlink and registration correctness.
Top-level `validate` reports hook state without failing solely because this
machine has not installed the managed hook symlinks yet.

## `block-node-modules-bin.ts`

`block-node-modules-bin.ts` is a `PreToolUse` guard for shell commands. It denies
commands that call binaries inside `node_modules/.bin` directly.

This keeps JavaScript and TypeScript commands package-manager mediated. Agents
should use:

- `pnpm exec <binary> [args]` for project-local binaries
- `pnpm dlx <package> [args]` for one-off package execution
- `pnpm run <script>` for package scripts

The hook blocks patterns such as:

- `./node_modules/.bin/vite build`
- `node_modules/.bin/biome check`
- `/path/to/project/node_modules/.bin/tsx script.ts`

## Agent Discovery

Agents can inspect hook metadata with:

```sh
pnpm exec tsx /Users/rene.hernandez/.agents/hooks/block-node-modules-bin.ts --agent-discovery
```

The discovery output is JSON. It includes the hook event, matcher, purpose,
runtime command, blocked patterns, supported Codex payload fields, failure
behavior, and preferred replacement commands.

Human-readable help is also available:

```sh
pnpm exec tsx /Users/rene.hernandez/.agents/hooks/block-node-modules-bin.ts --help
```

## Codex Registration

`ax hooks update` manages startup Git sync registration in
`~/.codex/hooks.json`. Older manual hook snippets may still exist in
`~/.codex/config.toml` for other hook types, but startup registration should be
managed through `hooks.json`.

The node_modules guard can still be registered manually as a Codex `PreToolUse`
hook when needed:

```toml
[features]
hooks = true

[[hooks.PreToolUse]]
matcher = "^Bash$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = "pnpm exec tsx /Users/rene.hernandez/.agents/hooks/block-node-modules-bin.ts"
timeout = 5
statusMessage = "Checking shell command policy"
```

## Failure Behavior

The hook is intentionally conservative:

- A direct `node_modules/.bin` call returns a Codex `deny` decision with the
  matched path, blocked command excerpt, reason, and replacement guidance.
- Malformed or missing hook input writes a diagnostic to stderr and does not
  block the command.
- Missing command fields write a diagnostic to stderr and do not block the
  command.

This avoids breaking unrelated Codex commands if the hook payload shape changes,
while still blocking the policy violation it is designed to catch.

## Testing

Blocked payload:

```sh
printf '{"tool_input":{"command":"./node_modules/.bin/vite build"}}' \
  | pnpm exec tsx /Users/rene.hernandez/.agents/hooks/block-node-modules-bin.ts
```

Allowed payload:

```sh
printf '{"tool_input":{"command":"pnpm exec vite build"}}' \
  | pnpm exec tsx /Users/rene.hernandez/.agents/hooks/block-node-modules-bin.ts
```

The blocked case emits a Codex `deny` decision. The allowed case exits with no
output.
