# Selectable AX Profile

## Goal

Let each machine select one AX profile that controls both installed runtime
assets and workflow policy, so a personal machine can synchronize without
resolving or authenticating against Fullscript sources. [confidence: 0.99 -
certain | reason: this is the accepted user outcome and directly addresses the
observed personal sync failure]

Deliver this plan and its implementation as one change set in one final draft
GitHub PR against `main`. The explicit GitHub route overrides this repository's
default GitLab MR policy for this change. There is no planning PR, OpenSpec
change, POC, or separate delivery unit. [confidence: 0.99 - certain | reason:
the user explicitly selected a PR and the repository policy selects one atomic
plan for ordinary AI-repo work]

## Context

Tracked `ax.config.json` currently selects both `personal` and `work` through
`runtime.installedProfiles` and selects `work` through
`runtime.policyProfile`. Top-level `pnpm ax sync` therefore resolves the
private Fullscript skill source even on a personal machine. The runtime already
has named `personal` and `work` profile definitions, a configurable runtime
root, candidate construction before target replacement, a generic transaction
engine, and offline status/validation surfaces. [confidence: 0.97 - certain |
reason: direct source inspection confirmed each existing boundary]

The accepted model has one term: **selected profile**. A selected profile owns
both its asset inventory and its instruction/rule policy. This iteration does
not expose independent installed-profile and policy-profile selection.
[confidence: 0.99 - certain | reason: the simplified one-profile model was
explicitly accepted]

An earlier implementation of this plan was merged through GitHub PR #6, then
removed when the GitHub mirror's `main` was force-rewritten from the newer
authoritative history. The preserved implementation branch is reusable
evidence, not an accepted base: port its behavior onto the current `main` and
reconcile every overlapping AX, workflow, agent, documentation, and test
change rather than replaying it blindly. [confidence: 0.99 - certain | reason:
live branch and provider inspection confirmed the preserved commits, merged PR,
force-rewritten main, and overlapping current owners]

## Accepted Decisions

### Profile definition and local selection

- Keep `profiles.personal` and `profiles.work` in tracked `ax.config.json` as
  the available profile definitions. Remove tracked
  `runtime.installedProfiles` and `runtime.policyProfile`; tracked config must
  not select a profile for every machine. [confidence: 0.97 - certain | reason:
  separating portable definitions from the machine choice is the accepted
  correction]
- Persist exactly one `selectedProfile` in
  `<runtime-root>/selected-profile.json`. Use a small versioned JSON document
  and atomic same-directory replacement; do not add a policy selector, multiple-profile
  array, machine preset, host map, selection file, or environment override.
  [confidence: 0.95 - certain | reason: one persisted name is the minimum state
  needed for repeatable sync]
- Treat profile-specific instruction paths as the workflow policy for that
  profile. `personal` keeps personal and Cloudflare assets and excludes the
  `fullscript` block; `work` keeps personal, Cloudflare, and Fullscript assets
  plus work-specific instructions. [confidence: 0.98 - certain | reason: this
  matches the current profile definitions and accepted boundary]

### CLI behavior

- Add `--profile <name>` only to top-level `ax sync`. The equivalent command in
  this repository is `pnpm ax sync --profile <name>`. [confidence: 0.98 -
  certain | reason: one explicit first-sync/switch flag is the accepted CLI]
- When no local selection exists, top-level sync without `--profile` fails
  before network access or target mutation with an actionable instruction to
  rerun using an available profile name. Do not add an interactive wizard or a
  silent default. [confidence: 0.96 - certain | reason: explicit initialization
  prevents accidental work-profile authentication and keeps headless behavior
  deterministic]
- When local selection exists, plain `ax sync` reuses it. Passing the same
  profile is an idempotent explicit sync; passing a different valid profile is
  an explicit profile switch. Unknown profiles fail before source resolution.
  [confidence: 0.98 - certain | reason: these are the complete simple-state
  transitions]
- Scoped runtime sync commands accept no profile flag and require an existing
  local selection. They consume that selection and continue to mutate only
  their current surface. Repo-local OpenSpec remains independent of runtime
  profile initialization. [confidence: 0.95 - certain | reason: this preserves
  the current scoped-command boundary]
- `ax status` and `ax validate` remain offline and read-only. They report the
  selected profile when initialized; an uninitialized runtime is a clear
  non-success finding that points to `ax sync --profile <name>`. [confidence:
  0.94 - certain | reason: local selection inspection needs no network and
  belongs in the existing runtime report]

### Switching and failure safety

- Build and validate the complete candidate for the requested profile before
  replacing live runtime targets. Persist the new selected profile only after
  every profile-owned runtime operation succeeds. [confidence: 0.97 - certain |
  reason: the accepted selection must never claim a failed switch]
- Reuse `scripts/ax/transaction-engine.ts` for the profile-owned replace and
  removal operations plus the local selection commit, instead of creating a
  second rollback mechanism. A failed or interrupted profile switch must
  restore the previous profile-owned runtime and retain the previous selection.
  [confidence: 0.86 - high | reason: the generic transaction engine already
  implements staged replacement, rollback, and final manifest commit, while
  the exact adapter shape needs implementation proof]
