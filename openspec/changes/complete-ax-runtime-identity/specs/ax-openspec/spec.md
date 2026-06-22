## MODIFIED Requirements

### Requirement: Deterministic upstream OpenSpec generation
The system SHALL run upstream OpenSpec generation with deterministic runtime
inputs isolated from ambient user-level OpenSpec global configuration.

#### Scenario: Generation ignores ambient global config
- **WHEN** user global OpenSpec config contains different profile, delivery, or workflow values
- **AND** `ax openspec install` or `update` generates assets
- **THEN** generated workflows match the values resolved from `ax.config.json` and confirmed setup inputs

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

### Requirement: OpenSpec config and generated asset validation
The system SHALL validate repo-local OpenSpec config quality and generated asset
normalization according to resolved tools, delivery, workflows, skill targets,
and command targets.

#### Scenario: Config validation catches invalid project config
- **WHEN** `openspec/config.yaml` has an unknown schema, oversized context, or rules for unknown artifact IDs
- **THEN** `ax openspec validate` fails with the specific config problem

#### Scenario: Asset validation follows resolved targets
- **WHEN** `ax.config.json` selects a subset of tools or custom target maps
- **THEN** `ax openspec validate` checks only the resolved expected generated assets and symlinks

#### Scenario: Normalization drift fails validation
- **WHEN** generated OpenSpec skill or command outputs remain as duplicated real files where symlinks are expected
- **THEN** `ax openspec validate` fails and reports the drifted paths
