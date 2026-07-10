## Context

The AI repo currently installs every local skill through `skills/*`. Lifecycle concerns are split across brainstorming, project intake, planning readiness, plan review, orchestration, POC, unit delivery, provider adapters, and merge follow-through. Their overlapping natural-language triggers make authority difficult to predict.

AX also owns active-workflow transactions. `ax commit`, `ax review-gate`, and `ax plans artifact` add state around Git, reviews, and planning. That state does not prevent two writers from sharing one Git index. Dedicated worktrees, native Git, repository hooks, exact-head review, and provider truth provide the required boundaries without a second workflow database.

The target lifecycle has five public modes: Explore, Plan, Execute, Review, and Finish. Explore discovers. Plan converges and writes one artifact at the end. Execute implements in an isolated worktree. Review automatically inspects exact artifacts or heads with read-only reviewers. Finish publishes implementation state and performs explicitly authorized terminal actions.

This is a breaking workflow migration. It changes skills, instructions, rules, provider routing, Linear coordination, AX, runtime profiles, and tests. The OpenSpec planning artifact ships separately before implementation. For this planning run, the requested local terminal state is a reviewed branch pushed for work-laptop MR creation and Nitro review.

## Goals / Non-Goals

**Goals:**

- Make the five modes the only inferred lifecycle entries.
- Preserve directly invokable bounded specialists.
- Make Plan conversational until decisions settle, then produce and review one primary artifact.
- Create one Linear issue per implementation MR after an explicit issue preview is approved.
- Require a complete exact-head implementation rehearsal for every OpenSpec.
- Preserve a deterministic direct Execute path for small clear work.
- Use one writer per review-artifact worktree and native hook-enabled commits.
- Keep orchestration evidence private, task-local, and recomputable.
- Route provider policy from the active project or profile.
- Reduce AX to runtime asset management.

**Non-Goals:**

- Add persisted mode state, a transition engine, a writer-lease service, or a workflow database.
- Keep compatibility aliases for retired lifecycle entries or AX workflow commands.
- Commit reviewer ledgers, fingerprints, handoffs, rehearsal receipts, or publication checkpoints.
- Promote, cherry-pick, or rebase POC code into final implementation.
- Change the OpenSpec CLI version.
- Reintroduce scheduled automations.
- Absorb the separate automation deletion or obsolete `integrate-review-gate-plan-workflows` cleanup.
- Copy unrelated dirty-primary-checkout changes into this stack.

## Decisions

### Expose exactly five inferred lifecycle modes

Ordinary language routes to Explore, Plan, Execute, Review, or Finish. An explicit mode name wins. Non-trivial entry and authority expansion produce one compact declaration containing mode, authority, and goal.

Specialists keep their bounded authority. Calling research does not grant file writes; calling Linear breakdown does not grant unapproved tracker writes; calling a reviewer does not grant fixes or publication.

Generated OpenSpec assets are explicit developer escape hatches. Ordinary requests to explore, propose, implement, or archive route through the five modes. The four repo-local adapters may run only when the user explicitly names `$openspec-explore`, `$openspec-propose`, `$openspec-apply-change`, `$openspec-archive-change`, or an `/opsx:*` command. Their metadata and prompt tests must not advertise ordinary-language inference.

Because upstream OpenSpec regeneration currently restores natural-language trigger text, AX owns a deterministic post-generation normalization step for repo-local adapters. Every `openspec install` and `openspec update` normalizes the four adapter metadata/prompts to explicit-only wording before validation. Validation fails when generated content can infer an adapter from ordinary language, and regeneration fixtures prove the five-mode route survives repeated updates.

### Use an exact skill disposition and staging layout

Units 1-7 stage incomplete mode packages under `mode-skills/<mode>/`, outside the current `skills/*` AX wildcard. AX install/update commands must ignore `mode-skills/`. No personal or work runtime refresh is allowed from those units. Unit 8 moves the completed packages to `skills/{explore,plan,execute,review,finish}` and activates them.

Lifecycle migration is exact:

