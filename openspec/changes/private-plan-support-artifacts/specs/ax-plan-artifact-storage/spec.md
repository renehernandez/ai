## ADDED Requirements

### Requirement: Private Plan Artifact Workspace
The system SHALL store file-backed plan workflow support artifacts in a private
AX plan workspace outside the target repository.

#### Scenario: Support artifact is recorded
- **WHEN** an agent records a support artifact for a plan
- **THEN** the system stores the artifact under `~/.ax/plans/`
- **AND** the target repository receives no support sidecar file
- **AND** the record includes the repo key, normalized repo-relative plan path,
  plan path hash, plan content fingerprint, artifact kind, artifact path, and
  artifact content fingerprint
  fingerprint

#### Scenario: Workspace is plan scoped
- **WHEN** two plans have the same basename in different repo-relative paths
- **THEN** the system assigns them distinct plan identities
- **AND** their private workspace records do not collide

### Requirement: Deterministic Plan Artifact Identity
The system SHALL derive private plan artifact identity from the invocation
target repository and normalized plan path.

#### Scenario: Repo key uses origin fetch URL
- **WHEN** the target repository has an `origin` fetch URL
- **THEN** the system derives `repo_key` from that URL
- **AND** it does not use mirrored push URLs to derive the key
- **AND** it canonicalizes equivalent remote URL forms by lowercasing the host,
  stripping protocol-specific prefixes, normalizing path separators, and
  removing a trailing `.git` suffix before building the key

#### Scenario: Repo identity is ambiguous
- **WHEN** the target repository has no `origin` fetch URL and no selected
  artifact-host remote
- **THEN** the system blocks artifact recording
- **AND** asks for the intended repository identity

#### Scenario: Plan or artifact path escapes workspace
- **WHEN** `--plan`, `--file`, artifact kind, or artifact extension would
  escape its allowed root after normalization
- **THEN** the system rejects the command
- **AND** no private workspace record is written

#### Scenario: Artifact input file root is deterministic
- **WHEN** an agent records an artifact with `--file <path>`
- **THEN** the allowed input roots are the target repository root, the operating
  system temp directory returned by the runtime, and the AX artifact inbox under
  `~/.ax/plans/inbox/`
- **AND** the private destination workspace under `~/.ax/plans/repos/` is not an
  allowed `--file` input root
- **AND** a `--file` path outside those roots is rejected

#### Scenario: Symlink target escapes workspace
- **WHEN** `--plan` or `--file` resolves through a symlink
- **AND** the symlink target escapes the target repository root, the allowed
  input roots for `--file`, or the private workspace after realpath resolution
- **THEN** the system rejects the command
- **AND** no private workspace record is written

### Requirement: Recoverable Plan Artifact Writes
The system SHALL write private plan artifact records in a recoverable order.

#### Scenario: Artifact record write succeeds
- **WHEN** artifact recording succeeds
- **THEN** the system writes the content-addressed artifact blob
- **AND** writes `manifest.json` through an atomic replace
- **AND** appends an `index.jsonl` row after the blob and manifest writes
  succeed

#### Scenario: Duplicate artifact is recorded
- **WHEN** the same artifact content is recorded more than once for the same
  plan revision
- **THEN** the system preserves the existing blob
- **AND** records deterministic metadata without corrupting prior records

#### Scenario: Private workspace state is corrupt
- **WHEN** the manifest is corrupt, the index has a truncated row, or an orphan
  blob is detected
- **THEN** the system reports repair guidance
- **AND** does not silently discard existing evidence

### Requirement: Plan Artifact Lookup
The system SHALL provide a minimal lookup command for recorded private support
artifacts.

#### Scenario: Recorded artifacts are listed
- **WHEN** an agent lists artifacts for a plan
- **THEN** the system prints the plan workspace manifest and revision artifact
  records
- **AND** includes artifact kind, relative private workspace path, and content
  fingerprint
