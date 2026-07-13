# First-Prompt Explore Default

## Goal

Make every new substantive task begin with a read-only Explore pass that uses
`brainstorming` by default, even when the opening prompt says to fix,
implement, or change something, unless the user explicitly names another
lifecycle mode. Preserve a low-friction later transition into Plan or Execute
after the user has seen the exploration and explicitly says to proceed.

## Context

The five-mode lifecycle currently defines Explore as read-only and Direct
Execute as eligible when one coherent MR can deliver the outcome without
material unresolved decisions. That readiness test does not first establish
whether the user intended the opening prompt to authorize mutation. As a
result, an agent can narrow an initial request until Direct Execute appears
safe instead of treating the prompt as the beginning of a working
conversation.

The restored `brainstorming` specialist has a strong map-first interaction
contract, but its default flow converges toward v1, a thin implementation
slice, earliest objective proof, and artifact routing. Those delivery-oriented
sections are valuable after the user invites convergence; applying them during
the opening pass can prematurely turn exploration into implementation
scoping.

## Accepted Decisions

### Gate every new substantive task through Explore

- A new substantive task begins in Explore and performs no repository,
  tracker, or provider mutation.
- Opening imperatives such as "fix", "implement", "change", or "build",
  specificity, urgency, and a proposed solution do not independently authorize
  mutation.
- `brainstorming` is the default Explore specialist for a new substantive
  change request. An explicitly named lifecycle mode or bounded read-only
  specialist overrides inferred routing.
- Requests that explicitly match the existing new-effort intake contract
  continue to use `start-project`; this change does not collapse specialized
  read-only intake or review into generic brainstorming.
- A materially different request starts a new task boundary and resets to
  Explore, including while the prior task is in Execute or Finish.
- Answers to active brainstorming questions, refinements within the accepted
  problem, review feedback, and CI failures inside an already authorized
  delivery do not create a new task boundary by themselves.

### Separate authority from readiness

The lifecycle router evaluates two questions in order:

1. **Authority:** Has the user seen the initial exploration and explicitly
   authorized a later mutation turn?
2. **Readiness:** After authority exists, do material behavior, architecture,
   migration, safety, ownership, ordering, cross-component, or verification
   decisions remain?

A later instruction such as "proceed", "implement this", or "make the
changes" supplies mutation authority for the accepted task. Plan owns the
transition when material decisions remain; otherwise Direct Execute is
eligible. The initial Explore pass may recommend that the task is ready for
Execute without asking a question, but it must wait for that later authority.

### Open the problem space before converging

The first brainstorming pass:

- inspects repository context and precedent;
- frames the intended outcome, motivation, current constraints, adjacent
  opportunities, and plausible alternative framings;
- treats evidence-backed recommendations as working hypotheses;
- names consequential assumptions without converting them into accepted scope;
  and
- asks no question when the inspected evidence makes the direction
  unambiguous.

V1 selection, thin-slice optimization, implementation slices, earliest
objective proof, artifact routing, and implementation-ready convergence remain
dormant during the opening pass. A later request to narrow, plan, implement,
identify v1, or prepare delivery activates them. Once convergence is invited,
the existing reuse, anti-overengineering, slice, and objective-proof contracts
apply unchanged.

Agreement accepts only the recommendation currently being discussed. It does
not silently accept unstated downstream scope or every recommendation in the
opening map.

## Domain Terms

| Term | Meaning |
| --- | --- |
| New substantive task | A new thread or a materially different requested outcome that would require non-trivial investigation, design, planning, implementation, review, or provider work. |
| Opening Explore gate | The mandatory read-only first pass for a new substantive task before inferred mutation authority can exist. |
| Working hypothesis | An evidence-backed recommendation offered to focus discussion without establishing final scope or delivery authority. |
| Mutation authority | Explicit later permission to create or change repository, tracker, or provider state for the explored task. |
| Readiness | The semantic test that selects Plan or Direct Execute after mutation authority exists. |
| Convergence invitation | A request to narrow, choose v1, plan, implement, or prepare delivery, which activates the brainstorming skill's delivery-oriented guidance. |

Simple self-contained questions and trivial conversational requests are not
substantive lifecycle work. Explicit mode wording continues to override
inference.

## Reuse And Deviation Contract

### Inspected precedents and canonical owners

- `instructions/AGENTS.md` and `AGENTS.md` own the portable and repo-local
  five-mode entrypoint wording.
- `rules/investigation-and-implementation.md` owns semantic routing, mutation
  authority, and transitions between Explore, Plan, and Execute.
- `skills/explore/SKILL.md` owns read-only Explore orchestration and routes
  divergent design to `brainstorming`.
- `skills/brainstorming/SKILL.md` owns the map-first interaction, discussion,
  convergence, slicing, and artifact-routing contracts.
