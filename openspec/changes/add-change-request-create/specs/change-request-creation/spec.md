## ADDED Requirements

### Requirement: Host-Neutral Change Request Entry Point
The system SHALL provide `change-request-create` as the host-neutral entrypoint
for creating or updating GitHub pull requests and GitLab merge requests.

#### Scenario: Neutral request selects change request creation
- **WHEN** a user asks to create or update a PR or MR without explicitly fixing
  the provider
- **THEN** the workflow uses `change-request-create`
- **AND** provider-specific mutation is delegated to the selected provider
  adapter

#### Scenario: Direct provider request remains supported
- **WHEN** a user explicitly asks for a GitHub PR or GitLab MR provider workflow
- **THEN** the corresponding provider adapter may be used directly
- **AND** it retains minimal safe body guidance for direct use

### Requirement: Route Selection Precedence
Change request creation SHALL route to the hosted artifact provider by explicit
artifact URL, explicit user host, configured review routing, then target push
remote, and SHALL ask or block when still ambiguous.

#### Scenario: Existing artifact URL controls update route
- **WHEN** a user asks to update `https://git.fullscript.io/example/repo/-/merge_requests/1`
- **AND** repository remotes include both GitHub and GitLab
- **THEN** the workflow selects the GitLab merge request route

#### Scenario: Explicit user host controls creation route
- **WHEN** a user asks to create a GitHub PR
- **AND** review routing could match a GitLab remote
- **THEN** the workflow selects the GitHub pull request route

#### Scenario: Review routing controls neutral creation route
- **WHEN** no artifact URL or explicit host is supplied
- **AND** review routing matches the repository remote
- **THEN** the workflow delegates to the matched `artifact.create_adapter`

#### Scenario: Ambiguous host blocks instead of guessing
- **WHEN** no artifact URL, explicit host, review route, or target push remote
  determines a single artifact host
- **THEN** the workflow asks a blocking routing question or reports blocked
- **AND** it does not choose the first remote by position

### Requirement: Review Routing Consumption
Change request creation SHALL consume existing review routing policy for
configured artifact route selection and SHALL NOT redefine review feedback
policy, Nitro routing, or hosted feedback parsing.

#### Scenario: Router delegates to provider create adapter
- **WHEN** `review-feedback-routing` selects `artifact.create_adapter:
  glab-mr-create`
- **THEN** `change-request-create` delegates creation or update mechanics to
  `glab-mr-create`
- **AND** the resulting GitLab mutation path uses the `glab-mr-create` workflow
  rather than a provider-neutral CLI helper

#### Scenario: Router is not a create adapter
- **WHEN** routing policy is represented in `review-routing.yaml`
- **THEN** `change-request-create` is not configured as an
  `artifact.create_adapter`
- **AND** provider adapter names remain the create adapter targets
- **AND** `review-routing.yaml` contains no adapter value named
  `change-request-create`

### Requirement: Template Preservation
Change request creation SHALL preserve project PR/MR templates when present and
fill them with reviewer-facing content.

#### Scenario: GitHub default template is preserved
- **WHEN** a repository contains `.github/PULL_REQUEST_TEMPLATE.md`
- **THEN** the PR description keeps the template section shape
- **AND** replaces placeholder content with concise reviewer-facing content

#### Scenario: Multiple GitHub templates require selection
- **WHEN** a repository contains multiple `.github/PULL_REQUEST_TEMPLATE/*.md`
  files
- **AND** no user choice or unambiguous convention identifies one template
- **THEN** the workflow asks which template to use

#### Scenario: GitLab template checklist is preserved
- **WHEN** a GitLab MR template contains required checklist text
- **THEN** the MR description preserves the checklist semantics
- **AND** omits internal process or tooling references from filled content

### Requirement: Existing Description Update Safety
Change request creation SHALL preserve user-authored and reviewer-authored
hosted body content when updating an existing PR or MR.

#### Scenario: Existing manual notes are preserved
- **WHEN** an existing PR or MR body contains manually added reviewer notes,
  links, or resolved checklist state
- **THEN** the update preserves that content
- **AND** only clearly managed sections are replaced automatically

#### Scenario: Ambiguous replacement asks
- **WHEN** an existing PR or MR body contains sections outside explicit managed
  HTML comment markers, such as `<!-- change-request-create:start -->` and
  `<!-- change-request-create:end -->`
- **THEN** it asks before replacing that section

#### Scenario: Existing artifact avoids duplicate creation
- **WHEN** an open PR or MR already exists for the source branch
- **THEN** the workflow reports the existing artifact or updates it
- **AND** it does not create a duplicate artifact

### Requirement: Reviewer-Facing Description Policy
Change request descriptions SHALL omit unnecessary internal process and tooling
references anywhere in the body and include only evidence that changes reviewer
or merge confidence.

#### Scenario: Internal process references are omitted
- **WHEN** source evidence includes local skill paths, subagent review gates,
  planning validation commands, and routine formatter or linter commands
- **THEN** the hosted description omits those references

#### Scenario: Routine validation already covered by CI is omitted
- **WHEN** CI or repo hooks already represent routine typecheck, lint, format,
  pre-commit, pre-push, or diff hygiene validation
- **THEN** the hosted description does not restate those local commands

#### Scenario: Targeted evidence is retained
- **WHEN** a targeted regression command, fixture check, browser route check,
  migration proof, operational verification, or reproduction check proves the
  changed behavior
- **THEN** the hosted description includes that evidence when it helps review

#### Scenario: Hosted failure is included
- **WHEN** a hosted workflow, check, job, pipeline, approval rule, or required
  reviewer state is failed, pending, unavailable, missing, or stale
- **THEN** the hosted description includes the relevant status and reviewer
  action context

#### Scenario: Routine green hosted checks are not restated
- **WHEN** hosted checks are routine and visibly green in the artifact host
- **THEN** the hosted description does not duplicate them unless they affect
  review or merge confidence
