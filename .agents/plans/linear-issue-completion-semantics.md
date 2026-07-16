# Linear Issue Completion Semantics In GitLab MR Bodies

## Goal

Make GitLab merge request descriptions express whether each relevant Linear
issue is completed by the MR or only related to it. The common path is one
issue completed by one MR, so a full-scope MR should normally publish
`Closes PAD-123`; partial delivery should publish `Related to PAD-123`.

## Motivation

A plain Linear URL can attach an MR to an issue without giving the relationship
completion semantics. Linear's current GitLab integration recognizes closing
magic words such as `Closes` and contributing words such as `Related to` in the
MR description. Without that distinction, a merged MR can leave a completed
issue open or a broad rule can close an issue prematurely.

Reference: [Linear GitLab integration](https://linear.app/docs/gitlab).

## Decisions

- `change-request-create` remains the canonical owner of MR body meaning and
  chooses the Linear relationship statement before provider mutation. Its
  task-local handoff includes the expected issue key and relationship alongside
  the approved title and body, or explicitly records that there is no relevant
  Linear issue. This expectation is workflow evidence, not a new persisted
  schema.
  [confidence: 0.98 - certain | reason: the current skill explicitly owns title
  and body policy]
- `glab-mr-create` remains a mechanics-only adapter. It compares the approved
  GitLab body with the task-local relationship expectation before mutation and
  verifies the same statement through the existing hosted-body readback
  boundary; it does not reclassify the issue or silently rewrite the body.
  [confidence: 0.97 - certain | reason: the current adapter consumes the
  approved body unchanged]
- A relevant Linear issue is one established by the accepted task context,
  plan, or explicit user direction. A URL, branch name, title, or incidental
  mention may identify a candidate, but does not by itself prove completion.
  [confidence: 0.94 - certain | reason: this preserves the agreed no-guessing
  boundary]
- Use a closing statement for every relevant issue that the MR independently
  completes. Use a contributing statement for every relevant issue that the MR
  advances but does not independently complete. Mixed relationships are
  classified per issue. [confidence: 0.96 - certain | reason: this is the
  accepted behavior and matches Linear's documented semantics]
- When a clearly relevant issue exists but completion intent is ambiguous,
  publication pauses for clarification. When no relevant Linear issue exists,
  the body adds no Linear relationship statement or new Tracking section, while
  preserving any existing template-owned or manual Tracking content.
  [confidence: 0.95 - certain | reason: this prevents both accidental closure
  and invented tracking]
- Existing description updates preserve manual content, links, checklist
  state, and protected template sections under the current managed-update
  contract. [confidence: 0.96 - certain | reason: this is existing
  change-request-create policy]

## Domain Terms

| Term | Meaning |
| --- | --- |
| Relevant issue | A Linear issue established as part of the accepted delivery context. |
| Closing relationship | The MR independently satisfies the issue's accepted scope; render with `Closes <issue-key>`. |
| Contributing relationship | The MR advances but does not independently satisfy the issue; render with `Related to <issue-key>`. |
| Completion status | The status selected by the Linear team's MR and branch workflow automation; it is not assumed to be literally named `Done`. |

## Scope

### In Scope

- Extend the host-neutral description-policy owner with GitLab/Linear
  relationship classification and a concise Tracking-section contract.
- Extend the GitLab adapter with fail-closed enforcement and hosted-body
  readback expectations for the approved task-local relationship handoff.
- Add deterministic regression coverage for ownership, closing, contributing,
  ambiguous, absent, multiple, and mixed issue relationships.
- Apply `writing-skills` RED-GREEN-REFACTOR testing to the changed agent
  behavior before committing.

### Out Of Scope

- Updating Linear issue status directly through the API.
- Creating a new Linear issue for this skill change.
- Changing GitHub PR behavior or generalizing a new provider abstraction.
- Inferring completion solely from issue links, branch names, MR titles, or
  commit messages.
- Changing Linear workspace workflow or target-branch automation.
- Repairing previously merged MRs or manually completing their associated
  issues.

## Reuse And Deviation Contract

The implementation reuses the existing ownership boundary:

- `change-request-create` authors and approves reviewer-facing title and body
  content;
- its task-local handoff carries the expected Linear issue relationships or an
  explicit no-issue result without creating persistent workflow state;
- `glab-mr-create` performs GitLab publication mechanics, verifies those
  expectations, and consumes the approved body unchanged; and
- the existing hosted-body readback protects manual content and confirms the
  published description.

The closest provider precedent is `github-pr-create`, which already warns that
closing keywords carry completion intent. This change moves the actual intent
decision into the canonical description-policy owner and adds GitLab/Linear
enforcement in the GitLab adapter. No new runtime service, parser framework, or
provider-neutral abstraction is introduced. [confidence: 0.96 - certain |
reason: repository inspection identified the existing owners and direct
precedent]

## Atomic Implementation Unit

Deliver one coherent change set containing the plan, the two aligned skill
contracts, and their regression coverage. It has one reviewer boundary, one
rollback path, and one visible behavior change, so it uses one atomic plan and
one final GitLab MR with no POC phase. [confidence: 0.95 - certain | reason: no
durable cross-component contract, migration, or independent delivery unit is
required]

The implementation sequence follows skill TDD:

1. Establish RED behavior with realistic MR-authoring scenarios against the
   current skills and capture the exact failure or rationalization.
2. Add the minimum description-policy and GitLab-adapter guidance needed to
   produce the agreed relationship semantics.
3. Re-run the same scenarios for GREEN behavior, then close and retest any
   newly observed loopholes.
4. Add deterministic repository regression coverage for the durable contract
   and validate the complete shared-skill surface.

## Acceptance Criteria

- A full-scope GitLab MR associated with one Linear issue contains a
  `## Tracking` section with the exact plain statement `Closes PAD-123`.
- A partial, POC, or stacked delivery that does not independently complete the
  issue contains a `## Tracking` section with the exact plain statement
  `Related to PAD-123`.
- Multiple or mixed relevant issues receive the correct relationship per
  issue as one plain relationship statement per issue; one issue's completion
  does not force the same classification onto the others.
- A plain Linear URL or bare issue key is not treated as proof of closing
  intent.
- A clearly relevant issue with ambiguous delivery scope blocks publication
  for clarification.
- Work with no relevant Linear issue adds no Linear relationship statement or
  new Tracking section and preserves existing template-owned or manual
  Tracking content.
- `change-request-create` owns relationship selection and body construction;
  its task-local handoff identifies the expected relationships; and
  `glab-mr-create` consumes the approved body unchanged while failing closed
  when that body does not match the handoff before or after publication.
- Existing MR updates preserve author-owned and manual body content.
- The skill text remains concise and uses consistent terms for closing and
  contributing relationships.

## First Real Confirmation

A fresh agent using the changed skills receives an accepted single-issue
GitLab delivery and produces an approved body plus task-local handoff whose
Tracking section contains the exact visible statement `Closes PAD-123`. A
paired partial-delivery scenario produces `Related to PAD-123`, and a
deterministic adapter fixture rejects a body whose statement does not match the
handoff before mutation or hosted-body readback. This is the earliest real
confirmation without creating a fake Linear issue or publishing a false
relationship. [confidence: 0.96 - certain | reason: it exercises the real
skill entrypoint and both adapter enforcement boundaries]

## Verification Strategy

- Run at least three behavioral evaluations: independent issue completion,
  partial or stacked delivery under pressure to close, and ambiguous or mixed
  issue context.
- Preserve RED evidence from the pre-change skills, then run the same scenarios
  against the changed skills for GREEN and bounded REFACTOR closure.
- Run the focused change-request skill contract tests, repository skill
  validation, and the repository's full automated test suite.
- Keep feature-branch runtime testing isolated from the live AX runtime. Live
  runtime convergence remains post-merge work from a clean `main` worktree.

## Risks And Controls

| Risk | Control |
| --- | --- |
| A broad default closes umbrella or partially delivered issues | Require independent completion; otherwise use `Related to`. |
| The adapter mutates centrally approved content | Keep classification in `change-request-create` and enforcement-only behavior in `glab-mr-create`. |
| The adapter cannot tell omission from an intentional no-issue body | Carry the selected relationships or an explicit no-issue result in the task-local handoff and compare it before mutation and after readback. |
| A link or branch name is mistaken for intent | Treat those values as candidates and require accepted delivery context. |
| Template updates damage manual content | Reuse managed-section preservation and hosted-body readback. |
| An explicit no-issue result collides with an existing Tracking section | Forbid only invented Linear statements or sections and preserve template-owned or manual Tracking content. |
| Skill prose passes static tests but agents still omit the keyword | Require RED-GREEN-REFACTOR behavioral scenarios through `writing-skills`. |
| Linear does not move an issue to the expected named status | Describe closing intent accurately and leave team/branch status automation out of scope. |

## Rollback

Revert the relationship-policy guidance and focused regression coverage as one
change set. Because the change adds no persistent data, migration, provider
configuration, or runtime service, rollback returns MR body authoring to the
previous behavior. If the merged change was already synced to the live runtime,
resync the clean reverted `main` source and validate the managed profiles.

## Delivery Policy

The plan and implementation ship together in one draft GitLab MR targeting
`main`. Publication includes normal repository hooks, configured CI, Nitro
review, and exact-head local Review. Technical readiness leaves the MR draft;
merge and post-merge live runtime sync require explicit merge authority.
