## ADDED Requirements

### Requirement: OpenSpec runtime command scope
The system SHALL expose `agent-runtime openspec install`, `agent-runtime openspec update`, `agent-runtime openspec validate`, and `agent-runtime openspec status` commands that operate on the current repository by default.

#### Scenario: Help lists OpenSpec commands
- **WHEN** a user runs `pnpm agent-runtime openspec --help`
- **THEN** the output lists `install`, `update`, `validate`, and `status`

### Requirement: OpenSpec CLI availability
The system SHALL require an available `openspec` CLI before generating, updating, validating, or reporting OpenSpec scaffolding.

#### Scenario: Missing CLI reports install command
- **WHEN** the `openspec` executable is unavailable and a user runs `pnpm agent-runtime openspec install`
- **THEN** the command fails with guidance containing `npm install -g @fission-ai/openspec@latest`

### Requirement: Repo-local OpenSpec generation
The system SHALL initialize and update OpenSpec scaffolding by invoking OpenSpec's own generator for Codex and Claude in the current repository.

#### Scenario: Install initializes Codex and Claude tools
- **WHEN** a user runs `pnpm agent-runtime openspec install`
- **THEN** the runtime invokes `openspec init . --tools codex,claude`

#### Scenario: Update refreshes initialized repo
- **WHEN** a repository already contains OpenSpec scaffolding and a user runs `pnpm agent-runtime openspec update`
- **THEN** the runtime invokes `openspec update .`

#### Scenario: Update initializes missing scaffolding
- **WHEN** a repository does not contain OpenSpec scaffolding and a user runs `pnpm agent-runtime openspec update`
- **THEN** the runtime follows the install initialization behavior

### Requirement: Repo-local skill normalization
The system SHALL keep generated OpenSpec skills canonical under `.agents/skills/openspec-*` and replace Codex and Claude generated skill copies with relative symlinks to those canonical repo-local skill directories.

#### Scenario: Skills normalize after install
- **WHEN** OpenSpec generation creates `.codex/skills/openspec-*` and `.claude/skills/openspec-*`
- **THEN** `.agents/skills/openspec-*` contains the canonical skill directories
- **AND** `.codex/skills/openspec-*` and `.claude/skills/openspec-*` are relative symlinks to `.agents/skills/openspec-*`

### Requirement: Repo-local command normalization
The system SHALL keep generated Claude `opsx` commands canonical under `.agents/commands/opsx` and replace generated Claude command files with relative symlinks to those canonical repo-local command files.

#### Scenario: Claude commands normalize after install
- **WHEN** OpenSpec generation creates `.claude/commands/opsx/*.md`
- **THEN** `.agents/commands/opsx/*.md` contains the canonical command files
- **AND** `.claude/commands/opsx/*.md` are relative symlinks to `.agents/commands/opsx/*.md`

### Requirement: OpenSpec validation
The system SHALL fail OpenSpec runtime validation when expected canonical assets are missing, when generated harness assets remain as real directories or files where symlinks are expected, or when symlinks point outside the repo-local `.agents` canonical folders.

#### Scenario: Duplicate generated skills fail validation
- **WHEN** `.codex/skills/openspec-propose` is a real directory instead of a symlink
- **THEN** `pnpm agent-runtime openspec validate` fails and identifies the duplicated generated skill path

#### Scenario: Wrong command symlink fails validation
- **WHEN** `.claude/commands/opsx/propose.md` is a symlink to a target outside `.agents/commands/opsx`
- **THEN** `pnpm agent-runtime openspec validate` fails and identifies the wrong command symlink

### Requirement: OpenSpec status reporting
The system SHALL report the OpenSpec CLI path and version, repo-local scaffolding presence, canonical `.agents` assets, and Codex and Claude symlink state.

#### Scenario: Status reports local scaffolding state
- **WHEN** a user runs `pnpm agent-runtime openspec status`
- **THEN** the output includes the `openspec` CLI path and version
- **AND** the output reports whether `.agents/skills`, `.agents/commands`, `.codex/skills`, `.claude/skills`, and `.claude/commands` OpenSpec assets are present and correctly linked
