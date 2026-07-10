## ADDED Requirements

### Requirement: AX is source-control and workflow-state neutral
The system SHALL manage reusable runtime assets and SHALL NOT coordinate Git transactions, local review gates, or private plan-session storage.

#### Scenario: AX help exposes runtime scopes
- **WHEN** a user runs `ax --help`
- **THEN** AX exposes shim, skills, instructions, hooks, profiles, OpenSpec scaffolding, install, update, status, and validation behavior
- **AND** it does not expose `commit`, `review-gate`, or `plans artifact`

#### Scenario: Removed commit command is invoked
- **WHEN** a caller invokes `ax commit`
- **THEN** AX reports the command unavailable
- **AND** agent guidance routes commits through native Git and repository hooks

#### Scenario: Removed review gate is invoked
- **WHEN** a caller invokes `ax review-gate`
- **THEN** AX reports the command unavailable
- **AND** no gate lock, activation, validation, consumption, or recovery state is created

#### Scenario: Removed plan-support command is invoked
- **WHEN** a caller invokes `ax plans artifact`
- **THEN** AX reports the command unavailable
- **AND** no private blob, manifest, revision, index, fingerprint, or correlation record is written

#### Scenario: Runtime status is inspected
- **WHEN** a user runs AX status or validation
- **THEN** AX reports runtime asset, link, profile, hook, shim, and repo-local OpenSpec health
- **AND** it does not inspect or report active workflow transaction state

### Requirement: AX validates the five-mode installed surface
The system SHALL validate that affected personal and work profiles install the intended public lifecycle and specialist surfaces without legacy lifecycle collisions.

#### Scenario: Profile lifecycle is valid
- **WHEN** AX validates an updated personal or work profile
- **THEN** Explore, Plan, Execute, Review, and Finish are installed as the five public lifecycle entries
- **AND** retained specialists are installed according to profile policy
- **AND** retired lifecycle packages are absent as standalone entries

#### Scenario: Unmanaged lifecycle collision is discoverable
- **WHEN** a combined runtime root contains an unmanaged skill whose metadata matches the retired lifecycle denylist
- **THEN** activation blocks with `unmanaged_lifecycle_conflict` plus path and provenance
- **AND** AX does not delete, reclassify, or overwrite the unmanaged entry

#### Scenario: Retired lifecycle denylist is evaluated
- **WHEN** AX validates the combined discoverable runtime
- **THEN** it uses the exact fixed denylist declared by the five-mode migration, including collision-only `plan-followthrough`, `plan-slices`, and `plan-to-pr`
- **AND** adding or removing a denylist name requires a reviewed source change rather than metadata inference

#### Scenario: Lifecycle validation executes
- **WHEN** AX validates personal or work profiles
- **THEN** it compares the five expected and retired forbidden names against the explicit configured manifest
- **AND** it does not add lifecycle metadata, a mode registry, a transition engine, or persisted mode state

#### Scenario: Staged mode source exists before cutover
- **WHEN** incomplete packages exist under `mode-skills/`
- **THEN** AX install/update ignores that tree and current installed inventories remain unchanged
- **AND** only the final cutover may move completed packages into `skills/`

#### Scenario: Portable mode helper boundary is invalid
- **WHEN** a mode skill imports executable helper logic from an unrelated repo-root workflow script
- **THEN** AX validation fails with a portable-boundary finding
- **AND** requires the helper to live inside the owning mode skill

#### Scenario: Staged mode source is validated
- **WHEN** a mode package exists under `mode-skills/`
- **THEN** `pnpm skills:validate` and Lefthook validate its metadata, references, scripts, and portable boundaries before commit
- **AND** copied-skill verification proves helper execution without AI-repo `node_modules`

### Requirement: AX removal has no compatibility alias
The system SHALL remove AX transaction and plan-support commands without a deprecated alias or one-release shim.

#### Scenario: Legacy reference remains in active guidance
- **WHEN** shared instructions, rules, active skills, adapter prompts, executable code, or tests still direct agents to `ax commit`, `ax review-gate`, required-gate helpers, or `ax plans artifact`
- **THEN** repository validation fails
- **AND** historical archived planning artifacts may be excluded from the active-reference rule

### Requirement: OpenSpec adapter normalization is durable
The system SHALL normalize repo-local generated OpenSpec adapters to explicit-only metadata and prompts after every managed install or update.

#### Scenario: OpenSpec assets regenerate
- **WHEN** AX delegates OpenSpec install or update to the configured CLI
- **THEN** AX deterministically normalizes the four generated adapters before validation
- **AND** ordinary language continues to route through the five lifecycle modes

#### Scenario: Adapter trigger content regresses
- **WHEN** generated metadata or prompts advertise ordinary-language inference for an `openspec-*` adapter
- **THEN** OpenSpec validation fails with the conflicting adapter and content location

### Requirement: Runtime activation is transactional
The system SHALL stage and validate candidate hooks, skills, instructions, and profiles before replacing verified AX-owned managed entries and SHALL restore previous values of touched managed entries on partial failure.

#### Scenario: Candidate runtime passes
- **WHEN** every candidate surface validates from one exact source head
- **THEN** AX changes only the verified union of previous-managed and candidate-managed entries and verifies installed parity
- **AND** it leaves no persistent workflow transaction state

#### Scenario: Transaction ownership is derived
- **WHEN** Unit 8 prepares activation
- **THEN** `previous_managed_manifest` comes from the verified exact Unit 7 predecessor lock and candidate ownership comes from the immutable Unit 8 lock
- **AND** the transaction set is their union

#### Scenario: Previous ownership cannot be verified
- **WHEN** predecessor lock identity, live entry identity/provenance, or an unmanaged same-name entry does not match the previous managed manifest
- **THEN** activation blocks before mutation
- **AND** AX does not infer ownership from the candidate lock alone

#### Scenario: Candidate construction or replacement fails
- **WHEN** failure is injected after hooks, skills, instructions, profiles, or a managed-entry replacement
- **THEN** AX restores every touched managed entry and removes temporary state
- **AND** reports the failed stage without leaving a partially activated lifecycle

#### Scenario: Runtime root has mixed ownership
- **WHEN** AX-owned and unmanaged skills or `.codex/skills/.system` share a root
- **THEN** AX preserves every unmanaged entry and never replaces the mixed-ownership directory itself
- **AND** rollback is limited to the lock-owned entries touched by the operation

#### Scenario: Activation succeeds
- **WHEN** the verified managed-entry transaction and post-activation validation pass
- **THEN** the already committed candidate lock remains unchanged
- **AND** there is no post-activation lock diff or source commit

#### Scenario: Finish runs the activation gate
- **WHEN** Unit 8 has one immutable hook-clean and Review-clean head and delivery authority includes live runtime mutation
- **THEN** Review emits `activation_ready` and Finish runs `runtime_activation_gate` for that exact head before Unit 8 publication or `ready_to_finish`
- **AND** missing authority, omitted activation, failure, or later head change blocks publication and stack readiness

#### Scenario: Hooks source is resolved
- **WHEN** the AI repo runtime configuration is validated
- **THEN** `runtime.hooks.sourceDir` resolves from repository-relative `hooks`
- **AND** config and lock state agree on that source
