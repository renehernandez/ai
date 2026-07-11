# AI Repo Agent Instructions

This file is the repo-local entrypoint for agents working in the `ai` repo.
Detailed policy lives under [rules/](rules/). Portable user-level instructions
live in [instructions/AGENTS.md](instructions/AGENTS.md).

## Scope and precedence

- Follow system, developer, and direct user instructions first, then this file
  and the relevant rule files.
- If a named tool is unavailable, use the closest safe equivalent and report
  any behavioral or verification difference.
- Do not install dependencies or run destructive commands unless the user or an
  approved implementation contract explicitly authorizes them.

## Five-mode workflow

Explore, Plan, Execute, Review, and Finish are the only inferred lifecycle
modes. An explicit mode name overrides inference. At non-trivial entry or any
authority expansion, state the mode, mutation authority, and goal once.

- **Explore** is read-only discovery, research, project intake, and divergent
  thinking. It produces no repository, tracker, or provider writes.
- **Plan** settles material decisions conversationally, then writes the selected
  planning artifact. It does not implement from design agreement alone.
- **Execute** implements accepted work in one owned branch/worktree. Exactly one write owner controls each worktree and may edit, stage, and commit there.
- **Review** is read-only inspection of one artifact fingerprint, target-base
  diff, or exact HEAD. It returns findings to Plan or Execute and emits the
  task-local publication checkpoint.
- **Finish** owns provider writes, hosted feedback follow-through, and readiness.
  Merge, deployment, and cleanup require explicit user authority or activated
  project policy.

Route semantically. Direct Execute is eligible only when one coherent MR can
deliver the outcome and no material behavior, architecture, migration, safety,
ownership, ordering, cross-component contract, or verification decision
remains. Otherwise enter Plan. Limiting language such as read-only, Plan-only,
Execute-only, Review-only, or local-only stops at that boundary.

## Quick operating rules

- Keep commands simple: one command per tool call, no compound shell chains,
  and no `--no-verify`.
- Use native hook-enabled Git commits. Fix hook failures before retrying; never
  bypass repository hooks.
- Do not force-push ordinary follow-up, review-feedback, or CI-fix commits.
  Force-push only for an explicitly authorized history rewrite or a required
  history repair such as rebase/conflict recovery.
- Before pushing a non-default branch, inspect live hosted state. Do not reuse a
  branch whose only review artifact is closed or merged without user direction.
- Ask for narrowly scoped reusable approval prefixes for recurring safe
  commands. Never request broad reusable approval for destructive commands,
  dependency installation, publication, credentials, or interpreters.
- For JavaScript and TypeScript, run project binaries through `pnpm exec`,
  `pnpm dlx`, or `pnpm run`; never call `node_modules/.bin` directly.
- Across all projects, do not use generic `check` terminology for CI jobs,
  task-runner entries, automation-backed package scripts, or pre-commit hook
  entries. Use behavior-specific names such as `lint`, `format`, `typecheck`, `unit-test`, `integration-test`, `e2e-test`, `build`, `schema-validate`, or
  `drift-validate`. Native commands such as `biome check` remain valid behind a
  purpose-specific job, hook, task, or script name.
- After changing shared skill, agent, instruction, or rule sources, run
  `writing-skills` against the changed agent behavior before committing.
  Portable shared skills keep runnable helpers in the owning skill folder or a
  real package dependency.
- Keep reviewer scratch, fingerprints, handoffs, ledgers, command proof, and
  private workflow evidence in the task. Under `.agents/plans`, commit only a
  primary atomic-plan Markdown file. Reusable workflow machinery may be
  committed only when it is the feature being changed in this repo.
- Write hooks in TypeScript unless a concrete runtime requirement dictates
  another language.
- Troubleshooting remains read-only through diagnosis and report. Enter Execute
  only after the user requests a fix.
- Use confidence scores as defined in [rules/confidence.md](rules/confidence.md).
- Use `doc-smith` for non-trivial documentation, `scrutinize` for adversarial
  validation, and `hallmark` for frontend design work.
- Prefer authenticated organization-aware CLIs: `gh`, `glab`, and `wrangler`.
- Do not use vague verification labels. Name the exact unit, integration,
  browser, route, console, deployment, or other verification performed.
- Avoid generic AI filler and formulaic contrast phrasing.
- Before machine-readable YAML or JSON, include a concise `## Readable Summary`.

## Planning and delivery shape

