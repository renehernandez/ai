## MODIFIED Requirements

### Requirement: Top-level runtime status
The system SHALL provide a read-only, offline `ax status` command that compares tracked desired state, local AX ownership state, observed runtime entries, and target-project readiness.

#### Scenario: Status reports runtime roots
- **WHEN** `ax status` runs
- **THEN** it reports source root, config path, local manifest path, cache path, transaction path, backup path, target root, and executable path
- **AND** it reports no tracked lock path

#### Scenario: Status reports shim health
- **WHEN** status runs from the managed shim or package script
- **THEN** it reports shim ownership, executable state, PATH resolution, shadowing, stale targets, and detached/disposable worktree targets

#### Scenario: Status reports installed profiles
- **WHEN** a local manifest exists
- **THEN** status reports installed profiles and the single `policyProfile`, then compares desired inventory with manifest-owned and observed entries
- **AND** it fails when `policyProfile` is missing or outside the installed set

#### Scenario: First-run selection is missing
- **WHEN** no local manifest or selected profile exists
- **THEN** status reports `profile_selection_required`
- **AND** performs no interactive selection or mutation

#### Scenario: Status aggregates managed surfaces
- **WHEN** status runs
- **THEN** it reports skill, instruction, hook, link, ownership, content-hash, collision, and retained-profile state

#### Scenario: Incomplete transaction exists
- **WHEN** status finds a temporary AX journal that has not completed
- **THEN** it reports `incomplete_transaction` and the affected targets
- **AND** it does not recover or remove the journal

#### Scenario: Recovery resolution is needed
- **WHEN** status finds `recovery_conflict` or `recovery_failed`
- **THEN** JSON output includes transaction ID, domain/root, current target and manifest hashes, and allowed per-path recovery actions with their resulting ownership/hash state
- **AND** when profile metadata differs it reports allowed `profileSelectionState` values and incompatible ownership choices
- **AND** when the previous manifest was absent it reports that selecting `previous` deletes the manifest and permits zero owned paths
- **AND** status remains read-only

#### Scenario: Another sync holds the mutation lock
- **WHEN** status observes an active runtime-root mutation lock
- **THEN** it reports the lock owner and remains read-only

#### Scenario: Cache is missing or corrupt
- **WHEN** status cannot use the disposable source cache
- **THEN** it reports cache state as informational or repairable by sync
- **AND** it does not treat cache state as ownership evidence

#### Scenario: Target OpenSpec is missing
- **WHEN** status runs in a project without OpenSpec setup
- **THEN** it reports target OpenSpec as missing
- **AND** does not mark global runtime invalid solely for that condition

#### Scenario: Managed runtime is invalid
- **WHEN** status detects invalid config or manifest parsing, unsupported hash version, missing source root, broken managed assets, content drift, ownership mismatch, collision, incomplete transaction, recovery conflict/failure, broken hooks, or a mismatched managed shim
- **THEN** status exits non-zero with path-level findings

#### Scenario: Target readiness has a warning
- **WHEN** PATH or shadowing prevents convenient shim resolution without invalidating explicitly invoked runtime state
- **THEN** status reports a warning without failing solely for that condition

#### Scenario: Offline inspection is enforced
- **WHEN** status runs
- **THEN** it performs no network access, source fetch, target mutation, transaction recovery, backup creation, or manifest write
- **AND** it reports that remote-ref freshness is unknown until the next sync
