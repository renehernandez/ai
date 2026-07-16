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

Route authority before readiness. Every new substantive task begins in Explore
and defaults to `brainstorming`; an opening request to fix, implement, change,
or build does not itself authorize mutation. A materially different requested
outcome resets the task to Explore. Explicit mode wording overrides inference.
After the initial exploration, a later explicit instruction to proceed
authorizes Plan or Execute: Direct Execute is eligible only when one coherent
MR can deliver the accepted outcome and no material behavior, architecture,
migration, safety, ownership, ordering, cross-component contract, or
verification decision remains. Otherwise use Plan. Narrow language such as
read-only, Plan-only, Execute-only, Review-only, or local-only limits later
modes.

## Operating rules

- Keep commands simple: one command per tool call, no compound shell chains,
  and no `--no-verify`.
- Use native hook-enabled Git commits. Fix hook failures and restage before
  retrying; never bypass repository hooks.
- Run documented automated setup and install dependencies already declared by
  the project without separate permission. Adding, updating, downgrading, or
  removing dependencies, or accepting dependency manifest or lockfile changes,
  requires explicit user authorization or an accepted implementation contract.
  Destructive commands still require explicit authorization.
- Do not force-push ordinary follow-up, feedback, or CI-fix commits. Reserve
  force-push for an authorized history rewrite or required history repair.
- Before pushing a non-default branch, inspect live hosted state. Do not reuse a
  branch whose only review artifact is closed or merged without user direction.
- Request narrow reusable approval prefixes for recurring safe commands. Avoid
  broad approvals for destructive commands, dependency graph changes,
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
- Default every non-trivial design and implementation to repository precedent
  discovery and canonical-owner reuse, even when the request does not mention
  an existing approach. New mechanisms require repository-backed justification.
- Keep reviewer scratch, fingerprints, handoffs, ledgers, command proof, and
  other private workflow evidence in the task. Under `.agents/plans`, commit
  only a primary atomic-plan Markdown file.
- Write agent hooks in TypeScript unless a concrete runtime requirement dictates
  another language.
- Troubleshooting stays read-only through diagnosis and report. Enter Execute
  only when the user requests a fix.
- Use confidence scores from [rules/confidence.md](../rules/confidence.md).
- Use `doc-smith` for non-trivial user-facing or operational documentation and
  `scrutinize` for adversarial validation. Atomic plans and OpenSpec artifacts
  use planning Review instead of Doc Smith reader personas.
  No mandatory frontend-design skill is currently selected.
- Prefer authenticated organization-aware CLIs: `gh`, `glab`, and `wrangler`.
- Name the exact verification layer performed; do not use vague shorthand.
- Avoid generic AI filler and formulaic contrast phrasing.
- Before a machine-readable YAML or JSON contract, add a concise
  `## Readable Summary`.

## Planning and delivery

- The five modes remain the only lifecycle authority owners. Bounded
  specialists operate inside them: Explore uses `brainstorming` and
  `start-project`; Plan uses `openspec-tasks`; Review uses the GitHub/GitLab
  host adapters and `nitro-review-feedback` when policy selects Nitro; Finish
  uses `change-request-create` plus the selected creation adapter.
- `codex-review-feedback` remains retired. GitHub PR review does not request,
  poll, normalize, or gate on Codex-authored review feedback.

- Plan remains conversational until scope, design, delivery shape, risk,
  acceptance, proof, and policy choices are coherent.
- Acceptance of a complete atomic plan, including `agreed`, authorizes its
  uninterrupted Plan, Execute, Review, and Finish sequence. In a Git repository
  with a valid upstream, implementation is not complete until its dedicated
  draft PR/MR is published and required CI and configured automated reviewers
  confirm no actionable automated feedback remains. Explicit narrower mode or
  no-push limits override this default. This does not authorize merge.
- Use an atomic plan for one coherent implementation unit that needs no durable
  cross-component specification or mandatory rehearsal. Its plan and
  implementation form one change set in one final PR/MR; it has no POC phase.
- Use OpenSpec for independently reviewable delivery units, durable
  cross-component contracts, migration design, or work requiring full
  rehearsal.
