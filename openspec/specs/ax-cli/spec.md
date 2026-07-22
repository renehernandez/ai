# ax-cli Specification

## Purpose
TBD - created by archiving change guide-openspec-runtime-setup. Update Purpose after archive.
## Requirements
### Requirement: Managed runtime shim
The system SHALL provide an `ax` command through an AX-managed `~/.local/bin/ax` shim backed by the durable AI repo and invokable from arbitrary target projects.

#### Scenario: Managed shim resolves durable source root
- **WHEN** the managed shim is invoked outside the AI repo
- **THEN** the runtime source root resolves to the durable AI repo checkout
- **AND** the executable path is reported from `AX_EXECUTABLE_PATH`

#### Scenario: Central config is default
- **WHEN** the managed shim is invoked without `--config`
- **THEN** desired state resolves from the durable AI repo `ax.config.json`
- **AND** local ownership, cache, transactions, and backups resolve under `~/.agents/runtime`
- **AND** no tracked lock path is required

#### Scenario: Repo-local scope targets cwd
- **WHEN** the managed shim runs a repo-local scope such as `openspec`
- **THEN** the target root resolves to the invocation current working directory

#### Scenario: Explicit config override remains available
- **WHEN** the managed shim is invoked with `--config <path>`
- **THEN** desired state uses that explicit configuration
- **AND** machine-local runtime state remains under the configured local runtime root

#### Scenario: Shim lifecycle is managed
- **WHEN** shim install, status, or uninstall runs
- **THEN** AX mutates or inspects only the AX-managed executable shim
- **AND** shim `install` remains distinct from runtime synchronization

### Requirement: Desired and managed runtime state are separate
The system SHALL treat tracked `ax.config.json` as available desired-state definitions, local `<runtime-root>/selected-profile.json` as the machine selection, and the filesystem as observed state.

#### Scenario: Desired state is declared
- **WHEN** AX reads `ax.config.json`
- **THEN** it derives available profiles, source URLs and refs, selected names, target paths, hooks, instructions, and OpenSpec settings
- **AND** tracked config does not select a profile for every machine

#### Scenario: Hook source is resolved
- **WHEN** AX builds hook candidates
- **THEN** `runtime.hooks.sourceDir` resolves repository-relative `hooks` inside the local source snapshot
- **AND** no machine-specific checkout path is required

#### Scenario: Successful sync records selection
- **WHEN** runtime synchronization succeeds
- **THEN** `selected-profile.json` records schema version and exactly one selected profile
- **AND** it records no URL, ref, resolved commit, timestamp, cache path, transaction data, policy selector, or duplicated desired configuration

#### Scenario: Previous profile content leaves desired state
- **WHEN** a successful profile switch no longer includes a path owned only by the previous profile
- **THEN** AX removes that path and its managed links transactionally
- **AND** unrelated paths outside exact AX targets remain untouched

### Requirement: Sync is the only runtime convergence command
The system SHALL expose `sync` as the sole runtime-content mutation verb and keep `status` and `validate` read-only.

#### Scenario: Runtime profiles synchronize
- **WHEN** a user runs `ax sync`
- **THEN** AX reconciles skills, instructions, and hooks for the locally selected profile
- **AND** top-level sync does not mutate repo-local OpenSpec files

#### Scenario: First sync selects one profile
- **WHEN** no selected profile exists
- **THEN** top-level sync requires `--profile <name>`
- **AND** validates that name before source resolution or mutation
- **AND** performs no interactive selection and has no silent default

#### Scenario: Later sync reuses selection
- **WHEN** one valid selected profile exists and top-level sync has no profile flag
- **THEN** AX reuses that selected profile

#### Scenario: Profile switch succeeds
- **WHEN** top-level sync names a different valid profile
- **THEN** AX builds the complete candidate before mutation, removes previous-profile-only owned paths, and commits the new selection last
- **AND** the selected profile controls both installed assets and workflow policy

#### Scenario: Profile switch fails
- **WHEN** candidate construction, target replacement, deletion, validation, or selection commit fails
- **THEN** AX restores the previous profile-owned runtime and previous selection
- **AND** leaves the failed profile unselected

