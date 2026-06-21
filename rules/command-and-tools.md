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

- Use `pnpm agent-runtime skills install --profile <name>` for first-time installs of managed skills for a machine profile.
- Use `pnpm agent-runtime skills update --profile <name>` to refresh managed skills from their configured upstream refs.
- Use `pnpm agent-runtime skills validate --profile <name>` for local, non-network validation of managed skill configuration.
- Use `pnpm agent-runtime skills status --profile <name>` to inspect installed skill copies and symlinks.
- Add `--profile <name>` to scope skills work to one machine profile; repeat it to select multiple profiles.
- Use either `--all-profiles` or one or more `--profile <name>` flags for non-interactive skills commands.
- After changing any managed skill source under `skills/`, run `writing-skills` against the changed skill before committing, then run `pnpm agent-runtime skills update --profile <name>` before treating the change as live. Repo source files and installed runtime copies can drift until the update runs.
- After refreshing a changed skill, verify the active runtime surface with `pnpm agent-runtime skills status --profile <name>`. Use `pnpm agent-runtime skills validate --profile <name>` or `pnpm agent-runtime validate --all-profiles` when the change affects shared workflow contracts, agent prompts, or cross-profile behavior.
- If a managed skill depends on a shared script outside its own skill directory, declare that file under `runtime.reusableScripts` in `agent-runtime.config.json` and refresh the affected profile with `pnpm agent-runtime skills update --profile <name>`.
- Do not manually create skill symlinks or hand-copy managed skills into runtime folders.
- Do not use `npx skills`; this repo manages skills through the internal `pnpm agent-runtime` CLI.

## Agent Runtime Sync

- This repo currently has no repo-managed subagent mappings. Skills may still delegate to available local, cloud, or custom subagents exposed by the active harness.
- Do not manually create subagent symlinks or hand-copy generated agent files into runtime folders; use the repo runtime or the owning harness mechanism when adding managed subagents.

## Hook Runtime Sync

- Use `pnpm agent-runtime hooks install` for first-time managed hook setup.
- Use `pnpm agent-runtime hooks update` after changing files under `hooks/` or hook registration behavior.
- Use `pnpm agent-runtime hooks validate` to enforce managed hook symlink state and Codex/Claude startup registration state.
- Use `pnpm agent-runtime hooks status` for read-only hook source, symlink, registration, Codex trust, and selected remote reporting.
- Do not manually create managed hook symlinks or hand-copy hook files into `~/.agents/hooks`, `~/.codex/hooks`, or `~/.claude/hooks`.
- Do not manually edit Codex or Claude startup hook registration when `agent-runtime hooks update` can apply the registration with backups.
- Codex startup hook trust is app-owned state. If status reports `[untrusted] codex startup hook trust`, report that state and avoid hand-editing trust hashes.

## Instruction Runtime Sync

- Use `pnpm agent-runtime instructions install --profile <name>` for first-time `AGENTS.md` and managed rule-file symlink setup.
- Use `pnpm agent-runtime instructions update --profile <name>` after changing managed instruction paths.
- Use `pnpm agent-runtime instructions validate --profile <name>` for local validation of configured instruction sources and targets.
- Use `pnpm agent-runtime instructions status --profile <name>` to inspect instruction symlinks.
- Use `--profile personal` on personal machines and `--profile work` on Fullscript work machines.
- Use `--all-profiles` only when intentionally validating or installing the union of all machine profiles.
- Do not manually create managed instruction symlinks or hand-copy managed instruction files into runtime folders.

## Runtime Wrapper Commands

- Use `pnpm agent-runtime install --profile <name>` or `pnpm agent-runtime update --profile <name>` to refresh skills, instructions, and hooks.
- Use `pnpm agent-runtime validate --profile <name>` or `pnpm agent-runtime status --profile <name>` to validate skills and instructions while reporting hook state. Use scoped `pnpm agent-runtime hooks validate` when hook symlink and startup registration failures should block.
- Add `--help` to the root command, wrapper commands, scoped commands, or scoped subcommands to inspect available options before running a command.