- Every OpenSpec receives one complete disposable implementation POC. The POC is
  a draft review-only PR/MR that receives local and hosted automated review plus
  personal acceptance of the exact clean head, then closes unmerged.
- Reconcile durable POC findings once per authorized cycle. Implement final
  code independently; never promote POC commits.
- Do not publish a separate planning PR/MR. An atomic plan and its
  implementation are one change set in one final PR/MR, with no POC PR/MR or
  POC phase. OpenSpec produces one final PR/MR per top-level delivery unit, with
  nested work items implemented cohesively inside that unit.
- Review evidence and the technical-readiness checkpoint remain task-local.
  After a hook-clean commit, publish the draft and request hosted review before
  running local Review on that same head. Cover every phase-specific review
  type inline or through subagents, use one findings batch, and run bounded
  closure only for affected types after repairs. Local Review consumes the
  pre-commit hook's full-suite evidence and does not rerun that suite. A changed
  target base or HEAD requires a fresh exact-target checkpoint; patch-equivalent
  rebases may preserve discovery only after base-sensitive validation, while
  material contract or review-risk changes require new discovery.
- For multiple final units, Plan records semantic eligibility and one total Git
  order. Execute may develop eligible units concurrently when each has a singly
  owned branch/worktree; publication and restack propagation preserve the Git
  predecessor order.
- Final MRs remain draft through implementation and technical readiness.
  Finish continues monitoring configured CI and hosted review after publication
  and routes in-scope failures to the current lane owner without another user
  prompt.
- Implementation or delivery wording authorizes Finish publication and hosted
  follow-through, not merge. Merge, deployment, and cleanup remain explicit.

## Provider policy

- Resolve provider behavior from direct user instruction, project policy, the
  machine's selected profile, then remote inference.
- Project instructions select the review host, target branch, automated
  reviewer, approvals, and direct-publication policy.
- Nitro applies only to Fullscript GitLab projects whose active policy selects
  it. A review request is a new top-level note containing only
  `/request_review @nitro`. Read the complete response and unresolved
  Nitro-authored discussions; actionable feedback anywhere in the response must
  be fixed or explicitly dispositioned before readiness.
- Review retrieves and normalizes hosted findings read-only. Finish performs
  provider mutations and polling. Plan or Execute owns fixes.

## Organizational agents

- Use the `agent-workspace` skill to activate, resume, delegate to, message,
  open, or deactivate pinned organizational agents and ephemeral Agent Runs.
- Linear and Git own durable coordination state. Do not create a private
  orchestration database or treat editable tracker text as authority.
- Route delivery through the Delivery Executive Assistant and operations
  drafting through the Executive Operations Assistant. Rene retains merge and
  external-action authority unless an exact active policy grants it.
- Manage pinned prompt bundles and ephemeral custom-agent descriptors through
  the tracked `agents/` source and `ax agents`; never edit installed outputs
  directly.
- Generate the two persistent coordinator project roots through `ax
  coordinators`. Activation requires their current saved-project IDs and policy
  fingerprints from AX registration.

## AX runtime

- Tracked `ax.config.json` is authoritative for available profiles, exact managed targets,
  and retired skills. Each machine persists one selected profile under its AX
  runtime root; that profile controls installed assets and policy.
- Initialize or switch with `ax sync --profile <name>`. Later plain `ax sync`
  runs reuse that selection for runtime convergence. Sync replaces declared targets and
  removes explicitly retired skills without adoption or ownership prompts. It
  also converges exact managed tool-config leaves while preserving unowned
  values.
- Scoped `skills sync`, `instructions sync`, `hooks sync`, `agents sync`, and
  `coordinators sync` use the same tracked selection. Use `configs sync` for
  exact managed config leaves. Unrelated paths and unowned config values remain
  untouched.
- Use `ax status` and `ax validate` for offline, read-only inspection with no
  network access, content comparison, or mutation.
- Exercise feature-branch AX behavior only with isolated HOME and runtime roots.
  Keep the live runtime unchanged before merge. `--runtime-root` does not
  redirect tool config, so config sync requires an isolated HOME too.
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
