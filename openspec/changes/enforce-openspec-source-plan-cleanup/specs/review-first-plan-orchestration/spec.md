## ADDED Requirements

### Requirement: OpenSpec Blueprint Source Plan Reference
The system SHALL carry the source plan path in machine-readable readiness output
when `plan-ready` emits an `openspec_blueprint` from a `.agents/plans/**`
artifact.

#### Scenario: Blueprint includes source plan ref
- **WHEN** `plan-ready` emits an `openspec_blueprint` from a
  `.agents/plans/**` artifact
- **THEN** the blueprint includes `source_plan.ref` with the source plan path
- **AND** `validate-blueprint` rejects plan-file-backed OpenSpec blueprints
  that omit `source_plan.ref`

#### Scenario: Orchestrator passes expected source plan to cleanup
- **WHEN** `plan-orchestrator` materializes an `openspec_blueprint` that
  includes `source_plan.ref`
- **THEN** it passes that value to `cleanup-source-plan` as
  `--expected-source-plan`
- **AND** it does not derive the expected source-plan value from the cleanup
  target itself

### Requirement: Plan-To-OpenSpec Source Plan Cleanup
The system SHALL treat `.agents/plans/**` files as scratch intake artifacts
when an `openspec_blueprint` is materialized into an OpenSpec change.

#### Scenario: Source plan is deleted after valid OpenSpec creation
- **WHEN** `plan-orchestrator` materializes an `openspec_blueprint` from a
  primary `.agents/plans/**` source plan
- **AND** `cleanup-source-plan` receives `--source-plan <delete-target>` and a
  separate `--expected-source-plan <recorded-source-plan>` for the current
  conversion context
- **AND** the normalized cleanup target matches the normalized expected
  source-plan path
- **AND** the OpenSpec change is created
- **AND** `openspec validate <change-id> --strict --no-interactive` passes
- **AND** repo-local OpenSpec scaffolding validation passes when available
- **THEN** the workflow deletes the primary source plan
- **AND** creates the `plan_review_request` against
  `openspec/changes/<change-id>`

#### Scenario: Repo-local OpenSpec validation surface is absent
- **WHEN** `plan-orchestrator` materializes an `openspec_blueprint` from a
  primary `.agents/plans/**` source plan
- **AND** `cleanup-source-plan` receives separate matching `--source-plan` and
  `--expected-source-plan` paths for the current conversion context and
  `change-id`
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
- **WHEN** the primary `.agents/plans/**` source plan is tracked in `HEAD`, the
  target planning base, or the index as a tracked modification or deletion
  before OpenSpec planning publication
- **THEN** the workflow reports an invalid precondition
- **AND** does not publish a source-plan deletion in the OpenSpec planning diff

#### Scenario: Cleanup target is not the expected source plan
- **WHEN** `plan-orchestrator` is asked to clean up a `.agents/plans/**` path
- **AND** the normalized repo-relative path does not match the explicit
  source-plan path recorded for the current OpenSpec conversion context
- **THEN** the workflow reports an invalid precondition
- **AND** preserves the supplied `.agents/plans/**` file
- **AND** does not treat untracked status as sufficient cleanup authority

#### Scenario: Expected source plan is missing
- **WHEN** `plan-orchestrator` is asked to clean up a `.agents/plans/**` path
- **AND** no separate `--expected-source-plan` value is supplied
- **THEN** the workflow reports an invalid precondition
- **AND** preserves the supplied `.agents/plans/**` file
- **AND** does not default expected source-plan authority from `--source-plan`

#### Scenario: Cleanup context is for a different change id
- **WHEN** `plan-orchestrator` is asked to clean up a `.agents/plans/**` path
- **AND** the path matches an expected source-plan record for a different
  OpenSpec `change-id`
- **THEN** the workflow reports an invalid precondition
- **AND** preserves the supplied `.agents/plans/**` file

#### Scenario: Cleanup path normalization rejects escapes
- **WHEN** `plan-orchestrator` is asked to clean up a source-plan path
- **AND** the supplied or expected path escapes the repo root or
  `.agents/plans/**` after normalization or symlink resolution
- **THEN** the workflow reports an invalid precondition
- **AND** preserves the supplied path

#### Scenario: Multiple source plans require explicit paths
- **WHEN** an `openspec_blueprint` was synthesized from more than one source
  plan
- **THEN** the workflow deletes only source plans whose normalized paths are
  explicitly recorded for the same OpenSpec `change-id`
- **AND** preserves additional source plans unless their superseded paths were
  explicitly recorded for deletion in the current conversion context

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
