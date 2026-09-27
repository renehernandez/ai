# Separate session handoffs from worker assignments

## Objective and delivery

A handoff to a completely new top-level session only tells that session what to
start: one new standard workflow. It no longer prescribes delivery mechanics.
Handing work to an implementer or reviewer inside one orchestrated session stays
a precise, fully specified assignment. Deliver one atomic plan plus
implementation in one AI-repository PR. No runner code, state format, or
dependency changes are in scope. Merge and live AX sync need separate
authority.

## Evidence

Pi planner session `37ef2452` in Tripdy received a brief written by an earlier
session through `handoff-brief`. Besides the objective and requirements, the
brief fixed a seven-step sequence, `paseo run --background` dispatch, a named
reviewer roster with a nonexistent profile, draft publication, and a stop
point. The planner's own managed workflow forbids that dispatch, requires the
runner's planning review and Sol roster, and publishes Ready. The planner
stopped twice to reconcile the two authorities. After the user said to follow
the standard workflow, it still encoded the brief's draft and roster
mechanics as runner standing orders, so every later worker prompt carried
them.

Root causes:

- `rules/handoff-and-resume.md` and the `handoff-brief` template define one
  mid-flight continuation shape (write owner, exact head, CI/merge state,
  "next concrete command") for every handoff.
- Both resume passes (`rules/handoff-and-resume.md` and
  `rules/session-startup.md`) tell the receiver to continue from the recorded
  next action, which turns brief text into instructions.
- `skills/handoff-brief/references/paseo-workflow.md` uses Handoff Brief for the
  implementer assignment, so one template serves both kinds of handoff.
- Nothing stops a receiver from turning brief text into standing orders the
  user never stated.

## Two handoff kinds

**Session handoff** goes from a session or user to a fresh top-level session.
It contains the objective, context, facts verified against live state
(repository, existing branch, PR/MR, or head when relevant), required behavior,
acceptance criteria, limits the user actually stated, local-only gaps, and
blockers. Its next action is always to start the standard workflow from the
brief. It excludes step sequences, dispatch commands, agent profiles, reviewer
rosters or review-skill lists, publication state, and standing orders; the
receiver's workflow and repository policy own those.

The receiver verifies the brief against live state and enters Explore.
Existing branches, PRs/MRs, and worktrees are facts that Explore and Plan
decide how to use; they do not make a mid-flight resume. Carried user limits
are scope inputs that Plan may adopt; they never alter delivery mechanics.
Brief text never becomes a standing order or delivery override. Only the
user's statements in the receiving session do. When brief content conflicts
with the receiver's workflow, the receiver follows its workflow and reports
the ignored item once, without stopping to ask.

**Worker assignment** goes from an orchestrator to an implementer or reviewer
inside one orchestrated workflow. It carries the reviewed plan, branch, base,
head, verification lanes, acceptance criteria, and effective standing orders
exactly. The worker executes it and reports without entering Explore. The
Immutable Publication Packet is also this kind.

Recovering in-flight runner state stays with the runner's `continuation` and
`retry-handoff` actions, not a session handoff.

## Ownership, reuse, and deviations

- `rules/handoff-and-resume.md` stays the canonical owner for both kinds. It
  splits into a session handoff section with its receiving rules and a worker
  assignment section that keeps the Immutable Publication Packet in place.
  `execute`, `finish`, and their tests keep referencing it unchanged.
- `skills/handoff-brief/SKILL.md` covers session handoffs only. Its template
  and description drop mid-flight mechanics, and it points worker assignments
  to their owners. `agents/openai.yaml` wording follows.
- `rules/session-startup.md` replaces its duplicate resume pass with a pointer
  to the canonical owner, removing the second "continue from the recorded next
  action" instruction.
- `skills/handoff-brief/references/paseo-workflow.md` has the orchestrator
  write the implementer assignment brief directly from the reviewed plan
  instead of using Handoff Brief. It also states that standing orders come only
  from the user's statements. The runner already snapshots whatever brief it is
  given, so the script is unchanged.
- The earlier idea of moving the Publication Packet into the Paseo reference is
  dropped: the packet also governs non-Paseo stacked Finish lanes, and three
  tests plus two skills bind it to its current owner.
- No new mechanism is introduced.

## Acceptance and proof

- Update the `handoff-brief` unit assertions in
  `tests/unit/operational-utilities-skill.test.ts` to require the session
  template and its fixed start-standard-workflow next action, and to reject
  mid-flight mechanics fields.
- Run `writing-skills` RED/GREEN pressure scenarios inline against the before
  and after text, without spawning agent CLIs:
  1. Authoring a session handoff for the Tripdy task yields objective,
     requirements, verified facts, and user limits, with no steps, dispatch
     command, roster, or draft/Ready state.
  2. A fresh planner given the original Tripdy brief enters Explore under the
     standard workflow, reports the conflicting mechanics once without asking,
     and records no standing orders from brief text.
  3. An orchestrator dispatching an implementer writes a precise assignment
     from the reviewed plan without the session template.
- Pass native commit hooks, including the full unit suite and charter
  validation.
- Personal route: GitHub `origin`, no required hosted CI or automated reviewer.
  Publish a draft PR, run local Review on its exact head, and stop at technical
  readiness.
