## ADDED Requirements

### Requirement: Portable Shared Skill Boundary
The system SHALL treat each non-`ax-cli` shared skill folder as the portable
unit of behavior.

#### Scenario: Non-ax-cli skill is self-contained
- **WHEN** a shared skill other than `ax-cli` includes scripts, instructions, or
  adapter prompts
- **THEN** the skill's runnable helper files are packaged inside that skill
  folder
- **AND** the skill does not require the AI repo source-tree layout to execute
  its documented commands

#### Scenario: Repo artifact paths remain allowed
- **WHEN** a non-`ax-cli` skill describes project artifacts such as
  `.agents/plans`
- **THEN** the guidance is allowed as repo artifact guidance
- **AND** it is not treated as installed runtime path guidance

### Requirement: Non-Ax Skills Exclude Runtime Manager Guidance
The system SHALL prevent non-`ax-cli` shared skills from teaching AX commands,
installed runtime roots, managed symlink surfaces, machine-specific absolute
paths, private plan-artifact commands, or local profile refresh mechanics.

#### Scenario: Non-ax-cli skill mentions AX command
- **WHEN** skill validation inspects a non-`ax-cli` skill
- **AND** the skill text includes an AX command example or private AX
  plan-artifact command
- **THEN** validation fails with a portable-boundary error

#### Scenario: Non-ax-cli skill mentions installed runtime path
- **WHEN** skill validation inspects a non-`ax-cli` skill
- **AND** the skill text includes installed runtime roots, managed skill
  symlink paths, or machine-specific absolute paths
- **THEN** validation fails with a portable-boundary error

### Requirement: Skill Script Imports Stay Inside Skill Root
The system SHALL reject shared skill scripts that import source files outside
their own skill folder by relative parent traversal.

#### Scenario: Skill script imports repo-level helper
- **WHEN** skill validation inspects a skill-local script
- **AND** the script imports a source file outside the skill folder
- **THEN** validation fails with a portable-boundary error

#### Scenario: Skill script imports packaged helper
- **WHEN** skill validation inspects a skill-local script
- **AND** the script imports a file inside the same skill folder
- **THEN** validation allows the import

### Requirement: Precommit Enforces Skill Portability
The system SHALL enforce portable skill boundaries through the existing
precommit-covered `pnpm skills:validate` command.

#### Scenario: Portable boundary regression is introduced
- **WHEN** a developer attempts to commit a non-`ax-cli` skill that violates
  the portable boundary
- **THEN** the existing precommit skill validation command fails
- **AND** the failure identifies the skill and violated boundary
