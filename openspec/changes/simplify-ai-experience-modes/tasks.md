## 1. Explore And Plan Artifact Creation

Dependencies: planning MR. Git predecessor: planning branch.
Hosted predecessor gate: concurrent.

- [ ] 1.1 Add staged `mode-skills/explore` and `mode-skills/plan` packages, mode fixtures, static contract tests, and real staged-skill scenarios without changing active profiles.
  - First real confirmation: Run a staged-skill scenario through explicitly named Explore and Plan skills; Explore returns visible failure output for a write attempt, while Plan creates exactly one expected artifact in an isolated disposable worktree with no unrelated path changes.
  - Acceptance: The staged packages are outside `skills/*`; AX install/update ignores them; `scripts/skill-validate.ts` validates both `skills/` and `mode-skills/`; current installed inventories remain byte-for-byte unchanged.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR scenarios, named-skill fixtures, staged-skill subagents, disposable copied-skill execution without AI-repo `node_modules`, `pnpm skills:validate`, and `pnpm test`; no test helper may select a mode from free text.
- [ ] 1.2 Fold brainstorming and Start Project behavior into Explore.
  - Acceptance: Explore is read-only and a Start Project request returns a Project Context Pack plus initial Linear project description in chat without tracker or repository writes.
  - Verification: Cover direct research, divergent brainstorming, project intake, attempted write, and organic convergence that proposes Plan and waits.
- [ ] 1.3 Implement conversational Plan convergence and bounded return to Explore.
  - Acceptance: Plan delays file creation until scope, design, delivery shape, risk, acceptance, and proof settle; broad reopened discovery returns to Explore.
  - Verification: Cover direct Plan entry, bounded research, reopened problem space, unresolved material decision, and settled convergence.
- [ ] 1.4 Implement deterministic atomic/OpenSpec routing and one primary artifact write.
  - Acceptance: Shape, semantic-size bands, risk, migration, ownership, and explicit override select `.agents/plans/<slug>.md` or one OpenSpec without a second representation; current task-audit behavior moves with parity to dependency-free `mode-skills/plan/scripts/openspec-tasks.mjs` and final `skills/plan/scripts/openspec-tasks.mjs`.
  - Verification: Cover each size band, multi-unit shape, mechanical churn, small high-risk work, explicit override, impossible override, material ambiguity, legacy/new task-audit output parity, and copied-skill Node.js execution without repo dependencies.
- [ ] 1.5 Make generated OpenSpec adapters explicit-only.
  - Acceptance: Ordinary language routes through a lifecycle mode; `$openspec-*` and `/opsx:*` remain developer escape hatches; AX deterministically normalizes adapter metadata/prompts after every OpenSpec install/update; the CLI version is unchanged.
  - Verification: Regenerate twice, validate normalized content, cover ordinary explore/propose/apply/archive collision prompts and every explicit adapter/command invocation, and fail deliberately denormalized metadata.

## 2. Automatic Plan Artifact Review

Dependencies: Unit 1. Git predecessor: Unit 1.
Hosted predecessor gate: concurrent.

- [ ] 2.1 Stage the minimal Review core with fingerprinted baseline and contextual artifact reviewer selection.
  - First real confirmation: Feed a deliberately deficient artifact to Plan; visible evidence shows four baseline reviewers plus affected specialists inspecting one fingerprint and returning normalized findings.
  - Acceptance: Review owns catalog/selection, normalization, target identity, freshness, and repeat/conflict handling; Plan owns artifact repair/scope escalation; four baseline reviewers always run and affected specialists are deterministic/read-only.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR and copied-skill scenarios; cover atomic/OpenSpec artifacts, documentation/agent, AX/skill, security, data, infrastructure, and no-extra-specialist cases.
- [ ] 2.2 Implement in-scope repair and exact-fingerprint rerun.
  - Acceptance: Plan automatically fixes findings that preserve settled decisions, revalidates, and reruns all required reviewers against the new fingerprint.
  - Verification: Cover clean, one repair, hook-style formatting mutation, stale fingerprint, and missing private evidence.
- [ ] 2.3 Implement material, repeated, and conflicting-reviewer escalation.
  - Acceptance: Scope, architecture, safety, or delivery-shape changes ask the user; the same blocker after one repair and conflicting required reviewers stop with evidence.
  - Verification: Cover each material category, normalized repeat, conflicting reviewer pair, and resolved conflict.
