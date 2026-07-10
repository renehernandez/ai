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
The system SHALL treat tracked `ax.config.json` as desired state, local `~/.agents/runtime/managed-runtime.json` as AX ownership state, and the filesystem as observed state.

#### Scenario: Desired state is declared
- **WHEN** AX reads `ax.config.json`
- **THEN** it derives profiles, source URLs and refs, selected names, target paths, hooks, instructions, and OpenSpec settings

#### Scenario: Hook source is resolved
- **WHEN** AX builds hook candidates
- **THEN** `runtime.hooks.sourceDir` resolves repository-relative `hooks` inside the local source snapshot
- **AND** no machine-specific checkout path is required

#### Scenario: Successful sync records ownership
- **WHEN** runtime synchronization succeeds
- **THEN** `managed-runtime.json` records schema version, installed profiles, one `policyProfile`, AX-owned installed paths, and content hashes
- **AND** it records the canonical hash version but no URL, ref, resolved commit, timestamp, cache path, transaction data, or duplicated desired configuration

#### Scenario: Legacy runtime is adopted
- **WHEN** the local manifest is absent
- **THEN** AX previews exact-hash `manage` for candidate-matching desired paths, `replace-managed` for approved drifted desired paths, and `remove` for canonical retired or stale paths
- **AND** interactive use confirms every action while headless use requires `--adoption-file <path>` with exact path, hash, and action
- **AND** replacement or removal creates a verified backup before mutation
- **AND** unapproved or hash-drifted occupied paths remain unmanaged collisions
- **AND** AX never reads or recreates `ax.lock.json`

#### Scenario: Drifted desired legacy path is replaced
- **WHEN** a `replace-managed` approval matches the observed canonical path and hash
- **THEN** AX backs up the observed entry, installs the validated candidate, and records only the candidate hash in the new manifest

#### Scenario: Managed content leaves desired state
- **WHEN** desired state no longer includes a manifest-owned entry
- **THEN** AX may remove that entry and its managed links
- **AND** an occupied path without verified ownership blocks as an unmanaged collision

### Requirement: Sync is the only runtime convergence command
The system SHALL expose `sync` as the sole runtime-content mutation verb and keep `status` and `validate` read-only.

#### Scenario: Runtime profiles synchronize
- **WHEN** a user runs `ax sync`
- **THEN** AX reconciles skills, instructions, and hooks for profiles recorded in the local manifest
- **AND** top-level sync does not mutate repo-local OpenSpec files

#### Scenario: Installed profiles differ from workflow policy
- **WHEN** one or more profiles are synchronized
- **THEN** the manifest records installed inventory and exactly one workflow-policy profile from that set
- **AND** profile defaults are not combined

#### Scenario: First interactive sync runs
- **WHEN** no manifest or selected profile exists and the process is interactive
- **THEN** AX previews available profiles, records installed profiles plus one workflow-policy profile, and synchronizes the confirmed selection

#### Scenario: First headless sync runs
- **WHEN** no manifest or selected profile exists and the process is noninteractive
- **THEN** AX requires `--profile` or `--all-profiles` plus `--policy-profile <name>`
- **AND** those explicit values authorize the first selection
- **AND** performs no mutation when selection is missing

#### Scenario: Scoped surface synchronizes
- **WHEN** a user runs skills, instructions, or hooks `sync`
- **THEN** AX requires an existing valid manifest and consumes its installed/policy profile selection
- **AND** reconciles only that surface's owned paths/hashes with the same snapshot and transaction rules
- **AND** never creates the manifest or changes profile selection

#### Scenario: Scoped sync has no manifest
- **WHEN** a scoped sync runs before top-level initialization
- **THEN** it exits with `runtime_not_initialized` and points to `ax sync`

#### Scenario: Stored profile selection changes
- **WHEN** a later interactive sync changes installed or policy profile selection
- **THEN** AX previews the exact replacement/addition and requires confirmation

#### Scenario: Stored profile selection changes headlessly
- **WHEN** a later noninteractive sync changes installed or policy profile selection
- **THEN** it requires `--profile-selection-file <path>` containing current manifest hash, exact replacement installed profiles, and one policy profile
- **AND** hash drift or incomplete selection blocks without mutation

#### Scenario: Policy profile is invalid
- **WHEN** policy profile is missing, duplicated, or absent from installed profiles
- **THEN** sync and validation fail with `policy_profile_ambiguous`

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
The system SHALL use `sha256-tree-v1` for every runtime ownership, snapshot, adoption, journal, backup, and recovery identity.

