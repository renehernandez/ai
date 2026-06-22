## MODIFIED Requirements

### Requirement: Runtime Surface Validation
The system SHALL validate installed runtime surfaces after managed updates.

#### Scenario: Runtime refresh proves installed behavior
- **WHEN** shared plan workflow skills or instructions change
- **THEN** runtime skill update, status, and validation run for personal and
  work profiles
- **AND** instruction status and validation run when installed instructions
  changed

#### Scenario: Installed planning scripts execute after refresh
- **WHEN** installed planning skill scripts import shared helper scripts
- **THEN** the runtime configuration installs every imported shared helper or
  the installed skill avoids that import
- **AND** post-refresh verification executes representative installed planning
  scripts rather than relying only on status or validation metadata

#### Scenario: Nitro feedback helper import is covered
- **WHEN** `plan-review` or `plan-unit-delivery` imports
  `scripts/nitro-feedback-gate.ts` from either the repo-local or installed
  runtime skill copy
- **THEN** runtime refresh installs `scripts/nitro-feedback-gate.ts` beside the
  installed skill roots or removes the installed script imports
- **AND** installed `plan-review` and `plan-unit-delivery` script execution
  checks prove the import resolves wherever it remains
- **AND** the check distinguishes a currently broken installed helper from a
  refresh-durability gap where the installed helper resolves only from an
  unmanaged runtime script file that is not declared in reusable runtime script
  configuration

#### Scenario: Missing shared script import blocks delivery
- **WHEN** an installed planning skill script fails because a shared helper
  script is missing from the installed runtime scripts directory
- **THEN** delivery reports a runtime compatibility failure
- **AND** the runtime refresh is not considered successful