- [ ] 2.4 Keep review evidence task-local and prove committed artifact identity.
  - Acceptance: No reviewer identities, transcripts, fingerprints, ledgers, or handoffs enter Git, hosted descriptions, Linear, Git notes, or AX; committed artifact content must equal the reviewed fingerprint.
  - Verification: Scan durable surfaces, cover a matching commit, hook mutation, unrelated planning diff, resume without evidence, and recomputation.

## 3. Linear Mapping And Planning Publication

Dependencies: Unit 2. Git predecessor: Unit 2.
Hosted predecessor gate: concurrent.

- [ ] 3.1 Implement Linear discovery and exact preview approval.
  - First real confirmation: A reviewed artifact renders the exact project/issue create-reuse-update preview and blocks all Linear writes until the user approves that preview or explicitly confirms the artifact-scoped skip.
  - Acceptance: Start Project and multi-unit OpenSpec require a project; an atomic issue may be explicitly standalone; artifact approval alone does not authorize an unseen issue preview.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR and copied Plan-skill scenarios; cover one match, several matches, no match, archived/wrong-team project, standalone atomic, approved preview, rejected preview, auth failure, confirmed skip, and lost skip evidence.
- [ ] 3.2 Create one outcome-centered issue per implementation MR and synchronize ownership boundaries.
  - Acceptance: Atomic plans map to one issue; OpenSpec maps top-level units to issues; nested work items stay in the unit issue; artifact, hosted review, and Linear authorities remain distinct.
  - Verification: Cover duplicate reuse, stable IDs/URLs, dependencies, team status mapping, assignment-only edit, scope drift, acceptance drift, and artifact refresh.
- [ ] 3.3 Isolate planning before the first write and support exact dirty handoff identity.
  - Acceptance: Plan snapshots the primary checkout and writes in a dedicated worktree; primary state remains unchanged; handoff includes changed/untracked paths and diff fingerprint and invalidates on divergence.
  - Verification: Cover clean/dirty primary, stale same-path untracked files, separate planning worktree, explicit transfer, dirty transfer, and unknown ownership.
- [ ] 3.4 Create the native artifact-only planning checkpoint and publication checkpoint.
  - Acceptance: Native Git runs hooks without bypass; OpenSpec task audit status/fingerprint or atomic `not_applicable` route, exact clean HEAD, base diff, reviewed fingerprint, validation, reviewers, provider route, and blocker set are current before publication.
  - Verification: Cover task-audit pass/error/stale fingerprint, atomic N/A, passing hooks, hook mutation/failure/retry, extra diff, dirty head, stale review, ambiguous provider, and `hosted_planning` versus `branch_transport` scope.
- [ ] 3.5 Publish planning state or emit a complete push-only handoff.
  - Acceptance: Normal Plan creates a planning-only PR/MR after the common Linear gate; branch transport pushes only and reports provider, remote/ref/SHA, base, artifact, validation, reviews, hook evidence, worktree state, ownership release, Linear state, and remaining gates.
  - Verification: Cover GitHub, generic GitLab, Fullscript GitLab/Nitro, remote mismatch, remote-SHA verification, Plan-only, compound continuation, push-only with current Linear, and push-only with `blocked_auth_pending`.
- [ ] 3.6 Resume planning from live Git, provider, artifact, and Linear state.
  - Acceptance: Missing private reviews are rerun; stale remote or tracker state blocks; scheduled automation and private workflow storage are unnecessary.
  - Verification: Cover fresh resume, changed head, changed artifact, changed Linear mapping, lost skip confirmation, long human wait, and unsupported provider.

## 4. Execute Isolation And Native Commit Boundaries

Dependencies: Unit 1. Git predecessor: Unit 3.
Hosted predecessor gate: concurrent.

- [ ] 4.1 Implement ordered direct Execute eligibility.
  - First real confirmation: A clear request within 8 substantive files and 400 non-generated lines selects Execute, while the first failed eligibility condition visibly returns the request to Plan.
  - Acceptance: Direct Execute requires one outcome/MR/owner/proof and no architecture, migration, cross-component, safety, ordering, ambiguity, size excess, or explicit Plan request.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR and copied Execute-skill scenarios; cover every passing condition and each hard stop, including 9 files, 401 lines, generated churn, existing Linear input, `Execute only`, discovered scope before writes, and discovered scope after dirty/committed partial work.
- [ ] 4.2 Implement one writer per planning, POC, or implementation review artifact.
  - Acceptance: Each writer owns a dedicated branch/worktree; reviewers are read-only; parallel writers use separate worktrees; ambiguous ownership blocks.
  - Verification: Cover same-index collision, independent parallel writers, explicit transfer, dirty transfer, unknown owner, and dependent unit ordering.
