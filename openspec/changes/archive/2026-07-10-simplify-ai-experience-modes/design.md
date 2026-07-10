## Context

The AI repo currently installs local skills through a wildcard and exposes overlapping lifecycle entrypoints for brainstorming, project intake, planning, review, POC delivery, provider routing, and merge follow-through. AX also owns tracked source-resolution state and workflow transactions. These surfaces make ordinary requests ambiguous, cause lockfile churn whenever remote refs advance, and require users to distinguish installation from update even though both operations reconcile the same runtime.

The target experience has five public modes: Explore, Plan, Execute, Review, and Finish. It also has one runtime mutation verb: sync. Desired state stays in tracked configuration; machine ownership and installed hashes stay local. OpenSpec work receives a complete disposable POC before clean final delivery shaped by its top-level task units.

This change is a breaking cross-cutover. Mode packages, active instructions, retained specialists, AX commands, runtime state, generated OpenSpec handling, and tests must agree in one mergeable implementation MR. The user's explicit bootstrap exception replaces this migration's POC with iterative latest-head Nitro review.

### Terminology and current surfaces

| Term | Meaning |
| --- | --- |
| AX | The `ax` CLI implemented by this repository and exposed through the managed shim |
| Durable AI repo | The non-disposable checkout used by the managed shim as its source root |
| Bounded specialist | A directly invokable skill whose authority does not expand into another lifecycle mode |
| Installed profiles | One or more runtime inventories synchronized on a machine |
| Workflow-policy profile | Exactly one profile selected for default workflow policy in the current project/session |
| Project policy | Repository instructions or configuration that override profile defaults |
| Artifact fingerprint | A deterministic content hash for one Plan or OpenSpec artifact |
| Target-base diff | The exact changes between a review target and its declared Git base |
| Exact-head gate | Evidence bound to one Git HEAD and invalidated by any HEAD change |
| Task-local evidence | Review or handoff state kept in the current Codex task/thread rather than committed files |
| Fidelity-equivalent environment | An isolated environment that preserves the behavior of the real decision boundary |
| First real confirmation | An automated objective-proof scenario with a visible pass/fail result kept in task-local test output |

Atomic plans live at `.agents/plans/<slug>.md`. The plan is committed with the final delivery, remains as a durable project record after merge, and contains no review sidecars. An abandoned plan records its disposition in the plan or owning project surface.

## Goals / Non-Goals

**Goals:**

- Make the five modes the only inferred lifecycle entries while preserving bounded specialists.
- Route work from unresolved decisions and contract needs rather than file or line thresholds.
- Review planning artifacts and implementation artifacts with target-specific baselines.
- Require one production-complete POC for every OpenSpec, including automated and personal review.
- Reconcile POC findings into the OpenSpec once per authorized cycle, then implement each final delivery unit cleanly.
- Make Linear behavior an explicit `required|disabled` policy with predictable precedence.
- Keep one writer per worktree and keep local review evidence recomputable rather than durable.
- Replace tracked AX lock state with a minimal local ownership manifest.
- Replace install/update runtime mutations with one recoverable sync operation.
- Resolve remote sources to the latest configured ref for every sync without persisting commits.
- Keep pre-merge runtime proof isolated and refresh live runtime only from merged source.

**Non-Goals:**

- Add persisted mode state, a transition engine, a writer lease, or a workflow database.
- Keep compatibility aliases that execute retired lifecycle skills or AX mutation commands.
- Commit reviewer ledgers, fingerprints, handoffs, POC receipts, or runtime transactions.
- Publish a separate planning MR or a reconciliation-only MR. This change also does not create a multi-MR implementation stack because it has one delivery unit.
- Promote POC commits through merge, rebase, cherry-pick, or patch application.
- Compare patch IDs, police code similarity, or attempt to prove what a final writer remembered.
- Persist source URLs, refs, commits, timestamps, cache paths, or duplicated desired state in the local runtime manifest.
- Mutate live personal/work runtime roots before the final change is merged.
- Change the OpenSpec CLI version or absorb unrelated automation deletion.

## Decisions

### Expose exactly five inferred lifecycle modes

Ordinary language routes to Explore, Plan, Execute, Review, or Finish. An explicit mode name wins. A non-trivial entry or authority expansion produces one compact declaration of mode, write authority, and goal.

