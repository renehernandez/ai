## ADDED Requirements

### Requirement: Globally linked runtime command
The system SHALL provide an `agent-runtime` command that can be globally linked
from the durable AI repo and invoked from arbitrary target projects.

#### Scenario: Global command resolves durable source root
- **WHEN** a globally linked `agent-runtime` command is invoked outside the AI repo
- **THEN** the runtime source root resolves to the durable AI repo checkout
- **AND** the command uses the AI repo implementation

#### Scenario: Central config is default
- **WHEN** the global command is invoked without `--config`
- **THEN** the runtime config path resolves to the AI repo `agent-runtime.config.json`
- **AND** the command does not auto-discover a target repo `agent-runtime.config.json`

#### Scenario: Repo-local scopes target cwd
- **WHEN** the global command runs a repo-local scope such as `openspec`
- **THEN** the target root resolves to the invocation current working directory

#### Scenario: Explicit config override remains available
- **WHEN** the global command is invoked with `--config <path>`
- **THEN** the runtime uses the explicit config path instead of the central default

#### Scenario: Link-safe execution is tested
- **WHEN** the command is installed through the package bin
- **THEN** the command runs from outside the AI repo without relying on a target repo package script
