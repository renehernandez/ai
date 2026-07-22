# Linear Start-Work Ownership

## Objective

Make Linear ownership explicit when the authenticated user starts work on an
issue, while preserving another human's existing ownership.

## Approach

Extend the canonical Linear rules with one start-work decision contract:

- assign an unassigned issue to the authenticated Linear user;
- continue when that user is already the assignee;
- stop and request instructions when another user is the assignee;
- when the issue belongs to a project with no lead, assign the authenticated
  user as lead only when that user created the project; and
- preserve every existing project lead.

Treat the permitted issue-assignee and conditional project-lead changes as part
of the authorized start-work lifecycle transition. Re-read the issue and
project before mutation, apply only the eligible ownership fields, and verify
both records afterward.

## Decisions and Constraints

- “Authenticated user” means the current Linear identity, not a hard-coded
  person.
- An assignee conflict blocks repository work until the user resolves ownership.
- Project creation alone does not claim leadership; the conditional lead change
  occurs only when starting work on an issue in that project.
- An issue without a project still follows the assignee rules and skips only
  the project-lead branch.
- Unavailable project lead or creator metadata skips and reports the conditional
  lead update without blocking an otherwise verified issue assignment.
- Finish owns this bounded pre-implementation step solely because it owns
  provider writes; the step does not enter terminal Finish work.
- The accepted start-work policy confirms the eligible scalar assignee and
  project-lead writes without confirming other provider actions.
- Automated-agent delegation remains separately gated by explicit user
  confirmation.
- This is one atomic rule-and-test change with no Linear provider mutation.

## Reuse and Deviation Contract

Reuse `rules/git-and-review.md` as the canonical owner of Linear assignment and
status policy, `skills/linearis/SKILL.md` for provider read/write verification,
and the existing agent-instruction unit suite for executable contract coverage.
No new lifecycle owner, provider adapter, or source of truth is introduced. The
only deviation from current behavior is the explicit start-work ownership
transition accepted above.

## Delivery and Proof

Deliver the plan, rule, and focused contract tests in one draft GitLab MR.

First real confirmation: run the agent-instruction unit test and behavioral
GREEN scenarios against the updated rule. Success means an agent assigns an
unassigned issue to the authenticated user, preserves self-assignment, stops on
another assignee, conditionally claims a creator-owned leadless project, and
preserves an existing lead.