Specialists keep their own bounded authority. Research remains read-only. Linear breakdown does not authorize tracker writes. Reviewers do not gain fix or publication authority. Generated `openspec-*` adapters remain explicit developer commands and are never inferred from ordinary language.

The mode responsibilities are:

| Mode | Responsibility | Default mutation authority |
| --- | --- | --- |
| Explore | Discovery, research, project intake, divergent thinking | Read-only |
| Plan | Settle decisions and create or reconcile one planning artifact | Planning artifact only |
| Execute | Implement in one owned worktree | Repository implementation writes |
| Review | Inspect one exact artifact, diff, or head | Read-only |
| Finish | Publish, follow hosted feedback, and perform explicitly authorized terminal actions | Provider writes within granted scope |

Explore produces project context and an initial Linear-ready description in chat without creating repository or tracker state. Organic convergence asks before entering Plan because Plan gains artifact-write authority.

### Route semantically

Direct Execute is eligible only when the requested outcome fits one coherent MR and no unresolved behavior, architecture, migration, safety, ownership, ordering, cross-component contract, or verification decision remains. The first unresolved material decision routes to Plan.

Plan chooses the artifact from the contract:

- Use an atomic plan when one coherent MR is expected and the work does not need a durable cross-cutting specification or mandatory full rehearsal.
- Use OpenSpec when the work has several independently reviewable delivery units, changes a durable cross-component contract, requires migration design, or needs the full POC gate.
- Follow an explicit user route unless that route cannot represent the accepted contract coherently.

File count and changed-line estimates may inform implementation risk, but they never decide routing.

Representative routes are:

| Request state | Route | Reason |
| --- | --- | --- |
| Rename one stable CLI flag with known tests and no compatibility decision | Direct Execute | No material decision remains |
| Add a cache whose eviction, ownership, or failure policy is unsettled | Plan | Behavior and operational decisions remain |
| Change a shared runtime manifest or migration contract | OpenSpec | Durable cross-cutting contract and POC are required |
| User requests an atomic plan for an ordered data migration | OpenSpec | The requested route cannot represent the migration contract coherently |

### Keep mode packages self-contained and cut over atomically

The final runtime installs five self-contained packages under `skills/{explore,plan,execute,review,finish}`. There is no sixth lifecycle library and no `mode-skills/` staging tree. Executable deterministic helpers live inside the mode that owns them.

Before adding mode packages, implementation replaces the `skills/*` source wildcard with the exact active legacy inventory. This prevents incomplete new packages from entering a profile during development. The final profile switch replaces legacy lifecycle names with the five modes and retained specialists in the same MR.

Lifecycle package disposition is explicit:

| Current packages | Final owner |
| --- | --- |
| `brainstorming`, `start-project` | Explore |
| `plan-ready`, `plan-review`, `plan-orchestrator`, `plan-poc`, `openspec-tasks` | Plan |
| `plan-unit-sequencer`, `plan-unit-delivery` | Execute |
| `review-feedback-routing`, `github-adapter-review`, `gitlab-adapter-review`, `codex-review-feedback`, `nitro-review-feedback` | Review |
| `change-request-create`, `github-pr-create`, `glab-mr-create`, `merge-followthrough` | Finish |
| `session-start` | Shared session-startup rule plus each mode's preflight |

The retired-name denylist has one source of truth in AX and includes `session-start`. Validation scans active instructions, rules, skill metadata, configured profiles, and installed inventories. Unmanaged collisions such as `plan-followthrough`, `plan-slices`, or `plan-to-pr` block with path and provenance; AX never deletes them.

Before deleting a package, implementation inventories its references, prompts, scripts, fixtures, and provider-specific rules. Required behavior moves into the owner. Retained specialists that point to retired skills receive new mode cross-links.

Root workflow helpers have an explicit disposition. `planning-contracts.ts`, `objective-proof.ts`, `stack-state.ts`, `nitro-feedback-gate.ts`, `review-gate.ts`, and `plan-artifacts.ts` are deleted unless an owning mode still needs a deterministic subset. A retained subset moves into that mode package.

Tracked private planning sidecars are removed during cutover: `.agents/plans/change-request-create.openspec-blueprint.yaml`, `.agents/plans/change-request-create.review-request.yaml`, `.agents/plans/change-request-create.reviewer-selection.yaml`, and `.agents/plans/openspec-guided-runtime-setup.review-request.yaml`. Final validation permits only primary plan Markdown under `.agents/plans/**`; future reviewer selections, requests, blueprints, and handoffs remain task-local or in private storage outside the repo.

