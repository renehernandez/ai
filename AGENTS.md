# AI Repo Agent Instructions

This file is the repo-local entrypoint for agents working in the `ai` repo.
The linked rule files are normative and preserve the detailed policies.
Portable user-level instructions that are installed into runtime profiles live in
[instructions/AGENTS.md](instructions/AGENTS.md).

## Scope and Precedence

- Follow higher-priority system, developer, and direct user instructions first.
- Then apply this file and the linked files under [rules/](rules/).
- If a rule names a tool that is unavailable in the current harness, use the closest safe equivalent and say what changed.
- For accepted implementation work, finish on a feature branch by committing,
  pushing to the selected hosted-review remote, and creating or updating a
  PR/MR when the project has a hosted-review workflow.
- Do not install dependencies or run destructive commands unless the user
  explicitly asks.
- For implementation work that needs planning, review-first delivery, stacked PRs/MRs, or multi-step coordination, route through `plan-orchestrator` and the related plan workflow skills.
- For small direct implementation work, use the current session and the project's local verification/review rules unless the user explicitly asks for a plan workflow.

## Quick Operating Rules

- Keep commands simple: one command per tool call, no compound shell chains, and no `--no-verify`.
- Agents must use `ax commit` instead of raw `git commit` when committing work.
  Ordinary iteration uses the normal `ax commit` path; `ax commit --require-review-gate`
  is opt-in only when the user or active workflow explicitly requires it. Plan workflow skills
  may use their required-gate commit helpers only when that gate is explicitly
  required; raw `git commit` remains Rene's manual terminal escape hatch. Before any agent publishes work by
  pushing, creating or updating a PR/MR, or direct publication, run the final
  personal publication checkpoint against the branch diff and exact HEAD SHA.
  This personal checkpoint does not replace hosted review, CI, Nitro, MR/PR
  approval, or the user's manual terminal escape hatch. Do not publish if the
  checkpoint is missing, stale, tied to another HEAD, or has unresolved blockers.
- Do not force push for ordinary follow-up work, review feedback, or CI fixes. Use subsequent commits because hosted diffs are squash-merged. Force push only when it is necessary to resolve a Git history change, rebase, conflict, stale remote update, or when the user explicitly asks for a history rewrite.
- Before pushing any non-default source branch in a PR/MR workflow or stack,
  check live hosted-review state for that branch. Never push to a branch whose
  only matching hosted PR/MR is already closed or merged; stop and ask whether
  to create a new branch and review artifact, reopen or explicitly reuse the old
  artifact, or take another path.
- When a safe recurring command needs approval, request a reusable scoped prefix rule instead of a one-off approval. Prefer narrow prefixes such as `["pnpm", "test"]`, `["pnpm", "run", "test"]`, `["git", "status"]`, `["git", "diff"]`, `["git", "show"]`, and `["glab", "mr", "view"]`; avoid reusable approvals for destructive commands, dependency installs, pushes, credential access, or broad interpreters like `python`, `node`, or `bash`.
- Keep approval-seeking commands prefix-matchable: avoid shell redirection, command substitution, heredocs, glob-heavy arguments, and broad `bash -lc` wrappers when a direct command works. If repeated prompts persist in a long-running Codex thread after sandbox or writable-root config changes, tell the user the thread may need to be restarted, forked, or handed off so the new config is loaded.
- In brainstorming or planning threads, treat agreement as design confirmation only. Do not edit files, generate migrations, or start implementation from scope agreement alone; wait for an explicit implementation trigger such as "implement this", "make the changes", "start the PR", "go ahead and code it", or "apply the plan".
- When the user says they dislike a proposed name, structure, or design shape, provide alternatives and tradeoffs before changing files, even if they did not explicitly ask for alternatives.
- For JavaScript and TypeScript projects, invoke package-managed commands through the package manager, such as `pnpm exec`, `pnpm dlx`, or `pnpm run`; never call binaries inside `node_modules` directly.
- Across all projects, do not name CI jobs, task-runner entries, package scripts
  that back automation, or pre-commit hook entries with generic `check`
  terminology. Use names that state the behavior being enforced, such as
  `lint`, `format`, `typecheck`, `unit-test`, `integration-test`, `e2e-test`,
  `build`, `schema-validate`, or `drift-validate`. If a tool's native command
  uses `check`, such as `biome check` or `git diff --check`, keep the native
  command invocation but wrap it in a purpose-specific job, hook, task, or
  script name.
