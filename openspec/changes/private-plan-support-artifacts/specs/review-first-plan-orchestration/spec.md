## ADDED Requirements

### Requirement: Atomic Plan Support Sidecar Boundary
The system SHALL distinguish primary atomic plan markdown documents from
support workflow artifacts under `.agents/plans/**`.

#### Scenario: Plan artifact classification is deterministic
- **WHEN** a path under `.agents/plans/**` is classified for plan-review
  validation
- **THEN** a repo-relative markdown file with extension `.md` is classified as a
  primary plan document only when it does not match a support workflow naming
  pattern
- **AND** support workflow naming patterns include
  `*.review-request.*`, `*.reviewer-selection.*`, `*.handoff.*`,
  `*.blueprint.*`, `*.ledger.*`, `*.report.*`,
  `*.validation-input.*`, and `*.validation-output.*`
- **AND** YAML, JSON, and JSONL files under `.agents/plans/**` are classified as
  support workflow artifacts even when they do not match a known support
  workflow naming pattern
- **AND** classification is based on normalized path, extension, and the
  enumerated support naming patterns rather than file contents

#### Scenario: Atomic markdown plan is valid
- **WHEN** `plan-review` validates a planning diff for `artifact_type: plan`
- **AND** the diff includes the primary `.agents/plans/**` markdown plan
  artifact
- **THEN** validation accepts the primary plan artifact
- **AND** normal atomic plan review validation continues

#### Scenario: Atomic plan diff contains support sidecar
- **WHEN** `plan-review` validates a planning diff for `artifact_type: plan`
- **AND** the diff includes a support sidecar under `.agents/plans/**`
- **THEN** validation fails
- **AND** hosted planning review is not created or updated
- **AND** the failure message directs the agent to thread evidence and the
  private AX plan workspace for support artifacts

#### Scenario: Historical sidecar is touched
- **WHEN** a planning diff adds, modifies, deletes, renames, copies, or
  type-changes a support sidecar under `.agents/plans/**`
- **THEN** validation fails even if a matching historical sidecar already
  exists in the repository

### Requirement: Plan Support Evidence Stays Private
The system SHALL keep support workflow evidence out of hosted review
descriptions by default unless it is summarized or represented by a stable
correlation value.

#### Scenario: Hosted review description includes plan support evidence
- **WHEN** an agent writes a hosted planning review description
- **AND** support evidence is relevant to the review
- **THEN** the description may include summarized evidence, artifact hashes,
  thread references, or stable correlation IDs
- **AND** it does not include local `~/.ax/plans/...` paths, raw private
  evidence, or private thread metadata by default

### Requirement: Plan Workflow Support Artifact Routing
The system SHALL route file-backed plan workflow support artifacts to the
thread and private AX plan workspace instead of `.agents/plans/**`.

#### Scenario: Plan-ready creates support output
- **WHEN** `plan-ready` creates reviewer selection, readiness YAML, an
  OpenSpec blueprint, validation input, or another file-backed support artifact
- **THEN** the support artifact is stored in the thread or private AX plan
  workspace
- **AND** it is not written beside the primary plan markdown document

#### Scenario: OpenSpec source plan cleanup remains unchanged
- **WHEN** an `openspec_blueprint` is materialized into an OpenSpec change
- **THEN** the existing OpenSpec source-plan cleanup invariant still applies
- **AND** hosted OpenSpec planning diffs contain no `.agents/plans/**` paths
