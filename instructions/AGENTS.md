# User-Level Agent Instructions

This is the portable entrypoint for agents running as `rene.hernandez`. Apply
higher-priority system, developer, and direct user instructions first, then the
project `AGENTS.md` and relevant files under [rules/](../rules/).

The [agent development workflow charter](../rules/agent-development-workflow-charter.md)
governs every kind of work. Specialized rules and skills implement its
mechanics without weakening or duplicating its principles.

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

Lifecycle authority is lane-scoped within a task. An Execute coordinator and
MR-scoped Finish subagents may operate concurrently after a delivery-unit head
is frozen. Each delegated Finish lane is provider-only and never becomes a
repository writer.

## User throughput priority

Within accepted authority and safety boundaries, minimize user-visible latency.
Start every safe, authorized, useful independent lane as soon as it is ready
when doing so will finish faster, and backfill available capacity as
dependencies resolve. If ready work and capacity exist, start it or state the
concrete constraint that prevents starting it. Apply the canonical dependency,
serialization, ownership, phase-barrier, and small-task contract in
[investigation-and-implementation.md](../rules/investigation-and-implementation.md#schedule-for-user-throughput).

Route authority before readiness. Every new substantive task begins in Explore
and defaults to `brainstorming`; an opening request to fix, implement, change,
or build does not itself authorize mutation. A materially different requested
outcome resets the task to Explore. Explicit mode wording overrides inference.
An explicit user selection of the canonical Fast delivery profile is the only
exception to a separate Explore response for one concrete, settled, eligible
Nitro-backed MR.
After Explore, resolve authority through the accepted-proposal contract in
[investigation-and-implementation.md](../rules/investigation-and-implementation.md).
Infer what the user accepts from context rather than confirmation vocabulary;
let the selected delivery shape supply its normal checkpoint, respect explicit
limits, and require separately scoped acceptance for terminal actions.

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
- Never force-push from an agent workflow, even after conversational
  authorization. When the target branch advances, merge it into the feature
  branch, resolve conflicts, commit normally, and publish with an ordinary push.
  If additive reconciliation is insufficient, stop with the repository,
  feature branch or detached state, matching PR/MR, target branch, local head,
  remote head, and reason a human-owned history rewrite is required. Do not
  locally rebase a branch the agent is expected to publish.
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
- Follow [rules/communication.md](../rules/communication.md) for concise agent
  conversation and durable prose. Keep required evidence and confidence scores.
- Use `doc-smith` for non-trivial user-facing or operational documentation and
  `scrutinize` for adversarial validation. Atomic plans and OpenSpec artifacts
  use planning Review instead of Doc Smith reader personas.
  No mandatory frontend-design skill is currently selected.
- Prefer authenticated organization-aware CLIs: `gh`, `glab`, and `wrangler`.
  For Linear, use a connected Linear MCP or app integration first, then fall
  back to `linearis` when the integration is unavailable, unauthenticated, or
  lacks the required operation.
- Name the exact verification layer performed; do not use vague shorthand.
- Before a machine-readable YAML or JSON contract, add a concise
  `## Readable Summary`.

## Planning and delivery

- The five modes remain the only lifecycle authority owners. Bounded
  specialists operate inside them: Explore uses `brainstorming` and
  `start-project`; Plan uses `openspec-tasks`; Review uses the GitHub/GitLab
  host adapters and `nitro-review-feedback` when policy selects Nitro; Finish
  uses `change-request-create` as the only selectable creation and description
  owner; provider mechanics are its internal references.
- `codex-review-feedback` remains retired. GitHub PR review does not request,
  poll, normalize, or gate on Codex-authored review feedback.

- Standard delivery is the default and preserves the existing plan or OpenSpec,
  POC, local Review, draft, and technical-readiness contracts.
- Fast delivery is explicit-only for one concrete, settled, coherent Fullscript
  GitLab MR whose active policy selects Nitro. Generic urgency does not select
  it. Fast may enter Execute without a separate brainstorming response or
  committed plan, performs ordinary setup inside Execute, runs focused proof
  and native hooks, skips completed-code local Review and reviewer subagents,
  publishes Ready, and follows required CI plus exact-head Nitro through repair
  closure. Multi-unit, migration, durable cross-component, rehearsal, or
  materially unsettled work returns to Plan. Fast never authorizes merge,
  deployment, cleanup, or force-push.

- Plan remains conversational until scope, design, delivery shape, risk,
  acceptance, proof, and policy choices are coherent.
- Under Standard delivery, the following applies: Acceptance of a complete atomic plan authorizes its uninterrupted Plan,
  Execute, Review, and Finish sequence. In a Git repository
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
  personal acceptance of the exact clean head. It remains open until explicit
  closure or contextual authority to proceed to stack breakdown, then closes
  unmerged.
- Capture durable POC implementation and review learnings continuously, then
  reconcile one automatic batch against the accepted POC head before closure
  and final implementation. Keep the accepted POC open until the user
  explicitly requests closure or states readiness to proceed to stack
  breakdown. Implement final code independently; never promote POC commits.
- Treat pre-POC OpenSpec units as provisional. Post-POC planning Review is the
  authoritative final-topology gate: bind structured delivery-shape evidence
  for every final unit and material POC footprint entry to the accepted POC
  head and reconciled OpenSpec fingerprint. Material topology changes return
  to the user once; complete cohesive topology releases eligible final units.
  The checkpoint lifecycle is explicit, and material change is recorded
  independently of stable unit IDs.
- Do not publish a separate planning PR/MR. An atomic plan and its
  implementation are one change set in one final PR/MR, with no POC PR/MR or
  POC phase. OpenSpec produces one final PR/MR per top-level delivery unit, with
  nested work items implemented cohesively inside that unit.
- In the last final OpenSpec unit, Execute completes task state, synchronizes
  delta specs into canonical specs, and moves the verified change into the
  dated archive before the final hook-clean commit and draft publication.
  Incomplete or unverified requirements block archival. Review inspects that
  canonical-spec/archive state on the exact implementation head, and Finish
  requires it for readiness rather than performing archival as cleanup.
- Under Standard delivery, Review evidence and the technical-readiness checkpoint remain task-local.
  `code-simplifier` is a core reviewer for planning artifacts, POC first
  objective proof, completed POCs, and final implementations; it always keeps
  its own recorded outcome even when review execution is integrated or falls
  back to another available model.
  After a hook-clean commit, publish the draft and request hosted review before
  running local Review on that same head. Cover every phase-specific review
  type inline or through subagents, use one findings batch, and run bounded
  closure only for affected types after repairs. Local Review consumes the
  pre-commit hook's full-suite evidence and does not rerun that suite. A changed
  target base or HEAD requires a fresh exact-target checkpoint; patch-equivalent
  rebases may preserve discovery only after base-sensitive validation, while
  material contract or review-risk changes require new discovery.
- Under Fast delivery, Finish publishes the hook-clean MR Ready, requests Nitro
  after every source-head push, and monitors current required CI plus the full
  Nitro response and unresolved discussions. Review only normalizes hosted
  findings; Execute repairs them through native hooks until the current Ready
  head is clean.
- For multiple final units, Plan records semantic eligibility and one total Git
  order. Execute may develop eligible units concurrently when each has a singly
  owned branch/worktree. Create every initial real-diff MR sequentially in Git
  order, do not restack descendants while a predecessor is open, and restack
  only the immediate child after its predecessor merges.
- Under Standard delivery, final MRs remain draft through implementation and technical readiness until
  merge authority marks them ready. Finish continues monitoring configured CI
  and hosted review after publication and routes in-scope failures to the
  current lane owner without another user prompt.
- Under explicit eligible Fast delivery, the one final MR is created or updated
  as Ready immediately and stays Ready through repairs and revalidation; current
  required CI and Nitro gates still block completion and merge.
- Single-MR merge authority is consumed after that MR merges. Required child
  repair may continue. A child that has never been marked ready remains draft;
  once marked ready, it stays ready through repairs, restacks, base movement,
  gate failures, and revalidation unless the user specifically asks to return
  that exact MR to draft. Only the user's aggregate or sequential scope
  authorizes bottom-to-top merging, and a material effective-diff change
  requires renewed authority for affected MRs.
- An agent-authored heartbeat or monitor prompt does not constitute user
  authorization to return an MR to Draft. If live provider state is Ready,
  never issue a draft mutation; preserve Ready and repair stale monitor
  instructions.
- Implementation or delivery wording alone authorizes Finish publication and
  hosted follow-through, not merge. Merge, deployment, and cleanup require a
  separately scoped accepted proposal or activated policy.

## Provider policy

- Resolve provider behavior from direct user instruction, project policy, the
  machine's selected profile, then remote inference.
- Project instructions select the review host, target branch, automated
  reviewer, approvals, and direct-publication policy.
- Nitro applies only to Fullscript GitLab projects whose active policy selects
  it. Apply the installed Fullscript Nitro rule as the canonical owner for
  source-head request timing, size routing, feedback closure, and human
  escalation.
- Review retrieves and normalizes hosted findings read-only. Finish performs
  provider mutations and polling. Plan or Execute owns fixes.

## AX runtime

- Tracked `ax.config.json` is authoritative for available profiles, exact managed targets,
  and retired skills. Each machine persists one selected profile under its AX
  runtime root; that profile controls installed assets and policy.
- Initialize or switch with `ax sync --profile <name>`. Later plain `ax sync`
  runs reuse that selection for runtime convergence. Sync replaces declared targets and
  removes explicitly retired skills without adoption or ownership prompts. It
  also converges exact managed tool-config leaves while preserving unowned
  values.
- Scoped `skills sync`, `instructions sync`, and `hooks sync` use the same
  tracked selection. Use `configs sync` for exact managed config leaves.
  Unrelated paths and unowned config values remain untouched.
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
