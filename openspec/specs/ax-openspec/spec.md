# ax-openspec Specification

## Purpose
TBD - created by archiving change guide-openspec-runtime-setup. Update Purpose after archive.
## Requirements
### Requirement: OpenSpec setup state classification
The system SHALL classify repo-local OpenSpec setup through one shared read-only report used by `ax openspec sync`, `ax openspec status`, and `ax openspec validate`.

#### Scenario: Missing state is classified
- **WHEN** a repository has neither OpenSpec config nor managed generated assets
- **THEN** state is `missing`
- **AND** sync may begin confirmed first-time setup

#### Scenario: Configured state is classified
- **WHEN** a repository has valid config and normalized managed assets
- **THEN** state is `configured`
- **AND** sync reconciles drift without repeating first-time confirmation

#### Scenario: Partial state with valid config is classified
- **WHEN** valid config exists but canonical assets, generated commands, or harness links are missing, locally altered, stale, duplicated, or misdirected
- **THEN** state is `partial_repairable`
- **AND** sync may reconstruct the generated surfaces from config

#### Scenario: Generated trigger metadata contradicts its invocation boundary
- **WHEN** generated adapter metadata or prompts contradict the explicit-only invocation boundary
- **THEN** the content is classified as drift
- **AND** state is `partial_repairable`

#### Scenario: Partial state lacks config
- **WHEN** generated assets exist without valid project config
- **THEN** state is `partial_context_required`
- **AND** sync requires confirmed context before mutation

#### Scenario: Inspection precedes mutation
- **WHEN** `ax openspec sync` starts
- **THEN** it classifies state before backup, config write, generation, normalization, or apply

### Requirement: Deterministic upstream OpenSpec generation
The system SHALL run upstream OpenSpec generation during sync with deterministic runtime inputs isolated from ambient user-level OpenSpec configuration.

#### Scenario: OpenSpec sync probes the CLI
- **WHEN** OpenSpec sync prepares generation
- **THEN** AX resolves the configured `openspec` executable or falls back to PATH, runs `openspec --version`, and reports path/version diagnostics
- **AND** does not install or upgrade the CLI

#### Scenario: Offline inspection locates the CLI without executing it
- **WHEN** `ax openspec status` or `ax openspec validate` inspects local state
- **THEN** AX locates the configured `openspec` executable or the first executable on PATH through filesystem checks
- **AND** does not execute the CLI or probe its version

#### Scenario: OpenSpec CLI is unavailable
- **WHEN** no executable CLI or version response is available
- **THEN** sync fails before candidate mutation with installation guidance

#### Scenario: Generation ignores ambient global config
- **WHEN** ambient global OpenSpec values differ from resolved AX configuration and confirmed project context
- **THEN** generated workflows use AX-resolved inputs

#### Scenario: Upstream invocation is observable
- **WHEN** integration tests use a fake OpenSpec CLI
- **THEN** tests can assert argv, isolated config home, and resolved environment

#### Scenario: CLI version pinning is considered
- **WHEN** maintainers need a pinned OpenSpec version
- **THEN** they deliver that package/config change separately
- **AND** this sync change does not claim an undeclared repository package pin

#### Scenario: Confirmed config survives generation
- **WHEN** sync creates or reviews project config before generation
- **THEN** the final candidate preserves confirmed values

#### Scenario: Generation fails
- **WHEN** upstream generation or normalization fails
- **THEN** no live candidate is applied
- **AND** existing configured state remains unchanged

### Requirement: OpenSpec config and generated asset validation
The system SHALL parse repo-local OpenSpec config through a documented fail-closed YAML subset and SHALL validate config and generated assets against resolved tools, delivery, workflows, skill targets, command targets, and explicit-only adapter triggers.

#### Scenario: Project config uses the supported YAML subset
- **WHEN** project config contains a scalar `schema`, literal or folded `context`, and a `rules` mapping
- **THEN** rules accept quoted or unquoted artifact keys whose values are lists or an empty mapping
- **AND** AX preserves the parsed context and rules for validation and config review

#### Scenario: Project config exceeds the supported YAML subset
- **WHEN** project config contains an unsupported YAML construct or malformed supported value
- **THEN** parsing fails closed with a specific validation finding
- **AND** sync performs no project mutation

#### Scenario: Config is invalid
- **WHEN** config contains an unknown schema, oversized context, or rules for unknown artifacts
- **THEN** validation fails with the specific problem

#### Scenario: Resolved targets vary
- **WHEN** configuration selects a subset of tools or custom target maps
- **THEN** validation checks only the resolved expected assets and links

#### Scenario: Normalization drifts
- **WHEN** locally altered generated files or links do not match canonical normalized form
- **THEN** validation fails with path-level findings

#### Scenario: Adapter trigger regresses
- **WHEN** generated `openspec-*` metadata and prompts contradict each other or advertise ordinary-language inference
- **THEN** the content is drift
- **AND** validation fails with the adapter and content location

### Requirement: OpenSpec sync converges setup state
The system SHALL expose `ax openspec sync` as the sole mutating OpenSpec command and SHALL converge missing, configured, and repairable partial state.

