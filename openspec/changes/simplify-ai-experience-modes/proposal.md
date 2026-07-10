## Why

The current AI workflow exposes overlapping lifecycle skills, couples agent commits and planning handoffs to AX-owned state, and makes authority hard to follow across planning, implementation, review, and publication. The desired experience needs five predictable modes, repository-native isolation and verification, durable team-facing planning artifacts, and private local orchestration.

## What Changes

- Introduce five inferred public workflow modes: Explore, Plan, Execute, Review, and Finish. Explicit mode names override inference, and authority-expanding transitions remain visible.
- Keep Explore read-only for discovery, research, project intake, and divergent thinking. Starting a project produces a conversational context pack and initial Linear project description without creating tracker state.
- Make Plan a convergent brainstorming mode whose completion writes one primary artifact: `.agents/plans/<slug>.md` for one implementation MR or an OpenSpec change for a multi-MR delivery. Size, file count, ownership, risk, migrations, and delivery shape inform routing; an explicit user route overrides the heuristics.
- Require automatic read-only subagent review after a Plan artifact is written or changed. In-scope findings return to Plan automatically; material scope, architecture, safety, or delivery changes return to the user. A reviewed Plan artifact is committed with native Git and published in a planning-only PR or MR.
- Require every Plan artifact to generate corresponding Linear delivery records after the user approves an exact issue/project preview. Atomic plans create one implementation issue; OpenSpec changes create one issue per delivery unit. Project ambiguity blocks issue creation until the user selects or creates a project, and skipping Linear requires explicit confirmation for that artifact.
- **BREAKING** Make a complete, disposable implementation rehearsal mandatory for every OpenSpec after latest-head hosted planning review and before final stack delivery. An exact completion receipt reconciles every planned unit/work item and applicable production surface against one POC head. Automated latest-head feedback plus explicit user acceptance are required; POC commits are never promoted into the final stack, and runtime cutover is rehearsed only in isolated roots.
- Preserve a direct Execute path for small, unambiguous implementation requests. Direct Execute skips Plan artifacts, planning review, Linear generation, and the OpenSpec rehearsal, but still uses an isolated worktree, native hooks, automatic Review, relevant read-only reviewer subagents, and a normal implementation PR or MR when delivery is authorized.
- Enforce one writer per MR-owned worktree. Reviewers remain read-only; parallel writers require separate worktrees; ownership transfer requires an explicit handoff.
- **BREAKING** Replace agent-authored `ax commit` and required local review-gate commits with native `git commit`. Cohesive intermediate commits run repository hooks normally, never use `--no-verify`, and cannot advance after hook failure until the boundary is fixed, restaged, and committed successfully.
- Preserve the AI repo's existing pre-commit contract: staged Biome validation, skill validation, and the complete unit-plus-integration test suite run for every commit.
- Automatically enter Review after Plan artifacts, material POC heads, direct Execute, and each implementation delivery unit. Review evidence remains task-local; stale or missing evidence is recomputed instead of committed or copied into hosted descriptions.
- Make Plan own planning-state publication, including planning PRs/MRs and explicitly approved Linear writes. Finish owns implementation publication, hosted feedback follow-through, merge readiness, and explicitly authorized merge, deployment, or cleanup.
- Deliver one planning artifact PR/MR plus one implementation PR/MR for an atomic plan. Deliver one planning PR/MR, one unmerged full-rehearsal PR/MR, and one dependency-ordered implementation PR/MR per OpenSpec delivery unit. Implementation may begin after the exact planning head is approved and the required rehearsal is accepted.
- Update an OpenSpec change in the implementation PR/MR associated with each discovered contract change. The final implementation PR/MR carries only its own spec changes and archives the inherited completed OpenSpec; there is no separate final reconciliation PR/MR.
- **BREAKING** Reduce the user-facing lifecycle surface to the five modes. Retire standalone lifecycle entrypoints and move reusable planning, sequencing, provider, feedback, and merge logic behind the owning mode. Keep research, Linear breakdown, security, documentation, code-quality, project-health, AX, and similar specialist capabilities directly invokable.
- **BREAKING** Narrow AX to runtime asset management. Remove `ax commit`, `ax review-gate`, `ax plans artifact`, private review-gate and plan-support storage, and workflow transaction state. Keep shim, skills, instructions, hooks, profiles, OpenSpec scaffolding, status, update, and validation.
- Keep provider-specific GitHub, GitLab, Nitro, CI, approval, and merge rules in project or work-profile policy. Local orchestration details, reviewer identities, fingerprints, ledgers, and handoffs do not appear in committed artifacts or hosted descriptions.
- Deliver eight vertical implementation units: Explore/Plan artifact creation, Plan review, Linear/planning publication, Execute/native commits, Review/Finish, complete rehearsal, stack sequencing, and one atomic runtime/AX cutover.
- Support a nonterminal push-only planning handoff with verified remote SHA and all pending gates. The handoff does not authorize MR creation, rehearsal, or execution when Linear or hosted review remains pending.