### Review the target with the matching baseline

Review always operates on one exact artifact fingerprint, target-base diff, or HEAD. Reviewers are read-only; Plan or Execute owns fixes. A changed target invalidates its review evidence.

Planning and OpenSpec targets use four baseline reviewers:

1. implementation readiness;
2. edge cases and risk;
3. simplification and scope;
4. refactoring opportunities.

POC and final implementation targets use four baseline reviewers:

1. correctness;
2. regression risk;
3. maintainability;
4. verification quality.

Review adds security, documentation/agent alignment, AX/skill compatibility, data, infrastructure, UI, or other specialists from the affected surface. Provider comments, hosted automated review, approvals, and CI remain separate hosted gates.

The Review package owns the reviewer catalog, target identity, prompt contracts, and normalized `passed|finding|blocked` output. Baseline names above are canonical reviewer IDs. Planning review keys evidence to the artifact fingerprint. POC and final implementation review keys evidence to target base plus exact HEAD.

In-scope findings return to the owning writer for repair and a fresh review. A material scope, architecture, safety, or delivery change returns to Plan. Repeated or conflicting material blockers return to the user.

Reviewer identities, transcripts, fingerprints, and handoffs remain task-local. Missing evidence is recomputed.

### Create one local planning artifact without a planning MR

Plan remains conversational until scope, design, delivery shape, risks, acceptance, verification, and policy choices settle. It then writes one atomic plan or OpenSpec in an isolated worktree and runs the planning baseline plus affected specialists.

The initial OpenSpec is committed on a local planning-base branch but is not published as a standalone planning MR. Plan-only work may stop with a locally reviewed artifact. Implementation-authorized OpenSpec work uses that commit as the POC starting point. After reconciliation, the first final unit includes the planning-base commits; this one-unit change uses the same branch for its planning base and final MR.

After each explicitly authorized POC cycle, Plan updates proposal, design, delta specs, tasks, and required Linear content in one reconciliation batch. The reconciled OpenSpec receives the planning review baseline. It is published with the final implementation, not through another planning artifact.

The POC never checks source `tasks.md` boxes. Its implementation, tests, CI, and reviews prove rehearsal coverage. Reconciliation may change unchecked tasks. Final implementation checks tasks only after independently satisfying them, then archives the completed change.

### Make Linear policy explicit

Linear policy has exactly two values: `required` and `disabled`. Precedence is:

```text
direct user instruction > project policy > workflow-policy profile default
```

Profile defaults are `personal: disabled` and `work: required`. Installed profiles do not combine policy defaults. The local runtime manifest supplies exactly one workflow-policy profile selected by interactive sync or `--policy-profile <name>`; a direct user instruction or project policy may override its individual policy values. A missing, invalid, or ambiguous workflow-policy profile produces `policy_profile_ambiguous` and blocks profile-dependent work.

When disabled, the workflow performs no Linear discovery, preview, mutation, drift check, status synchronization, or gate. When required, Plan performs read-only discovery, prefers reuse over duplication, previews the exact project/issue mutation and intended lifecycle status transitions, and waits for explicit approval before writing. A later status transition may run without another prompt only when the approved preview named it; otherwise Plan or Finish previews that mutation first.

Each OpenSpec top-level delivery unit maps to one outcome-centered issue and final implementation MR. Nested tasks remain work items in that issue. This change has one top-level unit, so it maps to one issue and one final MR. Missing authentication, write access, or an unresolvable project under `required` blocks until the user changes policy or repairs the missing state. There is no artifact-scoped skip token or skip receipt.

The planning artifact remains canonical for scope, design, acceptance, and verification. Linear remains canonical for assignment, priority, scheduling, and status. The POC and final MRs are canonical for exact-head review discussion.

### Require one full disposable POC

After this migration lands, every subsequent OpenSpec receives a full POC after the initial artifact passes local review. The POC branch starts from that planning commit and opens one draft PR/MR against the normal target branch. Its title begins with `POC:` and its description states that it is review-only and must never merge.

