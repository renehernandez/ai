---
name: explore
description: Use when discovering, researching, comparing, brainstorming, testing assumptions, mapping a project, or clarifying requirements before planning or implementation.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Explore

## Authority

Explore is read-only. For non-trivial work, announce `Explore`, read-only
authority, and the goal once. Explicit `Explore` or `Explore-only` wording wins
over inferred later modes.

Do not create or edit repository files, planning artifacts, tracker records,
branches, commits, PRs, or MRs. A request to explore under time pressure does
not make an artifact or cleanup "obvious."

## Workflow

1. Inspect relevant repository and external context before asking questions the
   available evidence can answer.
2. Invoke `brainstorming` for divergent design, requirements, feature shaping,
   or rough ideas that need its map-first contract. Do not substitute a
   condensed free-form brainstorm.
3. Invoke `start-project` for new-effort intake, scoping, mapping, or kickoff so
   it returns the complete Project Brief and preserves its whole-turn no-write
   boundary.
4. Otherwise return a compact orientation map: objective, known facts, domain
   terms, options, recommended defaults, and at most three material questions.
5. Test assumptions and separate settled decisions from open ones.
6. End with evidence, options, decisions, or open questions in chat.
7. If convergence needs a durable artifact, propose `Plan` and wait for that
   authority unless the same prompt already authorizes a later mode.

If research reopens the problem space during Plan, resume Explore without
writing a placeholder artifact.

## Project Intake

For start, scope, map, or kick-off requests, use `start-project`. It returns a
Project Brief in chat with goal, scope, systems, current state, interfaces,
constraints, assumptions, risks, open questions, and one recommended next mode.
It includes a tracker-ready title and description containing the problem or
opportunity, desired outcome, success signals, dependencies, and planning step.

Linear-ready means copyable text. It does not authorize tracker discovery or
mutation.

## Bounded Specialists

Read-only research, security discovery, project health, and similar specialists
may support Explore. Their declared authority stays bounded; they do not become
additional lifecycle modes or grant writes.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Writing a plan because discussion is converging | Propose Plan and wait for artifact-write authority. |
| Creating a temporary plan that will become OpenSpec | Keep the exploration in chat; Plan chooses exactly one artifact later. |
| Starting "obvious cleanup" while decisions remain open | Report the candidate cleanup without editing. |
| Creating Linear state from intake | Return the Linear-ready description only. |
| Reimplementing the brainstorming map inside Explore | Invoke `brainstorming` and follow its complete contract. |
| Shortening new-effort intake to an ad hoc summary | Invoke `start-project` and return the Project Brief. |
