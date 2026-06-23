# Research Auto-Dispatch Plan

## Objective

Change the shared `research` skill from a routing-only skill into a thin
research dispatcher. When a user asks to research a topic without naming a
specific research skill, `research` should choose the appropriate research area
and proceed with that area skill's research brief contract. Explicit
route-only requests should still return only a routing decision.

## Background

The current `research` contract says to stop after emitting `research_routing`.
That matched the original `research-router` behavior, but it is surprising now
that the skill is named `research`. In a real thread, a user asked the skill to
research technical options and proceed, and the skill only returned next-step
instructions instead of running the technical research lane.

The agreed behavior is:

- `research` means "perform the appropriate research" by default.
- Route-only behavior remains available for explicit routing or classification
  requests.
- Auto-dispatch is bounded to the research family:
  `research -> research-technical | research-content`.
- `research` does not auto-run downstream skills such as `brainstorming`,
  `plan-ready`, `doc-smith`, or `presentations`.
- No compatibility behavior is needed for old `research-router` invocations.

## Scope

In scope:

- Update `skills/research/SKILL.md` so default research requests run the
  selected area skill instead of stopping at `research_routing`.
- Update `skills/research/agents/openai.yaml` so the default prompt reflects
  auto-dispatch rather than routing-only output.
- Update focused research skill tests to prove the new default and preserve the
  explicit route-only path.
- Update the research skill family plan documentation so it no longer describes
  `research` as only a router.
- Run the repo-required `writing-skills` validation/review against the changed
  shared skill behavior and adapter prompt before treating the implementation
  as shippable.
- Refresh installed skills after implementation and validate both managed
  profiles.

Out of scope:

- Do not add compatibility behavior for retired `research-router` invocations.
- Do not make `research` a general workflow orchestrator.
- Do not auto-run `brainstorming`, `plan-ready`, `doc-smith`, or
  `presentations` after a research brief.
- Do not add new research area skills.
- Do not change `research-technical` or `research-content` brief schemas. If
  implementation uncovers a required area-skill schema change, stop and revise
  or split the work.
- Do not change AX configuration, managed profile definitions, dependency
  configuration, or retired-skill behavior. `ax.lock.json` changes are allowed
  only when they are the direct result of refreshing installed skill runtime
  metadata after the implementation.
- Do not broadly rewrite the historical research skill family plan. Update only
  the current contract text affected by `research` auto-dispatch.
- Do not update historical followthrough records unless they are presented as
  current guidance. If search finds router-only language there, explicitly
  classify it as historical or leave it untouched.

## Required Behavior

For a normal research request:

1. Decide whether the primary lane is `research-technical` or
   `research-content`.
2. Load and apply the selected area skill contract.
3. Return that selected area skill's `research_brief` as the final answer.
   Do not merely name the selected skill or return a next-step routing
   instruction.
4. Stop after the selected research brief.
5. Name the recommended next skill in the brief's decision readiness section
   when the user asks for a later brainstorm, plan, document, or presentation.

For a request where research is unnecessary:

1. Preserve the existing `research_routing.status: unnecessary` behavior.
2. Do not gather sources.
3. Recommend the better downstream skill or next action.

For an explicit route-only request:

1. Return the existing `research_routing` shape.
2. Do not gather sources.
3. Do not run an area skill.
4. Treat examples such as "route this", "classify this research request",
   "which research skill should I use?", and "route only" as route-only
   language.

For mixed technical-plus-content requests:

1. Choose one primary lane.
2. Preserve the deferred lane through `secondary_skill` in route-only output or
   equivalent deferred-lane language in the research brief.
3. Do not run both area skills.

For ambiguous primary intent:

1. Ask one clarifying question.
2. Do not run both area skills.

## Acceptance Criteria

- A technical research request through `research` is documented and tested as
  proceeding to the `research-technical` brief contract.
- A content research request through `research` is documented and tested as
  proceeding to the `research-content` brief contract.
- Explicit route-only language is documented and tested as returning only
  `research_routing`.
- Existing `research_routing.status: unnecessary` behavior is documented and
  tested so requests with enough supplied source material or no external
  grounding do not force source gathering.
- Mixed technical-plus-content requests still choose one primary lane and
  record or mention the deferred lane instead of running both.
- Requests that say "research then brainstorm" produce a research brief with
  `brainstorming` as the recommended next skill, without performing the
  brainstorm.
- `research-router` is not reintroduced as an alias, compatibility mode, or
  installed skill.

## Expected File Areas

- `skills/research/SKILL.md`
- `skills/research/agents/openai.yaml`
- `tests/unit/research-skills.test.ts`
- `docs/plans/research-skill-family.md`
- `ax.lock.json` after runtime refresh

## Documentation Alignment

Update `docs/plans/research-skill-family.md` wherever it currently describes
`research` as routing-only current behavior:

- workflow narrative such as "`research` classifies and hands off";
- the Research Contract and router-output sections;
- default-prompt requirements that say prompts must preserve router-only
  behavior;
- implementation-slice acceptance criteria that only prove route selection;
- runtime verification text that refers to personal-only refresh or
  `agent-runtime.lock.json`.

The updated documentation should name both managed profiles where runtime
refresh is required and should refer to tracked `ax.lock.json` when lockfile
metadata changes.

## Verification

- `writing-skills` review or validation against the changed shared skill
  behavior, including the adapter prompt, retrieval semantics, default
  auto-dispatch behavior, route-only escape hatch, and unnecessary-research
  path
- `pnpm test:unit`
- `pnpm exec tsx tests/unit/ax-cli.test.ts` if runtime retirement or install
  behavior changes
- `pnpm ax skills update --profile personal`
- `pnpm ax skills update --profile work`
- `pnpm ax skills status --profile personal`
- `pnpm ax skills status --profile work`
- `pnpm ax skills validate --profile personal`
- `pnpm ax skills validate --profile work`
- Inspect `git diff -- ax.lock.json` after runtime refresh and confirm changes
  are limited to expected `research` content hash and managed local skill
  metadata changes, with no unrelated remote-skill, profile, dependency, or
  retirement drift.
- `pnpm test`
- `git diff --check`
- `rg -n "routing-only|agent-runtime.lock|research.*classifies|research.*hands off|research-router" skills docs tests AGENTS.md instructions rules`

## Risks

- The phrase "run the selected skill" may be interpreted as merely naming the
  selected skill unless the adapter prompt explicitly requires the final answer
  to be the selected area skill's brief.
- The new behavior could accidentally become multi-skill orchestration if the
  skill says to continue into downstream skills. Keep the contract bounded to
  one research area skill.
- Tests that only check for routing fields may keep passing while the user
  experience remains routing-only. Add assertions for auto-dispatch wording and
  area-skill brief handoff expectations.