- Plan stays conversational until scope, design, delivery shape, risk,
  acceptance, proof, and policy decisions are coherent.
- AI-repo work uses one atomic plan and one final MR. When a proposed change is
  too broad for one coherent MR, split it into separately accepted atomic
  changes. Do not infer an OpenSpec route for ordinary AI-repo work.
- OpenSpec adapters remain explicit developer commands. When the user explicitly
  invokes one, follow its complete POC and delivery contract; otherwise create
  no OpenSpec change for this repository.
- Do not create a separate planning MR. An atomic plan and its implementation
  are one change set in one final MR, with no POC MR or POC phase.
- Review evidence stays task-local. A changed artifact, target base, or HEAD
  invalidates its evidence and publication checkpoint.

## Repository Finish policy

- Finish routes this repo through GitLab `origin`. A single or root MR targets
  `main`; each stacked descendant targets its immediate predecessor branch
  until that predecessor merges and the child retargets. Do not push `main` or
  publish directly to it without explicit user authorization.
- The `github` remote is a mirror. When a remote has several push URLs, publish
  only to the selected GitLab URL or a provider-specific remote.
- Finish inspects CI or no-pipeline state and posts a new top-level note
  containing only `/request_review @nitro`. It reads the complete Nitro response
  and unresolved Nitro-authored discussions; reassuring summary language does
  not override carried-forward actionable feedback.
- Every final MR is created and kept draft through implementation, CI, review,
  and technical readiness. Finish stays active after publication, follows the
  complete pipeline graph and hosted feedback, and reactivates the current
  Execute owner to fix in-scope failures without requiring another user prompt.
- Implementation or delivery wording authorizes publication and hosted
  follow-through, not merge. Merge, deployment, and cleanup remain explicit.
- For multiple final delivery units, preserve the total predecessor order,
  implement semantically eligible units concurrently in singly owned
  worktrees, retarget and restack after predecessor squash merges, and refresh
  every changed effective-diff gate.
- Technical readiness leaves every MR draft. Explicit merge authority starts a
  bottom-to-top sequence that marks only the current MR ready immediately before
  its merge and waits for any review triggered by that transition.

## Organizational agents

- Use the `agent-workspace` skill to activate, resume, delegate to, message,
  open, or deactivate pinned organizational agents and ephemeral Agent Runs.
- Linear and Git own durable coordination state. Do not create a private
  orchestration database or treat editable tracker text as authority.
- Route delivery through the Delivery Executive Assistant and operations
  drafting through the Executive Operations Assistant. Rene retains merge and
  external-action authority unless an exact active policy grants it.
- Manage generated custom-agent descriptors through the tracked `agents/`
  source and `ax agents`; never edit installed TOML directly.

## AX runtime

- Tracked `ax.config.json` is authoritative runtime state. It declares
  `runtime.installedProfiles`, `runtime.policyProfile`, exact managed targets,
  and `runtime.retiredSkills`.
- Use `pnpm ax sync` to replace declared runtime targets from source and remove
  explicitly retired skills. Scoped `skills sync`, `instructions sync`, and
  `hooks sync` use the same config without initialization state.
- AX leaves unrelated paths outside its exact declared targets untouched.
- Use `ax status` and `ax validate` for offline, read-only inspection. They do
  not fetch remote refs, compare file contents, or mutate runtime state.
- Exercise AX changes before merge only with isolated HOME and runtime roots.
  Do not refresh the live runtime from a feature branch or disposable worktree.
- After merge, verify the clean merged default branch source, then run live
  `ax sync`.
- Use `ax openspec sync` in the invocation repository for repo-local OpenSpec
  convergence. Headless first setup requires `--context-file <path>`; configured
  review keeps the explicit config-review flags. Top-level runtime sync never
  mutates repo-local OpenSpec.
- The managed shim keeps the durable AI repo as source/config root while
  repo-local scopes target the current working directory.

## Harness entrypoints

- Use project-native setup and verification commands from nearby repository
  instructions. This file does not define a universal setup command.
- Store reusable Codex automation definitions under [automations/](automations/)
  and keep prompts self-contained and repo-aware.
- Load installed rule files under [rules/](rules/) that apply to the active
  profile.
- In Codex, map shell instructions to the available shell tool, read each
  selected skill fully, use `apply_patch` for manual edits, and keep delegated
  work bounded.
- Fullscript GitLab, infrastructure, CI, Cloudflare, and related organization
  rules apply whenever their systems are in scope.
