## ADDED Requirements

### Requirement: Assembled runtime behavior evaluation
The repository SHALL provide automated behavior evals that exercise repository-owned skills and selected rules through the AX-managed Codex and Claude runtime shapes.

#### Scenario: Explicit runtime lane executes
- **WHEN** an evaluator selects a supported runner and model
- **THEN** the harness assembles the selected AX profile in an isolated runtime
- **AND** records runner and model identity with the normalized result

#### Scenario: Runtime lane is incomplete
- **WHEN** credentials, runner identity, model identity, or required result metadata is missing
- **THEN** evaluation fails with an actionable setup error
- **AND** does not silently skip the lane

### Requirement: Evaluation isolation
Every live behavior eval SHALL isolate repository, runtime, and provider effects from the user's live environment.

#### Scenario: Skill attempts a mutation
- **WHEN** a scenario permits repository or provider-shaped activity
- **THEN** the activity targets only the temporary repository or provider-command shim
- **AND** the source worktree, live AX runtime, and real provider state remain unchanged

#### Scenario: Lane environment is assembled
- **WHEN** the harness starts a supported runner
- **THEN** it passes only safe runtime and runner-specific environment variables
- **AND** does not leak unrelated credentials or grant Claude shell capability

#### Scenario: Integrity is compared
- **WHEN** the harness snapshots source or sandbox state
- **THEN** it compares streamed per-file digests without retaining base64 repository contents
- **AND** reports any unexpected source or sandbox mutation

### Requirement: Behavior-first grading
Eval scenarios SHALL grade observable behavior and structured outputs rather than incidental prose.

#### Scenario: Deterministic boundary exists
- **WHEN** filesystem state, tool routing, provider calls, freshness, escalation, or structured output can prove a requirement
- **THEN** a deterministic assertion decides that requirement
- **AND** semantic scoring cannot override a forbidden mutation or missing required field

#### Scenario: Semantic judgment is necessary
- **WHEN** a required quality cannot be represented deterministically
- **THEN** a named judge uses scenario-specific criteria and a declared threshold
- **AND** stores normalized diagnostic evidence for replay

#### Scenario: Scenario vocabulary is presented
- **WHEN** a model receives a behavior scenario
- **THEN** it may see the global behavior vocabulary
- **AND** does not receive that scenario's required or forbidden answer labels

#### Scenario: Repository authority is evaluated
- **WHEN** Plan, Execute, or a read-only lane receives a temporary repository with write-capable tools
- **THEN** Plan and Execute prove authority through the required observable write
- **AND** read-only lanes prove restraint by leaving repository state unchanged

#### Scenario: Provider receipt is malformed
- **WHEN** a provider-shaped call cannot be classified as supported retrieval
- **THEN** the harness fails closed by classifying it as mutation
- **AND** the scenario cannot pass a provider-write prohibition

### Requirement: Pre-simplification baseline
Affected lifecycle and specialist behavior SHALL pass before runtime instructions that teach that behavior are reduced.

#### Scenario: Current critical behavior fails
- **WHEN** a critical authority or specialist scenario fails against the current corpus
- **THEN** the failure is reported as a behavior gap
- **AND** it is not normalized into an expected failure or a lower threshold

#### Scenario: Later simplification changes behavior
- **WHEN** a skill or rule simplification regresses an affected scenario
- **THEN** the eval command fails before that change reaches technical readiness

### Requirement: Preserved behavior coverage
The committed baseline SHALL cover the five lifecycle authorities and every explicitly preserved specialist capability.

#### Scenario: Lifecycle authority is evaluated
- **WHEN** the lifecycle group runs
- **THEN** it proves Explore read-only behavior, Plan artifact-only mutation, Execute repository ownership, Review read-only exact-target inspection, and Finish provider routing with separately authorized terminal actions

#### Scenario: Specialist leverage is evaluated
- **WHEN** the specialist group runs
- **THEN** it proves Brainstorming Orientation Map and convergence, Start Project intake, Change Request Create description ownership, Nitro evidence routing, OpenSpec task auditing, and evidence-backed read-only Security Review

### Requirement: Separate deterministic and live evaluation layers
The repository SHALL keep deterministic validation in the native hook and live model evaluation in an explicit credentialed command.

#### Scenario: Pre-commit runs
- **WHEN** the native pre-commit hook validates the repository
- **THEN** deterministic harness, fixture, schema, skill, and charter tests run without requiring model credentials

#### Scenario: Live eval command runs
- **WHEN** an authorized operator invokes the skills-and-rules eval command with an explicit lane
- **THEN** it emits normalized Vitest eval results and uncommitted diagnostic artifacts

#### Scenario: Final readiness is evaluated
- **WHEN** the completed corpus reaches its archival unit
- **THEN** current Codex and Claude runtime lanes both execute successfully
- **AND** a pre-inference runner or gateway failure remains a blocking verification gap
