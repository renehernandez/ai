## ADDED Requirements

### Requirement: Planning review includes charter compliance
The system SHALL include charter compliance in the artifact-fingerprint-bound planning Review for every rule, skill, agent, instruction, hook, validator, or automation change.

#### Scenario: Workflow planning artifact is reviewed
- **WHEN** a planning artifact changes agent behavior
- **THEN** Review validates canonical ownership, affected charter principles, removed contradictions, and selected pressure scenarios
- **AND** a missing or failing charter result blocks implementation handoff

## MODIFIED Requirements

### Requirement: POC reconciliation is one batch per authorized cycle
The system SHALL continuously capture durable POC implementation and feedback learnings and SHALL reconcile them once against the stable accepted POC head before closure and final implementation.

#### Scenario: Durable POC findings exist
- **WHEN** POC evidence changes scope, design, requirements, acceptance, verification, migration, or tasks
- **THEN** Plan updates all affected OpenSpec artifacts and required Linear preview content together
- **AND** contract-preserving updates require no additional user prompt

#### Scenario: Reconciliation is reviewed
- **WHEN** the consolidated update is complete
- **THEN** the planning baseline and affected specialists review the revised artifact against the accepted POC head

#### Scenario: No material contract finding exists
- **WHEN** the POC confirms the initial contract
- **THEN** Plan records no speculative expansion and proceeds with the validated artifact

#### Scenario: Reconciliation appears unproved
- **WHEN** the revised spec contains a materially new behavior or risk not proven by the accepted POC
- **THEN** Plan presents the delta and recommendation to the user
- **AND** only explicit user direction starts another POC cycle

