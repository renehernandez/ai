# User-Level Agent Instructions

This is the portable entrypoint for agents running as `rene.hernandez`. Apply
higher-priority system, developer, and direct user instructions first, then the
project `AGENTS.md` and relevant files under [rules/](../rules/).

## Five-mode workflow

Explore, Plan, Execute, Review, and Finish are the only inferred lifecycle
modes. An explicit mode name overrides inference. For non-trivial work, announce
the mode, mutation authority, and goal once when entering or expanding
authority.

- **Explore** is read-only discovery, research, project intake, and divergent
  thinking. It does not write repository, tracker, or provider state.
- **Plan** resolves material decisions conversationally, then writes one atomic
  plan or OpenSpec artifact.
- **Execute** implements accepted work in one owned branch/worktree. Exactly one write owner controls each worktree and may edit, stage, and commit there.
- **Review** inspects one exact artifact fingerprint, target-base diff, or HEAD
  read-only and returns findings to Plan or Execute.
- **Finish** owns provider mutations, hosted feedback follow-through, and
  readiness. Merge, deployment, and cleanup require explicit user authority or
  activated project policy.

Route from unresolved decisions and contract needs. Direct Execute is eligible
only when one coherent MR can deliver the outcome and no material behavior,
architecture, migration, safety, ownership, ordering, cross-component contract,
or verification decision remains. Otherwise use Plan. Narrow language such as
read-only, Plan-only, Execute-only, Review-only, or local-only limits later
modes.

## Operating rules

- Keep commands simple: one command per tool call, no compound shell chains,
  and no `--no-verify`.
- Use native hook-enabled Git commits. Fix hook failures and restage before
  retrying; never bypass repository hooks.
- Do not install dependencies or run destructive commands without explicit
  authorization from the user or accepted implementation contract.
- Do not force-push ordinary follow-up, feedback, or CI-fix commits. Reserve
  force-push for an authorized history rewrite or required history repair.
- Before pushing a non-default branch, inspect live hosted state. Do not reuse a
  branch whose only review artifact is closed or merged without user direction.
- Request narrow reusable approval prefixes for recurring safe commands. Avoid
  broad approvals for destructive commands, dependency installation,
  publication, credentials, or interpreters.
- For JavaScript and TypeScript, use `pnpm exec`, `pnpm dlx`, or `pnpm run`;
  never invoke `node_modules/.bin` directly.
- Across all projects, avoid generic `check` terminology for CI jobs,
  task-runner entries, automation-backed package scripts, and pre-commit hook
  entries. Use behavior-specific names such as `lint`, `format`, `typecheck`, `unit-test`, `integration-test`, `e2e-test`, `build`, `schema-validate`, or
  `drift-validate`. A native command such as `biome check` stays behind a
  purpose-specific job, hook, task, or script name.
- After changing shared skill, agent, instruction, or rule sources, run
  `writing-skills` against the changed agent behavior before committing.
  Portable shared skills keep runnable helpers in the owning skill folder or a
  real package dependency.
- Keep reviewer scratch, fingerprints, handoffs, ledgers, command proof, and
  other private workflow evidence in the task. Under `.agents/plans`, commit
  only a primary atomic-plan Markdown file.
- Write agent hooks in TypeScript unless a concrete runtime requirement dictates
  another language.
- Troubleshooting stays read-only through diagnosis and report. Enter Execute
  only when the user requests a fix.
- Use confidence scores from [rules/confidence.md](../rules/confidence.md).
- Use `doc-smith` for non-trivial documentation, `scrutinize` for adversarial
  validation, and `hallmark` for frontend design.
- Prefer authenticated organization-aware CLIs: `gh`, `glab`, and `wrangler`.
- Name the exact verification layer performed; do not use vague shorthand.
- Avoid generic AI filler and formulaic contrast phrasing.
- Before a machine-readable YAML or JSON contract, add a concise
  `## Readable Summary`.

## Planning and delivery

- Plan remains conversational until scope, design, delivery shape, risk,
  acceptance, proof, and policy choices are coherent.
- Use an atomic plan for one coherent final MR that needs no durable
  cross-component specification or mandatory rehearsal.
- Use OpenSpec for independently reviewable delivery units, durable
  cross-component contracts, migration design, or work requiring full
  rehearsal.
- Every OpenSpec receives one complete disposable implementation POC. The POC is
  a draft review-only PR/MR that receives local and hosted automated review plus
  personal acceptance of the exact clean head, then closes unmerged.
- Reconcile durable POC findings once per authorized cycle. Implement final
  code independently; never promote POC commits.
- Do not publish a separate planning PR/MR. An atomic plan produces one final
  PR/MR. OpenSpec produces one final PR/MR per top-level delivery unit, with
  nested work items implemented cohesively inside that unit.
- Review evidence and the publication checkpoint remain task-local and become
  stale when the artifact, target base, or HEAD changes.
- Implementation or delivery wording authorizes Finish publication and hosted
  follow-through, not merge. Merge, deployment, and cleanup remain explicit.

## Provider policy

- Resolve provider behavior from direct user instruction, project policy, one
  workflow-policy profile, then remote inference.
- Project instructions select the review host, target branch, automated
  reviewer, approvals, and direct-publication policy.
- Nitro applies only to Fullscript GitLab projects whose active policy selects
  it. A review request is a new top-level note containing only
  `/request_review @nitro`, and latest-head feedback must pass.
- Review retrieves and normalizes hosted findings read-only. Finish performs
  provider mutations and polling. Plan or Execute owns fixes.

## AX runtime

- Tracked `ax.config.json` is desired state. Local
  `~/.agents/runtime/managed-runtime.json` is ownership state. The filesystem is
  observed state.
- Use `ax sync` for runtime convergence. Scoped `skills sync`,
  `instructions sync`, and `hooks sync` require an initialized manifest and do
  not change its installed or policy profile selection.
- Use `ax status` and `ax validate` for offline, read-only inspection with no
  network access or mutation.
- Exercise feature-branch AX behavior only with isolated HOME and runtime roots.
  Keep the live runtime unchanged before merge.
- After merge, verify a clean local default-branch source and run live
  `ax sync`.
- Use `ax openspec sync` in the invocation repository for repo-local OpenSpec.
  Headless first-time setup requires `--context-file <path>`; top-level runtime
  sync never mutates the current working directory's OpenSpec assets.

## Harness entrypoints

- Use the current project's own setup and verification commands.
- Store reusable Codex automations in the shared `automations/` source and keep
  prompts self-contained and repo-aware.
- Load the installed rule files relevant to the active runtime profile.
- In Codex, map shell guidance to the available shell tool, read selected skills
  fully, use `apply_patch` for manual edits, and keep delegated work bounded.
- Fullscript-specific rules apply to Fullscript repositories, internal GitLab,
  internal CI, Cloudflare resources, and organization-owned infrastructure.
