## ADDED Requirements

### Requirement: Planning Workflow Skills Are Portable
The system SHALL package planning workflow helper logic inside each planning
workflow skill that exposes the behavior.

#### Scenario: Plan workflow helper runs from skill folder
- **WHEN** an agent follows documented helper commands for `plan-ready`,
  `plan-review`, `plan-orchestrator`, `plan-unit-sequencer`,
  `plan-unit-delivery`, or `openspec-tasks`
- **THEN** the command resolves from files packaged inside that skill folder
- **AND** the command does not require discovering the AI repo root

#### Scenario: Planning workflow skill needs private artifact storage
- **WHEN** a planning workflow skill explains where support workflow artifacts
  belong
- **THEN** it keeps support artifacts in the thread or private workflow storage
- **AND** it does not teach AX command syntax unless the `ax-cli` skill is the
  active guidance surface
