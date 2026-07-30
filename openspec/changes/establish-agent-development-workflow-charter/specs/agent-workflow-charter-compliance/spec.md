## ADDED Requirements

### Requirement: Universal workflow charter governs all work
The system SHALL apply one agent-development workflow charter to every kind of work while allowing specialized rules to implement project, lifecycle, provider, review, verification, and operational mechanics.

#### Scenario: Any work begins
- **WHEN** an agent performs personal, project, repository, provider, operational, or documentation work
- **THEN** the charter’s principles and authority boundaries apply
- **AND** a specialized rule may refine mechanics without weakening or contradicting them

#### Scenario: Specialized policy conflicts with the charter
- **WHEN** both policies cannot be preserved
- **THEN** the workflow identifies the conflict and blocks the weaker design
- **AND** only explicit user direction may revise the charter or approve a scoped exception

### Requirement: Agent-behavior changes pass charter validation
The system SHALL block a change to instructions, rules, skills, agent definitions, hooks, agent-behavior validators, or automation prompts until affected charter requirements pass structural and behavioral validation.

#### Scenario: Agent-behavior surface changes
- **WHEN** a proposed diff changes agent behavior
- **THEN** validation identifies the canonical owner, affected charter principles, intended deviations, obsolete guidance removed, and selected pressure scenarios
- **AND** clean-context behavior evidence demonstrates compliance

#### Scenario: Change only claims compliance
- **WHEN** a change contains a prose assertion without affected behavior evidence
- **THEN** the charter gate fails

#### Scenario: Repair commit covers only part of the proposed change
- **WHEN** the latest commit has valid pressure evidence but the complete target-base-to-source-head diff contains another changed behavior surface
- **THEN** Review validates the cumulative range rather than only the staged repair
- **AND** every behavior surface in that range must map to its canonical owner and executable contract-specific RED/GREEN scenario

#### Scenario: Named pressure tests do not exercise their owner
- **WHEN** RED and GREEN test names contain the expected labels but their assertions only prove that a function or path string is truthy
- **THEN** the charter gate fails
- **AND** every changed behavior surface must map to a contract-specific scenario ID
- **AND** that contract is the single source of its affected principles and executable evidence
- **AND** each polarity must bind its assertion to an executed owning-path result

#### Scenario: Non-executable text imitates an owning-path call
- **WHEN** a named RED or GREEN scenario contains required evidence tokens only in line comments, block comments, string literals, or template-literal text
- **THEN** the charter gate requires an actual TypeScript call expression
- **AND** the behavior change remains blocked for missing executable evidence

#### Scenario: Syntactic evidence does not prove execution
- **WHEN** the apparent owner call is statically unreachable, resolves to a shadowed binding, or appears only in an assertion message or uninvoked callback
- **THEN** the charter gate rejects that scenario
- **AND** the tested assertion value or an assertion-invoked callback must depend on a reachable call from the canonical import or top-level helper

#### Scenario: A future validator or agent prompt is introduced
- **WHEN** a new agent-behavior validator script or agent, review, or rubric prompt template is added
- **THEN** the charter gate classifies it as an agent-behavior surface
- **AND** an unregistered canonical owner blocks the change

#### Scenario: Ordinary product code changes
- **WHEN** a diff does not change an agent-behavior surface
- **THEN** the charter behavior-change gate does not add unrelated workflow validation
- **AND** a generic product helper is not classified only because its filename contains `validate` or `validator`

### Requirement: Context uses progressive disclosure and canonical ownership
The system SHALL keep global guidance compact, load specialized context when required, and preserve one canonical owner for each policy or concept.

#### Scenario: Specialized procedure is needed
- **WHEN** a task enters a provider, lifecycle, review, verification, or operational concern
- **THEN** the agent loads the specialized owner for that concern
- **AND** the global entrypoint does not duplicate its exhaustive procedure

#### Scenario: Parallel guidance is found
- **WHEN** two rules, skills, or tools independently own the same policy
- **THEN** the change reuses or consolidates the canonical owner
- **AND** removes or retires the competing control path

### Requirement: Expressive interfaces replace repeated prompts
The system SHALL prefer tools, contracts, validation, and ownership boundaries that make correct behavior natural over repeated prose reminders.

#### Scenario: Repeated instruction has been bypassed
- **WHEN** observed agent behavior repeatedly ignores a prose-only delegation or authority boundary
- **THEN** the redesign removes or constrains the bypassing interface
- **AND** adds a regression scenario for the observed failure

### Requirement: Authored files receive refactoring pressure
The system SHALL treat approximately 400 manually authored lines as a strong refactoring signal and SHALL require an enabling refactor or cohesion-based justification before growth at or above 500 lines.

#### Scenario: Authored file approaches 400 lines
- **WHEN** active work grows a manually authored file to approximately 400 lines
- **THEN** Plan, Execute, and code-quality Review evaluate responsibility count, coupling, branching complexity, change frequency, and ownership

#### Scenario: Authored file is at least 500 lines
- **WHEN** a change would grow a manually authored file at or above 500 lines
- **THEN** the change performs an upfront enabling refactor or records a concrete cohesion-based justification

#### Scenario: Category requires different treatment
- **WHEN** the file is generated code, a schema, fixture, data table, or cohesive declarative artifact
- **THEN** the workflow applies category-specific review instead of arbitrary splitting

### Requirement: Enabling refactors precede their consumers
The system SHALL deliver and validate a required enabling refactor before the change that consumes it when the refactor safely improves the current canonical owner.

#### Scenario: Current structure obstructs an accepted change
- **WHEN** a behavior change would otherwise add parallel ownership, scattered branches, or avoidable review debt
- **THEN** the workflow delivers the enabling refactor first
- **AND** the refactor remains useful and safe if the consumer never lands

#### Scenario: Cleanup is unrelated
- **WHEN** a proposed refactor does not directly enable the accepted outcome or improve its canonical owner
- **THEN** it remains outside the delivery scope