- After changing shared skill, agent, instruction, or rule sources in this repo, run `writing-skills` against the changed agent behavior before committing. Portable shared skills must keep runnable helper logic inside the owning skill folder or a real package dependency; do not use repo-root workflow scripts or `runtime.reusableScripts` to make a skill portable. For live runtime refreshes, use the `ax-cli` steering skill and verify the affected installed surface before treating source edits as live.
- Do not stage or commit local workflow artifacts into work-project repositories. Keep reviewer scratch, readiness reports, reviewer reports, delivery ledgers, screenshots, command proofs, validation evidence, rejected generated shapes, and private plan-support pointers in the thread or private plan-support storage. Reusable AI repo workflow machinery, managed rules, skills, validators, runtime scripts, and regression fixtures may be committed only when that machinery is the feature being changed in this AI repo.
- Write agent and Codex hooks in TypeScript unless there is a specific runtime requirement that makes another language a better fit.
- After changing hook sources or hook registration behavior, run `pnpm ax hooks update` for the affected machine when live runtime refresh is intended, then use `pnpm ax hooks validate` or `pnpm ax hooks status` to confirm symlinks, startup registration, Codex trust state, and selected remote reporting.
- In troubleshooting mode, diagnose and report before editing or fixing anything.
- For multi-file implementation requests, work in the current agent session unless the user explicitly asks to use a subagent or the active workflow launches available subagents for bounded work or verification.
- For review work, use the relevant review skill or adapter in the current session. Skills may delegate to available local, cloud, or custom subagents when the workflow benefits from independent review lanes.
- Use confidence scores on actionable statements as defined in [rules/confidence.md](rules/confidence.md).
- Use `/doc-smith` for non-trivial documentation work and Mermaid for Markdown diagrams.
- Use `/scrutinize` for adversarial validation of plans, implementation diffs, PRs, hosted review feedback, proposed approaches, sanity checks, and second opinions.
- Always use the `hallmark` skill for frontend design work, including greenfield UI, redesigns, design audits, visual polish, and design extraction from URLs or screenshots.
- Prefer CLI tools that carry authentication and org conventions: `gh` for GitHub, `glab` for GitLab, and `wrangler` for Cloudflare.
- For this repo, completed work routes through GitLab `origin` merge requests against `main` with Nitro review by default. Do not commit directly to `main` or push `main` unless the user explicitly asks for direct publication.
- For this repo, a delivery artifact is complete only after the GitLab MR exists, CI or no-pipeline state is inspected, Nitro review is requested in a new top-level MR note containing only `/request_review @nitro`, and latest-head Nitro feedback is clean or fully resolved.
- Review-first plan workflows use the same GitLab MR/Nitro route with stacked delivery. When `plan-orchestrator`, `plan-review`, or the approved plan workflow requires Nitro-reviewed stacked delivery, create the planning MR first, wait for the required Nitro-clean planning-review gate, and only then continue to stacked implementation sequencing. A `plan-orchestrator` run may finish only with `stack_ready` for the full reviewed stack or `delivery_blocked` with evidence; one delivered OpenSpec task, `plan-ready` output, or `planning_review` handoff is not terminal success.
- When asked to merge stacked MRs, follow [rules/git-and-review.md](rules/git-and-review.md): land the stack bottom-to-top, expect each next MR to retarget to `main`, and resolve any newly surfaced conflicts before merging the next MR.
- Treat GitLab `origin` as the primary hosted-review and publishing remote for this repo. The `github` remote remains a mirror path; do not use it as the default delivery route unless the user explicitly asks or GitLab is unavailable.
- If a remote has multiple push URLs, push implementation branches only to the
  selected hosted-review provider URL or a provider-specific remote. Do not use
  a broad push that also updates mirror remotes.
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

### OpenSpec Runtime

- Use `pnpm ax openspec install|update|validate|status` to manage
  repo-local OpenSpec scaffolding.
- When invoked through the managed `~/.local/bin/ax` shim from another repo,
  the runtime source/config root remains this AI repo by default, while
  repo-local scopes such as `openspec` target the invocation current working
  directory. Use top-level `ax status` to verify source root, config
  path, target root, executable link health, managed runtime surfaces, hooks,
  and target OpenSpec readiness.
- Run `ax openspec install` only for missing OpenSpec setup. Headless
  install requires `--context-file <path>` with confirmed project context before
  writing `openspec/config.yaml`; interactive install previews inferred config
  and asks for confirmation. Do not use `--accept-inferred-config`.
- Run `ax openspec update` for configured projects. Normal update is
  asset-focused and skips mutation when validation reports generated assets are
  current. Use `--review-config` to review inferred context/rule changes, and
  use `--accept-config-changes` only when applying those changes headlessly.
- Run `ax openspec validate` after install, update, or config review;
  validation checks repo config quality, generated asset targets, portable
  skill boundaries, and symlink normalization.
- OpenSpec-generated skills are canonical under `.agents/skills/openspec-*` for
  this repo, with `.codex/skills/openspec-*` and
  `.claude/skills/openspec-*` pointing back by relative symlink.
- OpenSpec-generated Claude commands are canonical under `.agents/commands/opsx`
  with `.claude/commands/opsx/*` pointing back by relative symlink.
- Do not install OpenSpec-generated skills into global `~/.agents/skills` or
  move them into the shared repo `skills/` folder.

### Shared Automations

- Store reusable Codex automation definitions under [automations/](automations/).
- Runtime folders such as `~/.codex/automations` and `~/.agents/automations` should point here by symlink.
- Keep automation prompts self-contained and repo-aware; ignore runtime-only state such as jitter salts, logs, per-run state files, and automation memory/state artifacts such as `memory.md` and `state.json`.

### Installed Rules

Load the rule files installed under [rules/](rules/). Runtime profiles may install only the rule files relevant to this machine.

### Claude Code

- Treat `Bash`, `Task`, and slash skills such as `/glab-commit` as literal harness capabilities when available.
- Never use `WebFetch`; use `curl` through `Bash` for web content as described in [rules/command-and-tools.md](rules/command-and-tools.md).
- Use `/brainstorm` for brainstorming and design sessions, not the lower-level `brainstorming` skill name.

### Codex

- Map `Bash` instructions to the shell command tool available in Codex.
- Read the relevant skill `SKILL.md` before applying a named skill.
- Use `apply_patch` for manual file edits and read files before editing them.
- If a rule or skill uses subagents, keep prompts bounded, avoid write access unless explicitly approved by the workflow or user, and reconcile findings in the parent thread.

### Fullscript Workflows

- GitLab, GitHub, Linear, Cloudflare, Terraform, CI, Docker, and documentation rules are captured in the linked files.
- Fullscript-specific rules apply whenever working in Fullscript repositories, internal GitLab, internal CI, Cloudflare resources, or org-owned infrastructure.
