## ADDED Requirements

### Requirement: GitLab MR delivery for AI repo changes
The system SHALL guide completed implementation work in this repo through a
GitLab merge request against `main` with Nitro review by default.

#### Scenario: Completed work uses hosted review
- **WHEN** an agent completes implementation work in this repo
- **THEN** repo guidance directs the agent to create a feature branch
- **AND** push it to the GitLab `origin` remote
- **AND** open or update a GitLab MR against `main`
- **AND** request Nitro review

#### Scenario: Direct main is explicit override only
- **WHEN** an agent is ready to publish completed work in this repo
- **THEN** repo guidance does not treat direct `main` push as the default path
- **AND** direct `main` updates require explicit user override or merge follow-through instructions

#### Scenario: Delivery completion includes hosted evidence
- **WHEN** implementation delivery is called complete
- **THEN** the agent has inspected GitLab pipeline status
- **AND** has posted `/request_review @nitro`
- **AND** has inspected latest-head Nitro feedback outcome
