# ax-status Specification

## Purpose
TBD - created by archiving change guide-openspec-runtime-setup. Update Purpose after archive.
## Requirements
### Requirement: Top-level runtime status
The system SHALL provide a read-only top-level `ax status` command
that verifies global runtime installation health and reports target project
readiness.

#### Scenario: Status reports runtime roots
- **WHEN** `ax status` runs
- **THEN** it reports source root, config path, lock path, cache path, target root, and executable path

#### Scenario: Status reports shim health
- **WHEN** `ax status` runs from the managed shim or package script
- **THEN** it reports whether `~/.local/bin/ax` exists
- **AND** reports whether the shim is AX-managed and executable
- **AND** reports whether the shim points at the current source root or, when
  status runs from a disposable same-repository worktree, an existing
  non-disposable durable source root
- **AND** reports the disposable runtime source root when the durable source
  root exception is accepted
- **AND** reports whether PATH resolves `ax` to the managed shim or another executable

#### Scenario: Status aggregates managed runtime surfaces
- **WHEN** `ax status` runs
- **THEN** it reports profile skill and instruction state
- **AND** reports reusable script state
- **AND** reports hook state

#### Scenario: Missing target OpenSpec is not a global runtime failure
- **WHEN** `ax status` runs in a target project without OpenSpec setup
- **THEN** it reports target OpenSpec as missing
- **AND** does not mark the global runtime installation invalid solely because OpenSpec is missing

#### Scenario: Status fails for invalid managed assets
- **WHEN** status detects broken config parsing, missing source root, invalid managed assets, broken reusable scripts, missing hook source, mismatched managed shim, stale managed shim, or detached-worktree shim target
- **THEN** `ax status` exits non-zero

#### Scenario: Status warns for target readiness gaps
- **WHEN** status detects missing `~/.local/bin` on PATH or a shadowing executable that does not prevent explicit `pnpm ax status` from running
- **THEN** it reports a warning without failing solely for that condition