The POC implements every explicit task, requirement, scenario, acceptance criterion, and applicable production concern. It includes tests, documentation, operational guidance, migrations, rollback, compatibility, security, performance, accessibility, and direct success/failure proof where the accepted design makes them applicable. The POC uses real decision boundaries or fidelity-equivalent environments rather than mocks that bypass the decision under review.

The POC receives:

- the local implementation review baseline and affected specialists;
- repository verification and configured CI;
- configured latest-head hosted automated review, including Nitro when project policy selects it;
- the user's personal review of the automated-review-clean head.

Findings are fixed in the same POC MR. Every POC HEAD change refreshes local exact-head review, configured hosted review, CI, and personal acceptance. Coverage is proven by implementation, tests, CI, and reviews; no separate rehearsal receipt is created.

Personal acceptance records the POC URL and exact accepted SHA in task-local state. If a resumed task cannot recover that evidence, it presents the closed POC head and requests fresh acceptance. The remote POC branch remains available until final delivery is ready unless explicit cleanup policy says otherwise.

After personal acceptance, the POC is frozen, closed unmerged, and its local worktree is removed. Entering the mandatory POC flow authorizes this local teardown as workflow housekeeping; remote branch deletion still requires Finish cleanup authority. Plan then reconciles durable findings once. Implementation-local observations that do not change the contract remain transient.

Reconciliation does not automatically trigger another POC. If the reconciled contract appears to introduce a materially unproved behavior or risk, Plan presents that delta and a recommendation to the user. Only explicit user direction starts another POC cycle; each explicitly authorized cycle gets one post-acceptance reconciliation batch.

### Deliver clean final implementation units

Final implementation starts from the reconciled OpenSpec without POC commits or ancestry. The first unit starts from the normal target base plus reconciled planning state; dependent units use the declared predecessor. No unit uses the POC branch as a Git base or merges, rebases, cherry-picks, or applies POC commits. The workflow performs no patch-ID, similarity, or writer-input policing.

An atomic plan produces one final MR. An OpenSpec produces one final MR per top-level delivery unit, with nested tasks implemented as cohesive commits. Each unit carries its own task/spec updates; the last unit carries completion/archive. This OpenSpec has one top-level unit, so its single implementation MR contains the complete specification, code, tests, active instruction/rule updates, runtime migration, and completion/archive.

Top-level task order defines a total Git predecessor chain even when logical dependencies permit parallel implementation. The first unit contains the reconciled planning-base commits. Each later unit branches from the previous hosted unit, so planning changes appear once. Logical dependencies control when work is semantically eligible; the total Git chain controls branch ancestry and merge order.

After a predecessor squash-merges, its child retargets to the default branch and restacks onto the verified merged commit before merge. Every changed descendant HEAD reruns local and hosted gates. This change's one-unit chain requires no restack.

Every final unit diff receives relevant review surfaces:

- planning baseline for the reconciled OpenSpec content;
- implementation baseline for the code and complete target-base diff.

Task/spec changes receive the planning baseline in their owning unit. Before the last unit publishes, the planning baseline reviews the final canonical-spec/archive diff and the implementation baseline reviews the exact final HEAD.

Finish publishes each mergeable unit MR and follows configured CI and latest-head hosted feedback. Findings return to Execute, followed by fresh local Review and Finish publication. It reports stack readiness only when every declared unit is current. An unqualified delivery request never merges. Merge, deployment, and cleanup require explicit language or activated project policy.

### Keep worktree and provider authority explicit

Each planning, POC, or final review artifact has one write owner and one dedicated branch/worktree. This is a coordination invariant among participating tasks, not a cross-process lease. Parallel writers may work only on disjoint artifacts in separate worktrees. Ownership transfer records branch, worktree, HEAD, changed/untracked paths, and a diff fingerprint; the previous owner stops writing first. Unknown or contradictory ownership blocks writes.

Provider policy precedence is direct user instruction, project policy, workflow-policy profile, then remote inference. GitHub, generic GitLab, and Fullscript GitLab/Nitro use their configured review and approval contracts. Ambiguous routing blocks publication without invalidating completed local work.

Finish owns provider mutations, review requests, polling, and readiness decisions. Review owns read-only retrieval and normalization of hosted findings. Plan or Execute owns repairs. Their task-local handoff contains provider, artifact URL, target base, exact head SHA, normalized findings, and gate status.

