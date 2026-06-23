## ADDED Requirements

### Requirement: Deliverable-Only OpenSpec Tasks

The system SHALL treat OpenSpec checkbox tasks as deliverable units rather than
planning lifecycle phases.

#### Scenario: Generated blueprint rejects validation-only task

- **WHEN** plan readiness validates an OpenSpec blueprint task whose work is only
  running tests, linting, formatting, OpenSpec validation, CI inspection, hosted
  review, reviewer-note proof, or evidence capture
- **THEN** the workflow rejects the blueprint task before OpenSpec creation
- **AND** it reports the task-shape violation as a readiness blocker

#### Scenario: Generated blueprint rejects final lifecycle group

- **WHEN** plan readiness validates a blueprint that would materialize a final
  documentation, testing, validation, review, or combined lifecycle group
- **AND** the change is not primarily about that lifecycle area
- **THEN** the workflow rejects the blueprint before OpenSpec creation

#### Scenario: Workflow-area feature is allowed

- **WHEN** a task changes documentation, test infrastructure, validation tooling,
  CI behavior, reviewer tooling, runtime validation tooling, or reusable AI
  workflow machinery as the feature itself
- **THEN** the task may be treated as a deliverable
- **AND** regression fixtures cover the allowed exception

### Requirement: Shared Task-Shape Classification

The system SHALL use one canonical task-shape classifier for plan-ready
blueprints, OpenSpec task audits, planning review, and delivery sequencing.

#### Scenario: Blueprint and checkbox classify identically

- **WHEN** an equivalent task is represented as a plan-ready blueprint task and
  as an OpenSpec `tasks.md` checkbox
- **THEN** both inputs are normalized through the same classifier
- **AND** both inputs receive the same task-shape classification

#### Scenario: Manual-looking proof blocks redesign

- **WHEN** a task looks like external or manual work but only captures review,
  CI, validation, or evidence proof
- **THEN** the classifier treats the task as proof-only or validation-only
- **AND** the workflow returns `needs_spec_redesign` instead of ignoring it as
  manual work

#### Scenario: Heuristics are not duplicated

- **WHEN** plan-ready, openspec-tasks, plan-review, plan-orchestrator, or
  plan-unit-sequencer needs task-shape decisions
- **THEN** it uses the shared classifier
- **AND** lifecycle or validation heuristic tables are not duplicated in that
  skill script

### Requirement: Existing Bad Specs Block For User Direction

The system SHALL block existing OpenSpec changes with invalid task shape and ask
for user direction before redesign.

#### Scenario: OpenSpec audit blocks lifecycle phase

- **WHEN** `openspec-tasks` audits a `tasks.md` file with validation-only tasks,
  proof-only tasks, or lifecycle-phase groups
- **THEN** it returns `needs_spec_redesign`
- **AND** it lists the offending groups and tasks
- **AND** it does not rewrite `tasks.md`

#### Scenario: Planning review blocks invalid task shape

- **WHEN** `plan-review` prepares to publish or update an OpenSpec planning
  review
- **AND** the referenced `tasks.md` has task-shape violations
- **THEN** planning review blocks with `needs_spec_redesign`
- **AND** it does not create or update the hosted planning review artifact

#### Scenario: Sequencing blocks invalid task shape

- **WHEN** `plan-orchestrator` or `plan-unit-sequencer` prepares to select the
  next OpenSpec task for delivery
- **AND** the task list contains validation-only tasks, proof-only tasks, or
  lifecycle-phase groups
- **THEN** sequencing blocks with `needs_spec_redesign`
- **AND** `plan-unit-delivery` is not started

### Requirement: Local Workflow Artifacts Stay Private

The system SHALL prevent local workflow artifacts from being committed into
work-project repositories while allowing reusable workflow machinery in the AI
repo.

#### Scenario: Work-project artifact boundary

- **WHEN** an agent prepares work for a work-project repository
- **THEN** reviewer scratch, validation evidence, task-shape analysis, private
  manifests, command transcripts, planning ledgers, screenshots, and support
  artifacts are excluded from the repo diff

#### Scenario: AI repo reusable machinery is allowed

- **WHEN** the AI repo changes shared skills, rules, reviewer prompts,
  validators, or minimized regression fixtures for shared agent behavior
- **THEN** those reusable workflow artifacts may be committed in the AI repo
