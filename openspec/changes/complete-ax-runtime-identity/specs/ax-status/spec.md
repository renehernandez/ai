## MODIFIED Requirements

### Requirement: Top-level runtime status
The system SHALL provide a read-only top-level `ax status` command
that verifies AX runtime installation health, shim health, and target project
readiness.

#### Scenario: Status reports runtime roots
- **WHEN** `ax status` runs
- **THEN** it reports source root, config path, lock path, cache path, target root, and executable path

#### Scenario: Status reports shim health
- **WHEN** `ax status` runs from the managed shim or package script
- **THEN** it reports whether `~/.local/bin/ax` exists
- **AND** reports whether the shim is AX-managed
- **AND** reports whether PATH resolves `ax` to the managed shim or another executable
- **AND** reports stale, mismatched, or detached-worktree shim targets

#### Scenario: Status aggregates managed runtime surfaces
- **WHEN** `ax status` runs
- **THEN** it reports profile skill and instruction state
- **AND** reports reusable script state
- **AND** reports hook state

#### Scenario: Missing target OpenSpec is not a global runtime failure
- **WHEN** `ax status` runs in a target project without OpenSpec setup
- **THEN** it reports target OpenSpec as missing
- **AND** does not mark the global runtime installation invalid solely because OpenSpec is missing
- **AND** exits with status `0`

#### Scenario: Runtime failures exit non-zero
- **WHEN** status detects broken config parsing, missing source root, invalid managed assets, broken reusable scripts, missing hook source, mismatched managed shim, stale managed shim, or detached-worktree shim target
- **THEN** it classifies the finding as runtime failure
- **AND** exits non-zero

#### Scenario: PATH warnings remain non-fatal
- **WHEN** status detects missing `~/.local/bin` on PATH or a shadowing executable that does not prevent explicit `pnpm ax status` from running
- **THEN** it classifies the finding as a warning
- **AND** exits with status `0`
