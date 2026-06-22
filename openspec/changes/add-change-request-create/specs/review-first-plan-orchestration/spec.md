## MODIFIED Requirements

### Requirement: Rule And Runtime Alignment
The system SHALL align shared instructions, runtime surfaces, and verification
with stacked Nitro-reviewed delivery and hosted change request creation.

#### Scenario: Hosted change request rule is shared
- **WHEN** an agent needs to create or update a PR or MR without an explicitly
  provider-specific request
- **THEN** shared review rules identify `change-request-create` as the
  artifact-host-neutral entrypoint
- **AND** the same reviewer-facing description contract applies outside
  local-only skill discovery

#### Scenario: Runtime refresh proves installed behavior
- **WHEN** shared plan workflow skills, change request skills, rules, or
  instructions change
- **THEN** runtime skill update, status, and validation run for personal and
  work profiles
- **AND** instruction status and validation run when installed instructions
  changed