- [ ] 4.3 Implement native cohesive commit boundaries and the explicit bootstrap.
  - Acceptance: Planning and Units 1-8 use native `git commit`; current user-approved bootstrap overrides stale pre-cutover AX wording; no implementation unit calls `ax commit` or `--no-verify`.
  - Verification: Cover first implementation commit, ordinary intermediate commit, forbidden AX commit call, and active-reference removal deferred to Unit 8.
- [ ] 4.4 Repair hook failures before progress and keep later work out of the boundary.
  - Acceptance: Failure is fixed, restaged, and recommitted before another boundary, push, or Review; unrecoverable infrastructure failure stops with evidence.
  - Verification: Cover staged formatting, test failure, hook-produced change, later-boundary contamination, dependent work, missing hook evidence after resume, and infrastructure failure.
- [ ] 4.5 Preserve the AI repo's complete per-commit verification.
  - Acceptance: Lefthook runs staged Biome, `pnpm skills:validate`, and full `pnpm test` for every native commit.
  - Verification: Exercise each hook lane and a complete successful native commit through Lefthook.

## 5. Automatic Review And Finish Provider Loop

Dependencies: Units 3 and 4. Git predecessor: Unit 4.
Hosted predecessor gate: concurrent.

- [ ] 5.1 Extend the Unit 2 Review core with automatic exact-head implementation review.
  - First real confirmation: A real implementation diff launches baseline and affected read-only reviewers against one target-base/HEAD pair and produces `review_complete` or a concrete blocker.
  - Acceptance: The Execute owner fixes findings; any head change invalidates review; material scope returns to Plan; repeated/conflicting blockers stop.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR plus copied Review/Finish-skill scenarios; cover clean, multi-reviewer, duplicate finding, fix/rerun, stale head, material return, repeat, and conflict.
- [ ] 5.2 Implement standalone Review target selection and `ready_to_finish`.
  - Acceptance: Direct Review states target/base and does not fix unless requested; readiness requires clean committed HEAD, current hooks, and no blockers.
  - Verification: Cover plan, OpenSpec, POC, dirty worktree, branch diff, PR/MR, Linear mapping, ambiguous target, and review-and-fix.
- [ ] 5.3 Internalize provider routing and hosted feedback behind Review/Finish.
  - Acceptance: GitHub, generic GitLab, and Fullscript GitLab/Nitro use project/profile policy; ambiguous provider blocks; provider helpers are not inferred lifecycle entries.
  - Verification: Cover each route, Nitro selected/not selected, stale hosted feedback, CI repair, and exact-head rereview.
- [ ] 5.4 Implement Finish publication and feedback repair loops.
  - Acceptance: Delivery-authorized work publishes; local-only work stops; hosted findings return Execute -> Review -> Finish; unqualified Finish never merges.
  - Verification: Cover initial publication, subsequent commit, closed/merged branch protection, local-only, hosted fix, `merge_ready`, and `stack_ready`.
- [ ] 5.5 Gate merge, deployment, and cleanup on explicit authority.
  - Acceptance: Merge/ship language authorizes bottom-to-top merge after current gates; deployed/merged state is verified; cleanup follows request or project policy.
  - Verification: Cover no-merge default, explicit merge, queue, retargeted child, conflict, deploy, cleanup, and remote-state verification.

## 6. Complete OpenSpec Rehearsal

Dependencies: Units 3 and 5. Git predecessor: Unit 5.
Hosted predecessor gate: concurrent.

- [ ] 6.1 Require a reviewed planning MR before creating the POC.
  - First real confirmation: An OpenSpec with local review but no hosted planning artifact is rejected; the same exact planning head becomes eligible only after current Linear mapping/skip and clean latest-head hosted planning feedback.
  - Acceptance: Atomic plans remain rehearsal-optional; Plan owns rehearsal scope/draft publication/reconciliation, Execute owns the sole POC writer, Review owns exact-head inspection, and OpenSpec rehearsal precedes final planning approval and clean implementation.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR and copied Plan-skill scenarios; cover missing MR, stale hosted feedback, blocked Linear, explicit skip, exact eligible head, wrong base, and accidental merge route.
- [ ] 6.2 Build every delivery unit and applicable production surface in one unmergeable POC.
  - Acceptance: Implementation, tests, docs, runbooks, operations/observability, operational hardening, relevant exhaustive edge cases, migrations/rollback/compatibility, security, performance, accessibility, and direct success/failure proof are covered or a concern has reviewed `not_applicable` rationale.
  - Verification: Cover complete, Unit-1-only partial, scaffolding-only, mocked boundary, and each missing production-surface category.
