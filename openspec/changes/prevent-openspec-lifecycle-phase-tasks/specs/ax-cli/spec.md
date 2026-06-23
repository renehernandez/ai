## ADDED Requirements

### Requirement: Plan Workflow Runtime Refresh

The system SHALL refresh and validate installed runtime surfaces after shared
plan workflow skills, instructions, rules, or managed reusable scripts change.
This refresh SHALL be treated as an activation gate owned by the task that
changed installed behavior, not as a standalone final OpenSpec task group.

#### Scenario: Shared skills change

- **WHEN** shared plan workflow skills, skill scripts, or adapter prompts change
- **THEN** package-managed skill update runs for both `personal` and `work`
  profiles
- **AND** package-managed skill validation runs for both `personal` and `work`
  profiles before the change is treated as live
- **AND** the implementation task that changed those shared surfaces records the
  refresh evidence with that deliverable

#### Scenario: Shared instructions or rules change

- **WHEN** shared instructions, repo-local rules, or portable agent guidance
  change
- **THEN** package-managed instruction update runs for both `personal` and
  `work` profiles
- **AND** package-managed instruction validation runs for both profiles before
  the change is treated as live
- **AND** the implementation task that changed those instructions or rules
  records the refresh evidence with that deliverable

#### Scenario: Managed skill imports a new reusable script

- **WHEN** a managed skill imports a new top-level shared script
- **THEN** `runtime.reusableScripts` is updated to include that script
- **AND** package-managed runtime validation covers the updated reusable script
  declaration
- **AND** the script import, runtime declaration, and validation evidence remain
  part of the same deliverable unit
