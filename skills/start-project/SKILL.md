---
name: start-project
description: Use when starting, scoping, mapping, kicking off, or preparing a new effort before planning or implementation, especially when the user wants local-first context, a project brief, or tracker-ready intake.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Start Project

## Mode Boundary

This is a bounded Explore specialist. It is read-only for the entire turn and
does not create repository, tracker, or provider state. A later accepted mode
transition owns any resulting write.

## Overview

Map the local context for a new effort before planning starts. Return a
portable Project Brief in chat, then recommend one follow-up workflow.

This skill stops at intake. It does not create tickets, split work into issues,
write acceptance criteria, estimate effort, create branches, or start
implementation.

## Use Boundary

Use this skill when the user asks to start, scope, map, kick off, prepare, or
intake a new project or broad effort and the next useful step is understanding
the terrain.

Do not use it for:

- clear direct implementation requests with an obvious file or behavior target;
- active design discussion that should stay in `brainstorming`;
- already-approved plans ready for Plan or Execute;
- tracker breakdown work after context intake is already complete.

A single `$start-project` invocation never writes external state. It does not
create or update Linear projects, Linear issues, GitLab issues, GitHub issues,
Asana tasks, OpenSpec files, local plan files, branches, commits, PRs, or MRs.

If a prompt mixes intake with breakdown or storage, return the Project Brief
only and recommend the requested breakdown or storage as a later follow-up.
Phrases such as "if possible", "Linear-ready", "put it in Linear", "create
tickets", or "so the team can start tomorrow" are not storage permission inside
this skill.

The no-write boundary applies to the whole turn. Do not use `start-project` as
a context boundary and then call Linear, GitLab, GitHub, Asana, filesystem, or
planning tools to store, update, or create downstream artifacts in the same
response. If the user asks for both intake and a tracker update in one prompt,
return the Project Brief and say that tracker mutation requires a
separate follow-up after the intake result is accepted.

## Workflow

1. Classify the effort as single-repo, multi-repo, research-heavy,
   tracker-linked, or unclear.
2. Inspect local context read-only before asking broad questions: repo
   instructions, README files, docs, existing plans, package scripts,
   architecture-signaling files, and targeted search results.
3. Ask only for missing scope that cannot be discovered safely, usually the
   goal, repo or system boundary, and any known tracker links.
4. For multi-repo, large-repo, unfamiliar-domain, or explicitly requested work,
   optionally launch bounded read-only explorers. Ask each explorer for a short
   context report, not implementation tasks.
5. Return one Project Brief in chat.
6. Recommend exactly one follow-up route and stop.

## Project Brief

Use this structure by default:

```markdown
# <Effort Name> - Project Brief

## Goal
<one paragraph>

## Scope
### In
<bullets>

### Out
<bullets>

## Repos / Systems
| Name | Location | Role | Confidence |
| --- | --- | --- | --- |

## Current State
<what exists now based on read-only exploration>

## Key Interfaces
<entrypoints, commands, APIs, documents, workflows, or handoff surfaces>

## Constraints
<workflow, review, repo, runtime, compliance, or delivery constraints>

## Open Questions
<questions that need human or stakeholder decision>

## Load-Bearing Assumptions
<assumptions that would change later planning if wrong>

## Observed Risks
<risks discovered during intake, without mitigation plans>

## Recommended Follow-Up
<one next workflow and why>

## Tracker-Ready Summary
<short title and description suitable for copying to a tracker>
```

Remove empty sections only when they would be misleading. Keep the brief
portable Markdown so it can be pasted into a tracker or saved later.

## Hard Stops

Never include downstream breakdown or preview artifacts in the brief:

- Issues
- Tasks
- Milestones
- Workstreams
- Deliverables
- Backlog
- Delivery Arc
- Proposed First Milestone
- Implementation Plan
- Delivery Sequence
- Acceptance Criteria
- Issue Titles
- Estimates
- Assignees

If the user asks for any of these, say that breakdown belongs in the recommended
follow-up workflow and keep the brief at context-intake level.

Do not produce `linear_breakdown_preview`, issue-title lists, milestone
previews, OpenSpec task drafts, or implementation slice previews.

Observed risks are allowed when phrased as planning inputs. Do not add
mitigation plans unless the user starts a follow-up planning workflow.

## Follow-Up Routing

Recommend one route:

| Situation | Recommended follow-up |
| --- | --- |
| Requirements or tradeoffs need discussion | `brainstorming` |
| The effort needs specs or acceptance criteria before implementation planning | `openspec-propose` |
| The effort has a reviewed plan or accepted planning artifact | Plan or Execute, according to its readiness |
| The user wants Linear issues from the brief | `linear-breakdown` |
| The request is already narrow enough to code | direct implementation after an explicit implementation trigger |

Recommendation only means "next step." Do not invoke the route from this skill.
When the prompt contains several downstream writes, select the route that owns
the primary next outcome. State that every non-selected write remains deferred
to its own later authorized workflow; do not name extra routes merely to account
for every requested mutation.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Creating Linear issues because the user said "Linear-ready" | Return a Tracker-Ready Summary that can be copied later |
| Creating a Linear project because the user said "put it in Linear if possible" | Return the brief and name Linear storage as a separate follow-up workflow |
| "I used start-project for the context boundary, then Linear for the mutation" violates this skill | Stop after the brief; external mutation requires a separate follow-up turn |
| Renaming issue breakdown as workstreams, deliverables, backlog, or delivery arc | Remove it; use `Recommended Follow-Up` instead |
| Writing acceptance criteria in the brief | Record open questions and constraints instead |
| Treating observed risks as a mitigation plan | List risks as planning inputs only |
| Asking broad questions before reading the repo | Inspect local context first, then ask only what cannot be discovered |

## Verification Scenarios

The skill is working when these requests produce a Project Brief and preserve the
boundary:

- "Start this project and create tickets" returns the brief, then routes ticket
  creation to follow-up.
- "Make this Linear-ready" returns a copyable tracker summary and names Linear
  storage as a separate follow-up workflow.
- "Before continuing, use start-project to update the relevant Linear project"
  returns the brief and stops; it does not update Linear in the same turn.
- "Scope this new effort" means map new-effort context before planning, not a
  full design brainstorm.
- A small direct code request does not use this skill because intake is
  unnecessary.
