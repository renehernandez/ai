## ADDED Requirements

### Requirement: Source-Plan Cleanup Runtime Validation
The system SHALL validate installed runtime planning surfaces after source-plan
cleanup behavior changes.

#### Scenario: Source-plan cleanup contract is installed
- **WHEN** source-plan cleanup changes shared planning skill behavior, adapter
  prompts, or helper scripts
- **THEN** runtime skill update, status, and validation run for personal and
  work profiles
- **AND** verification confirms installed `plan-orchestrator` and `plan-review`
  surfaces describe the same OpenSpec source-plan cleanup contract as the repo
  source