- Replace the current blanket legacy-runtime-state cleanup with explicit
  cleanup that cannot delete `selected-profile.json` or an active profile
  transaction. Old `managed-runtime.json` state remains retired and is never
  interpreted as a profile choice. [confidence: 0.94 - certain | reason:
  `removeLegacyRuntimeState` currently deletes runtime transaction paths and
  must be narrowed before those paths become active again]
- On a successful switch, remove paths owned exclusively by the previous
  profile and install paths owned by the new profile. Continue using
  `runtime.retiredSkills` for paths removed from profile definitions across
  source versions. Leave unrelated paths untouched. [confidence: 0.93 -
  certain | reason: profile-difference cleanup is required to make selection
  authoritative without broad filesystem ownership]
- Keep managed tool-config values profile-independent in this iteration. They
  continue to use the existing top-level config preparation and validation
  path and must not influence which remote profile sources are resolved.
  [confidence: 0.91 - certain | reason: current managed config contains no
  profile-specific values]

### Migration and activation

- Do not infer or migrate the current tracked `personal + work` selection. The
  first release treats a machine without local selection state as
  uninitialized and requires one explicit `--profile` choice. [confidence:
  0.96 - certain | reason: inferring `work` would reproduce the incident and
  inferring `personal` would silently change work machines]
- After merge, initialize this machine with
  `pnpm ax sync --profile personal`, then run `pnpm ax validate`. Future live
  refreshes use plain `pnpm ax sync`. [confidence: 0.99 - certain | reason: the
  user selected the personal profile for this machine]
- Startup hooks that encounter uninitialized state report the same actionable
  command and stop; they do not prompt or choose a profile. [confidence: 0.92 -
  certain | reason: startup execution is headless and must not guess]

## Scope

### In scope

- Replace tracked runtime selection with one locally persisted selected
  profile.
- Add top-level `sync --profile <name>` parsing and selection resolution.
- Make sync, status, validate, and scoped runtime commands consume local
  selection state.
- Make profile switches remove old profile-exclusive owned paths and roll back
  failed or interrupted switches.
- Update the canonical AX specs, CLI/runtime tests, documentation, active agent
  instructions/rules, and `ax-cli` skill.
- Validate changed shared agent behavior with `writing-skills` before commit.
- Deliver through a draft GitHub PR targeting `main`, then follow GitHub CI and
  review feedback under the explicit provider override.

### Out of scope

- Multiple simultaneously selected profiles.
- A separate policy profile, policy inheritance, compatibility matrix, or
  mixed personal/work policy.
- Interactive profile selection, machine presets, host detection, environment
  overrides, or external selection files.
- Changing the contents of the existing personal, work, Cloudflare, or
  Fullscript blocks except where active instructions must describe the new
  selection behavior.
- Changing remote URLs, credentials, dependency versions, or package manifests.
- Publishing through GitLab, requesting Nitro, merging the PR, deploying, or
  cleaning up branches without later explicit authority.

## Reuse and Deviation Contract

### Canonical owners to extend

- `ax.config.json` owns available profile definitions and shared runtime target
  declarations.
- `scripts/ax.ts` owns Commander parsing, top-level/scoped routing, and
  structured output.
- `scripts/ax/runtime-sync.ts` owns profile inventory resolution, runtime path
  classification, candidate construction, live-source safety, status,
  validation, and convergence.
- `scripts/ax/transaction-engine.ts` owns generic staged filesystem
  replacement, rollback, interrupted-transaction recovery, and manifest-last
  commits.
- `scripts/ax/json-state.ts` owns safe local JSON-state primitives where those
  primitives fit the selected-profile document.
- `tests/unit/ax-cli.test.ts`,
  `tests/unit/runtime-authoritative-sync.test.ts`,
  `tests/unit/runtime-sync-safety.test.ts`, and
  `tests/integration/ax-cli.test.ts` own the current parser, desired-state,
  safety, and end-to-end CLI coverage.
- The preserved `codex/selectable-ax-profiles` implementation is the closest
  behavior precedent. Reuse its state schema and transaction adapter while
  retaining all newer current-`main` behavior in overlapping owners.
- `docs/ax.md`, `skills/ax-cli/SKILL.md`, `rules/command-and-tools.md`,
  `instructions/AGENTS.md`, root `AGENTS.md`, and their contract tests own the
  active guidance.
- `openspec/specs/ax-cli/spec.md` and any dependent canonical specs own durable
  AX behavior. Update those specs directly as implementation-alignment work;
  do not create an OpenSpec change directory.

### New mechanism and justification

Add one small local selected-profile state boundary under `scripts/ax/`, or a
focused extension to `runtime-sync.ts` if it remains cohesive. The state stores
only schema version and selected profile. A local state boundary is necessary
because tracked configuration cannot represent different choices on personal
and work machines. Do not introduce a broader runtime registry or orchestration
database. [confidence: 0.91 - certain | reason: the accepted behavior requires
one durable machine-local choice and nothing more]

## Implementation Plan

### 1. Prove personal profile initialization through the real CLI

