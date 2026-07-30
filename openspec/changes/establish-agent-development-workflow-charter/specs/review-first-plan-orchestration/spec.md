## MODIFIED Requirements

### Requirement: Nitro-Capable Hosted Route
The system SHALL require Nitro only when direct user, project, or workflow-policy profile selects it for the current GitLab artifact and SHALL start it through an explicit top-level request.

#### Scenario: Fullscript GitLab selects Nitro at 50 files or fewer
- **WHEN** a POC or final MR belongs to a Fullscript project whose policy requires Nitro and its effective diff contains at most 50 files
- **THEN** Finish posts a new top-level note containing only `/request_review @nitro`
- **AND** Nitro must pass for the latest pushed head

#### Scenario: Eligible large artifact selects Nitro
- **WHEN** a POC or removal-only MR contains more than 50 files and policy requires Nitro
- **THEN** Finish posts a new top-level note containing only `@nitro review`
- **AND** Nitro must pass for the latest pushed head

#### Scenario: GitHub route is selected
- **WHEN** the artifact host is GitHub
- **THEN** the workflow uses configured GitHub review, CI, and approval policy
- **AND** absence of Nitro does not block

#### Scenario: Generic GitLab route is selected
- **WHEN** the artifact host is non-Fullscript GitLab
- **THEN** the workflow uses that project's MR, CI, approval, and automated-review policy

#### Scenario: Provider policy is ambiguous
- **WHEN** host or required reviewer policy cannot be resolved
- **THEN** publication blocks with the routing gap
- **AND** completed local work remains valid for its exact state

### Requirement: Shared Nitro Feedback Gate
The system SHALL normalize and monitor Nitro feedback only for artifacts whose active policy requires Nitro and SHALL continue the repair loop through latest-head closure.

#### Scenario: Nitro readiness evidence is assembled
- **WHEN** Review evaluates the hosted Nitro gate
- **THEN** it derives the current head, effective diff count, request event, Nitro author identity, response chronology, and unresolved discussions from raw GitLab payloads
- **AND** MR-version evidence proves the request followed the transition to the exact current source head
- **AND** note and discussion evidence preserves contiguous provider page
  numbers and next-page metadata through the empty terminal value
- **AND** missing response separators and empty pagination header blocks remain
  distinct fail-closed evidence errors
- **AND** a self-authored normalized summary cannot satisfy hosted readiness

#### Scenario: Large-artifact request evidence is assembled
- **WHEN** a POC or removal-only MR contains more than 50 files
- **THEN** the raw note payload must contain the actual non-system authored `@nitro review` request with a nonempty requesting username
- **AND** a generic reviewer-request system event cannot satisfy the request gate

#### Scenario: Nitro response mixes reassurance with an action
- **WHEN** a Nitro response says there are no findings but also retains a concern, recommendation, or required change
- **THEN** the actionable language wins
- **AND** the gate remains blocked

#### Scenario: Nitro completion language fails closed
- **WHEN** a short Nitro completion is not composed entirely of complete standalone reassurance or neutral review-completion sentences
- **THEN** qualified, contrasting, malformed, or unknown completion text is actionable
- **AND** the gate remains blocked

#### Scenario: A structured Nitro review reports a clean verdict
- **WHEN** a Nitro completion contains a structured review with an explicit clean `Verdict`
- **THEN** deterministic receipt classification requires exactly one `Verdict` plus either a clean first `Verdict` sentence or Nitro's exact `No new findings survived verification` receipt heading, and no current feedback heading or severity marker
- **AND** Finish separately reads the complete response and unresolved discussions
- **AND** actionable feedback anywhere in the rich narrative remains blocking even when deterministic receipt classification passes
- **AND** technical readiness requires Finish's exact-head semantic-review evidence rather than accepting the deterministic receipt alone
- **AND** duplicate or malformed receipt structures fail closed

#### Scenario: A later Nitro response reopens a concern
- **WHEN** an earlier completion is clean and a later post-request Nitro response contains actionable language
- **THEN** the latest completion owns the receipt identity
- **AND** the gate remains blocked by the actionable response

#### Scenario: GitLab caps the changed-file count
- **WHEN** raw MR metadata reports `changes_count` as `1000+`
- **THEN** the workflow treats the artifact as above the 50-file request boundary without claiming an exact count
- **AND** only an eligible POC or removal-only MR may use the large-artifact Nitro route