| Current package | Target owner | Final disposition |
| --- | --- | --- |
| `brainstorming`, `start-project` | `explore` | Move guidance, references, and owner-specific helpers; delete packages |
| `plan-ready`, `plan-review`, `plan-orchestrator`, `plan-poc`, `openspec-tasks` | `plan` | Move guidance and owner-specific helpers; delete packages |
| `plan-unit-sequencer`, `plan-unit-delivery` | `execute` | Move guidance and owner-specific helpers; delete packages |
| `review-feedback-routing`, `github-adapter-review`, `gitlab-adapter-review`, `codex-review-feedback`, `nitro-review-feedback` | `review` | Move feedback retrieval/normalization prompts and owner-local helpers; delete packages |
| `change-request-create`, `github-pr-create`, `glab-mr-create`, `merge-followthrough` | `finish` | Move implementation publication/merge prompts and owner-local helpers; delete packages; Finish transitions to Review for feedback |
| unmanaged `plan-followthrough`, `plan-slices`, `plan-to-pr` | none | Collision-only legacy entries; no behavior-retention requirement; operator must remove or relocate before activation; AX never deletes them |
| `ai-readiness-upkeep`, `code-quality-review`, `code-simplifier`, `compound`, `deslop`, `diff-review`, `doc-smith`, `docs-alignment-review`, `handoff-brief`, `linear-breakdown`, `project-health-brief`, `research`, `research-content`, `research-technical`, `scrutinize`, `security-review`, `session-start`, `writing-skills`, `ax-cli` | bounded specialist | Keep directly invokable |

The retired-lifecycle denylist is exhaustive: `brainstorming`, `start-project`, `plan-ready`, `plan-review`, `plan-orchestrator`, `plan-poc`, `openspec-tasks`, `plan-unit-sequencer`, `plan-unit-delivery`, `review-feedback-routing`, `github-adapter-review`, `gitlab-adapter-review`, `codex-review-feedback`, `nitro-review-feedback`, `change-request-create`, `github-pr-create`, `glab-mr-create`, `merge-followthrough`, `plan-followthrough`, `plan-slices`, and `plan-to-pr`. Generated `openspec-*` adapters are excluded because explicit-only normalization keeps them as developer commands.

Every executable helper lives inside the mode that executes it. Plan owns planning publication primitives, Review owns feedback normalization, Finish owns implementation publication/merge primitives, and Execute owns stack/worktree primitives. Shared project/profile rules may remain declarative references, but modes do not import executable code from `scripts/`, sibling skills, or a workspace-only package. This keeps copied installed skills self-contained in arbitrary target repositories.

The mixed `scripts/plan-artifacts.ts` inventory is split before deletion: repository path-safety functions move exactly to `mode-skills/plan/scripts/path-safety.ts`; blob, manifest, index, revision, correlation, and private evidence functions are deleted with `ax plans artifact`.

The local personal-skill manifest is explicit and identical for personal and work profiles:

```text
explore plan execute review finish
ai-readiness-upkeep ax-cli code-quality-review code-simplifier compound deslop
diff-review doc-smith docs-alignment-review handoff-brief linear-breakdown
project-health-brief research research-content research-technical scrutinize
security-review session-start writing-skills
```

The personal profile continues to add the existing Cloudflare block. The work profile continues to add the Cloudflare and Fullscript blocks. Repo-local generated OpenSpec assets remain outside global profile selection.

`tests/fixtures/modes/` and `tests/integration/mode-lifecycle.test.ts` statically validate named skill metadata, authority, artifacts/outputs, and transitions. They do not implement their own prompt-to-mode selector. Objective source proof uses two real staged-skill scenarios: a read-only subagent invokes the explicitly named Explore `SKILL.md` and proves writes are blocked; an isolated Plan writer invokes the explicitly named Plan `SKILL.md` in a disposable worktree and proves exactly one expected artifact is created with no unrelated path changes. Unit 8 repeats real scenarios through each installed mode plus ordinary-language routing through the actual installed instructions.

Unit 1 extends `scripts/skill-validate.ts` to validate both `skills/` and `mode-skills/`. From that commit onward, every unit that creates or changes a mode skill follows `writing-skills` RED/GREEN/REFACTOR scenarios, runs staged-skill validation through Lefthook, and copies the changed mode into a disposable target with no AI-repo `node_modules`. Any executable helper must resolve from inside the copied skill using a target-available runtime.

