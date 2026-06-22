## MODIFIED Requirements

### Requirement: Stack-Ready Completion
The system SHALL consider orchestration complete only when the full MR stack is
ready for merge.

#### Scenario: Atomic plan stack is ready
- **WHEN** a single plan has one planning MR and one implementation MR
- **AND** both MRs have passed latest-head Nitro gates
- **AND** the implementation MR is stacked on the planning MR
- **THEN** the workflow reports `stack_ready`

#### Scenario: OpenSpec stack is ready
- **WHEN** an OpenSpec change has one planning MR and one implementation MR per
  deliverable task
- **AND** every MR in stack order has passed latest-head Nitro gates
- **AND** stack-ready validation parses the stack-tip `tasks.md` and finds no
  unchecked deliverable tasks
- **AND** every checked deliverable task has a matching implementation artifact
  with selected task ID, implementation head SHA, predecessor evidence, and
  task-delta validation evidence
- **THEN** the workflow reports `stack_ready`

#### Scenario: Partial OpenSpec stack is not ready
- **WHEN** an OpenSpec stack has task `1.1` checked
- **AND** task `1.2` remains unchecked
- **THEN** stack-ready validation rejects the state
- **AND** the orchestrator does not mark the active goal complete
- **AND** the workflow continues with the next unchecked deliverable task or
  reports `delivery_blocked` with evidence

#### Scenario: Self-attested task completion does not pass
- **WHEN** a stack-ready report claims all deliverable tasks are checked
- **BUT** it does not provide concrete stack-tip `tasks.md` content or a path
  plus structured task-to-artifact evidence
- **THEN** stack-ready validation rejects the report

#### Scenario: Earlier MR changes after descendants exist
- **WHEN** an earlier MR changes after descendant MRs exist
- **THEN** affected descendants must be restacked
- **AND** every changed MR must rerun the full Nitro feedback gate before
  `stack_ready`

#### Scenario: Merge follow-through remains separate
- **WHEN** the workflow reports `stack_ready`
- **THEN** it does not merge the stack
- **AND** merge follow-through is handled by a separate workflow

### Requirement: Orchestrator Full-Stack Sequencing
The system SHALL make `plan-orchestrator` drive OpenSpec implementation through
the full stack of deliverable tasks.

#### Scenario: Orchestrator exposes delivery blocked terminal state
- **WHEN** `plan-orchestrator` cannot continue because required review,
  routing, stack, task, runtime, or resume evidence is missing or failed
- **THEN** `plan-orchestrator/SKILL.md` describes `delivery_blocked` as an
  orchestrator-level terminal state
- **AND** the workflow does not rely only on lower-level sequencer vocabulary
  for that status

#### Scenario: Orchestrator invokes sequencer in full-stack mode
- **WHEN** `plan-orchestrator` invokes `plan-unit-sequencer`
- **THEN** the sequencer receives caller context identifying
  `plan_orchestrator`
- **AND** the sequencer normalizes the delivery goal to full-stack delivery

#### Scenario: Direct next-task sequencing remains available
- **WHEN** `plan-unit-sequencer` is invoked directly
- **THEN** it may select a `next_task`, `bounded_sequence`, or
  `complete_change` goal according to direct user intent

#### Scenario: Orchestrator cannot terminate from next-task completion
- **WHEN** caller context is `plan_orchestrator`
- **AND** unchecked deliverable OpenSpec tasks remain
- **THEN** sequencer completion for one task is not terminal
- **AND** the orchestrator continues sequencing or reports `delivery_blocked`

#### Scenario: Unsupported host blocks before delivery loop
- **WHEN** the repository route cannot provide the required stack host, CI
  evidence, or Nitro feedback gate
- **THEN** `plan-orchestrator` reports `delivery_blocked` with routing evidence
- **AND** it does not fall back to direct publish

### Requirement: Planning Review Feedback Disposition
The system SHALL prove prior Nitro planning feedback is explicitly dispositioned
before implementation sequencing starts.

#### Scenario: Latest clean Nitro note is not enough
- **WHEN** a planning MR has a latest-head Nitro note with no new critical
  issues
- **AND** earlier Nitro planning comments or discussions exist
- **THEN** the planning-review gate requires a feedback disposition ledger
- **AND** the workflow does not start implementation sequencing from the latest
  clean note alone