- Remove tracked selection fields from the runtime config type and
  `ax.config.json`; retain and validate the named profile definitions.
- Add `--profile <name>` to top-level sync parsing and thread it through the
  invocation boundary without exposing it on scoped commands.
- Implement versioned selected-profile state resolution under the effective
  runtime root, including missing, valid, malformed, and unknown-profile
  diagnostics.
- Narrow legacy-state cleanup so it removes obsolete state without deleting
  the new selection file, transaction journal, backups, or lock used by an
  active runtime sync.
- Add the first integration proof: run `ax sync --profile personal` against an
  isolated HOME/runtime and configured fake remote executors, assert that the
  personal and Cloudflare sources are resolved, assert that the Fullscript URL
  is never requested, and assert that status reports `personal`.
- Add an isolated local Git remote for the work-only block and run the real CLI
  with `--profile work`; assert that the work-only asset installs and the
  selection persists without depending on live Fullscript credentials.

**First real confirmation:** the actual top-level CLI completes a personal
profile sync without touching `git.fullscript.io`, a second plain `ax sync`
reuses the persisted personal selection, and an isolated work-profile CLI run
installs its work-only asset from a credential-free local Git fixture.
[confidence: 0.97 - certain | reason: this proves both user-visible profile
paths through the real entrypoint in the first slice]

### 2. Complete switching, cleanup, and recovery semantics

- Derive previous and requested owned-path inventories from the selected
  profiles and current config.
- Adapt runtime candidate operations to the existing transaction engine so a
  profile switch stages replacements, removes previous-only owned paths,
  commits selected-profile state last, and rolls back on injected failure or
  interruption.
- Preserve explicit retired-skill removal and unrelated-path behavior.
- Cover personal-to-work, work-to-personal, same-profile no-op, invalid
  profile, candidate-fetch failure, mid-apply failure, interrupted recovery,
  and selection-commit failure.

### 3. Align scoped commands, offline inspection, and guidance

- Make scoped sync require and reuse initialized selection without accepting
  `--profile`.
- Make top-level and scoped status/validate report selected or uninitialized
  state without network access.
- Remove guidance and tests that direct users to edit
  `runtime.installedProfiles` or `runtime.policyProfile`.
- Update the canonical AX specs to the one-profile model and update dependent
  policy wording to derive policy from `selectedProfile`.
- Update docs, root and portable instructions, rules, and `ax-cli` skill with
  first-sync, repeat-sync, switch, failure, and post-merge activation commands.
- Run `writing-skills` against the changed guidance and reconcile findings
  before Review.

## Acceptance

- A clean uninitialized runtime fails plain `ax sync` before network or live
  mutation and names the available `--profile` choices.
- `ax sync --profile personal` never resolves the Fullscript remote, persists
  `personal` only after success, and makes a subsequent plain sync reuse it.
- `ax sync --profile work` resolves the Fullscript block and persists `work`
  only after success.
- Switching profiles removes previous-only AX-owned paths, preserves unrelated
  paths, and rolls back runtime and selection state on failure or interruption.
- Scoped sync uses the persisted profile and rejects profile-selection flags.
- Status and validate remain offline and report selected/uninitialized state.
- Tracked config contains profile definitions but no machine selection.
- Active specs, docs, instructions, rules, skill guidance, and contract tests
  consistently describe the one-profile model.
- The implementation requires no dependency or package-manifest change.
- The final review artifact is a draft GitHub PR against `main`; GitLab/Nitro
  publication is not used for this change.

## Verification

- `pnpm exec tsx --test tests/unit/ax-cli.test.ts`
- `pnpm exec tsx --test tests/unit/runtime-authoritative-sync.test.ts`
- `pnpm exec tsx --test tests/unit/runtime-sync-safety.test.ts`
- `pnpm exec tsx --test tests/unit/ax-cli-skill-contract.test.ts`
- `pnpm exec tsx --test tests/unit/ax-runtime-identity-docs.test.ts`
- `pnpm exec tsx --test tests/integration/ax-cli.test.ts`
- `pnpm run biome:lint-format`
- `pnpm run skills:validate`
- `pnpm test`
- `git diff --check`
- Isolated-HOME/runtime CLI proof that personal initialization and repeat sync
  do not resolve the Fullscript URL.
- Isolated-HOME/runtime CLI proof that work initialization resolves and installs
  a work-only source through a local Git fixture.
- After merge only: from the verified clean `main` worktree, run
  `pnpm ax sync --profile personal` and `pnpm ax validate` for live activation.

## Risk

The main risk is changing the active profile while replacing many runtime
targets. Candidate-first resolution, transaction-engine reuse, previous-only
ownership calculation, selection-last commit, and injected rollback/recovery
tests contain that risk. [confidence: 0.88 - high | reason: the repository has
the required primitives, but runtime-sync integration is the implementation's
most failure-sensitive area]

The secondary risk is guidance drift because current docs and tests explicitly
teach tracked `installedProfiles` and `policyProfile`. Treat the canonical
specs, runtime code, CLI help, docs, instructions, rules, and skill contract as
one alignment set. [confidence: 0.95 - certain | reason: repository search
identified all of these active references]
