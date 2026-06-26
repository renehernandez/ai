# Latest Message Scope Gate

## Goal

Prevent agents from carrying implementation momentum past the user's latest
message when that message is only an observation, correction, question, or
diagnostic fact. The agent should distinguish what the user directly said from
the broader action it infers, then ask before taking high-blast-radius action.

## Motivation

In the review-action migration thread, the user observed that a pod did not have
the `nitro/action=review` label. The agent inferred that label work needed to be
moved earlier in the MR stack and proceeded with restacking. The diagnosis was
plausible, but the action crossed a scope boundary: a narrow diagnostic
observation became approval for stack surgery.

The durable behavior should preserve useful implementation followthrough while
blocking broad inferred actions unless the user confirms the scope jump.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Latest message scope gate | A check that reclassifies the user's newest message before carrying prior implementation momentum forward. |
| Diagnostic observation | A message that supplies evidence or a correction, such as "the pod does not have this label", without asking for a fix. |
| Accepted implementation work | A direct request or workflow step that asks the agent to implement, fix, build, apply changes, or deliver review-feedback changes. This existing state does not automatically authorize every later inferred scope expansion. |
| High-blast-radius action | A change that can affect branch topology, hosted review state, runtime behavior, CI/release gates, shared infrastructure, or delivery-unit boundaries. |

## Scope

### In Scope

- Update `rules/investigation-and-implementation.md` with a latest-message
  scope gate for accepted implementation work.
- Add concrete examples of high-blast-radius actions, including restacking,
  rebasing multiple MRs, force-pushing, moving work between MRs or delivery
  units, closing or reopening hosted review artifacts, rewriting OpenSpecs or
  plans, changing required CI/release behavior, mutating shared infrastructure,
  and assigning reviewers or agents.
- Update the quick operating rules in `AGENTS.md` and `instructions/AGENTS.md`
  so agents see the boundary before following deeper linked rules.
- Preserve ordinary implementation followthrough after explicit delivery
  requests.
- Require the agent to state what the latest user message directly establishes,
  what broader action it infers, why that action may be useful, and the exact
  action it wants to take before asking for confirmation.
- Run `writing-skills` review for the changed agent behavior before committing.
- Run explicit validation for the changed instruction/rule surface:
  `pnpm ax instructions validate --profile personal`,
  `pnpm ax instructions validate --profile work`, and `pnpm test:unit`.

### Out Of Scope

- Adding runtime hooks, command blockers, or automated enforcement.
- Changing `plan-orchestrator`, `plan-ready`, `plan-review`, or stacked-diff
  implementation logic.
- Changing Nitro, GitLab, or work-project repositories.
- Requiring confirmation for every small inferred code edit during accepted
  implementation work.
- Blocking normal feature-branch commit, push, MR update, CI inspection, or
  reviewer followthrough that the user or workflow already approved.
- Performing a live runtime refresh unless explicitly requested during
  implementation.

## Desired Behavior

During accepted implementation work, the agent should reclassify every new user
message before acting. If the latest user message only supplies evidence, asks a
question, or corrects a detail, and the next inferred action has broad blast
radius, the agent should pause.

Before acting, the agent should say:

1. What the user's message directly establishes.
2. What broader action it infers.
3. Why that broader action may be useful.
4. The exact action it proposes to take.

Then it should ask for confirmation.

Example compliant response:

```text
The pod evidence only confirms that this review environment does not have
nitro/action=review.

My inference is that the label implementation lives later in the stack, so this
MR cannot yet be the earliest valid e2e proof point. Moving that work earlier
would require restacking downstream MRs.

Do you want me to move the label work earlier and restack the affected MRs, or
should I only document that this MR is not yet the right test point?
```

## Implementation Tasks

- [ ] 1. Update the central scope gate rule
  - Add a "Latest Message Scope Gate" section to
    `rules/investigation-and-implementation.md`.
  - Acceptance: The rule explicitly applies during accepted implementation work
    and states that prior delivery approval does not turn a later diagnostic
    observation, correction, or question into approval for broader changes.
  - Acceptance: The rule lists concrete high-blast-radius examples.
  - Acceptance: The rule requires the agent to state direct evidence, inferred
    broader change, rationale, proposed action, and confirmation request before
    acting.
  - Acceptance: The rule makes rollback straightforward by limiting the central
    behavior change to instruction text, with no runtime hook or command
    enforcement.
  - Verification: Read the updated rule and confirm it preserves normal
    accepted implementation followthrough for low-blast-radius actions.
  - Verification: Run `writing-skills` against the changed agent behavior
    before committing, because this deliverable changes shared instruction
    behavior.

- [ ] 2. Align the instruction entrypoints
  - Add concise quick-rule wording to `AGENTS.md`.
  - Add the same concise quick-rule wording to `instructions/AGENTS.md`.
  - Acceptance: Both entrypoints route agents to pause before broad scope jumps
    from narrow latest-message evidence.
  - Acceptance: The wording is concise and does not duplicate the full central
    rule.
  - Verification: Compare the entrypoints against the central rule and confirm
    they do not conflict with the existing implementation followthrough
    defaults.
  - Verification: Confirm the implementation diff is limited to the central
    rule, the two instruction entrypoints, and the reviewed plan artifact; if
    runtime refresh is not explicitly requested, confirm the implementation
    does not update installed runtime state.
  - Verification: Confirm rollback would be a straight revert of the
    instruction/rule edits, with no data, runtime, or hosted-review artifact
    cleanup required.
  - Verification: Run `pnpm ax instructions validate --profile personal`.
  - Verification: Run `pnpm ax instructions validate --profile work`.
  - Verification: Run `pnpm test:unit`.
  - Verification: Record exact commands and outcomes in the implementation
    handoff or MR description.

## Risks

| Risk | Mitigation |
| --- | --- |
| Agents become too hesitant during implementation | Scope the pause only to broad inferred actions from narrow latest-message evidence. |
| Examples become stale | Keep examples illustrative and anchored by a general high-blast-radius definition. |
| Quick rules drift from central rules | Keep detailed policy in `rules/investigation-and-implementation.md` and entrypoints as concise pointers. |
| Runtime behavior is assumed live after source edits | Treat runtime refresh as out of scope unless explicitly requested and validate installed surfaces only when refresh is intended. |

## Recommended Route

This is an atomic plan: one user-visible behavior change, one ownership area
around shared agent instructions and rules, one verification story, and no
required sequencing across multiple delivery MRs.