- `tests/unit/agent-instructions.test.ts`,
  `tests/unit/brainstorming-skill.test.ts`, and
  `tests/integration/mode-lifecycle.test.ts` own the current static and
  cross-mode behavioral assertions.
- `.agents/plans/latest-message-scope-gate.md` contains an unimplemented,
  narrower precedent for reclassifying a later user message before carrying
  implementation momentum forward.
- `.agents/plans/restore-specialist-leverage.md` is the accepted precedent for
  keeping lifecycle authority in the five modes while restoring detailed
  behavior to bounded specialists.

### Direct reuse and extension

- Extend the existing five-mode entrypoints and central routing rule; do not
  add a sixth lifecycle mode or a separate authority router.
- Extend Explore's current `brainstorming` delegation instead of copying the
  specialist's map into the mode skill.
- Preserve the brainstorming skill's precedent scan, domain terms, short
  discussion queue, hard stops, reuse order, and delivery-stage objective-proof
  rules.
- Reuse the latest-message plan's task-boundary insight, generalized from
  high-blast-radius implementation actions to any materially different user
  request.

### New mechanisms and justified deviations

- Add an initial authority gate before the existing semantic readiness test.
  No current rule makes that ordering explicit.
- Add a task-boundary reset for materially different requests. This is broader
  and simpler than the latest-message plan's high-blast-radius confirmation
  checklist because the accepted design requires renewed exploration, not only
  confirmation before a large mutation.
- Split brainstorming into opening and convergence phases. This changes the
  current always-converge flow so v1 and implementation guidance cannot narrow
  the first pass.
- Remove `.agents/plans/latest-message-scope-gate.md` when implementation folds
  its still-relevant boundary into this plan, leaving one primary unimplemented
  contract for this behavior. Git history preserves the superseded artifact.

No runtime hook, command blocker, state database, new skill, schema, dependency,
or provider integration is required.

## Scope

### In Scope

- Add concise initial-Explore language to `AGENTS.md` and
  `instructions/AGENTS.md`.
- Define the detailed task-boundary, authority, reset, and later-transition
  contract in `rules/investigation-and-implementation.md`.
- Make `skills/explore/SKILL.md` default new substantive change requests to
  `brainstorming`, while preserving explicit mode and specialist routing.
- Preserve `start-project` for matching new-effort intake and preserve other
  explicitly selected read-only specialists.
- Refactor `skills/brainstorming/SKILL.md` into opening and convergence phases.
- Update `skills/brainstorming/agents/openai.yaml` so its default prompt leads
  with open-problem-space exploration and activates delivery shaping only when
  invited.
- Add focused unit and integration scenarios for first prompts, later
  authority, task resets, specific agreement, and dormant delivery guidance.
- Delete the superseded `.agents/plans/latest-message-scope-gate.md` during
  implementation.
- Run `writing-skills` and the repository's focused instruction, skill, and
  lifecycle verification before commit.

### Out Of Scope

- Changing the five lifecycle modes or giving `brainstorming` mutation
  authority.
- Requiring a question, a fixed response length, or a full orientation table
  for every small opening pass.
- Changing review-feedback or CI-fix followthrough inside an already accepted
  delivery task.
- Changing Plan's atomic-plan/OpenSpec selection, Execute ownership, Review
  gates, Finish publication behavior, or merge/deployment authority.
- Adding a runtime enforcement hook or automatically classifying task
  boundaries in code.
- Updating dependencies, manifests, or lockfiles.
- Running live `ax sync` from the feature branch. Live convergence remains a
  post-merge action from a clean durable `main`.

## Implementation Tasks

### 1. Establish the initial Explore authority gate

Update the portable and repo-local entrypoints, central investigation rule,
Explore skill, and instruction/lifecycle tests.

Acceptance:

- A new substantive task defaults to read-only Explore and `brainstorming`
  even when the opening prompt uses implementation verbs.
- Explicit lifecycle-mode wording remains an override.
- Matching new-effort intake still routes to `start-project`; an explicitly
  selected read-only specialist retains its bounded contract.
- A materially different outcome resets an active Plan, Execute, or Finish
  task to Explore.
- A same-task refinement, review finding, or CI failure retains the accepted
  mode and followthrough authority.
- The opening pass can report `ready for Execute` but cannot mutate until a
  later explicit transition.
- A later `proceed` routes by semantic readiness: unresolved material decisions
  enter Plan; a settled single-MR change may enter Direct Execute.
- Entry points stay concise and point to the central rule instead of duplicating
  its full decision contract.

First real confirmation:

- A focused lifecycle scenario supplies `Fix the authentication timeout` as a
  new task and proves the expected mode is Explore, mutation is forbidden, and
  `brainstorming` is the default specialist.
- Paired scenarios prove that a later `Proceed with the accepted approach`
  may enter Plan or Execute, while `Also redesign the authorization model`
  during Execute resets to Explore.

Verification:

