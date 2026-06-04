# User-Level Agent Instructions

This file is the concise entrypoint for agents running as `rene.hernandez`.
The linked rule files are normative and preserve the detailed policies.

## Scope and Precedence

- Follow higher-priority system, developer, and direct user instructions first.
- Then apply this file and the linked files under [rules/](rules/).
- When a project has its own `AGENTS.md`, apply the more specific project rules for that workspace.
- If a rule names a tool that is unavailable in the current harness, use the closest safe equivalent and say what changed.
- Do not commit, push, install dependencies, or run destructive commands unless the user explicitly asks.
- A feature implementation request counts as approval to complete the feature-delivery workflow in [rules/feature-delivery.md](rules/feature-delivery.md) unless the user says to stop before commit, push, or PR.
- If the user says "feature delivery workflow", "follow feature delivery", or similar, immediately read and apply [rules/feature-delivery.md](rules/feature-delivery.md); do not search only the project repo and conclude it is missing.

## Quick Operating Rules

- Keep commands simple: one command per tool call, no compound shell chains, and no `--no-verify`.
- For JavaScript and TypeScript projects, invoke package-managed commands through the package manager, such as `pnpm exec`, `pnpm dlx`, or `pnpm run`; never call binaries inside `node_modules` directly.
- Write agent and Codex hooks in TypeScript unless there is a specific runtime requirement that makes another language a better fit.
- In troubleshooting mode, diagnose and report before editing or fixing anything.
- For multi-file implementation requests, delegate to the implementer agent when that harness supports agents. If already running as implementer, execute the approved plan.
- Use the correct review path: local changes go to `local-review`; GitLab MRs go to `glab-review`.
- Use confidence scores on actionable statements as defined in [rules/confidence.md](rules/confidence.md).
- Use `/doc-smith` for non-trivial documentation work and Mermaid for Markdown diagrams.
- Always use the `hallmark` skill for frontend design work, including greenfield UI, redesigns, design audits, visual polish, and design extraction from URLs or screenshots.
- Prefer CLI tools that carry authentication and org conventions: `gh` for GitHub, `glab` for GitLab, and `wrangler` for Cloudflare.
- Do not use "smoke test" or "smoke tests" wording. Describe the exact verification performed instead, such as browser route checks, console checks, or manual browser verification.

## Harness Entrypoints

### Shared Rules

All harnesses follow these reusable policies:

- [Command and tools](rules/command-and-tools.md)
- [Agent surface routing](rules/agent-surface-routing.md)
- [Git and review](rules/git-and-review.md)
- [Feature delivery](rules/feature-delivery.md)
- [Session startup](rules/session-startup.md)
- [Handoff and resume](rules/handoff-and-resume.md)
- [Investigation and implementation](rules/investigation-and-implementation.md)
- [CI, infrastructure, and Cloudflare](rules/ci-infra-and-cloudflare.md)
- [Documentation and specs](rules/docs-and-specs.md)
- [Confidence framework](rules/confidence.md)

### Claude Code

- Treat `Bash`, `Task`, and slash skills such as `/glab-commit` as literal harness capabilities when available.
- Never use `WebFetch`; use `curl` through `Bash` for web content as described in [rules/command-and-tools.md](rules/command-and-tools.md).
- Use `/brainstorm` for brainstorming and design sessions, not the lower-level `brainstorming` skill name.

### Codex

- Map `Bash` instructions to the shell command tool available in Codex.
- Read the relevant skill `SKILL.md` before applying a named skill.
- Use `apply_patch` for manual file edits and read files before editing them.
- If a rule requires `Task` or a subagent and no such tool is available, report the limitation and use the closest local verification path.

### Fullscript Workflows

- GitLab, GitHub, Linear, Cloudflare, Terraform, CI, Docker, and documentation rules are captured in the linked files.
- Fullscript-specific rules apply whenever working in Fullscript repositories, internal GitLab, internal CI, Cloudflare resources, or org-owned infrastructure.
