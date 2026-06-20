# User-Level Agent Instructions

This file is the concise entrypoint for agents running as `rene.hernandez`.
The linked rule files are normative and preserve the detailed policies.

## Scope and Precedence

- Follow higher-priority system, developer, and direct user instructions first.
- Then apply this file and the linked files under [rules/](../rules/).
- When a project has its own `AGENTS.md`, apply the more specific project rules for that workspace.
- If a rule names a tool that is unavailable in the current harness, use the closest safe equivalent and say what changed.
- Do not commit, push, install dependencies, or run destructive commands unless the user explicitly asks.
- A feature implementation request counts as approval to complete the feature-delivery workflow in [rules/feature-delivery.md](../rules/feature-delivery.md) unless the user says to stop before commit, push, or PR.
- If the user says "feature delivery workflow", "follow feature delivery", or similar, immediately read and apply [rules/feature-delivery.md](../rules/feature-delivery.md); do not search only the project repo and conclude it is missing.

## Quick Operating Rules

- Keep commands simple: one command per tool call, no compound shell chains, and no `--no-verify`.
- Do not force push for ordinary follow-up work, review feedback, or CI fixes. Use subsequent commits because hosted diffs are squash-merged. Force push only when it is necessary to resolve a Git history change, rebase, conflict, stale remote update, or when the user explicitly asks for a history rewrite.
- When a safe recurring command needs approval, request a reusable scoped prefix rule instead of a one-off approval. Prefer narrow prefixes such as `["pnpm", "test"]`, `["pnpm", "run", "test"]`, `["git", "status"]`, `["git", "diff"]`, `["git", "show"]`, and `["glab", "mr", "view"]`; avoid reusable approvals for destructive commands, dependency installs, pushes, credential access, or broad interpreters like `python`, `node`, or `bash`.
- Keep approval-seeking commands prefix-matchable: avoid shell redirection, command substitution, heredocs, glob-heavy arguments, and broad `bash -lc` wrappers when a direct command works. If repeated prompts persist in a long-running Codex thread after sandbox or writable-root config changes, tell the user the thread may need to be restarted, forked, or handed off so the new config is loaded.
- In brainstorming or planning threads, treat agreement as design confirmation only. Do not edit files, generate migrations, or start implementation from scope agreement alone; wait for an explicit implementation trigger such as "implement this", "make the changes", "start the PR", "go ahead and code it", or "apply the plan".
- When the user says they dislike a proposed name, structure, or design shape, provide alternatives and tradeoffs before changing files, even if they did not explicitly ask for alternatives.
- For JavaScript and TypeScript projects, invoke package-managed commands through the package manager, such as `pnpm exec`, `pnpm dlx`, or `pnpm run`; never call binaries inside `node_modules` directly.
- After changing shared skill, agent, instruction, or rule sources in this repo, run `writing-skills` against the changed agent behavior before committing. For shared skill changes, refresh the installed runtime copies before treating the change as live with `pnpm agent-runtime skills update --profile <name>`, and confirm the active runtime surface with `pnpm agent-runtime skills status --profile <name>` or `pnpm agent-runtime validate --profile <name>`.
- Write agent and Codex hooks in TypeScript unless there is a specific runtime requirement that makes another language a better fit.
- In troubleshooting mode, diagnose and report before editing or fixing anything.
- For multi-file implementation requests, work in the current agent session unless the user explicitly asks to use a subagent or the active workflow launches available subagents for bounded work or verification.
- For review work, use the relevant review skill or adapter in the current session. Skills may delegate to available local, cloud, or custom subagents when the workflow benefits from independent review lanes.
- Use confidence scores on actionable statements as defined in [rules/confidence.md](../rules/confidence.md).
- Use `/doc-smith` for non-trivial documentation work and Mermaid for Markdown diagrams.
- Use `/scrutinize` for adversarial validation of plans, implementation diffs, PRs, hosted review feedback, proposed approaches, sanity checks, and second opinions.
- Always use the `hallmark` skill for frontend design work, including greenfield UI, redesigns, design audits, visual polish, and design extraction from URLs or screenshots.
- Prefer CLI tools that carry authentication and org conventions: `gh` for GitHub, `glab` for GitLab, and `wrangler` for Cloudflare.
- Review-first plan workflows are an explicit hosted-review exception to ordinary direct-publish guidance. When `plan-orchestrator`, `plan-review`, or the approved plan workflow requires a planning-only PR/MR, create that planning artifact first and wait for the required planning-review gate before implementation sequencing.
- Do not use "smoke test" or "smoke tests" wording. Describe the exact verification performed instead, such as browser route checks, console checks, or manual browser verification.
- Avoid slop-like contrast phrasing and generic AI filler. Do not lean on formulas like "X, not just Y", "more than just", "isn't just", or "the future of"; state the concrete claim directly.
- Describe the exact verification performed instead of using vague shortcut
  labels. Prefer precise phrases such as browser route checks, responsive
  viewport checks, console checks, local browser E2E tests, deployed-preview E2E
  tests, or manual browser verification.
- When returning machine-readable YAML or JSON contracts in chat, first include a concise `## Readable Summary`, then include the structured block for machine use.

## Harness Entrypoints

### Project Setup

- Use the current project's local setup, dependency, and verification
  instructions. Prefer commands declared in the project `AGENTS.md`, task
  runner config, package scripts, README, or nearby docs.
- Do not assume this user-level instruction file defines a universal setup
  command. Project-specific commands belong in project-specific instructions.

### Shared Automations

- Store reusable Codex automation definitions under [automations/](../automations/).
- Runtime folders such as `~/.codex/automations` and `~/.agents/automations` should point here by symlink.
- Keep automation prompts self-contained and repo-aware; ignore runtime-only state such as jitter salts, logs, per-run state files, and automation memory/state artifacts such as `memory.md` and `state.json`.

### Installed Rules

Load the rule files installed under [rules/](../rules/). Runtime profiles may install only the rule files relevant to this machine.

### Claude Code

- Treat `Bash`, `Task`, and slash skills such as `/glab-commit` as literal harness capabilities when available.
- Never use `WebFetch`; use `curl` through `Bash` for web content as described in [rules/command-and-tools.md](../rules/command-and-tools.md).
- Use `/brainstorm` for brainstorming and design sessions, not the lower-level `brainstorming` skill name.

### Codex

- Map `Bash` instructions to the shell command tool available in Codex.
- Read the relevant skill `SKILL.md` before applying a named skill.
- Use `apply_patch` for manual file edits and read files before editing them.
- If a rule or skill uses subagents, keep prompts bounded, avoid write access unless explicitly approved by the workflow or user, and reconcile findings in the parent thread.

### Fullscript Workflows

- GitLab, GitHub, Linear, Cloudflare, Terraform, CI, Docker, and documentation rules are captured in the linked files.
- Fullscript-specific rules apply whenever working in Fullscript repositories, internal GitLab, internal CI, Cloudflare resources, or org-owned infrastructure.
