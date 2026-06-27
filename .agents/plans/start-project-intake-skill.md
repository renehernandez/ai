# Start Project Intake Skill

## Goal

Create a shared `start-project` skill that helps agents begin a new effort by
mapping the local context first and returning a portable Project Context Pack in
chat.

The skill should make the first move for broad work consistent: inspect before
planning, summarize the terrain, surface open questions and assumptions, then
recommend the next workflow. It must not decompose the work into issues, tasks,
milestones, delivery slices, or implementation sequencing.

## Motivation

New efforts often start with a fuzzy goal and scattered context across repos,
docs, prior discussion, or a project-management tool. Emmanuel Regimbald's
`begin-project` skill in `devops/daedalus/skills` shows a useful pattern:
read-only exploration before planning, incremental synthesis, and a durable
context handoff.

This repo already has its own downstream planning and delivery workflows:
`brainstorming`, OpenSpec, `plan-orchestrator`, `plan-ready`, and the
plan-unit delivery skills. `start-project` should feed those workflows rather
than replace them.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Project | The user-visible effort being started. It does not imply a Linear Project. |
| Project Context Pack | A portable Markdown briefing produced by `start-project` in chat. |
| Storage target | A place the pack may later be copied or saved, such as Linear, GitLab, GitHub, Asana, OpenSpec, or a local plan file. |
| Follow-up workflow | The next skill or process recommended after intake, usually `brainstorming`, OpenSpec, or `plan-orchestrator`. |

## Scope

### In Scope

- Add a new shared skill at `skills/start-project/SKILL.md`.
- Add `skills/start-project/agents/openai.yaml` so the skill has installed UI
  metadata consistent with other shared skills.
- Teach local-first read-only intake for new efforts.
- Produce a chat-first Project Context Pack that can be pasted into Linear,
  GitLab, GitHub, Asana, OpenSpec, or a local markdown artifact later.
- Support optional read-only subagent exploration for multi-repo or large-repo
  efforts when the active harness allows it.
- Route the user to the next workflow without invoking that workflow.
- Validate the new skill with the repo's skill validation path and
  `writing-skills` pressure scenarios.

### Out Of Scope

- Writing to Linear, GitLab, GitHub, Asana, OpenSpec, or local plan files by
  default.
- Creating issues, tasks, tickets, milestones, implementation slices, or
  delivery sequences.
- Defining acceptance criteria, estimates, assignees, branches, MRs, PRs, or
  rollout plans.
- Editing application code.
- Replacing `brainstorming`, `plan-orchestrator`, OpenSpec, or any tracker
  breakdown workflow.
- Creating a new OpenSpec change for this skill-only delivery unless the
  implementation work later grows beyond one atomic shared-skill change.

## Desired Skill Behavior

`start-project` should activate when the user asks to start, kick off, scope,
map, or prepare a new effort before planning or implementation begins. It should
not activate for ordinary direct implementation requests that already have a
clear target.

The workflow should be:

1. Classify the effort from the user's prompt: single-repo, multi-repo,
   research-heavy, tracker-linked, or unclear.
2. Ask only for missing scope that cannot be discovered safely, usually goal,
   repo/system scope, and any known tracker links.
3. Inspect relevant local context read-only: repository instructions, README,
   existing docs, package scripts, architecture-signaling files, and targeted
   search results.
4. For multi-repo or large-repo work, optionally use read-only explorers with a
   bounded prompt and a short report budget.
5. Return a Project Context Pack in chat.
6. Recommend exactly one follow-up route, such as `brainstorming`,
   `openspec-propose`, `plan-orchestrator`, or direct implementation after a
   later explicit implementation trigger.

The skill should stop after returning the pack and follow-up recommendation.

## Project Context Pack Contract

The default output should be Markdown in chat:

```markdown
# <Effort Name> - Project Context Pack

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

The pack must not contain `Issues`, `Tasks`, `Milestones`,
`Implementation Plan`, `Delivery Sequence`, `Acceptance Criteria`, estimates,
or assignees.

## Atomic Implementation Unit

Deliver the `start-project` shared skill as one atomic change: skill source,
installed UI metadata, validation coverage, and any README/index update needed
for discoverability.

The first real confirmation is a pressure scenario where an agent receives a
new-effort prompt and returns a Project Context Pack while refusing to break the
work into issues or implementation tasks.

## Acceptance Criteria

- `skills/start-project/SKILL.md` exists with concise frontmatter and a clear
  trigger boundary for new-effort intake.
- The skill description anchors words such as "scope" and "map" to
  new-effort intake before planning, so it does not displace normal
  `brainstorming` for design discussion.
- The skill defaults to read-only local exploration and chat output.
- The skill's output contract is the Project Context Pack and explicitly
  excludes issue/task breakdown, acceptance criteria, estimates, delivery
  sequencing, and tracker writes.
- The skill recommends a follow-up workflow without invoking it.
- Optional storage targets are described as copy/save destinations only after
  the pack exists.
- Optional subagent exploration is constrained to read-only mapping and only
  used when useful for multi-repo, large-repo, unfamiliar-domain, or explicitly
  requested work.
- `skills/start-project/agents/openai.yaml` matches the skill metadata.
- `agents/openai.yaml` includes the expected `interface.display_name`,
  `interface.short_description`, and `interface.default_prompt` fields.
- The shared skills README or index is updated if this repo's current
  discoverability pattern requires it.
- `writing-skills` validation includes RED/GREEN pressure scenarios proving the
  no-breakdown boundary.

## Verification

Minimum verification for implementation:

```bash
pnpm ax skills validate --profile personal
pnpm ax skills validate --profile work
pnpm test
```

Skill-specific validation should include pressure scenarios:

1. New multi-repo effort prompt: the agent maps repos and returns a pack without
   creating issues or tasks.
2. User asks "start this project and create tickets": the agent produces the
   pack and routes ticket creation to a follow-up workflow instead of doing it.
3. User asks for Linear storage: the agent asks for or uses explicit storage
   permission and keeps the stored content identical to the pack.
4. Small direct implementation request: the skill does not trigger or routes
   away because intake is unnecessary.

If implementation changes installed skill state, also run:

```bash
pnpm ax skills update --profile personal
pnpm ax skills update --profile work
pnpm ax skills status --profile personal
pnpm ax skills status --profile work
```

## Risks And Controls

| Risk | Control |
| --- | --- |
| The skill turns into a project-management workflow | Hard-code the no-breakdown boundary and route issue/task creation to follow-up workflows. |
| The pack becomes too generic to help later planning | Require current-state, key-interface, constraints, assumptions, and observed-risk sections. |
| The skill duplicates `brainstorming` | Stop at context intake; decisions and breakdown belong to `brainstorming` or later planning. |
| The skill writes external state unexpectedly | Chat output is default; storage requires explicit user request. |
| Subagent exploration creates context noise | Keep explorer prompts bounded and require short structured reports. |
| Skill ships untested | Use `writing-skills` RED/GREEN pressure scenarios before delivery. |

## Rollback

If the implemented skill behaves poorly, revert the `skills/start-project/**`
source and any related discoverability metadata. If installed runtime profiles
were refreshed, rerun the relevant `pnpm ax skills update --profile <name>`
after the revert so installed copies return to the previous managed source
state.

## Recommended Delivery Route

This appears atomic: one shared-skill outcome, one ownership area, one
verification story, and no required multi-PR sequencing. Use `plan-ready` to
confirm atomic readiness before implementation.
