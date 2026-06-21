# agent-runtime-status Specification

## Purpose
TBD - created by archiving change guide-openspec-runtime-setup. Update Purpose after archive.
## Requirements
### Requirement: Top-level runtime status
The system SHALL provide a read-only top-level `agent-runtime status` command
that verifies global runtime installation health and reports target project
readiness.

#### Scenario: Status reports runtime roots
- **WHEN** `agent-runtime status` runs
- **THEN** it reports source root, config path, target root, and executable path

#### Scenario: Status reports link health
- **WHEN** `agent-runtime status` runs from a globally linked command
- **THEN** it reports whether the executable resolves back to the durable AI repo checkout

#### Scenario: Status aggregates managed runtime surfaces
- **WHEN** `agent-runtime status` runs
- **THEN** it reports profile skill and instruction state
- **AND** reports reusable script state
- **AND** reports hook state

#### Scenario: Missing target OpenSpec is not a global runtime failure
- **WHEN** `agent-runtime status` runs in a target project without OpenSpec setup
- **THEN** it reports target OpenSpec as missing
- **AND** does not mark the global runtime installation invalid solely because OpenSpec is missing