### Separate Explore from Plan

Explore performs read-only discovery, research, project intake, divergent brainstorming, and assumption testing. Start Project becomes Explore behavior and returns a Project Context Pack plus an initial Linear project description in chat. Explore never writes files or external state.

Plan settles scope, architecture, delivery shape, risks, acceptance, proof, and tracker mapping. It remains conversational until these decisions are coherent. A direct planning request enters Plan. Organic Explore convergence proposes Plan and waits because the next mode gains artifact-write authority.

Bounded research may occur inside Plan when it settles one active decision. Research that reopens the problem or solution space returns to Explore.

### Select one primary planning artifact

Plan writes the artifact only after convergence:

- one outcome, one primary ownership area, one verification story, and one independently reviewable implementation MR produces `.agents/plans/<slug>.md`;
- multiple delivery-unit MRs, ordered migration, coordinated cross-component contracts, or separately reviewable outcomes produce `openspec/changes/<change-id>/`.

Expected semantic size informs routing:

| Estimated change | Default bias |
| --- | --- |
| At most about 8 substantive files and 400 non-generated lines | Atomic plan |
| 9-15 substantive files or 400-800 non-generated lines | Decide from coupling, risk, ownership, and verification |
| More than 15 substantive files or 800 non-generated lines | OpenSpec |

Generated files, lockfiles, and mechanical codemod output do not count. A small migration or safety-sensitive contract may still require OpenSpec. An explicit user route overrides heuristics unless repository policy or internal coherence makes it impossible.

The primary artifact is the sole durable work definition. Plan does not create a source plan, blueprint, handoff sidecar, review ledger, or second plan representation.

### Review the materialized artifact by fingerprint

Unit 2 stages the minimal Review core under `mode-skills/review/`. Review exclusively owns reviewer catalog/selection, finding normalization, target identity, evidence freshness, and repeated/conflicting-blocker detection for every surface. Plan invokes that core for the final artifact, owns in-scope artifact repair and scope escalation, and never implements a parallel review pipeline. Unit 5 extends the same Review package with implementation diff/HEAD and hosted-feedback behavior.

The artifact Review core always selects four baseline read-only reviewers: implementation readiness, edge-case/risk, simplification/scope, and refactoring opportunities. It adds documentation/agent alignment, AX/skill compatibility, security, data, infrastructure, UI, or other specialists from the affected surface.

All reviewers inspect one artifact fingerprint. Plan automatically fixes findings that preserve settled scope and design and reruns required reviewers. Material scope, architecture, safety, or delivery changes return to the user. The same normalized blocker after one attempted fix, or conflicting required reviewers, stops for user direction.

Artifact review is keyed to content fingerprint, not a Git HEAD. After commit, Plan proves that the committed artifact content and the allowed planning-only diff match the reviewed fingerprint. Hook mutation requires revalidation and reviewer reruns before publication.

Reviewer identities, transcripts, fingerprints, ledgers, and handoffs remain task-local. Missing evidence is recomputed.

For this pre-cutover planning artifact, the deterministic task audit uses the existing `skills/openspec-tasks/scripts/openspec-tasks.ts`. Unit 1 ports it with parity tests to dependency-free `mode-skills/plan/scripts/openspec-tasks.mjs`; Unit 8's move establishes final `skills/plan/scripts/openspec-tasks.mjs`. Plan runs `node <plan-skill-root>/scripts/openspec-tasks.mjs audit <tasks.md>` after every `tasks.md` change. The task-local result contains status, exact tasks fingerprint, parsed unit/work-item IDs, next deliverable, manual pending items, and errors. `status: pass` tied to the current artifact fingerprint is required for planning commit/publication. Any `tasks.md` change makes it stale. Atomic-plan routing records task audit as `not_applicable` with the reviewed atomic route.

### Isolate planning before the first write

Before the first artifact write, Plan records the primary checkout's branch, HEAD, changed paths, untracked paths, and diff fingerprint, then creates or verifies a task-specific planning worktree. It writes only in that worktree. Completion asserts the primary snapshot is unchanged.

Dirty ownership transfer records branch, worktree, HEAD, changed paths, untracked paths, and diff fingerprint. Any live divergence invalidates the handoff. The previous owner stops writing before transfer.