#### Scenario: Older Nitro discussion remains unresolved
- **WHEN** a newer Nitro summary is clean but an older Nitro-authored actionable discussion is resolvable and unresolved
- **THEN** the discussion carries forward
- **AND** the gate remains blocked
- **AND** a non-resolvable historical `individual_note` summary does not independently count as an unresolved discussion
- **AND** actionable completion text after the latest request remains actionable even without an inline discussion

#### Scenario: Required Nitro does not start
- **WHEN** Nitro is required for the latest pushed head and does not acknowledge or start within project policy
- **THEN** the workflow reports the current blocked state and retries only under supported provider policy
- **AND** does not treat the artifact as approved

#### Scenario: Required Nitro is pending
- **WHEN** latest-head Nitro feedback is pending
- **THEN** Finish continues monitoring
- **AND** no duplicate request is posted for the same head and effective diff

#### Scenario: Required Nitro has findings
- **WHEN** Nitro returns actionable findings for the latest head
- **THEN** the owning Plan or Execute mode fixes all in-scope findings
- **AND** the next pushed head receives a new explicit Nitro request

#### Scenario: Nitro requires human judgment
- **WHEN** an actionable finding requires a material decision outside accepted authority
- **THEN** that MR blocks with the decision, evidence, options, and recommendation
- **AND** unrelated authorized work may continue

#### Scenario: Nitro feedback is stale
- **WHEN** required feedback belongs to an older source head
- **THEN** it does not satisfy the gate

#### Scenario: Required Nitro is clean
- **WHEN** Nitro completes latest-head review without unresolved actionable findings
- **THEN** the Nitro gate passes

#### Scenario: Nitro is not selected
- **WHEN** active policy does not require Nitro
- **THEN** the workflow relies on configured local review, hosted automation, approvals, and CI

### Requirement: Material Push Feedback Refresh
The system SHALL explicitly request each configured latest-head provider review after every source-head push.

#### Scenario: Feedback fix changes the head
- **WHEN** Plan or Execute pushes a feedback fix
- **THEN** Finish posts the configured review request for the new head
- **AND** monitors it through clean completion or a human-required decision

#### Scenario: Other source-head change occurs
- **WHEN** a head changes through conflict repair, pipeline repair, user edit, promotion restack, rebase, or spec/implementation correction
- **THEN** every latest-head-bound gate refreshes before readiness

#### Scenario: Only an unpromoted descendant target moves
- **WHEN** an ancestor push changes the target branch of a descendant without changing that descendant source head
- **THEN** the workflow does not request Nitro or restack the descendant
- **AND** its prior readiness evidence remains provisional until promotion

#### Scenario: Provider has no latest-head automated reviewer
- **WHEN** active policy configures no hosted automated reviewer
- **THEN** remaining approvals and CI apply
- **AND** local Review remains required

### Requirement: Stack-Ready Completion
The system SHALL report planned delivery ready only when the POC and every promoted artifact derived from the reviewed delivery shape satisfy current gates.

#### Scenario: Atomic plan is ready
- **WHEN** its one final MR passes required local review, provider review, CI, and applicable Linear policy
- **THEN** Finish reports merge readiness for that exact head

#### Scenario: OpenSpec stack is ready
- **WHEN** the POC is accepted, reconciled, closed under user authority, every final delivery-unit MR passes current promoted local/provider/CI gates, task/spec state is complete, dependencies are valid, and required Linear mappings are current
- **THEN** Finish reports `stack_ready`

#### Scenario: OpenSpec has one delivery unit
- **WHEN** its POC is accepted and closed under user authority and its one final MR passes every current gate
- **THEN** Finish reports merge readiness for that MR without manufacturing a multi-MR stack

#### Scenario: Earlier open unit changes
- **WHEN** an earlier delivery-unit head changes after dependent MRs exist
- **THEN** descendants remain unrestacked
- **AND** their gates remain provisional rather than triggering automatic propagation

#### Scenario: Predecessor squash-merges
- **WHEN** a predecessor merges as a squash commit
- **THEN** only its immediate child retargets and restacks onto the verified merged commit
- **AND** the changed child refreshes required gates before its merge

#### Scenario: Task evidence is incomplete
- **WHEN** a reconciled task is unchecked or a completed task lacks implementation and verification evidence
- **THEN** stack readiness is blocked

#### Scenario: Finish lacks merge authority
- **WHEN** every readiness gate passes without explicit merge authority
- **THEN** Finish reports readiness and does not merge

#### Scenario: Merge is authorized
- **WHEN** the user explicitly authorizes merge
- **THEN** Finish merges final artifacts in dependency order after current checks, approvals, and remote identity pass
- **AND** verifies remote merged state