#### Scenario: Scoped surface synchronizes
- **WHEN** a user runs skills, instructions, or hooks `sync`
- **THEN** AX requires an existing valid selected profile and consumes it
- **AND** reconciles only that surface's owned paths with the same snapshot and transaction rules
- **AND** never creates or changes profile selection

#### Scenario: Scoped sync has no manifest
- **WHEN** a scoped sync runs before top-level initialization
- **THEN** it exits with `runtime_profile_uninitialized` and points to top-level `ax sync --profile <name>`

#### Scenario: Scoped selection flag is passed
- **WHEN** a caller passes `--profile` to a scoped sync
- **THEN** command parsing rejects the unsupported option and performs no mutation

#### Scenario: Legacy runtime command is invoked
- **WHEN** a caller invokes runtime `install` or `update` at top level or a scoped surface
- **THEN** AX exits without mutation and reports the corresponding `sync` command
- **AND** no compatibility alias executes

#### Scenario: Runtime is inspected
- **WHEN** a user runs `status` or `validate`
- **THEN** AX performs no network access and no filesystem mutation
- **AND** reports or fails on missing, drifted, unmanaged, collision, or incomplete-transaction state

### Requirement: Every source is snapshotted once per invocation
The system SHALL build each synchronization candidate from one immutable snapshot per configured source/ref pair.

#### Scenario: Remote source synchronizes
- **WHEN** selected entries use the same remote URL and ref
- **THEN** AX fetches the ref once, resolves its latest commit once, and uses one temporary checkout for all of those entries
- **AND** it may print the resolved SHA without persisting it

#### Scenario: Local source synchronizes
- **WHEN** selected entries use a local source
- **THEN** a clean Git source uses its selected tree snapshot
- **AND** an arbitrary or dirty source requires equal pre-copy, candidate-copy, and post-copy content hashes
- **AND** mismatch retries within a bound or fails with `source_changed_during_snapshot`

#### Scenario: Candidate is unchanged
- **WHEN** desired inventory, candidate hashes, manifest hashes, and observed entries agree
- **THEN** AX performs no target replacement, backup creation, or manifest rewrite

### Requirement: Content identity is canonical and versioned
The system SHALL use `sha256-tree-v1` for every runtime snapshot, journal, backup, and recovery identity.

#### Scenario: Tree content is hashed
- **WHEN** AX hashes a directory tree
- **THEN** it sorts normalized relative paths and hashes length-prefixed path, entry-kind, executable-bit, and payload fields
- **AND** file payload is file bytes, symlink payload is link-target bytes, and every directory including an empty directory is represented

#### Scenario: Incidental metadata changes
- **WHEN** ownership, timestamps, or non-executable permission bits change without content identity changing
- **THEN** `sha256-tree-v1` remains stable

#### Scenario: Identity-bearing input uses another version
- **WHEN** a runtime journal or backup declares an unknown hash version
- **THEN** AX rejects it before mutation

### Requirement: Source caches are disposable
The system SHALL store remote source caches under `~/.agents/runtime/cache` and SHALL NOT use cache contents as ownership or installed truth.

#### Scenario: Cache is available
- **WHEN** a remote source synchronizes
- **THEN** AX fetches the latest configured ref and builds from the resulting snapshot

#### Scenario: Cache is absent or corrupt
- **WHEN** cached state cannot be used
- **THEN** AX recreates it from configured source state
- **AND** synchronization semantics remain unchanged

### Requirement: Runtime convergence is recoverable
The system SHALL validate a complete candidate before touching live entries and SHALL recover every partially applied AX-owned transaction.

#### Scenario: Concurrent mutation is attempted
- **WHEN** a mutating invocation cannot acquire the exclusive lock for the local runtime root
- **THEN** it exits without recovery or candidate application and reports the lock owner

#### Scenario: Mutation lock owner is dead
- **WHEN** the recorded process ID and process-start identity no longer identify a live owner
- **THEN** AX reclaims the lock and recovers its journal before new candidate work

#### Scenario: Candidate validation passes
- **WHEN** candidate skills, instructions, hooks, selected profile, links, and collision checks pass
- **THEN** AX records verified preimages, previous/candidate manifest hashes, expected old/new target hashes, and phase in a journal under `~/.agents/runtime/transactions/<id>`
- **AND** retains hash-verified candidate payloads and deletion markers in that transaction directory until finalize or rollback completes
- **AND** applies entries with same-filesystem temporary renames
- **AND** atomically replaces `selected-profile.json` last and marks `manifest_committed`