### Require an approved Linear preview

The artifact is canonical for scope, design, acceptance, delivery units, and verification. The planning PR/MR is canonical for exact-head discussion and approval. Linear is canonical for project grouping, assignment, priority, dependencies, scheduling, and status.

Plan performs read-only team, project, and issue discovery. It renders a final issue/project preview with exact project choice, titles, outcomes, acceptance, proof, dependencies, and create/reuse/update actions. Linear writes require explicit approval of that preview. Artifact approval alone does not count unless the exact Linear preview was included in the approved message.

An atomic plan maps to one issue. An OpenSpec maps to one issue per top-level delivery unit, with nested checkboxes kept inside the issue. Start Project efforts and multi-unit changes require a project. A standalone atomic issue may be explicitly unprojected.

If Linear is unavailable or inappropriate, Plan asks `Skip Linear for this planning artifact?`. Only explicit artifact-scoped confirmation creates `linear_skipped_by_user`. The common Linear gate is either a current approved mapping or a current artifact-scoped skip. Missing skip evidence after resume requires confirmation again.

### Give Plan bounded publication authority

Plan creates one native hook-enabled artifact-only commit. Before any push or hosted publication it evaluates a task-local publication checkpoint against target base and exact clean HEAD:

- the diff contains only the primary planning artifact and allowed generated OpenSpec metadata;
- the committed artifact equals the reviewed fingerprint;
- validation, task audit, required reviewers, and hook evidence are current;
- provider, remote, base, and branch are unambiguous;
- there are no unresolved local blockers;
- for hosted planning publication, the common Linear gate passes.

The checkpoint has two scopes. `hosted_planning` authorizes push plus planning PR/MR only when every item, including Linear, passes. `branch_transport` authorizes push only; it may carry a pending Linear gate, but that state must be explicit and it grants no MR, rehearsal, or Execute authority.

The push-only terminal is nonfinal `planning_branch_pushed`. Its handoff contains provider, remote and remote ref, verified remote SHA, branch, target base and SHA, artifact path and fingerprint, exact HEAD, validation/task-audit results, reviewer freshness or rerun requirements, hook evidence, clean state, ownership release, Linear mapping/skip/pending state, and remaining MR/reviewer gates. A receiving machine verifies live Git/provider state and reruns missing private reviews.

### Make direct Execute deterministic

Direct Execute is allowed only when every condition holds:

1. behavior, scope, and verification are unambiguous;
2. delivery fits one implementation MR and one primary ownership area;
3. expected semantic size is at most 8 substantive files and 400 non-generated lines;
4. there is no architecture, migration, cross-component contract, material safety, or ordering decision;
5. the user did not explicitly request Plan.

Any failed condition returns to Plan. Direct Execute skips only the Plan artifact, planning PR/MR, mandatory Linear creation, and rehearsal. It still requires an isolated worktree, native hooks, automatic Review, and authorized Finish behavior.

If scope expansion is discovered after code exists, Execute freezes the worktree and forbids commit, push, and publication. A private handoff records branch, worktree, base, HEAD, dirty diff, existing commits, changed/untracked paths, verification evidence, and the decision that triggered Plan. Plan uses the partial work as discovery evidence but creates the artifact from the original target base without those implementation commits. After approval, Execute starts from the reviewed planning base. The partial branch remains quarantined and is neither lost nor reused automatically; explicit user direction is required to dispose of it or authorize a reviewed transplant, and OpenSpec rehearsal/final-stack clean-lineage rules still apply.

`Execute only` or `keep it local` stops at `ready_to_finish`. Ordinary `implement` or `deliver` authorizes Execute -> Review -> Finish publication, never merge.

### Use native Git and repository hooks

Plan and Execute use native `git commit` and never `--no-verify`. Cohesive intermediate commits are allowed when each boundary independently satisfies repository invariants. A worktree cannot contain later-boundary changes while hooks test the current boundary.

Hook failure keeps ownership in the current boundary: diagnose, fix, restage, and retry. The owner cannot begin the next boundary, push, or enter Review while the commit is unsuccessful. An infrastructure-owned failure that cannot be repaired safely stops with evidence.