#### Scenario: Prior planning feedback is dispositioned
- **WHEN** a planning MR has Nitro planning feedback from one or more review
  rounds
- **THEN** the planning-review ledger enumerates every Nitro-authored planning
  comment or discussion by note ID
- **AND** includes the discussion ID when the feedback belongs to a discussion
- **AND** records whether each discussion is resolvable and currently resolved
  in the artifact host
- **AND** records disposition as fixed in planning, deferred to a specific
  implementation task, non-actionable, or blocked
- **AND** records evidence for that disposition

#### Scenario: Unresolved planning discussion blocks without rationale
- **WHEN** a Nitro-authored planning discussion is resolvable and unresolved in
  GitLab
- **AND** the planning-review ledger does not provide fixed, deferred, or
  non-actionable rationale
- **THEN** the planning-review gate emits `delivery_blocked`
- **AND** implementation sequencing does not start

#### Scenario: Latest clean head plus dispositioned history is ready
- **WHEN** the latest planning head has clean Nitro feedback
- **AND** every prior Nitro planning comment or discussion has an explicit
  disposition with evidence
- **THEN** the planning-review gate may emit `ready_for_stack`

### Requirement: Resume Predecessor Verification
The system SHALL verify predecessor task artifacts before resuming a partially
delivered OpenSpec stack.

#### Scenario: Resume state is ready for next task
- **WHEN** every previously checked deliverable task has a matching
  implementation artifact in stack order
- **AND** each predecessor artifact has passed latest-head CI and Nitro gates
- **AND** each predecessor task delta is valid for exactly the selected task
- **AND** stack-tip `tasks.md` is cumulative
- **AND** no predecessor requires restack
- **THEN** resume validation emits `resume_ready`

#### Scenario: Resume state is blocked
- **WHEN** any checked predecessor task lacks a matching implementation
  artifact, valid task delta, passed gate, cumulative task state, or restack
  evidence
- **THEN** resume validation emits `delivery_blocked`
- **AND** the sequencer does not select the next unchecked task

#### Scenario: Session exhaustion is not success
- **WHEN** token budget, session lifetime, or handoff constraints stop the
  orchestrator before `stack_ready`
- **THEN** the workflow records durable resume evidence
- **AND** reports `delivery_blocked`
- **AND** does not mark the active goal complete
- **AND** the resume evidence classifies the halt as immediately retryable
  session exhaustion rather than an external blocker
- **AND** a retry can resume from the latest verified stack state without
  reclassifying unchanged predecessor gates as failed

### Requirement: One-Unit Delivery Evidence
The system SHALL expose enough evidence from each unit delivery for downstream
resume and stack-ready validation.

#### Scenario: Delivery evidence identifies selected task
- **WHEN** `plan-unit-delivery` finishes an OpenSpec task artifact
- **THEN** delivery evidence records selected task ID, selected task base SHA,
  predecessor artifact or base ref, implementation artifact URL or ref,
  implementation head SHA, task-delta validation evidence, CI evidence, Nitro
  evidence, and restack state

#### Scenario: Bookkeeping-only task completion is rejected
- **WHEN** a selected task checkbox is marked complete outside the
  implementation artifact that delivered the task
- **THEN** delivery or stack-ready validation rejects the evidence

### Requirement: Rule And Runtime Alignment
The system SHALL align shared instructions, runtime surfaces, and verification
with stacked Nitro-reviewed delivery.

#### Scenario: Direct-main rule is overridden for plan orchestration
- **WHEN** repo rules describe direct-main publication
- **THEN** they include an explicit exception for `plan-orchestrator` stacked
  delivery

#### Scenario: Adjacent planning skills align with full-stack orchestration
- **WHEN** `plan-ready` or `plan-review` describes handoff into implementation
  sequencing
- **THEN** their instructions and adapter prompts align with orchestrator-owned
  full-stack delivery
- **AND** they do not imply that one delivered OpenSpec task can complete a
  `plan-orchestrator` run

#### Scenario: Runtime refresh proves installed behavior
- **WHEN** shared plan workflow skills or instructions change
- **THEN** runtime skill update, status, and validation run for personal and
  work profiles
- **AND** instruction status and validation run when installed instructions
  changed
 
