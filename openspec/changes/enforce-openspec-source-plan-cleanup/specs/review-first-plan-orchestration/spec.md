## ADDED Requirements

### Requirement: Plan-To-OpenSpec Source Plan Cleanup
The system SHALL treat `.agents/plans/**` files as scratch intake artifacts
when an `openspec_blueprint` is materialized into an OpenSpec change.

#### Scenario: Source plan is deleted after valid OpenSpec creation
- **WHEN** `plan-orchestrator` materializes an `openspec_blueprint` from a
  primary `.agents/plans/**` source plan
- **AND** the OpenSpec change is created
- **AND** `openspec validate <change-id> --strict --no-interactive` passes
- **AND** repo-local OpenSpec scaffolding validation passes when available
- **THEN** the workflow deletes the primary source plan
- **AND** creates the `plan_review_request` against
  `openspec/changes/<change-id>`

#### Scenario: Repo-local OpenSpec validation surface is absent
- **WHEN** `plan-orchestrator` materializes an `openspec_blueprint` from a
  primary `.agents/plans/**` source plan
- **AND** `openspec validate <change-id> --strict --no-interactive` passes
- **AND** no repo-local OpenSpec scaffolding validation command is available
- **THEN** the workflow records that the repo-local validation surface was
  absent
- **AND** the absent repo-local validation surface does not block source-plan
  cleanup

#### Scenario: Source plan is preserved when OpenSpec validation fails
- **WHEN** `plan-orchestrator` materializes an `openspec_blueprint` from a
  primary `.agents/plans/**` source plan
- **AND** OpenSpec creation or validation fails
- **THEN** the workflow preserves the source plan
- **AND** reports the OpenSpec creation or validation failure as the blocker

#### Scenario: Already committed source plan blocks conversion
- **WHEN** the primary `.agents/plans/**` source plan is already committed
  before OpenSpec planning publication
- **THEN** the workflow reports an invalid precondition
- **AND** does not publish a source-plan deletion in the OpenSpec planning diff

#### Scenario: Multiple source plans require explicit paths
- **WHEN** an `openspec_blueprint` was synthesized from more than one source
  plan
- **THEN** the workflow deletes only the primary source plan
- **AND** preserves additional source plans unless explicit superseded source
  paths were recorded for deletion

### Requirement: OpenSpec Planning Diff Excludes Source Plans
The system SHALL reject `artifact_type: openspec` planning diffs that contain
any `.agents/plans/**` path.

#### Scenario: OpenSpec planning diff contains source plan path
- **WHEN** `plan-review` validates a planning diff for `artifact_type:
  openspec`
- **AND** the diff contains any `.agents/plans/**` path as added, modified,
  deleted, renamed, copied, or type-changed
- **THEN** validation fails with a source-plan cleanup error
- **AND** hosted planning review is not created or updated

#### Scenario: Atomic plan review still accepts plan artifact
- **WHEN** `plan-review` validates a planning diff for `artifact_type: plan`
- **AND** the reviewed artifact is under `.agents/plans/**`
- **THEN** the source-plan cleanup invariant does not reject the diff
- **AND** normal atomic plan review validation continues