Before every push, MR creation, or MR update, Review emits an exact-head `publication_checkpoint` containing current target-base diff, hooks, required local reviewers, provider route, and blockers. Finish consumes that checkpoint. This replaces persisted AX review-gate state and becomes stale after any HEAD or target-base change.

Authority phrases resolve as follows:

| User wording | Maximum default authority |
| --- | --- |
| `implement`, `deliver`, `proceed` | Execute, Review, and Finish publication; no merge |
| `ship`, `merge`, `merge when green` | Merge after current gates |
| `deploy` | Deployment after required delivery state |
| `clean up` | Named branch/worktree cleanup |

Ambiguous terminal language asks before mutation. A local-only or Execute-only request stops before Finish. Hosted findings do not expand authority.

### Separate desired, managed, and observed runtime state

Tracked `ax.config.json` is desired state. It defines profiles, source URLs and refs, selected names, target paths, instructions, hooks, and OpenSpec settings.

`runtime.hooks.sourceDir` is repository-relative `hooks`. AX resolves it inside the immutable local source snapshot, so feature-branch isolated proof and merged-source live sync use the same source model without a machine-specific checkout path.

Local `~/.agents/runtime/managed-runtime.json` is ownership state. It contains only:

- schema version;
- installed profiles;
- one workflow-policy profile;
- AX-owned installed paths;
- content hashes for those installed entries.

It contains no URL, ref, resolved commit, timestamp, cache path, transaction state, or duplicated desired configuration. The live filesystem is observed state.

On first sync without a manifest, AX builds a legacy transition preview without reading `ax.lock.json`. An occupied desired path with canonical location and expected link topology is eligible for `manage` when its live hash matches the candidate or `replace-managed` when an explicitly approved observed hash differs. Replacement backs up the observed entry before installing the candidate. A canonical retired or stale path is eligible for `remove` only when the operator approves its exact path and observed hash. Every other occupied path is an unmanaged collision.

Interactive use confirms each `manage|replace-managed|remove` action. Headless use requires `--adoption-file <path>` containing exact canonical path, observed hash, and action entries; there is no broad adopt-all flag. Hash drift invalidates the approval. The successful transition manifest contains only current desired candidate hashes, so replaced desired entries and removed retired entries never preserve legacy hashes as installed truth.

Removed desired entries are pruned only when the local manifest proves ownership. Unmanaged entries and `.codex/skills/.system` are preserved.

### Use sync as the only runtime mutation verb

The public mutation surface is:

- `ax sync` for selected runtime profiles;
- scoped `skills sync`, `instructions sync`, and `hooks sync` forms;
- `ax openspec sync` for the invocation repository;
- shim `install`, `status`, and `uninstall`, which manage the executable shim rather than runtime content.

Bare `ax sync` uses installed profiles recorded in the local manifest. Only top-level `ax sync` may create the manifest or change installed/policy profile selection. A first interactive run selects one or more installed profiles and exactly one workflow-policy profile from that set. A first noninteractive run requires `--profile` or `--all-profiles` plus `--policy-profile <name>`; those explicit first-run flags are the approval because no prior selection exists.

Later interactive profile changes preview and confirm replacement/addition plus the one policy profile. Later headless changes require `--profile-selection-file <path>` containing the current manifest hash, exact replacement installed-profile set, and one policy profile. Hash drift invalidates the request. Zero policy profiles, several policy profiles, or a policy profile absent from the installed set fail validation. Top-level sync never mutates repo-local OpenSpec files.

Scoped `ax skills sync`, `ax instructions sync`, and `ax hooks sync` require an existing valid manifest, consume its profile selection, and never create or change installed/policy profiles. They update only the owned paths and hashes for their surface. A missing manifest returns `runtime_not_initialized` and points to top-level `ax sync`.

Runtime `install` and `update` fail without mutation and report `Use ax sync` or the corresponding scoped command. They are not aliases.

`status` and `validate` are read-only and perform no network access. They prove local desired/managed/observed consistency, not remote-ref freshness. Status summarizes desired, managed, observed, cache, collision, and incomplete-transaction state. Validate fails when those states do not satisfy the contract. Sync is the operation that determines whether a remote ref advanced and includes full candidate plus post-apply validation.

### Snapshot latest sources once per invocation

For each distinct remote URL/ref pair selected by a sync, AX fetches once, resolves the latest commit once, and uses one temporary checkout for every entry from that source. The resolved SHA may appear in diagnostic output but is never persisted.

