# AI Repo Agent Instructions

This file is the repo-local entrypoint for agents working in the `ai` repo.
Detailed policy lives under [rules/](rules/). Portable user-level instructions
live in [instructions/AGENTS.md](instructions/AGENTS.md).

## Scope and precedence

- Follow system, developer, and direct user instructions first, then this file
  and the relevant rule files.
- If a named tool is unavailable, use the closest safe equivalent and report
  any behavioral or verification difference.
- Run documented automated setup and install dependencies already declared by
  the project without separate permission. Adding, updating, downgrading, or
  removing dependencies, or accepting dependency manifest or lockfile changes,
  requires explicit user authorization or an accepted implementation contract.
  Destructive commands still require explicit authorization.

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
  task-local technical-readiness checkpoint after draft publication.
- **Finish** owns provider writes, hosted feedback follow-through, and readiness.
  Merge, deployment, and cleanup require explicit user authority or activated
  project policy.

Route authority before readiness. Every new substantive task begins in Explore
and defaults to `brainstorming`; an opening request to fix, implement, change,
or build does not itself authorize mutation. A materially different requested
outcome resets the task to Explore. Explicit mode wording overrides inference.
After the initial exploration, a later explicit instruction to proceed
authorizes Plan or Execute: Direct Execute is eligible only when one coherent
MR can deliver the accepted outcome and no material behavior, architecture,
migration, safety, ownership, ordering, cross-component contract, or
verification decision remains. Otherwise enter Plan. Limiting language such as
read-only, Plan-only, Execute-only, Review-only, or local-only stops at that
boundary.

After a mode gains authority, continue automatically within that scope. Ask
again only for a material contract decision, a required human-only action, or
an authority expansion. Routine wording, formatting, validation, test, CI,
review, and schema repairs do not require renewed permission. Clear agreement
with an explicit recommendation bundle accepts that bundle, but never unstated
scope or unrelated mutation or terminal authority. Existing authenticated
commands do not require renewed approval; credential entry or a new credential
grant remains a human action.

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
  dependency graph changes, publication, credentials, or interpreters.
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
- Default every non-trivial design and implementation to repository precedent
  discovery and canonical-owner reuse, even when the request does not mention
  an existing approach. New mechanisms require repository-backed justification.
- Keep reviewer scratch, fingerprints, handoffs, ledgers, command proof, and
  private workflow evidence in the task. Under `.agents/plans`, commit only a
  primary atomic-plan Markdown file. Reusable workflow machinery may be
  committed only when it is the feature being changed in this repo.
- Write hooks in TypeScript unless a concrete runtime requirement dictates
  another language.
- Troubleshooting remains read-only through diagnosis and report. Enter Execute
  only after the user requests a fix.
- Use confidence scores as defined in [rules/confidence.md](rules/confidence.md).
- Follow [rules/communication.md](rules/communication.md) for concise agent
  conversation and durable prose. Keep required evidence and confidence scores.
- Use `doc-smith` for non-trivial user-facing or operational documentation and
  `scrutinize` for adversarial validation. Atomic plans and OpenSpec artifacts
  use planning Review instead of Doc Smith reader personas.
  No mandatory frontend-design skill is currently selected.
- Prefer authenticated organization-aware CLIs: `gh`, `glab`, and `wrangler`.
- Do not use vague verification labels. Name the exact unit, integration,
  browser, route, console, deployment, or other verification performed.
- Before machine-readable YAML or JSON, include a concise `## Readable Summary`.

## Planning and delivery shape

- The five modes remain the only lifecycle authority owners. Bounded
  specialists operate inside them: Explore uses `brainstorming` and
  `start-project`; Plan uses `openspec-tasks`; Review uses the GitHub/GitLab
  host adapters and `nitro-review-feedback` when policy selects Nitro; Finish
  uses `change-request-create` plus the selected creation adapter.
- `codex-review-feedback` remains retired. GitHub PR review does not request,
  poll, normalize, or gate on Codex-authored review feedback.

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
- In the last final OpenSpec unit, Execute completes task state, synchronizes
  delta specs into canonical specs, and archives the verified change before the
  final hook-clean commit and draft publication. Review inspects that exact
  canonical-spec/archive head, and Finish treats it as a readiness input rather
  than cleanup. Incomplete or unverified work remains active.
- Review evidence stays task-local. After a hook-clean commit, publish the
  draft and request Nitro before local Review runs on that same head.
  `code-simplifier` is a core reviewer for planning artifacts, POC first
  objective proof, completed POCs, and final implementations; it always keeps
  its own recorded outcome even when review execution is integrated or falls
  back to another available model.
  Cover every phase-specific review type inline or through subagents, use one
  findings batch, and run bounded closure only for affected types after
  repairs. Local Review consumes the pre-commit hook's full-suite evidence and
  does not rerun it. A changed target base or HEAD requires a fresh exact-target
  checkpoint; patch-equivalent rebases may preserve discovery only after base-
  sensitive validation, while material contract or review-risk changes require
  new discovery.

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

## AX runtime

- Tracked `ax.config.json` is authoritative runtime state. It declares
  `runtime.installedProfiles`, `runtime.policyProfile`, exact managed targets,
  and `runtime.retiredSkills`.
- Use `pnpm ax sync` to replace declared runtime targets from source and remove
  explicitly retired skills and converge exact managed tool-config leaves.
  Scoped `skills sync`, `instructions sync`, `hooks sync`, and `configs sync`
  use the same config without initialization state.
- AX leaves unrelated paths and unowned tool-config values outside its exact
  declared ownership untouched.
- Use `ax status` and `ax validate` for offline, read-only inspection. They do
  not fetch remote refs, compare file contents, or mutate runtime state.
- Exercise AX changes before merge only with isolated HOME and runtime roots.
  Do not refresh the live runtime from a feature branch or disposable worktree.
  `--runtime-root` does not redirect tool config, so config sync requires an
  isolated HOME too.
- After every successful merge, locate the worktree that owns
  `refs/heads/main` with `git worktree list --porcelain`. Require it to be
  clean, run `git pull --ff-only origin main`, and verify its `HEAD` matches
  `origin/main` as the merged default branch source. From that main worktree,
  run live `pnpm ax sync` and `pnpm ax validate`. If any step fails, report the
  concrete blocker. Never substitute a feature or disposable worktree.
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
