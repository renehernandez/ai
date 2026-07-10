## Why

The current agent experience exposes overlapping lifecycle skills, spreads authority across several workflow packages, and couples reusable runtime management to tracked lock state and workflow-specific AX commands. The result is difficult to invoke, difficult to keep synchronized across machines, and expensive to evolve because source commits and separate install/update paths create churn without improving the local ownership contract.

## What Changes

- Introduce five inferred public workflow modes: Explore, Plan, Execute, Review, and Finish. Explicit mode names override inference, specialists keep bounded authority, and authority-expanding transitions remain visible.
- Keep Explore read-only. Make Plan conversational until material decisions settle. Allow direct Execute only when no unresolved behavior, architecture, migration, safety, ownership, ordering, or verification decision remains.
- Select planning artifacts semantically. Use an atomic plan for one coherent implementation MR when a durable specification and full rehearsal are unnecessary; use OpenSpec for cross-cutting contracts, migration design, or work that requires the mandatory full POC.
- Review Plan and OpenSpec artifacts locally with implementation-readiness, edge-case/risk, simplification/scope, and refactoring reviewers. Review POC and final implementation heads with correctness, regression, maintainability, and verification reviewers. Add affected-domain specialists to either set.
- **BREAKING** After this migration lands, require every subsequent OpenSpec to receive a complete disposable implementation POC before final implementation. Publish it as a draft review-only PR/MR, fix local and hosted automated feedback, obtain the user's personal acceptance of the latest head, close it unmerged, and reconcile durable findings into the spec once. This migration itself is the user-authorized bootstrap exception and ships through one implementation MR with Nitro review.
- **BREAKING** Deliver atomic plans through one final PR/MR and OpenSpec changes through one final PR/MR per top-level delivery unit, without a separate planning PR/MR. This change has one delivery unit, so its complete spec and implementation ship in one mergeable MR.
- Make Linear integration policy-driven with exactly `required` or `disabled`. Resolve policy from direct user instruction, then project policy, then one explicit workflow-policy profile (`personal: disabled`, `work: required`). Map this single-MR change to one outcome-centered issue when Linear is required.
- Enforce one writer per branch/worktree. Reviewers remain read-only. Execute includes automatic local Review and stops before terminal actions; Finish owns hosted publication and feedback follow-through. Merge, deployment, and cleanup still require explicit authority or activated project policy.
- **BREAKING** Reduce the user-facing lifecycle surface to the five modes. Retire standalone lifecycle entrypoints and migrate required behavior into self-contained owning mode packages while keeping bounded specialists directly invokable.
- **BREAKING** Replace tracked `ax.lock.json` with local `~/.agents/runtime/managed-runtime.json`. Keep desired source/profile state in `ax.config.json`; store only installed profiles, one workflow-policy profile, AX-owned installed paths, and content hashes in the local manifest.
- **BREAKING** Replace runtime `install` and `update` commands with one `sync` command. Keep `status` and `validate` read-only and offline. Old commands fail without mutation and point to the corresponding `sync` command.
- Resolve every configured remote ref to its latest available commit once per sync invocation, use one immutable source snapshot for all entries from that source, and never persist source URLs, refs, resolved commits, or timestamps in the local manifest.
- Build and validate a complete runtime candidate under an exclusive mutation lock. Apply it through a hash-checked recoverable journal, write the local manifest last, preserve recovery conflicts instead of overwriting external edits, retain seven verified backups per asset/target, and keep disposable source caches under `~/.agents/runtime/cache`.
- Make `ax openspec sync` converge missing, configured, and partial repo-local OpenSpec state through its own repo-scoped transaction domain while preserving context confirmation, generated-adapter normalization, and validation.
- Exercise runtime synchronization only against isolated roots on the implementation branch. Refresh the live runtime with ordinary `ax sync` only from verified merged default-branch source.

## Capabilities

### New Capabilities

- `agent-workflow-modes`: Defines the five public modes, semantic routing, authority boundaries, worktree ownership, target-specific review baselines, and Finish behavior.
- `reviewed-plan-artifacts`: Defines conversational Plan behavior, semantic artifact selection, local artifact review, and the absence of a separate planning PR/MR.
- `linear-plan-tracking`: Defines `required|disabled` policy resolution, preview/write authority, single-issue mapping, and tracker/source-of-truth boundaries.
- `openspec-implementation-rehearsal`: Defines the mandatory full POC, automated and personal review, one-time reconciliation, disposal, and clean final implementation handoff.

### Modified Capabilities

- `review-first-plan-orchestration`: Removes the separate planning MR, adds the full draft POC, and derives final one-or-many implementation artifacts from the reviewed task units with provider-policy review gates.
- `ax-cli`: Narrows AX to runtime assets, removes tracked lock and workflow commands, and introduces local ownership state plus recoverable synchronization.
- `ax-openspec`: Replaces separate install/update mutation paths with state-converging `ax openspec sync`.
- `ax-status`: Reports desired, managed, observed, cache, and recovery state without network access or mutation.

## Impact

- Five new self-contained mode packages under `skills/`; retirement of overlapping lifecycle packages, including `session-start`, and orphaned workflow helpers.
- Updates to `AGENTS.md`, installed instructions, shared rules, retained-specialist cross-links, hook guidance, AX guidance, and generated OpenSpec adapter normalization.
- AX CLI and runtime modules for local manifest state, source snapshots, synchronization, backups, OpenSpec convergence, and crash recovery.
- Removal of tracked `ax.lock.json`, repo-local `.ax/cache`, runtime `install`/`update`, `ax commit`, `ax review-gate`, `ax plans artifact`, and their workflow storage.
- Updated unit/integration fixtures for semantic routing, mode authority, POC/final review flow, Linear policy, latest-ref sync, offline inspection, rollback/recovery, and isolated runtime proof.
- One mergeable implementation MR for this one-unit change, with local review and latest-head Nitro iteration. No POC, planning MR, reconciliation-only MR, or live pre-merge runtime cutover.
