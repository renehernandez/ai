## ADDED Requirements

### Requirement: Finish And Check-Only Modes
The system SHALL treat `$merge-followthrough` as finish-mode permission for one
active MR or PR unless the user provides check-only wording.

#### Scenario: Single active artifact enters finish mode
- **WHEN** the user invokes `$merge-followthrough` for one active MR or PR
- **AND** the prompt does not include check-only wording
- **THEN** the skill treats the invocation as permission to merge or queue after
  required gates are acceptable

#### Scenario: Metadata work keeps finish mode
- **WHEN** the user asks for metadata work and invokes `$merge-followthrough`
- **AND** the prompt does not include check-only wording
- **THEN** the skill completes the metadata work
- **AND** continues to merge or queue after required gates are acceptable

#### Scenario: Check-only wording blocks merge
- **WHEN** the user asks to watch, inspect, report status, update only, see
  where this is, or not merge yet
- **THEN** the skill uses check-only mode
- **AND** it does not merge or queue the artifact

#### Scenario: Deployment is explicit only
- **WHEN** the user invokes `$merge-followthrough` without explicit deployment
  verification requirements
- **THEN** the skill does not require deployment verification as a default
  finish gate

### Requirement: Stack Merge Scope And Order
The system SHALL merge stacks only when stack-wide permission is explicit or
freshly validated from current stack-ready workflow evidence.

#### Scenario: Single artifact does not widen to stack
- **WHEN** the user invokes `$merge-followthrough` for one active MR or PR
- **AND** related MRs or PRs exist
- **AND** the user did not ask for stack-wide merge
- **THEN** the skill limits finish mode to the active artifact

#### Scenario: Stack-ready evidence is current
- **WHEN** a workflow artifact is used as stack-wide merge permission
- **THEN** the skill verifies current MR or PR IDs, head SHAs, source and
  target branches, open/non-draft state, required reviews, required CI graph,
  and intended order before merging the stack

#### Scenario: Stack merges bottom-to-top
- **WHEN** stack-wide permission is valid
- **THEN** the skill merges or queues the stack bottom-to-top
- **AND** refreshes each downstream item after its predecessor lands

#### Scenario: Ambiguous stack order blocks merge
- **WHEN** stack metadata is unavailable, broken, or ambiguous
- **AND** hosted relationships do not prove a clear order
- **THEN** the skill asks for the intended order before merging the stack

### Requirement: Guarded Branch Cleanup
The system SHALL clean up source branches only after remote merged state and
branch safety checks prove deletion will not discard user work or break open
artifacts.

#### Scenario: Safe branch cleanup proceeds
- **WHEN** the MR or PR is confirmed merged
- **AND** the source branch is not default or protected
- **AND** the branch is not checked out in any worktree
- **AND** the branch has no unmerged or unpushed commits
- **AND** no open MR or PR still references it as source or target/base
- **THEN** the skill may delete the local and remote source branch

#### Scenario: Cleanup waits for downstream retargeting
- **WHEN** a merged stack item has downstream artifacts
- **AND** an open downstream MR or PR still references the branch
- **THEN** the skill defers cleanup or reports the exact dependency

#### Scenario: Unsafe cleanup is reported
- **WHEN** any cleanup guard fails
- **THEN** the skill reports the branch and reason
- **AND** it does not force branch deletion

### Requirement: Default-Branch CI Graph Completion
The system SHALL require the required default-branch CI graph for the merged
commit or resulting default-branch head to succeed before reporting finish-mode
completion.

#### Scenario: Required CI graph succeeds
- **WHEN** an MR or PR is merged
- **AND** the required default-branch CI graph succeeds for the merge commit or
  resulting default-branch head
- **THEN** the skill may report the merge finish path complete

#### Scenario: Downstream CI is required proof
- **WHEN** the host exposes child or downstream pipelines as part of the
  required CI proof
- **THEN** the skill includes them in the default-branch CI graph result

#### Scenario: Missing default-branch CI is a verification gap
- **WHEN** no default-branch pipeline or check graph is created after the
  10-minute polling window
- **THEN** the skill reports a verification gap
- **AND** it does not claim the workflow is fully done

#### Scenario: Default-branch CI graph polling window expires
- **WHEN** the host does not immediately expose the default-branch CI graph
- **THEN** the skill polls every 1 minute for up to 10 minutes
- **AND** reports a verification gap if no graph is created by the end of that
  window

#### Scenario: Stack stops on default-branch CI problem
- **WHEN** a stack merge leaves default-branch CI failed, blocked, or missing
- **THEN** the skill stops subsequent stack merges
- **AND** it resumes only after the default branch is healthy and the user asks
  to continue

### Requirement: Fix-Forward Boundaries
The system SHALL allow fix-forward MR or PR creation after post-merge
default-branch CI failure only for evidence-backed branch-caused failures above
the confidence threshold, and SHALL never merge the fix-forward artifact
automatically.

#### Scenario: High-confidence fix-forward is proposed
- **WHEN** default-branch CI fails after merge
- **AND** the failure is evidence-backed branch-caused
- **AND** diagnosis and fix confidence are above 0.90 under the repo confidence
  framework
- **THEN** the skill may create a fix-forward branch, commit, push, and MR or PR
  through the repo's normal delivery route

#### Scenario: Fix-forward confidence is evidence-backed
- **WHEN** the skill reports fix-forward confidence above 0.90
- **THEN** the report identifies the failing default-branch job or check
- **AND** explains why the failure is caused by the merged change instead of
  infrastructure or unrelated changes
- **AND** identifies the minimal fix
- **AND** includes local or hosted verification for that fix when available

#### Scenario: Nitro is requested for fix-forward
- **WHEN** a fix-forward artifact is created in a Nitro-gated repo
- **THEN** the skill requests Nitro review for that artifact

#### Scenario: Fix-forward is never auto-merged
- **WHEN** a fix-forward artifact exists
- **THEN** the skill may watch CI and review state
- **AND** it must not merge that artifact automatically

#### Scenario: Lower-confidence fix stops for human review
- **WHEN** default-branch CI fails after merge
- **AND** diagnosis or fix confidence is 0.90 or lower
- **THEN** the skill reports the diagnosis, likely fix, and confidence rationale
- **AND** it does not create a fix-forward artifact automatically