#### Scenario: Tree content is hashed
- **WHEN** AX hashes a directory tree
- **THEN** it sorts normalized relative paths and hashes length-prefixed path, entry-kind, executable-bit, and payload fields
- **AND** file payload is file bytes, symlink payload is link-target bytes, and every directory including an empty directory is represented

#### Scenario: Incidental metadata changes
- **WHEN** ownership, timestamps, or non-executable permission bits change without content identity changing
- **THEN** `sha256-tree-v1` remains stable

#### Scenario: Identity-bearing input uses another version
- **WHEN** a manifest, adoption file, profile-selection file, journal, backup, or recovery file declares an unknown hash version
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
- **WHEN** candidate skills, instructions, hooks, profiles, links, ownership, and collision checks pass
- **THEN** AX records verified preimages, previous/candidate manifest hashes, expected old/new target hashes, and phase in a journal under `~/.agents/runtime/transactions/<id>`
- **AND** retains hash-verified candidate payloads and deletion markers in that transaction directory until finalize, rollback, or operator resolution completes
- **AND** applies entries with same-filesystem temporary renames
- **AND** atomically replaces `managed-runtime.json` last and marks `manifest_committed`

#### Scenario: Application fails
- **WHEN** a target replacement or post-apply validation fails
- **THEN** AX restores every touched entry from the journal
- **AND** leaves the previous manifest unchanged

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

#### Scenario: Operator resolves recovery through sync
- **WHEN** `ax sync --recovery-file <path>` names the transaction/domain, exact current target and manifest hashes, and `restore-previous|apply-candidate|preserve-unmanaged` for every path whose previous and candidate ownership records differ
- **THEN** `restore-previous` selects the previous manifest record or absence, `apply-candidate` selects the candidate record or deletion marker, and `preserve-unmanaged` retains current content while removing AX ownership
- **AND** when previous and candidate profile metadata differ the file selects exact-hash-bound `profileSelectionState: previous|candidate` for both `installedProfiles` and `policyProfile`
- **AND** AX writes the resulting hash-verified derived manifest into the transaction directory before changing targets
- **AND** applies only hash-matching authorized actions under the runtime-root lock, atomically installs the derived manifest last, and validates selected hashes, ownership, manifest structure, and untouched targets before removing recovery state
- **AND** reports any intentionally retained desired drift for a later normal sync rather than treating it as failed recovery

#### Scenario: Recovery resolution mixes actions
- **WHEN** one recovery file restores a previous entry, applies another candidate, and preserves a third entry as unmanaged
- **THEN** the derived manifest records the previous hash/ownership for the first, candidate hash/ownership for the second, and no ownership for the third when both owned paths belong to the selected profile inventory
- **AND** a process death before or after derived-manifest replacement resumes to that same selected state by hash

#### Scenario: Recovery changes installed or policy profile
- **WHEN** previous and candidate manifests have different installed profiles or policy profiles
- **THEN** recovery requires `profileSelectionState: previous|candidate` and uses both top-level fields from that selected manifest
- **AND** rejects an action that would own a path outside the selected inventory before any mutation
- **AND** permits `preserve-unmanaged` to retain out-of-profile content without AX ownership

#### Scenario: First-sync recovery selects previous state
- **WHEN** the transaction began without `managed-runtime.json` and recovery selects `profileSelectionState: previous`
- **THEN** the derived outcome is a journaled manifest-deletion marker with zero owned paths rather than fabricated profile metadata
- **AND** restored previous content and preserved current content remain unmanaged
- **AND** an `apply-candidate` action that would retain AX ownership is rejected before mutation
- **AND** a process death before or after manifest deletion resumes to the same absent-manifest state by hash

#### Scenario: Recovered in-profile content is older than desired
- **WHEN** `restore-previous` keeps an older hash for a path present in the selected profile inventory
- **THEN** the derived manifest records that observed owned hash and recovery may complete
- **AND** offline status reports desired drift for a later normal sync

#### Scenario: Disposable source state changes during recovery
- **WHEN** a recovery conflict remains after cache deletion, local-source mutation, or remote-ref advancement
- **THEN** `apply-candidate` uses the retained payload whose hash was authorized for that transaction
- **AND** does not rebuild the candidate from current source state

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