#### Scenario: Missing state synchronizes interactively
- **WHEN** sync runs in a TTY for missing state
- **THEN** it previews inferred tools, schema, workflow profile, delivery, and project context
- **AND** writes only after confirmation

#### Scenario: Missing state synchronizes headlessly
- **WHEN** sync runs without a TTY for missing state
- **THEN** it requires `--context-file <path>`
- **AND** performs no mutation when context is absent

#### Scenario: Configured state synchronizes
- **WHEN** config and managed assets exist
- **THEN** sync refreshes only drifted generated assets
- **AND** reviews inferred config changes only under the existing explicit config-review authorization

#### Scenario: Config review preserves unspecified current values
- **WHEN** config review proposes changes without specifying replacement `context` or `rules`
- **THEN** AX preserves the current valid context and rules in the effective proposal
- **AND** shows the full effective proposal before interactive confirmation or headless acceptance

#### Scenario: Partial state with config synchronizes
- **WHEN** valid config exists and generated assets are missing or stale
- **THEN** sync reconstructs them from that config after backup and candidate validation

#### Scenario: Partial state lacks config
- **WHEN** assets exist without valid config
- **THEN** interactive sync requires confirmed context and headless sync requires `--context-file`
- **AND** it does not infer and write project context silently

#### Scenario: Candidate is ready
- **WHEN** generation, canonicalization, harness-link normalization, explicit-only adapter normalization, and validation pass
- **THEN** AX applies the candidate through a repository-scoped transaction
- **AND** does not read or change runtime `selected-profile.json`

#### Scenario: Repository transaction begins
- **WHEN** OpenSpec sync is ready to mutate files
- **THEN** it acquires a worktree-specific mutation lock and records worktree identity, initial dirty paths, expected old/new hashes, candidate hashes, and touched-file preimages in a journal under the target Git administrative directory
- **AND** retains hash-verified candidate file payloads and deletion markers in that transaction directory until finalize, rollback, or operator resolution completes
- **AND** refuses to overwrite unrelated dirty paths

#### Scenario: Same worktree sync is concurrent
- **WHEN** another OpenSpec sync holds the worktree mutation lock
- **THEN** the new mutation exits without changing repository files

#### Scenario: Repository apply fails
- **WHEN** generation application or post-apply validation fails
- **THEN** AX restores a touched file only when its current hash equals recorded old or candidate state
- **AND** leaves unrelated paths unchanged

#### Scenario: Concurrent edit changes a touched file
- **WHEN** a touched file hash matches neither recorded old nor candidate state
- **THEN** AX preserves the journal and preimages as `recovery_conflict`
- **AND** does not overwrite the edit

#### Scenario: Repository rollback fails
- **WHEN** AX cannot restore a touched file during recovery
- **THEN** it records `recovery_failed`, preserves recovery material, and blocks later OpenSpec mutation in that worktree

#### Scenario: Operator resolves repository recovery
- **WHEN** `ax openspec sync --recovery-file <path>` identifies the worktree transaction, exact current hashes, and `restore-previous|apply-candidate|preserve-unmanaged` actions
- **THEN** AX verifies and uses the transaction-local candidate payload for `apply-candidate` and applies only hash-matching actions under the worktree lock
- **AND** validates the selected hashes, recovery-file actions, and untouched-path invariants before removing recovery material
- **AND** does not require canonical generated-asset convergence when an authorized action deliberately retains drift

#### Scenario: OpenSpec source state changes during recovery
- **WHEN** a repository recovery conflict remains after cache deletion, source mutation, or remote-ref advancement
- **THEN** `apply-candidate` uses the retained payload whose hash was authorized for that transaction
- **AND** does not regenerate the candidate from current source state

#### Scenario: Current repository file is preserved
- **WHEN** an authorized recovery action is `preserve-unmanaged`
- **THEN** AX keeps the current file and removes it from pending recovery
- **AND** a later normal sync reports any generated-asset drift

#### Scenario: Repository sync resumes
- **WHEN** a target repository has an incomplete OpenSpec journal
- **THEN** only that repository's next mutating OpenSpec invocation recovers it before new work
- **AND** status or validate reports it without mutation

#### Scenario: Repository backups rotate
- **WHEN** generated OpenSpec content changes successfully
- **THEN** AX retains seven backups per generated asset in the target Git administrative directory

#### Scenario: Legacy OpenSpec command is invoked
- **WHEN** a caller invokes `ax openspec install` or `ax openspec update`
- **THEN** AX exits without mutation and reports `Use ax openspec sync`
- **AND** no compatibility alias executes

#### Scenario: Supported context and config-review flags are used
- **WHEN** headless first-time or partial setup needs context
- **THEN** `--context-file <path>` supplies confirmed project context
- **AND** configured review uses `--review-config` with `--accept-config-changes` only for authorized headless application

#### Scenario: Canonical generated targets are resolved
- **WHEN** sync generates repo-local skills and commands
- **THEN** canonical skills resolve under `.agents/skills/openspec-*` and canonical commands under `.agents/commands/opsx`
- **AND** configured Codex and Claude targets use normalized harness links