- [ ] 6.3 Rehearse runtime activation only in isolated roots.
  - Acceptance: POC activation uses temporary HOME, AX config/lock/cache, skills, instructions, hooks, and profiles; live `~/.agents`, `~/.codex`, and `~/.claude` inventories remain unchanged.
  - Verification: Snapshot live inventories, inject candidate activation failures, verify isolation and cleanup, and reject live-root targets.
- [ ] 6.4 Compute the exact `rehearsal_completion_receipt`.
  - Acceptance: Parsed planning unit/work-item IDs exactly equal receipt IDs; each item has implementation and verification evidence; required concern sets, CI, local/hosted reviews, reconciliation, and zero missing entries reference exact planning and POC heads.
  - Verification: Cover missing/duplicate/extra IDs, missing evidence, invalid work-item N/A, surface N/A rationale, stale planning head, stale POC head, and complete receipt.
- [ ] 6.5 Require exact-head automation and explicit user acceptance.
  - Acceptance: Automation alone cannot accept; every POC-head change refreshes exact-head review and acceptance; plan changes rerun the full/affected classification and required hosted planning feedback first.
  - Verification: Cover pending user, accepted head, behavior-preserving new head, material plan correction, local finding, hosted finding, and missing acceptance after resume.
- [ ] 6.6 Reconcile durable learnings and dispose of POC code.
  - Acceptance: Contract learnings update OpenSpec and approved Linear previews; local notes stay transient; POC closes unmerged and its worktree is removed; final branches exclude POC ancestry, commit IDs, cherry-pick trailers, matching stable patch IDs, and POC branch/diff writer inputs while allowing behavior independently recreated from the revised OpenSpec.
  - Verification: Cover contract/local finding split, Linear refresh, closure, worktree removal, ancestry/commit/trailer/patch reuse, isolated writer inputs, equivalent independent recreation, and final-stack provenance.

## 7. OpenSpec Stack Sequencing

Dependencies: Units 4, 5, and 6. Git predecessor: Unit 6.
Hosted predecessor gate: concurrent.

- [ ] 7.1 Create one worktree and implementation MR per top-level unit while consuming Plan's Linear gate.
  - First real confirmation: An accepted rehearsal produces the first clean final unit from the reviewed planning head with correct predecessor, mapped issue or approved-skip identity, branch, worktree, and MR identity.
  - Acceptance: With approved mapping, each unit consumes exactly one existing issue; with approved skip, no issue is required and task IDs identify units; missing/stale mappings return to Plan and Unit 7 never creates issues; nested work becomes cohesive commits and the POC is never a predecessor.
  - Verification: Run `writing-skills` RED/GREEN/REFACTOR plus copied Execute/Finish-skill scenarios; cover mapped issue consumption, approved skip, missing/stale mapping return, duplicate-create rejection, first/dependent unit, nested commits, wrong base, and POC ancestry rejection.
- [ ] 7.2 Allow dependency-safe construction and enforce marked hosted gates.
  - Acceptance: Every unit has `Hosted predecessor gate: required|concurrent`; Plan owns it; task audit rejects missing/invalid values and defaults uncertain resume to `required`; concurrent still requires predecessor local Review and MR publication.
  - Verification: Cover concurrent hosted review, required hosted wait, missing/invalid marker, safe default, missing predecessor review, and published/unpublished predecessor.
- [ ] 7.3 Keep unit-local OpenSpec and Linear changes with their implementation MR.
  - Acceptance: Each MR updates its own task/contract and refreshes the common Linear gate through Plan when needed; generic final-unit archival behavior is implemented and fixture-tested here; no reconciliation-only MR exists.
  - Verification: Cover task completion, unit-local contract change, mapped-issue update preview, approved skip, generic last-unit archive, and attempted reconciliation MR.
- [ ] 7.4 Reroute cross-unit contract changes through Plan.
  - Acceptance: Affected writers freeze; planning branch/amendment and Linear update first; local/hosted planning review and rehearsal rerun; descendants restack and rereview from the new base.
  - Verification: Cover cross-unit architecture, migration, security, delivery-order changes, writer freeze, new stack base, and descendant invalidation.
- [ ] 7.5 Report and merge complete stacks safely.
  - Acceptance: Before `stack_ready`, parsed stack-tip `tasks.md` has no unchecked delivery unit or nested work item and maps every checked item to an implementation artifact, exact HEAD, predecessor, and verification evidence; the common Linear gate, planning approval, accepted closed POC, reviews/CI, and relationships are current.
  - Verification: Cover ready stack, valid skip, missing issue, unchecked unit, unchecked nested item, self-attested completion without artifact evidence, stale review, retarget after merge, conflict, and final remote verification.