For a clean Git local source, AX snapshots the selected Git tree. For an arbitrary directory or intentionally dirty source, AX computes a deterministic content hash before copy, hashes the candidate copy, and hashes the source again. It accepts the snapshot only when all three hashes match; otherwise it retries within a bounded limit or fails with `source_changed_during_snapshot`.

All AX content identity uses `sha256-tree-v1`. The canonical stream sorts normalized relative paths and encodes length-prefixed path/kind/mode fields plus length-prefixed file bytes or symlink-target bytes. Entry kind is `file|directory|symlink`; mode records executable-bit state. Directories, including empty directories, are entries. Ownership, user/group, timestamps, and non-executable permission bits are excluded. Manifest, adoption/profile-selection files, source snapshots, journals, backups, and recovery files declare or inherit this hash version and reject unknown versions.

Disposable remote caches live under `~/.agents/runtime/cache`. Cache contents improve fetch performance but never establish ownership or installed truth. Missing or corrupt caches are rebuilt.

If desired inventory and candidate hashes equal the local manifest and live entries, sync performs no replacement, backup, or manifest rewrite.

### Apply runtime candidates recoverably

AX acquires one exclusive mutation lock per local runtime root before recovery or candidate construction. Concurrent mutating invocations fail with the active lock owner; read-only status reports it. AX constructs and validates the complete selected candidate before touching live entries. Candidate construction covers skill portability, instructions, hooks, profile inventory, links, explicit OpenSpec adapter triggers, retired-name collisions, and target ownership.

Before mutation, AX creates a transaction directory under `~/.agents/runtime/transactions/<id>`. Its journal records `prepared|applying|manifest_committed`, previous and candidate manifest hashes, expected old/new target hashes, and verified preimages. The directory also retains hash-verified candidate payloads, including the candidate manifest and deletion markers, so recovery never depends on a disposable source snapshot or cache. AX applies per-entry same-filesystem renames, validates the result, atomically replaces `managed-runtime.json` last, records the committed phase when possible, and removes the transaction directory before releasing the mutation lock.

Recovery decisions use live hashes for every journal phase. If the installed manifest and target hashes equal the recorded candidate, recovery finalizes success even when the process died before recording `manifest_committed`. Otherwise, AX restores an entry only when its current hash equals the journal's expected old or candidate hash; an intervening external edit produces persistent `recovery_conflict` without overwrite. Failed restoration produces `recovery_failed`, preserves the journal/preimages, and blocks later mutation.

The mutation lock records process ID and process-start identity. A live owner blocks. A dead owner allows lock reclamation followed by journal recovery. Read-only status and validate report active lock, `incomplete_transaction`, `recovery_conflict`, or `recovery_failed` without mutation.

Conflict resolution remains part of sync. `ax status --json` exposes transaction ID, domain/root, current target and manifest hashes, and allowed actions with their resulting ownership/hash state without writing. The operator supplies `ax sync --recovery-file <path>` with that transaction identity, exact current hashes, and one action for every transaction path whose previous and candidate ownership records differ: `restore-previous`, `apply-candidate`, or `preserve-unmanaged`. `restore-previous` selects the previous record or absence, `apply-candidate` selects the candidate record or deletion marker, and `preserve-unmanaged` retains the current target while removing AX ownership. Unchanged ownership records carry forward automatically.

When previous and candidate manifests differ in `installedProfiles` or `policyProfile`, the recovery file also requires one exact-hash-bound `profileSelectionState: previous|candidate`; otherwise the shared metadata carries forward without a selector. The selected state supplies both top-level fields. A resulting owned path must belong to the inventory allowed by that profile selection. An action that would own an out-of-profile path is rejected before mutation; `preserve-unmanaged` may retain its current content without ownership. Older content for an in-profile path remains a valid owned observation but status reports desired drift for a later normal sync. The selected `policyProfile` must remain exactly one installed profile.

On first sync, the previous manifest state is explicitly absent. Selecting `profileSelectionState: previous` therefore chooses a journaled manifest-deletion marker rather than fabricating profile metadata. It permits no owned paths: previous content may be restored or current content preserved, but both remain unmanaged, and any `apply-candidate` action that would retain ownership is rejected. The manifest is removed last using the same exact-current-hash and crash-recovery rules. Selecting `candidate` uses the candidate profile metadata and ownership rules normally.

