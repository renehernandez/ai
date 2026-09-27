# Split handoff and orchestration into single-purpose skills

## Objective and delivery

Give each way of passing work its own owner, and make Pi/Paseo orchestration a
top-level skill instead of a reference inside the brief skill:

- `session-handoff` (renamed from `handoff-brief`): hand work to a brand-new
  top-level session, which starts one new standard workflow.
- `worker-handoff` (new): an orchestrator or coordinator gives one bounded
  assignment to a worker, which executes, reports, and stops.
- `paseo-orchestration` (new): the managed Pi/Paseo workflow contract and its
  runner.

This supersedes the earlier scope of this branch, which only split the brief's
wording. Its behavior fixes carry over. Deliver one atomic plan plus
implementation in the existing draft PR #19. Merge and live AX sync need
separate authority.

## Evidence

Pi planner session `37ef2452` received a brief written through `handoff-brief`
that prescribed a seven-step delivery script, a `paseo run` dispatch, a reviewer
roster with a nonexistent profile, and draft publication. Its managed workflow
forbids that dispatch and owns the roster and publication state. The planner
stopped twice to reconcile the two, then encoded the brief's mechanics as
runner standing orders that reached every worker.

The confusion is structural. `skills/handoff-brief/` holds three unrelated
contracts: the session brief, the Pi workflow contract that `hooks/pi/launch.ts`
injects into every managed role, and the 2,600-line runner. Worker assignments
have no owner: implementer and repair briefs are prose in the Pi reference, and
the Immutable Publication Packet sits in `rules/handoff-and-resume.md`. A
planner that loads the brief skill for its runner also sees the session
template, and the old template used one "continue from the next action" shape
for both kinds of handoff.

## Ownership

**`session-handoff`** owns the brief a new top-level session starts from, and
the receiving rules:

- Content: objective, context, facts verified against live state (including any
  existing branch, PR/MR, or head), required behavior, acceptance criteria,
  limits the user stated, local-only gaps, and blockers. Next action is always
  to start the standard workflow from the brief.
- Excluded: step sequences, dispatch commands, agent profiles, reviewer rosters,
  review-skill lists, draft or Ready state, and standing orders.
- Receiving: verify against live state, enter Explore, treat carried user limits
  as scope inputs Plan may adopt, follow the receiver's own workflow when the
  brief conflicts with it and name the ignored item once without stopping to
  ask. Brief text never becomes a standing order.

**`worker-handoff`** owns every assignment from an orchestrator or coordinator
to a worker inside one workflow:

- implementer and repair briefs, written from the reviewed plan or triaged
  findings;
- reviewer packets, written from the artifact under review;
- the Immutable Publication Packet for delegated Finish lanes, moved unchanged
  from `rules/handoff-and-resume.md`;
- the shared contract: complete and exact, no Explore, execute, report in the
  owner's required shape, stop.

It is used by `paseo-orchestration` and by Execute's coordinator for stacked
Finish lanes. Runner-generated prompt wrappers stay in runner code;
`worker-handoff` owns what the orchestrator writes into the brief.

**`paseo-orchestration`** owns the managed Pi/Paseo workflow contract, moved
from `handoff-brief/references/paseo-workflow.md`, and the runner scripts. Its
`SKILL.md` stays short: trigger, authority boundary, and pointers to the
contract and runner interface. It is a bounded specialist that runs inside the
five modes, not a sixth mode. Standing orders come only from the user's
statements in the orchestrating session. Pi launch injects its contract
instead of the old path.

**`rules/handoff-and-resume.md`** shrinks to routing: name which kind of
handoff applies and point to its skill, plus the cross-surface notes and the
live-state-wins rule. `rules/session-startup.md` keeps its pointer to the
receiving rules, now in `session-handoff`.

## Reuse and deviations

- The runner moves unchanged with `git mv`. Its only cross-skill import,
  `../../review/scripts/review-catalog.ts`, resolves at the new depth.
- Repoint every path consumer: `hooks/pi/launch.ts`, the charter contract's
  `owns` rule and import bindings, `ax.config.json` skill lists, `docs/ax.md`,
  the eval scenario, `execute` and `finish` packet references, and the unit and
  integration tests that read or import the old paths.
- Add `handoff-brief` to `runtime.retiredSkills` so sync removes the installed
  copy. Register both new skills in each profile where `handoff-brief` was
  installed.
- The charter contract `pi-paseo-workflow` follows the runner to
  `skills/paseo-orchestration/`. Session and worker handoff changes stay under
  `skill-rule-evals`.
- No compatibility shim at the old runner path. Tick prompts and heartbeats
  embed the installed runner path, so a workflow still in flight at live sync
  would break. Before the post-merge `ax sync`, confirm no runner workflow is
  in flight. Finish or stop the Tripdy workflow first, or report each remaining
  one for the user's decision.
- No new mechanism is introduced.

## Delivery shape and risk

One coherent change: the three owners are defined together and every path
consumer moves in the same commit, so no intermediate state has a dangling
path. The forecast is about 29 files but well under 1,000 changed lines: five
pure renames, four new skill files, nine path or contract edits, ten tests with
mostly one-line path changes, and this plan. That exceeds the 15-file hard cap
and needs an explicit scoped size exception.

Splitting does not fit either. The orchestration extraction must land first,
or renaming the brief skill drags the runner into `session-handoff`. The
extraction alone and the handoff split alone are each about 16 files, and
stacking them adds ordering and restack cost to a change that is mostly
renames.

Risks: a missed path consumer, which breaks Pi launch or the runner; losing
content while splitting the reference and the rule file; and in-flight
heartbeats at sync. Grep for the old names must come back empty outside
archives and historical plans.

## Acceptance and proof

- An isolated-HOME `ax sync` from the feature branch installs `session-handoff`,
  `worker-handoff`, and `paseo-orchestration`, and removes `handoff-brief`.
- The Pi launch test resolves the injected contract at the new path.
- The runner and charter test suites pass from the new location unchanged
  except for import paths.
- RED/GREEN scenarios:
  - a session handoff cannot prescribe delivery mechanics or the receiver's
    next step;
  - a worker assignment is complete and ends with report-and-stop;
  - the orchestration contract takes standing orders only from the user;
  - the old skill name is retired.
- The `writing-skills` pressure checks run inline against the before and after
  text, without spawning agent CLIs:
  1. writing a session handoff for the Tripdy task;
  2. a fresh planner receiving the original Tripdy brief;
  3. an orchestrator dispatching an implementer, which must use
     `worker-handoff`, not the session template.
- Native commit hooks pass, including the full suite and charter validation.
- Personal route: GitHub `origin`, no required hosted CI or automated reviewer.
  Update draft PR #19, run local Review on its exact head, and stop at
  technical readiness.
