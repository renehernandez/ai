---
name: start-project
description: Use when starting, scoping, mapping, kicking off, or preparing a new effort before planning or implementation, especially when the user wants local-first context, a project brief, or tracker-ready intake.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Start Project

## Boundary

Start Project is a bounded Explore specialist for new-effort intake. It is
read-only for the whole invocation and does not create tasks, issues, or tracker
records. It also does not write plans, specs, branches, commits, PRs, or MRs.
Downstream storage or implementation requires the lifecycle or specialist that
owns that later outcome.

Use it when the useful first result is a map of a new, broad, unfamiliar, or
multi-system effort. Do not use it for a narrow code change, active design
discussion already owned by `brainstorming`, an accepted plan, or issue
breakdown after intake is complete.

## Workflow

1. Classify the effort as single-repository, multi-repository, research-heavy,
   tracker-linked, or unclear.
2. Inspect local instructions, entrypoints, documentation, existing plans,
   architecture signals, and targeted search results before asking broad
   questions.
3. Ask only for material scope that cannot be discovered safely, such as the
   intended outcome, system boundary, or known tracker context.
4. For large or unfamiliar scope, bounded read-only explorers may return short
   context reports. Do not delegate implementation.
5. Synthesize one Project Brief in chat, recommend exactly one follow-up route,
   and stop.

## Project Brief

Use this complete portable structure. Remove an empty section only when keeping
it would be misleading.

```markdown
# <Effort Name> - Project Brief

## Goal
<desired outcome>

## Scope
### In
<included boundaries>

### Out
<excluded boundaries>

## Repos / Systems
| Name | Location | Role | Confidence |
| --- | --- | --- | --- |

## Current State
<evidence-backed description of what exists>

## Key Interfaces
<entrypoints, commands, APIs, documents, workflows, or handoffs>

## Constraints
<workflow, review, repository, runtime, compliance, or delivery constraints>

## Open Questions
<material decisions still requiring people or stakeholders>

## Load-Bearing Assumptions
<assumptions that would change later planning if false>

## Observed Risks
<risks discovered during intake, without designing mitigations>

## Recommended Follow-Up
<one next workflow and why>

## Tracker-Ready Summary
<copyable title and description with the problem, outcome, success signals,
dependencies, and next planning step>
```

The brief describes context, boundaries, and planning inputs. Keep downstream
breakdown out of it: no tasks, issues, milestones, acceptance criteria,
estimates, assignees, implementation slices, or disguised equivalents.
“Linear-ready” means the summary is copyable; it is not provider-write
authority. If the prompt also requests storage or breakdown, return the brief
and route that one next outcome without performing it.

## Follow-Up Routing

Choose exactly one route based on the primary unresolved outcome:

| Need | Route |
| --- | --- |
| Requirements or tradeoffs remain open | `brainstorming` |
| A durable cross-component specification is needed | `openspec-propose` |
| An accepted planning artifact is ready | Plan or Execute, according to its authority |
| The accepted brief should become Linear issues | `linear-breakdown` |
| The request has become a narrow code change | explicit implementation transition |

The route is a recommendation, not an invocation. Leave every other requested
write deferred to its own later authorized workflow.
