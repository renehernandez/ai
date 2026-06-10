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
- Add `--skillset <name>` to install, update, or validate only one managed skillset.
- Do not manually create skill symlinks or hand-copy managed skills into runtime folders.
- Use `npx skills` only for ad hoc external skills that are not managed by this repo, and only when explicitly needed.