Before changing a target, the neutral transaction engine verifies retained payloads, validates per-path ownership against the selected profile inventory or absent-manifest outcome, and writes a hash-verified derived resolution manifest or deletion marker into the transaction directory. The recovery-file's exact current manifest hash explicitly authorizes atomic replacement with that derived outcome. Target changes occur first and the derived manifest is atomically installed or removed last. If recovery itself terminates, ordinary hash-based journal recovery treats the derived manifest or absence, selected profile metadata, and selected target states as the transaction candidate. A current target or manifest hash mismatch blocks without mutation. The engine removes recovery state only after resolution consistency validates: selected hashes and ownership match, the manifest is structurally valid or intentionally absent, and untouched paths remain unchanged. Recovery does not require desired runtime or canonical OpenSpec convergence when an authorized choice deliberately preserves older or unmanaged content; offline status reports that remaining drift for a later normal sync. Cache deletion, local-source mutation, or later remote-ref advancement cannot change the authorized result.

Successful changes retain the latest seven verified backups per asset and target under `~/.agents/runtime/backups`. Unchanged content creates no backup. Journals are recovery state and are removed after success or complete rollback; they are not workflow state.

Module ownership is:

| Module | Responsibility |
| --- | --- |
| `scripts/ax.ts` | CLI wiring and high-level orchestration |
| `scripts/ax/runtime-state.ts` | Manifest schema, profile bootstrap, ownership adoption, drift, atomic manifest writes |
| `scripts/ax/source-snapshot.ts` | Cache, fetch/ref resolution, immutable local/remote snapshots, candidate hashes |
| `scripts/ax/transaction-engine.ts` | Domain-neutral locks, journal phases, hash checks, preimages, retained candidate payloads, apply, rollback, recovery |
| `scripts/ax/backup-store.ts` | Domain-neutral verified backup creation and seven-backup retention |
| `scripts/ax/runtime-sync.ts` | Runtime candidate planning, manifest/ownership rules, cross-surface validation, collision checks |
| `scripts/ax/openspec-sync.ts` | Repo-local candidate planning, missing/configured/partial convergence, context authorization, normalization, validation |

Runtime and OpenSpec planners emit transaction operations into the neutral engine. Asset-specific helpers never mutate live targets directly, and repo-local OpenSpec never imports runtime-manifest policy.

### Converge OpenSpec through sync

`ax openspec sync` handles three states:

- Missing: interactive use previews inferred context and requires confirmation; headless use requires `--context-file`.
- Configured: refresh only drifted generated assets and review config changes only under the existing explicit authorization flags.
- Partial: reconstruct missing or stale assets from valid config; missing config requires confirmed context.

Every path generates into a candidate, normalizes canonical assets and harness links, rewrites generated adapter triggers to explicit-only wording, validates, and then applies. `ax openspec status` and `validate` remain read-only.

Repo-local OpenSpec files never enter `managed-runtime.json`. OpenSpec sync reuses the transaction engine with a worktree-specific mutation lock, journal, and backup root resolved through the target Git administrative directory. Its journal records worktree identity, initial dirty paths, expected old/new hashes, candidate hashes, and file preimages. Sync compares expected hashes before replacement or restoration and refuses to overwrite unrelated or concurrent edits.

A concurrent edit produces persistent `recovery_conflict`; AX preserves the journal and preimages for explicit resolution. Failed restoration produces `recovery_failed`. Each worktree reports and recovers only its own transaction, and successful changes retain seven backups per generated asset.

Repo-local recovery uses the same hash-bound `ax openspec sync --recovery-file <path>` contract. `preserve-unmanaged` keeps the user's current file, removes that path from the pending recovery operation, and lets a later normal sync report any remaining generated-asset drift.

The supported first-time flags are `--context-file <path>` for confirmed headless context. Configured projects retain `--review-config` and headless `--accept-config-changes`. Canonical skills live under `.agents/skills/openspec-*`, with configured Codex/Claude links. Canonical commands live under `.agents/commands/opsx`, with configured harness links.

AX resolves `openspec` from the process PATH, runs `openspec --version`, and reports path/version diagnostics. A missing or non-executable CLI fails before candidate mutation with installation guidance. AX never installs or upgrades OpenSpec automatically; version pinning remains a separate maintenance change. Integration fixtures verify the invoked command and required capabilities instead of claiming a repository package pin.

