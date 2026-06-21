## ADDED Requirements

### Requirement: Single Stacked Delivery Mode
The system SHALL use stacked delivery as the only implementation mode for
review-first plan orchestration.

#### Scenario: Planning review mode is stacked delivery
- **WHEN** `plan-review` emits `planning_review`
- **THEN** `planning_review.mode` is `stacked_delivery`
- **AND** `planning_review.gate_outcome` is `ready_for_stack`
- **AND** `stack_base_ref` and `stack_base_evidence` are present

#### Scenario: Legacy delivery modes are rejected
- **WHEN** a plan workflow input or handoff uses `ship_then_continue` or
  `stack_when_ready`
- **THEN** the workflow rejects it as legacy
- **AND** it does not start implementation sequencing

#### Scenario: Direct publish is unsupported for orchestrated delivery
- **WHEN** an orchestrated plan workflow routes an implementation artifact
- **THEN** `direct_publish` is rejected
- **AND** the workflow requires a stacked PR or MR artifact

### Requirement: Nitro-Capable Hosted Route
The system SHALL require a Nitro-capable Fullscript GitLab MR route for the
first stacked-delivery cut.

#### Scenario: Fullscript GitLab route is supported
- **WHEN** the planning or implementation artifact is a Fullscript GitLab MR
- **THEN** the workflow may request Nitro feedback with `/request_review @nitro`

#### Scenario: Unsupported host blocks routing
- **WHEN** the artifact host is GitHub, non-Fullscript GitLab, or ambiguous
- **THEN** the workflow reports `nitro_route_unsupported`
- **AND** it does not substitute Codex or another feedback provider

### Requirement: Shared Nitro Feedback Gate
The system SHALL normalize Nitro feedback through a shared
`nitro_feedback_gate` before planning review, unit delivery, or stack-ready
completion can pass.

#### Scenario: Nitro start timeout blocks progress
- **WHEN** Nitro feedback is requested for the latest MR head
- **AND** Nitro does not acknowledge or start review within 10 minutes while
  polling every 1 minute
- **THEN** the workflow reports `nitro_review_start_blocked`
- **AND** it does not advance to the next MR

#### Scenario: Nitro pending does not pass completion
- **WHEN** Nitro feedback status is `pending`
- **THEN** the workflow records review-start evidence
- **AND** reports `nitro_review_completion_pending`
- **AND** does not advance to the next MR

#### Scenario: Latest-head Nitro findings block advancement
- **WHEN** Nitro returns findings for the latest MR head
- **THEN** the workflow reports `nitro_feedback_unresolved`
- **AND** requires the findings to be fixed or documented as non-actionable
- **AND** requires fresh Nitro feedback after the next material head-changing
  push

#### Scenario: Stale Nitro feedback does not satisfy the gate
- **WHEN** Nitro feedback belongs to an older MR head
- **THEN** the workflow reports `nitro_feedback_stale`
- **AND** requires fresh latest-head Nitro feedback before advancement

#### Scenario: Clean Nitro feedback passes
- **WHEN** Nitro completes latest-head review with no unresolved actionable
  findings
- **THEN** the shared gate outcome is `passed`

### Requirement: Material Push Feedback Refresh
The system SHALL request fresh Nitro feedback after every material
head-changing push in the plan workflow.

#### Scenario: Feedback-fix push refreshes Nitro
- **WHEN** an agent pushes changes to address Nitro feedback
- **THEN** it requests fresh Nitro feedback for the new head
- **AND** waits for the shared Nitro gate to pass

#### Scenario: Non-feedback material push refreshes Nitro
- **WHEN** an MR head changes because of restack, conflict fix, pipeline fix,
  user edit, rebase, or plan/documentation feedback fix
- **THEN** the workflow requests fresh Nitro feedback for the new head
- **AND** waits for the shared Nitro gate to pass

### Requirement: Stack Identity Evidence
The system SHALL carry stack identity evidence through planning and delivery
handoffs.

#### Scenario: Planning handoff records stack base
- **WHEN** planning review completes
- **THEN** the handoff records expected stack base ref and SHA
- **AND** records stack-base evidence from the Nitro-clean planning MR

#### Scenario: Implementation handoff records predecessor
- **WHEN** an implementation MR is created or updated
- **THEN** the delivery evidence records predecessor MR, expected base ref/SHA,
  implementation MR URL, implementation head SHA, and restack-required state

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
- **AND** the stack tip `tasks.md` has all deliverable tasks checked
- **THEN** the workflow reports `stack_ready`

#### Scenario: Earlier MR changes after descendants exist
- **WHEN** an earlier MR changes after descendant MRs exist
- **THEN** affected descendants must be restacked
- **AND** every changed MR must rerun the full Nitro feedback gate before
  `stack_ready`

#### Scenario: Merge follow-through remains separate
- **WHEN** the workflow reports `stack_ready`
- **THEN** it does not merge the stack
- **AND** merge follow-through is handled by a separate workflow

### Requirement: Rule And Runtime Alignment
The system SHALL align shared instructions, runtime surfaces, and verification
with stacked Nitro-reviewed delivery.

#### Scenario: Direct-main rule is overridden for plan orchestration
- **WHEN** repo rules describe direct-main publication
- **THEN** they include an explicit exception for `plan-orchestrator` stacked
  delivery

#### Scenario: Runtime refresh proves installed behavior
- **WHEN** shared plan workflow skills or instructions change
- **THEN** runtime skill update, status, and validation run for personal and
  work profiles
- **AND** instruction status and validation run when installed instructions
  changed