The AI repo keeps staged Biome validation, `pnpm skills:validate`, and full `pnpm test` on every commit.

The native-commit bootstrap is explicit. This approved OpenSpec records the user's direct decision to replace agent-authored AX commits. The planning commit and Units 1-8 therefore use native Git even while pre-cutover installed instructions still mention AX. Unit 8 removes every active instruction and command reference in the same runtime cutover. No implementation unit calls `ax commit`.

### Make Review automatic and read-only

Automatic Review runs after a Plan artifact, every material POC head, direct Execute, and each implementation unit. It selects baseline correctness, regression, maintainability, and verification reviewers plus affected specialists. The Plan or Execute owner fixes findings and commits a new hook-clean head; reviewers remain read-only.

Implementation review is keyed to the exact HEAD and target-base diff. Any head change invalidates it. Direct Review may inspect a plan/OpenSpec, POC, dirty worktree, branch diff, PR/MR, or Linear mapping. `review_complete` reports inspection; ordinary work emits `ready_to_finish` when the clean committed head, hooks, and reviewers pass. Unit 8 is the explicit exception: Review emits `review_complete` plus `activation_ready`; authorized Finish runs the exact-head runtime gate and emits `ready_to_finish` only after activation passes.

### Separate Plan publication from Finish delivery

Plan publishes planning state. Finish publishes implementation state, follows provider feedback and CI, and owns merge readiness. Hosted findings return through Execute -> Review -> Finish.

An unqualified Finish stops at `merge_ready` or `stack_ready`. `merge`, `ship`, or `merge when green` authorizes bottom-to-top merge follow-through after current checks, approvals, and stack integrity. Deployment and cleanup require explicit request or activated project policy.

Provider identity selects GitHub, generic GitLab, Fullscript GitLab/Nitro, CI, approval, and merge behavior. No provider is globally mandatory.

### Require hosted planning review before an OpenSpec rehearsal

OpenSpec order is canonical:

```text
local artifact validation and review
-> planning commit and approved Linear mapping or skip
-> planning PR/MR
-> latest-head hosted planning feedback clean or resolved
-> complete implementation rehearsal
-> reconcile durable POC findings into OpenSpec and Linear
-> rerun hosted planning feedback when the planning head changed
-> rerun the full or affected rehearsal against that reviewed planning head
-> exact-POC-head user acceptance
-> final planning approval
-> clean implementation stack
```

The rehearsal loop uses existing public modes: Plan authorizes the exact rehearsal scope and owns the unmergeable draft PR/MR plus durable reconciliation; Execute owns the sole POC worktree writer and code commits; Review inspects every material exact head; findings return to Execute for implementation-local fixes or Plan for contract changes and final user acceptance. The loop is Plan -> Execute (rehearsal authority) -> Review -> Plan, with no sixth public mode.

The draft POC starts from the exact reviewed planning head and contains every delivery unit and production-complete work: implementation, tests, documentation, runbooks, operations, observability, exhaustive relevant edge cases, migrations, rollback, compatibility, security, performance, accessibility, and direct proof where applicable.

POC runtime activation is forbidden against live `~/.agents`, `~/.codex`, or `~/.claude`. It uses an isolated temporary HOME plus isolated AX config, lock, cache, canonical skills, instruction targets, hooks, and profile roots. Only Unit 8 of the final clean stack may refresh the real runtime.

### Gate rehearsal with an exact completion receipt

The task-local `rehearsal_completion_receipt` is recomputed from the exact planning-head `tasks.md`. Its unit and nested work-item IDs must exactly equal the parsed plan IDs. A missing or duplicated item, missing implementation evidence, or missing verification evidence blocks. Work items cannot be `not_applicable`; obsolete work returns to Plan first.

Required concern sets are documentation, runbooks, observability, operational hardening, relevant edge cases, migrations, rollback, compatibility, security, performance, accessibility, and direct success/failure proof. A concern may be `not_applicable` only with reviewed rationale. The receipt records planning head and tasks fingerprint, exact POC head and URL, per-item implementation/verification evidence, concern evidence, local review, hosted review or `not_configured`, CI, user acceptance, OpenSpec reconciliation, Linear reconciliation or valid skip, and a zero-length missing list.

