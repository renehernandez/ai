## ADDED Requirements

### Requirement: POC Rehearsal Is Not Delivery Completion
The system SHALL keep `plan-poc` review rehearsals separate from
`plan-orchestrator` final delivery.

#### Scenario: POC artifact closes before final delivery
- **WHEN** a `plan-poc` artifact closes
- **THEN** the artifact is unmerged
- **AND** the workflow does not report `stack_ready`
- **AND** final delivery still requires a revised OpenSpec and normal
  `plan-orchestrator`

#### Scenario: POC commits are not delivery lineage
- **WHEN** final delivery begins after a POC rehearsal
- **THEN** implementation starts from the revised OpenSpec
- **AND** POC commits are not reused as delivery lineage

#### Scenario: POC learnings inform revised OpenSpec
- **WHEN** a POC learning summary contains spec corrections or phase-shape
  feedback
- **THEN** those learnings inform the revised OpenSpec
- **AND** normal `plan-orchestrator` consumes the revised OpenSpec as the source
  of truth