## 8. Atomic Runtime And AX Cutover

Dependencies: Units 1-7. Git predecessor: Unit 7.
Hosted predecessor gate: required.

Justification: Profile selection, active instructions, retired skill removal, AX command removal, hooks-source correction, and managed-entry activation must remain one unit so no supported runtime exposes both lifecycles, missing commands referenced by active instructions, or partially replaced managed entries.

- [ ] 8.1 Move completed mode packages into `skills/` and replace the local wildcard with the exact personal/work manifest.
  - Justification: These seven items remain one MR because reviewability and rollback require profile selection, instruction references, AX command availability, hook configuration, managed-entry activation, live parity, and OpenSpec archival to change as one immutable runtime boundary.
  - First real confirmation: Build a candidate personal and work runtime from the exact unit HEAD; visible inventory contains exactly five lifecycle modes, every named retained specialist, and unchanged external Cloudflare/Fullscript blocks.
  - Acceptance: `mode-skills/` staging disappears; AX-owned retired packages are absent; unmanaged retired lifecycle collisions block with path/provenance instead of being deleted; generated OpenSpec adapters are explicit-only; no lifecycle registry or persisted state is added.
  - Verification: Run final `writing-skills` RED/GREEN/REFACTOR and copied installed-skill scenarios; compare managed manifests, scan combined roots, cover unmanaged `plan-followthrough`/`plan-slices`/`plan-to-pr`, preserve unmanaged specialists and `.codex/skills/.system`, and run ordinary-language plus explicit OpenSpec fixtures.
- [ ] 8.2 Remove `ax commit`, `ax review-gate`, required-gate state, and active references.
  - Acceptance: Commands, locks, activation/validation/consumption/recovery code, help, packaging, docs, tests, and agent call sites are removed without alias or shim.
  - Verification: Run negative CLI/help tests and forbidden-reference validation scoped to active sources while excluding archived historical planning records.
- [ ] 8.3 Remove `ax plans artifact` private storage while preserving path-safety helpers.
  - Acceptance: Blob/index/manifest/revision/fingerprint/correlation storage and call sites are deleted; retained path-safety logic lives at `skills/plan/scripts/path-safety.ts` after final move.
  - Verification: Run negative command/storage tests, owner-local boundary tests, and scans for removed storage formats.
- [ ] 8.4 Update active instructions and correct the hooks source prerequisite.
  - Acceptance: Repo and installed instructions use five modes and native Git; `runtime.hooks.sourceDir` is repository-relative `hooks`; `hooks/README.md` and active docs use the portable source; corresponding lock state is regenerated; unrelated dirty-primary config/lock edits remain excluded.
  - Verification: Run instruction snapshots, hook-source resolution tests, strict config/lock drift validation, and a scan proving active docs contain no machine-specific repository source path.
- [ ] 8.5 Add transactional runtime candidate activation and rollback.
  - Acceptance: `scripts/ax/runtime-activation.ts` owns transaction planning, ownership validation, application, reconstruction, and rollback while `scripts/ax.ts` only orchestrates the CLI; manifests come from exact Unit 7/8 locks; changes are limited to their verified union; failure preserves unmanaged/system assets.
  - Verification: Enforce the module boundary and cover old-managed removal, unmanaged same-name collision, stale predecessor lock, live identity mismatch, resume, success, injected failures, rollback, and zero lock diff.
- [ ] 8.6 Implement the post-commit `runtime_activation_gate` and refresh rules.
  - Acceptance: Review emits `review_complete` plus `activation_ready` for the immutable head but not `ready_to_finish`; Finish owns authorized live mutation and emits `ready_to_finish` only after the exact-head gate passes; omission/failure blocks Unit 8 publication and `stack_ready`.
  - Verification: Cover missing authority, exact `review_complete`/`activation_ready` handoff, premature readiness rejection, successful Finish readiness, omitted/failed activation, feedback-head invalidation, blocked mutation, merged-main/revert refresh, and restoration.
- [ ] 8.7 Complete task state and archive this OpenSpec in the immutable source commit.
  - Acceptance: The source commit contains Unit 8 implementation, own contract changes, every checked source task, and accumulated archive; it passes native hooks and exact-head Review before the external activation gate; no follow-up reconciliation MR exists.
  - Verification: Validate the archived OpenSpec, stack ancestry, task-to-artifact evidence, exact-head reviews, clean worktree, and native Lefthook commit.
