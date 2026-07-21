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
- Run the project's documented automated setup command, and install the
  dependency graph already declared by its manifests and lockfiles, without
  separate permission.
- Do not add, update, downgrade, or remove dependencies, or accept changes to
  dependency manifests or lockfiles, unless the user explicitly asks or the
  accepted implementation contract requires it. If setup would make one of
  those changes, stop and request authority instead of accepting the change.
- Route package-management file changes through the owning package manager CLI
  whenever it provides a command for the change. This includes dependency
  additions, removals, upgrades, downgrades, semver range changes,
  workspace/package-manager catalog edits, and lockfile updates in files such as
  `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, and
  `bun.lock`. Use commands such as `pnpm add`, `pnpm remove`, `pnpm update`,
  `npm install`, `npm uninstall`, `yarn add`, `yarn remove`, `bun add`, or
  `bun remove`, then review the generated manifest and lockfile diff.
- Manual edits to package-management files are a last resort for metadata that
  the package manager cannot update directly, such as scripts, package names,
  exports, engines, or tool configuration. Do not hand-edit dependency entries,
  package-manager catalogs, or lockfiles to match those changes.

## Harness Mapping

- In Claude Code, apply shell instructions to the `Bash` tool.
- In Codex, apply shell instructions to the available shell command tool.
- If a rule names a tool that is unavailable in the current harness, use the closest safe equivalent and report the fallback when it affects verification or behavior.

## Provider CLIs

- Use the authenticated organization-aware CLI selected for the provider.
- Use `linearis` for supported Linear provider reads and writes. Read its live
  `usage` output before an unfamiliar operation.
- Do not use Linear MCP, app, or plugin tools as a fallback. Report an
  unsupported Linearis operation as a capability blocker.
- Credential entry through `linearis auth login` remains a human action.

## AX runtime convergence

Tracked `ax.config.json` is authoritative runtime state. It declares installed
profiles, exactly one workflow-policy profile, exact runtime targets, and
explicitly retired skills. `runtime.configs` additionally owns exact leaf
values inside mixed machine-local tool configs.

- Use `pnpm ax sync` to build one validated candidate, replace every declared
  skill, instruction, and hook target, and remove `runtime.retiredSkills`.
- Change `runtime.installedProfiles` and `runtime.policyProfile` in tracked
  config when the machine selection changes. Sync has no selection flags.
- Scoped `pnpm ax skills sync`, `pnpm ax instructions sync`, and
  `pnpm ax hooks sync` use that tracked selection and mutate only that surface.
- Use `pnpm ax configs sync` to converge only the exact managed TOML leaves in
  tracked config. Preserve every unowned value and do not hand-edit a managed
  leaf in `~/.codex/config.toml`.
- Leave unrelated paths outside AX's exact configured targets untouched.
- Do not hand-copy runtime assets, create managed symlinks manually, or edit
  managed hook registration directly.
- Portable shared skills keep executable helpers in the owning skill directory
  or a real package dependency.

Each distinct configured source/ref pair resolves once per sync invocation.
AX validates the complete temporary candidate before replacing live entries.
Disposable source caches live under `~/.agents/runtime/cache`. If sync is
interrupted, rerun it.

## Offline inspection

- Use `pnpm ax status` and `pnpm ax validate` for offline, read-only inspection
  with no network access or filesystem mutation.
- Status reports configured profiles, path presence, link targets, retired
  paths, and cache state. It cannot establish remote-ref freshness.
- Validate checks runtime structure, not byte-for-byte content. Run sync to
  restore authoritative content.
- Scoped `skills`, `instructions`, and `hooks` status/validate commands apply
  the same offline boundary to one surface.
- `configs status` compares exact managed leaves. `configs validate` also runs
  the installed Codex config loader against a temporary candidate and
  remains read-only.
- Codex hook trust is app-owned state. Report an untrusted status; do not edit
  trust hashes manually.

## Repo-local OpenSpec sync

- Use `ax openspec sync` in the invocation repository to converge missing,
  configured, or repairable partial repo-local OpenSpec state.
- Headless missing or context-required state uses `--context-file <path>`.
  Configured context review remains explicit through its config-review flags.
- `ax openspec status` and `ax openspec validate` are offline, read-only, and
  perform no mutation.
- Top-level runtime sync never mutates OpenSpec files in the current working
  directory.
- Canonical generated skills live under `.agents/skills/openspec-*`; canonical
  commands live under `.agents/commands/opsx`; configured harness targets use
  normalized relative links.

## Isolated proof and live activation

- Run pre-merge AX proof with isolated HOME, cache, skills, instructions, hooks,
  configs, and profile targets. `--runtime-root` does not redirect tool config,
  so config mutation requires both an isolated HOME and runtime root.
- A feature branch, dirty source, or disposable worktree must never mutate live
  runtime roots.
- After merge, verify the clean merged default branch source matches the hosted
  default branch, then run live `ax sync`.
- Keep shim lifecycle separate from runtime convergence. Use
  `pnpm ax shim install`, `pnpm ax shim status`, and `pnpm ax shim uninstall` for
  the managed `~/.local/bin/ax` entrypoint.
- Add `--help` to inspect root, scoped, and shim command options.
