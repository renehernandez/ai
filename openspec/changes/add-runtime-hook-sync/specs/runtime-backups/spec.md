## ADDED Requirements

### Requirement: Runtime backup before mutation
Agent-runtime SHALL verify a backup decision before replacing, removing,
rewriting, or retargeting an existing runtime-managed target.

#### Scenario: Existing target mutation is gated by backup verification
- **WHEN** a runtime command is about to mutate an existing managed file,
  directory, or symlink
- **THEN** the command verifies that a backup exists before performing the
  mutation

#### Scenario: Backup failure blocks mutation
- **WHEN** backup creation or backup verification fails for an existing target
- **THEN** the runtime command aborts before mutating the target

### Requirement: Backup target coverage
Runtime backups SHALL support regular files, directories, symlinks, dangling
symlinks, executable files, and missing targets with explicit observable
semantics.

#### Scenario: Symlink backup preserves link identity
- **WHEN** a managed target is a symlink
- **THEN** the backup records the symlink itself instead of dereferencing and
  copying the linked target

#### Scenario: Missing target has explicit result
- **WHEN** a managed target does not exist before mutation
- **THEN** the backup helper returns an explicit missing-target result or
  manifest entry that callers can assert before continuing

### Requirement: Backup retention
Runtime backups SHALL keep the seven most recent successful backups per asset
kind and target, and SHALL prune older backups only after a new backup succeeds.

#### Scenario: Failed backup does not prune
- **WHEN** a backup attempt fails
- **THEN** existing older backups remain unchanged

#### Scenario: Successful backup prunes oldest entries
- **WHEN** a backup succeeds and more than seven backups exist for the asset
  kind and target
- **THEN** the oldest backups beyond the seven newest successful backups are
  removed

### Requirement: Existing runtime mutation integration
Agent-runtime SHALL use the shared backup primitive before existing skills,
instructions, reusable script, and OpenSpec runtime mutation paths mutate
existing managed targets.

#### Scenario: Validate and status remain read-only
- **WHEN** a user runs runtime validate or status commands
- **THEN** the command does not create backups or mutate managed targets
