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

## AX runtime convergence

Tracked `ax.config.json` is desired state. Local
`~/.agents/runtime/managed-runtime.json` records installed profiles, exactly one
workflow-policy profile, AX-owned paths, and content hashes. The live filesystem
is observed state.

- Use `pnpm ax sync` to build one validated candidate and converge selected
  skills, instructions, and hooks.
- Only top-level sync may initialize the manifest or change installed/policy
  profile selection. A first headless run supplies explicit profile and policy
  selection. Later headless selection changes use an exact-manifest-hash-bound
  profile-selection file.
- Scoped `pnpm ax skills sync`, `pnpm ax instructions sync`, and
  `pnpm ax hooks sync` require an initialized valid manifest, reuse its profile
  selection, and mutate only that surface.
- Do not hand-copy runtime assets, create managed symlinks manually, or edit
  managed hook registration directly.
- Portable shared skills keep executable helpers in the owning skill directory
  or a real package dependency.

Each distinct configured source/ref pair resolves once per sync invocation and
uses one immutable source snapshot for every selected entry. Disposable source
caches live under `~/.agents/runtime/cache`; they are never ownership or
installed truth.

Every runtime mutation holds the runtime-root lock, validates the complete
candidate before touching live entries, retains transaction payloads under
`~/.agents/runtime/transactions`, writes `managed-runtime.json` last, and keeps
seven verified backups per changed asset/target under
`~/.agents/runtime/backups`.

## Offline inspection

- Use `pnpm ax status` and `pnpm ax validate` for offline, read-only inspection
  with no network access or filesystem mutation.
- Status reports desired, managed, observed, cache, collision, lock, and
  recovery state. It cannot establish remote-ref freshness.
- Validate fails when desired, ownership, observed content, profile policy,
  hooks, or recovery state violates the local contract.
- Scoped `skills`, `instructions`, and `hooks` status/validate commands apply
  the same offline boundary to one surface.
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

- Run pre-merge AX proof with isolated HOME, manifest, cache, transactions,
  backups, skills, instructions, hooks, and profile targets.
- A feature branch, dirty source, or disposable worktree must never mutate live
  runtime roots.
- After merge, verify the clean merged default branch source matches the hosted
  default branch, then run live `ax sync`.
- Keep shim lifecycle separate from runtime convergence. Use
  `pnpm ax shim install`, `pnpm ax shim status`, and `pnpm ax shim uninstall` for
  the managed `~/.local/bin/ax` entrypoint.
- Add `--help` to inspect root, scoped, and shim command options.