- `pnpm exec node --import tsx --test tests/unit/agent-instructions.test.ts`
- `pnpm exec node --import tsx --test tests/integration/mode-lifecycle.test.ts`
- Inspect the entrypoints against the central rule and confirm they preserve
  explicit-mode overrides and accepted delivery followthrough.

### 2. Separate opening brainstorming from delivery convergence

Update the brainstorming source, OpenAI metadata, focused tests, and superseded
plan artifact.

Acceptance:

- The opening map explores motivation, intended outcome, existing context,
  alternative framings, assumptions, precedent, and a working recommendation.
- Opening recommendations are labeled working hypotheses and do not establish
  v1 or implementation scope.
- Agreement accepts the discussed recommendation only.
- The skill may omit a question when the direction is unambiguous.
- V1, thin-slice, implementation slices, earliest proof, and artifact routing
  activate only after an explicit convergence invitation.
- Once activated, the existing reuse-first, anti-overengineering, and earliest
  objective-proof requirements still pass their focused assertions.
- `.agents/plans/latest-message-scope-gate.md` is removed as superseded, with
  its relevant reset behavior represented in this primary plan and central
  rule.

Verification:

- `pnpm exec node --import tsx --test tests/unit/brainstorming-skill.test.ts`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm run biome:lint-format:staged`
- `pnpm run skills:validate`
- `pnpm ax instructions validate`
- `pnpm ax skills validate`
- `pnpm ax validate`
- Run `writing-skills` against scenarios covering opening `fix` and
  `implement` prompts, a later `proceed`, a mid-Execute topic change, specific
  agreement, an unambiguous no-question pass, and a user-invited v1 narrowing.
- Inspect the final diff and confirm no runtime target, manifest, lockfile,
  dependency, tracker, or provider state changed.

## Acceptance Summary

- Initial prompts establish context and intent through Explore; they do not
  grant inferred mutation authority.
- Brainstorming opens the problem space before attempting to narrow the fix.
- The user can transition with ordinary later language such as `proceed`
  without ceremonial mode syntax.
- Materially different requests restart exploration instead of inheriting
  implementation momentum.
- Delivery-oriented brainstorming guidance remains available and unchanged in
  force once the user invites convergence.
- The behavior is portable across both installed profiles and supported by
  focused source-level and pressure-scenario evidence.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Agents become ceremonially slow on obvious work | Permit a brief opening pass, no mandatory question, and an immediate `ready for Execute` recommendation while retaining the no-write boundary. |
| Explicit requests stop working | Preserve explicit lifecycle-mode overrides and treat ordinary later `proceed` language as sufficient authority. |
| Agents restart Explore on every follow-up | Define task boundaries by a materially different outcome and preserve same-task feedback, CI, and refinement followthrough. |
| Brainstorming becomes directionless | Keep evidence-backed working recommendations, precedent discovery, domain terms, and the short discussion queue. |
| Delivery safeguards disappear | Gate v1 and slice guidance by convergence invitation; do not weaken the reuse, safety, or earliest-proof rules after activation. |
| Entry points and skills drift | Keep detailed authority in the central rule, interaction detail in `brainstorming`, concise pointers in entrypoints, and assertions across all owners. |
| Source changes are mistaken for live runtime convergence | Validate source/profile contracts only on the branch; perform live `ax sync` after merge from clean durable `main`. |

Rollback is a straight revert of the instruction, rule, skill, metadata, test,
and plan-artifact changes. It requires no data migration, runtime cleanup, or
provider rollback.

## Delivery And Policy

- **Artifact:** atomic plan.
- **Delivery:** this plan and its implementation form one change set in one
  final draft GitLab MR targeting `main`.
- **POC:** none; the change is one coherent instruction/skill unit and requires
  no durable cross-component contract, migration, or rehearsal.
- **Ownership:** one Execute owner continues in
  `/Users/rene.hernandez/.codex/worktrees/99be/ai` on
  `codex/first-prompt-explore-default`.
- **Integration hotspots:** `AGENTS.md`, `instructions/AGENTS.md`,
  `rules/investigation-and-implementation.md`, `skills/explore/SKILL.md`, and
  `skills/brainstorming/SKILL.md`.
- **Linear policy:** `disabled` by direct user instruction for this change. No
  Linear issue is created or updated.
- **Merge, deployment, cleanup, and live runtime sync:** not authorized by this
  plan or by implementation wording.

## Execute Handoff

Execute receives this reviewed artifact, branch
`codex/first-prompt-explore-default`, worktree
`/Users/rene.hernandez/.codex/worktrees/99be/ai`, and target `main`. Implement
Tasks 1 and 2 cohesively in this single branch. Recheck `main` and the hosted
branch state before publication. If implementation discovers a material change
to the accepted authority gate, explicit-mode override, task-boundary reset,
or convergence trigger, stop and return to Plan instead of silently widening
the contract.
