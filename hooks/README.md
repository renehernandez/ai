# Codex Hooks

This directory contains user-level Codex hooks shared by the Codex app and
Codex CLI. The runtime path `~/.agents/hooks` is a symlink to this folder, so
Codex can use stable hook paths while the source stays versioned in the personal
AI repo.

Source of truth:

- Repo path: `/Users/renehernandez/personal/projects/ai/hooks`
- Runtime path: `/Users/renehernandez/.agents/hooks`
- Codex config: `/Users/renehernandez/.codex/config.toml`

Hooks in this folder should be written in TypeScript unless a specific runtime
requirement justifies another language.

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
npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts --agent-discovery
```

The discovery output is JSON. It includes the hook event, matcher, purpose,
runtime command, blocked patterns, supported Codex payload fields, failure
behavior, and preferred replacement commands.

Human-readable help is also available:

```sh
npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts --help
```

## Codex Registration

The user-level Codex config enables hooks and registers this script:

```toml
[features]
hooks = true

[[hooks.PreToolUse]]
matcher = "^Bash$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = "npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts"
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
  | npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts
```

Allowed payload:

```sh
printf '{"tool_input":{"command":"pnpm exec vite build"}}' \
  | npx tsx /Users/renehernandez/.agents/hooks/block-node-modules-bin.ts
```

The blocked case emits a Codex `deny` decision. The allowed case exits with no
output.