#### Scenario: Application fails
- **WHEN** a target replacement or post-apply validation fails
- **THEN** AX restores every touched entry from the journal
- **AND** restores the previous selected-profile state or its absence

#### Scenario: A process terminates unexpectedly
- **WHEN** a later mutating AX invocation finds an incomplete journal
- **THEN** it finalizes success whenever manifest and target hashes equal the recorded candidate, regardless of recorded phase
- **AND** otherwise restores only entries whose current hashes equal recorded old or candidate hashes
- **AND** read-only status or validate reports `incomplete_transaction` without recovery

#### Scenario: Recovery observes an external edit
- **WHEN** an entry hash matches neither recorded old nor candidate state
- **THEN** AX preserves journal and preimages as `recovery_conflict`
- **AND** does not overwrite the external edit

#### Scenario: Recovery cannot restore state
- **WHEN** rollback fails after recovery begins
- **THEN** AX records `recovery_failed`, preserves recovery material, and blocks later mutation

#### Scenario: Recovery resolution is stale
- **WHEN** a recovery-file current target or manifest hash differs from observed state
- **THEN** sync performs no recovery mutation and reports the changed path

#### Scenario: Successful change retains backups
- **WHEN** a changed entry synchronizes successfully
- **THEN** AX retains the latest seven verified backups per asset and target under `~/.agents/runtime/backups`
- **AND** unchanged content creates no backup

### Requirement: AX is workflow-state neutral
The system SHALL manage reusable runtime assets and SHALL NOT coordinate Git commits, local review gates, private plan storage, or runtime activation gates.

#### Scenario: AX help is inspected
- **WHEN** a user runs `ax --help`
- **THEN** it exposes shim management, sync, status, validation, and repo-local OpenSpec behavior
- **AND** it does not expose `commit`, `review-gate`, `plans artifact`, `activation_ready`, or `runtime_activation_gate`

#### Scenario: Removed workflow command is invoked
- **WHEN** a caller invokes `ax commit`, `ax review-gate`, or `ax plans artifact`
- **THEN** AX reports the command unavailable
- **AND** creates no workflow transaction or private evidence state

### Requirement: AX validates the five-mode surface
The system SHALL validate intended personal/work profile inventories and block retired lifecycle collisions without deleting unmanaged content.

#### Scenario: Profile lifecycle is valid
- **WHEN** a personal or work profile is validated
- **THEN** Explore, Plan, Execute, Review, and Finish are its public lifecycle entries
- **AND** retained specialists follow profile policy

#### Scenario: Retired managed packages remain
- **WHEN** desired or installed managed inventory contains a retired lifecycle name
- **THEN** validation fails with that name and owning surface

#### Scenario: Unmanaged lifecycle collision exists
- **WHEN** a discoverable runtime root contains an unmanaged retired lifecycle skill
- **THEN** sync blocks with `unmanaged_lifecycle_conflict`, path, and provenance
- **AND** AX does not delete, overwrite, or reclassify it

#### Scenario: Portable mode boundary is invalid
- **WHEN** a mode imports executable helper logic from an unrelated repo-root workflow script or sibling skill
- **THEN** validation fails and identifies the nonportable dependency

### Requirement: Live runtime activates only from merged source
The system SHALL keep POC and feature-branch runtime proof isolated and SHALL use ordinary sync for post-merge live activation.

#### Scenario: POC or pre-merge validation executes
- **WHEN** AX behavior is exercised before merge
- **THEN** it uses isolated HOME, manifest, cache, transaction, backup, skill, instruction, hook, and profile roots
- **AND** does not mutate live user runtime inventories

#### Scenario: Feature source targets live runtime
- **WHEN** canonical live roots are selected from a feature branch, dirty source, or disposable worktree
- **THEN** AX rejects the mutation with `unverified_live_source`
- **AND** requires explicit isolated roots

#### Scenario: Verified default-branch source is available
- **WHEN** the reviewed final change is merged and local default-branch source is verified
- **THEN** ordinary `ax sync` performs live activation
- **AND** candidate validation, rollback, and post-apply validation form the complete activation gate