### Activate live runtime only after merge

The implementation branch runs AX against an isolated HOME, manifest, cache, transactions, backups, skills, instructions, hooks, and profile targets. AX rejects canonical live targets unless its source root is a clean verified default-branch checkout matching the selected hosted default branch. Feature branches and disposable worktrees must provide explicit isolated roots and can never bypass this guard.

After the final MR merges and the default-branch source is verified locally, ordinary `ax sync` performs the live cutover. Candidate validation, ownership checks, rollback, and post-apply validation inside sync are the activation gate. There is no `activation_ready`, `runtime_activation_gate`, predecessor source lock, or post-activation source commit.

### Bootstrap this change with pre-cutover tools

This user-approved OpenSpec is the migration authority for its own singular delivery shape. Before the five modes exist, the current root session and explicit `openspec-apply-change` workflow own the isolated implementation branch. The user explicitly exempted this bootstrap migration from its future mandatory-POC rule: the complete implementation, OpenSpec change, and tests ship in one mergeable MR and iterate through latest-head Nitro feedback.

Current repository instructions continue to require `ax commit` for the pre-cutover implementation commit; the managed durable checkout keeps that command available through the last source commit. Current GitLab/Nitro adapters publish the single implementation MR. No current workflow command may create a POC, planning MR, implementation stack, or live runtime refresh for this change. The installed five-mode contract applies the mandatory full POC to subsequent OpenSpec changes after cutover.

### Verification map

| Surface | Primary fixtures | Required commands or visible proof |
| --- | --- | --- |
| Modes and routing | `tests/fixtures/modes/**`, `tests/integration/mode-lifecycle.test.ts` | `pnpm skills:validate`; focused Node test; isolated Explore write denial and `.agents/plans/five-mode-proof.md` creation |
| Runtime state and sync | `tests/unit/ax-runtime-*.test.ts`, `tests/integration/ax-cli.test.ts` | focused Node tests; injected rollback/recovery; isolated personal/work sync, status, and validate |
| OpenSpec sync | `tests/integration/ax-openspec.test.ts` or the owning AX integration suite | missing/configured/partial fixtures, explicit-trigger normalization, repo-scoped rollback |
| Active cutover | instruction/rule snapshots and forbidden-reference fixtures | `pnpm biome:lint-format`; `pnpm exec tsc --noEmit`; `pnpm skills:validate`; `pnpm test`; strict OpenSpec validation |

Test files may be split differently when implementation discovers a clearer ownership boundary, but each named behavior and command remains required.

## Risks / Trade-offs

- The future full POC duplicates implementation effort. It buys direct review of complete behavior before durable contracts and final implementation are fixed.
- This bootstrap exception uses one broad implementation MR. Target-specific local reviewers, cohesive internal commits, and repeated latest-head Nitro review keep the review surface explicit while the workflow is tuned through real use.
- Removing commit pins means sync follows configured refs. One snapshot per source/ref preserves within-run consistency while accepting that separate sync runs may resolve different source heads.
- Local ownership migration can encounter unverifiable paths. Blocking preserves user-owned content and requires an explicit operator decision.
- Journaled per-entry replacement cannot atomically swap every filesystem root at once. Candidate validation, manifest-last commit, and idempotent recovery provide all-or-restored semantics for AX-owned entries.
- Policy-disabled Linear reduces shared tracker visibility. The direct/project/profile precedence makes that choice explicit.

## Migration Plan

1. Rewrite and locally review this OpenSpec on the isolated final-delivery branch.
2. Commit the initial OpenSpec without publishing a separate planning MR.
3. Implement the complete change once on the isolated implementation branch. Update active instructions, remove retired packages/commands/state, complete tests, and archive the OpenSpec in the same MR.
4. Run isolated runtime proof and exact-head local planning/implementation review against the complete branch diff.
5. Publish one mergeable implementation MR, request Nitro, resolve every latest-head finding, and repeat local/provider gates after each head change.
6. Stop at merge readiness unless the user separately authorizes merge.
7. After merge, verify the default-branch source and run live `ax sync` for the installed profiles.

Rollback before merge closes or reverts the implementation MR. A failed live sync restores touched entries and the previous manifest. A source revert requires another sync from the verified reverted default branch.

## Open Questions

None.
