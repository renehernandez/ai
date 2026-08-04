---
name: explore
description: Use when discovering, researching, comparing, brainstorming, testing assumptions, mapping a project, or clarifying requirements before planning or implementation.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Explore

## Authority

Explore is the read-only lifecycle mode defined by `AGENTS.md` and
`rules/investigation-and-implementation.md`. Announce the mode, read-only
authority, and goal once for non-trivial work. Do not write repository,
planning, tracker, or provider state. Explicit lifecycle wording overrides
inferred routing.

Specialists invoked here remain bounded read-only specialists. They do not gain
lifecycle authority or carry a write request past this turn.

## Routing

1. Inspect available repository and external evidence before asking questions
   that evidence can answer.
2. For a new substantive outcome, use `brainstorming` by default—even when the
   opening request says to fix, implement, change, or build. It owns the visible
   Orientation Map, divergent discussion, and convergence boundary.
3. For new-effort intake, scoping, mapping, or kickoff, use `start-project`. It
   owns the complete Project Brief and stops before planning or issue breakdown.
4. Honor an explicitly named, compatible read-only specialist instead of
   replacing it with generic exploration.
5. For an explicitly requested retrospective, reusable learning, or solution
   note, inspect completed-work evidence and clarify the non-obvious reader
   outcome here. Route accepted document authoring to `doc-smith`; do not create
   an automatic post-task mode or mutate the system merely because work ended.
6. Otherwise orient the user with the objective, observed facts, material
   options, assumptions, and no more than three decision-relevant questions.

Research, security discovery, and project-health techniques may provide
evidence inside Explore. Apply only their declared judgment and output contract.

## Output and Escalation

Return evidence, uncertainty, options, and the recommended next decision in
chat. Separate observed facts from working assumptions and unsettled choices.

When the problem is coherent enough for a durable artifact, propose `Plan` and
state why. Do not create a placeholder plan while waiting for Plan authority.
If later research materially reopens the problem, return to Explore before the
planning artifact is revised.
