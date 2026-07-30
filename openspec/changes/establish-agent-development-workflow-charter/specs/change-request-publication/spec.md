## ADDED Requirements

### Requirement: One selectable owner creates and updates change requests
The system SHALL expose `change-request-create` as the only selectable skill that constructs or updates a PR/MR title or description.

#### Scenario: User names GitHub, GitLab, gh, or glab
- **WHEN** a user requests creation or update of a change request through provider-specific wording
- **THEN** `change-request-create` applies reviewer-facing description policy before provider mutation
- **AND** the wording does not select a separate description owner

#### Scenario: Existing artifact body changes
- **WHEN** later implementation changes reviewer-facing scope, behavior, risks, or tracking semantics
- **THEN** `change-request-create` updates the owned content before hosted review is requested

### Requirement: Provider mechanics are internal references
The system SHALL keep GitHub and GitLab authentication, routing, duplicate detection, template handling, draft creation, and hosted readback as internal mechanics owned by `change-request-create`.

#### Scenario: GitLab mutation is required
- **WHEN** the resolved provider is GitLab
- **THEN** the central owner executes the GitLab mechanics with its approved title and body
- **AND** no independently selectable GitLab creation skill authors or approves that content

#### Scenario: GitHub mutation is required
- **WHEN** the resolved provider is GitHub
- **THEN** the central owner executes the GitHub mechanics with its approved title and body
- **AND** no independently selectable GitHub creation skill authors or approves that content

### Requirement: Hosted content is preserved and verified
The system SHALL preserve template-owned and human-owned content and SHALL read the hosted title and body back after every creation or description update.

#### Scenario: Existing content has mixed ownership
- **WHEN** a change request contains manual sections, reviewer notes, links, checklist state, or protected template instructions
- **THEN** the central owner changes only clearly owned content
- **AND** ambiguous replacement requires user direction

#### Scenario: Hosted mutation succeeds
- **WHEN** the provider command returns success
- **THEN** the workflow reads the hosted title and body back
- **AND** restores safe damage or blocks with the exact recovery gap

### Requirement: Standalone creation adapters are retired
The system SHALL remove `github-pr-create` and `glab-mr-create` from installed selectable skill profiles after their mechanics move under the central owner.

#### Scenario: Runtime profile is validated
- **WHEN** personal or work skill selection is built
- **THEN** `change-request-create` is installed
- **AND** standalone GitHub and GitLab creation adapters are absent or explicitly retired

#### Scenario: Direct provider-description bypass is tested
- **WHEN** a pressure scenario asks an agent to use a retired adapter or raw provider description flag
- **THEN** the agent routes through `change-request-create`
- **AND** direct description authorship fails the charter gate

