# ax-openspec Specification

## Purpose
TBD - created by archiving change guide-openspec-runtime-setup. Update Purpose after archive.
## Requirements
### Requirement: OpenSpec setup state classification
The system SHALL classify repo-local OpenSpec setup through one shared state
report used by `ax openspec install`, `ax openspec
update`, `ax openspec status`, and `ax openspec validate`.

#### Scenario: Missing state allows install
- **WHEN** a repository has no `openspec/` directory and no managed OpenSpec generated assets
- **THEN** `ax openspec install` may start first-time setup

#### Scenario: Configured state blocks install
- **WHEN** a repository has `openspec/config.yaml` and normalized managed OpenSpec generated assets for the selected tools
- **THEN** `ax openspec install` fails with `already_configured`
- **AND** the output points to `ax openspec update`, `status`, or `validate`

#### Scenario: Partial state blocks install
- **WHEN** a repository has any OpenSpec footprint but missing config, missing canonical assets, duplicated generated directories, wrong symlink targets, or stale generated commands
- **THEN** `ax openspec install` fails with `repair_needed`
- **AND** the output includes path-level findings

#### Scenario: State inspection happens before mutation
- **WHEN** `ax openspec install` or `ax openspec update` starts
- **THEN** the command inspects OpenSpec state before backup, config write, upstream generation, or normalization

### Requirement: Guided first-time OpenSpec install
The system SHALL create first-time OpenSpec configuration from confirmed
defaults before generating repo-local OpenSpec assets.

#### Scenario: Interactive install confirms inferred defaults
- **WHEN** `ax openspec install` runs in a TTY for missing OpenSpec state
- **THEN** the command shows inferred setup defaults for tools, schema, workflow profile, delivery, and workflows
- **AND** the user can accept, edit, or skip meaningful sections before files are written

#### Scenario: Headless install requires context file
- **WHEN** `ax openspec install` runs without a TTY
- **AND** `--context-file <path>` is not provided
- **THEN** the command fails with `confirmation_required`
- **AND** no OpenSpec files are written

#### Scenario: Headless install uses confirmed context file
- **WHEN** `ax openspec install --context-file <path>` runs without a TTY for missing OpenSpec state
- **THEN** the command writes `openspec/config.yaml` from inferred required values and the provided project context
- **AND** it runs upstream OpenSpec generation

#### Scenario: Accept-inferred config is not supported
- **WHEN** help, docs, tests, or agent guidance describe headless first-time OpenSpec install
- **THEN** they do not offer `--accept-inferred-config` as a supported contract

### Requirement: Deterministic upstream OpenSpec generation
The system SHALL run upstream OpenSpec generation with deterministic runtime
inputs isolated from ambient user-level OpenSpec global configuration.

#### Scenario: Generation ignores ambient global config
- **WHEN** user global OpenSpec config contains different profile, delivery, or workflow values
- **AND** `ax openspec install` or `update` generates assets
- **THEN** generated workflows match the values resolved from `agent-runtime.config.json` and confirmed setup inputs

#### Scenario: Upstream invocation is observable in tests
- **WHEN** integration tests run with a fake OpenSpec CLI
- **THEN** the fake records the argv and environment used for upstream `init` or `update`
- **AND** tests can assert the isolated config home and expected arguments

#### Scenario: Confirmed config survives generation
- **WHEN** first-time install writes confirmed `openspec/config.yaml`
- **AND** upstream OpenSpec generation completes
- **THEN** the final `openspec/config.yaml` preserves the confirmed values

#### Scenario: Failed generation leaves repairable state
- **WHEN** upstream generation or normalization fails after files were staged or written
- **THEN** the command restores or stabilizes config, canonical assets, and harness symlinks where possible
- **AND** reports repair findings instead of ambiguous drift

### Requirement: Configured-project update reconciliation
The system SHALL make `ax openspec update` reconcile configured
projects without re-running first-time setup.

#### Scenario: Update refuses missing state
- **WHEN** a repository has missing OpenSpec state
- **THEN** `ax openspec update` fails and points to `ax openspec install`

#### Scenario: Normal update is asset-focused
- **WHEN** a configured repository has current generated assets
- **AND** `ax openspec update` is run without `--review-config`
- **THEN** the command exits without proposing config changes

#### Scenario: Update reviews config only when requested
- **WHEN** `ax openspec update --review-config` runs in a configured repository
- **THEN** the command may propose context or artifact-rule changes from project signals
- **AND** it applies only confirmed changes before upstream generation

#### Scenario: Headless update config review requires acceptance
- **WHEN** `ax openspec update --review-config` runs without a TTY
- **AND** `--accept-config-changes` is not provided
- **THEN** the command reports proposed config changes without mutating files

### Requirement: OpenSpec config and generated asset validation
The system SHALL validate repo-local OpenSpec config quality and generated asset
normalization according to resolved tools, delivery, workflows, skill targets,
and command targets.

#### Scenario: Config validation catches invalid project config
- **WHEN** `openspec/config.yaml` has an unknown schema, oversized context, or rules for unknown artifact IDs
- **THEN** `ax openspec validate` fails with the specific config problem

#### Scenario: Asset validation follows resolved targets
- **WHEN** `agent-runtime.config.json` selects a subset of tools or custom target maps
- **THEN** `ax openspec validate` checks only the resolved expected generated assets and symlinks

#### Scenario: Normalization drift fails validation
- **WHEN** generated OpenSpec skill or command outputs remain as duplicated real files where symlinks are expected
- **THEN** `ax openspec validate` fails and reports the drifted paths

