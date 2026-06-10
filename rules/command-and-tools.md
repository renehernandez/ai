# Command and Tools Rules

These rules apply to command execution, network access, and tool installation across harnesses.

## Network Requests

- Never use the Claude `WebFetch` tool because proxy restrictions can cause self-signed certificate failures.
- Use `curl` through the shell for web content when the harness allows shell commands.
- When fetching web pages for content, include `-H "Accept: text/markdown"` to request Markdown. Many sites, including Cloudflare and GitHub, return cleaner Markdown than HTML.
- If the response content type is not `text/markdown`, fall back to HTML parsing.
- Example: `curl -s -H "Accept: text/markdown" "https://example.com"`
- Do not use `curl` for authenticated GitHub API work. Use `gh api` instead.
- Do not use `curl` for Cloudflare API operations. Use `wrangler` subcommands instead.

## Shell Command Discipline

- Never use compound commands in one shell tool call.
- Do not join commands with `&&`, `||`, `;`, pipes, subshells, or similar shell control operators in a single tool call.
- Issue each command as a separate tool call so permission rules and failures are easy to diagnose.
- Prefer purpose-built command flags over shell pipelines when possible.
- Do not run destructive commands unless the user explicitly asks or approves the exact action.
- Do not install dependencies unless the user explicitly asks or the approved implementation plan requires it.

## Harness Mapping

- In Claude Code, apply shell instructions to the `Bash` tool.
- In Codex, apply shell instructions to the available shell command tool.
- If a rule names a tool that is unavailable in the current harness, use the closest safe equivalent and report the fallback when it affects verification or behavior.

## Skill Installation

- Use `pnpm agent-runtime skills install` for first-time installs of all managed skillsets from this repo.
- Use `pnpm agent-runtime skills update` to refresh all managed skillsets from their configured upstream refs.
- Use `pnpm agent-runtime skills validate` for local, non-network validation of managed skillset configuration.
- Use `pnpm agent-runtime skills status` to inspect installed skill copies and symlinks.
- Add `--skillset <name>` to install, update, or validate only one managed skillset.
- Do not manually create skill symlinks or hand-copy managed skills into runtime folders.
- Use `npx skills` only for ad hoc external skills that are not managed by this repo, and only when explicitly needed.

## Agent Runtime Sync

- Use `pnpm agent-runtime agents install` for first-time sub-agent generation and harness symlink setup.
- Use `pnpm agent-runtime agents update` after changing agent source files or harness model mappings.
- Use `pnpm agent-runtime agents validate` for local validation of configured agents, harnesses, and model mappings.
- Use `pnpm agent-runtime agents status` to inspect generated agent files and harness symlinks.
- Add `--agent <name>` or `--harness <name>` to scope agent commands.
- Do not manually create managed agent symlinks or hand-copy generated agent files into runtime folders.

## Instruction Runtime Sync

- Use `pnpm agent-runtime instructions install` for first-time `AGENTS.md` and `rules/` symlink setup.
- Use `pnpm agent-runtime instructions update` after changing managed instruction paths.
- Use `pnpm agent-runtime instructions validate` for local validation of configured instruction sources and targets.
- Use `pnpm agent-runtime instructions status` to inspect instruction symlinks.
- Add `--harness <name>` to scope instruction commands.
- Do not manually create managed instruction symlinks or hand-copy managed instruction files into runtime folders.

## Runtime Wrapper Commands

- Use `pnpm agent-runtime install`, `pnpm agent-runtime update`, `pnpm agent-runtime validate`, or `pnpm agent-runtime status` to run the corresponding command across skills, agents, and instructions.
- Add `--help` to the root command, wrapper commands, scoped commands, or scoped subcommands to inspect available options before running a command.