## Capabilities

### New Capabilities

- `agent-workflow-modes`: Defines the five public modes, inference and transition rules, authority boundaries, direct Execute path, worktree ownership, native commit loop, automatic Review, and Finish behavior.
- `reviewed-plan-artifacts`: Defines convergent Plan behavior, deterministic artifact routing, automatic planning review, planning-only publication, and durable artifact lifecycle.
- `linear-plan-tracking`: Defines mandatory Plan-to-Linear project and issue mapping, source-of-truth boundaries, status synchronization, drift handling, and explicit skip confirmation.
- `openspec-implementation-rehearsal`: Defines the mandatory full implementation rehearsal, review and user-acceptance gates, invalidation rules, disposal, and clean final-stack handoff.

### Modified Capabilities

- `review-first-plan-orchestration`: Replaces globally Nitro-only orchestration with provider-policy routing; adds atomic and OpenSpec stack shapes, associated spec updates, automatic review loops, and planning/POC/implementation gates.
- `ax-cli`: Removes Git transaction, local review-gate, and private plan-support commands so AX manages runtime assets only.

## Impact

- Shared behavior: `AGENTS.md`, `instructions/AGENTS.md`, mode/routing rules, Git/review rules, confidence guidance, handoff guidance, and their tests.
- Workflow surface: new `explore`, `plan`, `execute`, `review`, and `finish` skills; retirement or internalization of brainstorming, start-project, plan readiness/review/orchestration, POC, delivery-unit, provider-publication, feedback, and merge lifecycle entrypoints.
- Specialist behavior: research remains read-only; Linear breakdown remains Plan-owned; domain reviewers remain directly invokable and callable as read-only subagents.
- AX implementation: `scripts/ax.ts`, focused `scripts/ax/runtime-activation.ts`, review-gate and plan-artifact storage code, CLI help/runtime packaging, AX skill/docs, and unit/integration coverage.
- Delivery: Git worktrees and native commits, current Lefthook verification, planning and implementation PR/MR adapters, hosted feedback adapters, and Linear project/issue operations.
- Runtime distribution: `ax.config.json`, `ax.lock.json`, `hooks/README.md`, personal/work profile selection, generated OpenSpec adapter normalization, staged-skill validation, and installed-surface validation.
- Runtime cutover: staged mode sources remain outside `skills/*` until the final unit; candidate activation changes only the verified union of Unit 7 and Unit 8 AX-owned entries, restores previous touched values on failure, and corrects the hooks source to repository-relative `hooks`.
- Existing automation deletions and the pending obsolete `integrate-review-gate-plan-workflows` deletion remain separate cleanup and must not be absorbed into this implementation stack.
- OpenSpec CLI version pinning remains a separate atomic maintenance change because the currently resolved CLI successfully generates and strictly validates the configured assets.
