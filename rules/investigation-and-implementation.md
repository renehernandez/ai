# Investigation and Implementation Rules

These rules govern when to diagnose, when to edit, and how to route implementation work.

## Troubleshooting and Investigation

- When the user is troubleshooting, investigating, or debugging an issue, do not take action such as committing, pushing, editing files, or running fixes before presenting findings and asking how to proceed.
- Troubleshooting mode means analyze, diagnose, and report, then wait for the user's decision before acting.
- This applies even when the fix seems obvious.

## Brainstorming and Design Sessions

- When the user wants to brainstorm, design, or think through a problem, always use the `/brainstorm` skill.
- Do not load the lower-level `brainstorming` skill directly for these requests.
- This applies in plan mode and normal mode.

## Code Implementation

- When the user asks to implement, fix, build, or apply changes across multiple files, delegate to the `implementer` agent when that harness supports agent delegation.
- This applies whether or not a `plan.md` file exists.
- For trivial single-file edits, inline execution is acceptable.
- If already running as the implementer agent, execute the approved plan instead of re-delegating.
- For feature implementation work, follow [feature-delivery.md](feature-delivery.md) through PR creation and CI follow-through unless the user explicitly asks to stop earlier.
- Do not commit or push non-feature implementation work unless the user explicitly asks or the approved plan requires it.

## Local Code Review

- When the user asks to review local changes, review their changes, review the working tree, or self-review, delegate to the `local-review` agent.
- If local-review tooling is unavailable, report that limitation and perform the best available local review without pretending an agent ran.

## Compound Step

- Invoke the `/compound` skill at the end of substantive implementation, troubleshooting, brainstorming, or design work when non-obvious learnings should be captured.
- Also invoke `/compound` at the end of a substantive session when the user says they are done, such as `that's it`, `thanks`, `wrap up`, or `done for now`.
- Keep the compound step brief.
- Skip it when the work was trivial, such as a single typo fix or small config tweak, or when no non-obvious learning was produced.
- Respect the user's request to skip compound.