All review and acceptance evidence references the same POC head. Any POC-head change invalidates exact-head automation and user acceptance. Behavior-preserving changes may avoid repeating the full implementation exercise, but they still require updated exact-head review, receipt, and acceptance. Any planning-head change invalidates the receipt and reruns the full or affected rehearsal classification.

The receipt is never committed, stored in AX, copied to Linear, or placed in a hosted description. Missing receipt evidence after resume is recomputed; missing user acceptance is requested again.

The POC closes unmerged and its worktree is removed before clean implementation begins. Final branches must descend from the reviewed planning/implementation predecessor, contain no POC commit ancestry, commit IDs, cherry-pick trailers, or matching stable patch IDs, and their writer inputs exclude the POC branch/diff. Equivalent behavior independently recreated from the revised OpenSpec is allowed. This objective lineage rule forbids commit, patch, or diff promotion while avoiding an unverifiable claim about a developer's memory.

### Deliver one vertical MR per top-level task unit

The final stack has eight units with explicit dependencies:

| Unit | Outcome | Logical prerequisite | Git predecessor |
| --- | --- | --- | --- |
| 1 | Explore and Plan artifact creation | planning MR | planning branch |
| 2 | Automatic Plan artifact review | 1 | Unit 1 |
| 3 | Linear mapping and planning publication | 2 | Unit 2 |
| 4 | Execute isolation and native commit boundaries | 1 | Unit 3 |
| 5 | Automatic Review and Finish provider loop | 3, 4 | Unit 4 |
| 6 | Complete OpenSpec rehearsal | 3, 5 | Unit 5 |
| 7 | OpenSpec stack sequencing | 4, 5, 6 | Unit 6 |
| 8 | Atomic runtime and AX cutover | 1-7 | Unit 7 |

Logical prerequisites describe capability needs; hosted branches are deliberately linearized as planning -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8. Each artifact therefore has one Git predecessor, and bottom-to-top merge remains unambiguous.

Every OpenSpec delivery-unit heading contains `Hosted predecessor gate: required|concurrent`. Plan owns the value; task audit rejects a missing or invalid marker; the safe default during repair/resume is `required`. `concurrent` allows a child only after predecessor local Review and MR publication. `required` additionally waits for predecessor latest-head hosted review/CI. This plan marks Unit 8 `required`; Units 1-7 are `concurrent` after the already-required planning review.

Each implementation MR updates its own OpenSpec task state and any contract it changes. Unit-local contract changes remain in that MR. A cross-unit design change freezes affected writers, returns the delta to the planning branch or a focused planning amendment, updates Linear, reruns local and hosted planning approval, reruns rehearsal, establishes the new stack base, restacks descendants, and rereviews every changed exact head.

Unit 7 implements and tests generic final-unit archival. Unit 8 is this change's actual final unit: it completes its task, applies any own contract changes, and archives the accumulated OpenSpec. There is no reconciliation-only MR.

### Make the final runtime cutover atomic

Unit 8 moves completed mode packages from `mode-skills/` to `skills/`, changes the local profile wildcard to the explicit manifest, deletes retired lifecycle packages, updates active instructions, removes AX workflow commands/state, and corrects `runtime.hooks.sourceDir` to repository-relative `hooks` with the corresponding lock update. That hook correction is in scope because current strict hook validation cannot pass without it; unrelated primary-checkout config/lock edits remain excluded.

AX builds candidate AX-owned personal/work entries in a temporary transaction directory and validates skills, instructions, hooks, and profiles there. `previous_managed_manifest` is derived from the exact Unit 7 predecessor's committed `ax.lock.json`; the candidate manifest is the immutable Unit 8 commit's `ax.lock.json`. AX verifies the predecessor SHA and every live previous-managed entry's identity/provenance, then treats the union of previous and candidate entries as the only transaction set. A stale predecessor, live identity mismatch, or unmanaged same-name entry blocks.

Managed-entry transaction planning, ownership validation, application, reconstruction, and rollback live in `scripts/ax/runtime-activation.ts`. `scripts/ax.ts` remains CLI orchestration and does not absorb this subsystem.

AX atomically replaces or removes only entries in that verified union and records the previous value of each touched entry for rollback. It never swaps a mixed-ownership directory and never removes `.codex/skills/.system` or unrelated unmanaged entries. Injected failures after candidate hooks, skills, or instructions restore only touched managed entries. Success leaves the already committed candidate lock unchanged with zero post-activation lock diff. Resume reconstructs both manifests from Git rather than persisted workflow state.

Before activation AX scans the combined discoverable skill roots. Any unmanaged skill whose metadata matches the retired lifecycle denylist, including `plan-followthrough`, `plan-slices`, or `plan-to-pr`, blocks with `unmanaged_lifecycle_conflict` and reports its path/provenance. AX does not delete or reclassify unmanaged assets. The operator must explicitly remove, relocate, or bring each conflict under managed source before the five-mode cutover may activate. Unrelated unmanaged specialists remain untouched.

Unit 8 source tasks, task completion, and OpenSpec archival are included in one immutable native source commit. Automatic Review runs on that head. Finish owns live-runtime mutation when the original delivery request or explicit continuation authorizes it. Finish runs a separate task-local `runtime_activation_gate`, not an OpenSpec checkbox. The gate validates the candidate from the reviewed commit, applies the verified managed-entry transaction, and proves `update`, `validate`, `status`, hooks validation, OpenSpec validation, skill validation, full tests, and installed inventory resolve to that same head. Failure restores previous values of touched managed entries and blocks Unit 8 publication, `ready_to_finish`, and `stack_ready`. No source commit is allowed after activation; runtime proof remains task-local.

Any hosted-feedback commit invalidates activation. The owner restores the pre-cutover managed snapshot or reviews and activates the new exact head before publication continues. After squash merge, Finish refreshes and validates runtime from the verified merged `main` SHA. Reverting the source also requires a runtime refresh; a Git revert alone does not restore installed entries.

AX validates the five expected names and forbidden retired names against the configured profile manifest. It does not introduce lifecycle classification metadata, a mode registry, a transition engine, or persisted mode state.

### Resume from live state

Active tasks may poll provider checks. A long human or provider wait ends with a private handoff. Resume reconstructs from worktrees, remote refs, hosted artifacts, Linear, and OpenSpec, then reruns missing private reviews and confirmations.

No scheduled automation continues implementation, review, merge, or cleanup merely because time passed.

## Risks / Trade-offs

- Full rehearsal duplicates implementation effort. The exact receipt makes the cost visible and prevents partial rehearsal from passing.
- Source staging adds temporary tree movement. Keeping staged modes outside `skills/*` prevents accidental installation before Unit 8.
- One atomic runtime cutover is broad. Candidate validation and rollback injection cover partial activation failure.
- Explicit Linear approval adds a human gate. It preserves write authority and produces reviewable issue content.
- Private evidence may be unavailable after handoff. The receiving task reruns it.
- Native hooks can observe later working-tree changes. Boundary-clean worktrees prevent that contamination.
- Earlier stack changes can invalidate descendants. The cross-unit reroute freezes writers and rebuilds current evidence.

## Migration Plan

1. Review this OpenSpec locally and commit it alone. Hosted planning publication requires the common Linear gate; requested push-only branch transport may carry pending Linear state and grants no MR, rehearsal, or Execute authority.
2. Obtain latest-head hosted planning feedback and amend the plan plus approved Linear mapping when required.
3. After hosted planning feedback is clean, build the complete rehearsal in an isolated-runtime POC, reconcile findings, obtain exact-head user acceptance, and close it unmerged.
4. Build Units 1-7 in dependency order. Keep `mode-skills/` out of installed profiles, use native commits, and publish one MR per unit.
5. Build Unit 8 as the atomic runtime/AX cutover, including the relative hooks source correction, transactional candidate activation, final installed-surface proof, task completion, and OpenSpec archive.
6. Merge only with explicit authority, bottom-to-top, rechecking retargeted descendants.

Rollback before merge uses normal branch/MR reverts. The workflow change introduces no production data migration. Runtime activation failure restores previous values of touched managed entries. After merge, reverting Unit 8 and refreshing AX restores the old managed runtime surface; earlier source units remain inactive until a corrected cutover is ready.

## Open Questions

None.
