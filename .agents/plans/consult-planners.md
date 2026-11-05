# Consult planners

## Objective

Add two advisory planner roles, Astra and Fable, that the orchestrator can
consult through the Paseo workflow runner, on its own initiative or when the
user asks. A consult returns advice: options, a recommendation, risks, open
questions, and optionally a draft plan. The orchestrator stays the only writer
of `.agents/plans` and the only owner of every gate decision.

## Accepted scope

| Role | Route | Tools |
| --- | --- | --- |
| `planner-astra` | `openai-codex/gpt-6-astra:medium` | `read`, `grep`, `find`, `ls`, `mcp` |
| `planner-fable` | `claude-bridge/claude-fable-5-1:medium` | `read`, `grep`, `find`, `ls`, `mcp` |

- `ax.config.json`: one fixed-route Paseo provider and one agent profile per
  planner, named `Astra · Consult Planner` and `Fable · Consult Planner`,
  following the reviewer provider shape. `paseoTools` is disabled, so planners
  get no Paseo session, terminal, schedule, or workspace tools.
  `claude-fable-5-1` joins the bridge `forceTwoHundredK` list, because the
  bridge reports 1M context and paid long-context fallback is forbidden.
- `hooks/pi/policy.ts`: both roles join `roles`. `allowedTools` gives
  `planner-*` roles the read tools plus `mcp`, and no `bash`, `edit`, or
  `write`. The existing MCP action and agent-orchestration denials apply
  unchanged.
- `hooks/pi/launch.ts`: no new mechanism. Planners are non-review roles, so
  they already load the MCP adapter and must pass its startup check. The
  bridge package and billing-environment stripping already key on
  `claude-bridge`.
- Runner: a new `consult` action and consult worker slots. These are
  described under Behavior below.
- Contract and docs: `skills/paseo-orchestration/references/paseo-workflow.md`
  (the normative contract) gets a "Consult planners" section and a `consult`
  row in the runner table. `skills/paseo-orchestration/SKILL.md` and
  `docs/ax.md` summarize it.
- Out of scope: planners writing plans, planners acting as reviewers, new
  implementer routes, and any roster marker change.

## Behavior

### `consult` input

`consult` takes `briefPath` and an optional `planners` list, which defaults
to both planners. An empty list, a duplicate name, or a name other than
`planner-astra` or `planner-fable` refuses with nothing recorded. The runner
sorts the list before it computes the consult fingerprint, so input order
has no effect. It also takes the same optional workspace fields as
`review`. The brief is written by the orchestrator. It holds the question,
the constraints, and the repository paths to read.

### Dispatch

The runner snapshots the brief read-only and records a consult with a
fingerprint. It launches one fresh session per named planner, concurrently,
through the existing `launch` path. That path covers inert start, route
verification, the assignment digest, a send that never repeats, and the
standing-orders block.

### Planner assignment

The assignment tells the planner to:

- work read-only;
- treat the brief as evidence;
- use MCP only for research;
- launch no workers and write no files;
- return exactly one envelope.

```text
AX_CONSULT_BEGIN
{"fingerprint":"...","summary":"...","recommendation":"...",
 "options":["..."],"risks":["..."],"questions":["..."],"draft":"optional"}
AX_CONSULT_END
```

`summary` and `recommendation` are required nonempty strings. `options`,
`risks`, and `questions` are required string lists, which may be empty, and
every entry must be nonempty. `draft` is optional; when present it is a
nonempty string. The fingerprint must match the consult.

### Workers and ticks

Consult workers appear in `workers()` as `consult:planner-astra` and
`consult:planner-fable`. Each `Worker` entry that `workers()` returns carries
a `kind` (`implementer`, `review`, or `consult`). `workers()` derives it from
the slot the worker occupies. It is never persisted, so states written before
this change read exactly as before, with no defaulting or migration. One canonical capability table in
`paseo-workflow-state.ts`, keyed by `kind`, owns every per-kind behavior.
Every call site that now infers behavior from `phase` or the `review-` role
prefix reads the table instead, including `launch`, `recordCompletion`,
`tick`, `settleDelivery`, `retryLaunch`, `adopt`, gates, and `inFlight`.

| Capability | implementer | review | consult |
| --- | --- | --- | --- |
| writes the worktree, so it has a baseline | yes | no | no |
| superseded-session conflict watch | yes | no | no |
| failure records `degraded`, not `failed` | no | yes | yes |
| one automatic retry after an identity-known launch failure | no | yes | yes |
| a second non-delivery records `degraded` | no | yes | yes |
| `adopt` eligible | yes | no | no |
| ambiguous past the timeout is stopped and records `degraded` | no | no | yes |
| blocks phase progression while in flight | yes | yes | no |

The table's `review` column reproduces current reviewer behavior exactly, and
its `implementer` column reproduces current implementer behavior exactly. The
refactor changes no existing behavior; existing tests prove that.

`tick` records a parsed envelope as `complete` with its `advice`. It names
each consult result in its line, such as `consult:planner-fable: complete`.

### Effect on gates

Consults are advisory and create no gates:

- `nextStep` never requires triage, fallback assessment, or a waiver for
  them.
- `handoff`, `review`, and `repair` do not refuse while a consult runs.
- A degraded consult only lowers the advice available. The orchestrator
  reports it to the user in the same turn.
- The runner distinguishes monitored from blocking in-flight work.
  - `inFlight` (monitored) includes running consults. The heartbeat, `tick`
    monitoring, `loopStatus`, `finish`, and `cleanup` use it. The heartbeat
    therefore stays armed until every consult is recorded, even at an
    `awaiting-user` gate. `finish` and `cleanup` refuse while a consult
    runs.
  - `nextStep` returns `unchanged` only for blocking in-flight work, meaning
    kinds whose table row says so. When only consults are in flight,
    `nextStep` names the ready phase step (`triage`, `review`, `handoff`
    gate, `repair`, or `publication`) exactly as it would without them, and
    lists the running consults beside it as `consulting`.
- Delivery recovery reuses one automatic `retry-launch` for an undelivered
  planner. An ambiguous planner is evaluated by each tick as today. Past the
  reviewer timeout, it is not a gate: the runner stops its session and
  records `degraded`. This is its terminal state, so an unresolvable consult
  can never hold `finish` or `cleanup`. `adopt` stays implementer-only.

### Consult lifecycle

There is one current consult. A new `consult` refuses while any current
consult worker is in flight; otherwise it archives the previous consult to
`priorConsults`. Consults do not count against review rounds or bounds. They
are allowed in any phase before `finish`.

### Compatibility

States initialized before this change have no planner routes. On those
states, `consult` refuses with a message naming `init`. Every other action on
them is unchanged. `init` now requires both planner providers in the live
Paseo config, the same way it requires reviewer providers. No roster marker
changes.

### Requesting a consult

The orchestrator dispatches a consult when it chooses, or when the user asks,
for example "ask Fable", "consult Astra", or "get both planners' take". Advice
may inform the plan, but only the orchestrator's own revision changes the
plan, and that revision still needs a fresh planning round. The planner
profiles can also be opened manually in Paseo as standalone read-only
consultants.

## Reuse and deviation

- Reuses the following unchanged:
  - `launch`, delivery evidence, `settleDelivery`, `retry-launch`;
  - heartbeat, standing orders, snapshots, and the `envelope` parser;
  - `routesFromConfig`;
  - the reviewer provider and profile shape.
- New mechanism, justified by the requirement: the consult slot and the
  `AX_CONSULT` envelope. Consult output is free-form advice, not lens
  outcomes, so the review envelope does not fit it. The worker `kind`
  and its capability table replace the current overloaded use of `phase` and
  the `review-` prefix, and the monitored/blocking split replaces the single
  in-flight list for progression. Both are needed so consult workers neither
  inherit implementer behavior nor become a de facto gate.
- Rejected:
  - Planners writing `.agents/plans`, because it breaks single-writer
    ownership.
  - Running consults as an extra review group, because it changes the
    exactly-once lens contract and the bounds.
  - Giving planners Paseo tools, because that allows lifecycle side effects
    from an advisory role.

## Acceptance and proof

First visible proof: under an isolated HOME and runtime root, sync the branch
config. Show two planner profiles and providers with the routes above and
Paseo tools disabled. Run the managed wrapper's argument builder for each
planner role and show four things: the fixed route, the tools `read`, `grep`,
`find`, `ls`, and `mcp`, the MCP adapter package, and the bridge package for
Fable only.

Unit tests:

- **profile/config:** both planner profiles and providers have the exact
  routes, medium thinking, and `paseoTools.enabled: false`.
  `forceTwoHundredK` holds Opus, Sonnet, and Fable.
- **launch:** each planner role is fixed to its single route. Model,
  provider, and thinking overrides are refused. Fable args include the
  bridge. Both include MCP. Billing variables are stripped for Fable.
- **policy:** both roles are accepted. `bash`, `edit`, and `write` are
  denied. `read` and `mcp` are allowed. The MCP `action` and `create_agent`
  denials still apply.
- **runner, `init`:** `init` records planner routes and fails naming the
  missing `ax-planner-*` provider.
- **runner, `consult` dispatch:**
  - `consult` launches the named planners concurrently with the brief
    snapshot and standing orders.
  - It refuses on a finished workflow, a state without planner routes, an
    empty planner list, a duplicate or unknown planner, or a current consult
    still in flight. Each refusal records nothing.
  - An ambiguous consult past the timeout is stopped and recorded
    `degraded`, after which `finish` proceeds.
  - A state fixture written before this change, whose workers have no
    `kind`, passes `status`, `tick`, and dispatch exactly as before.
  - A second consult archives the first.
- **runner, `tick` on consults:**
  - `tick` records a valid envelope as `complete` with its advice.
  - A malformed envelope, a fingerprint mismatch, a timeout, or a provider
    error records `degraded`.
  - A planner still at its startup reply follows the delivery evaluator.
  - An undelivered planner gets one `retry-launch`. A second non-delivery
    records `degraded`.
- **runner, gates:**
  - A running consult does not refuse `review`, `handoff`, or `repair`.
  - With a review round complete and a consult still running, `tick` returns
    `changed` naming `triage`, lists the consult, and keeps the heartbeat
    armed. With an implementer running and a consult running, `tick`
    returns `unchanged`.
  - The capability table's review and implementer columns are pinned by
    the existing reviewer and implementer tests, which still pass
    unchanged.
  - A running consult does refuse `finish` and `cleanup`.
  - A complete or degraded consult never yields a triage or `awaiting-user`
    step.
  - `adopt` refuses consult workers.
- **existing tests:** updated wherever they enumerate managed roles,
  providers, or profiles.

Run the project's lint, format, and unit tests (the repository has no
typecheck script), then skill and charter validation, native hooks, and the `writing-skills` RED/GREEN scenarios
for the changed contract text. After authorized merge of this change and its
predecessor, run these on the clean `main` worktree, in order:

1. Fast-forward the worktree.
2. List running Paseo agents with `paseo ls`. If any managed worker is still
   active, stop and ask the user.
3. Run live `pnpm ax sync` and `pnpm ax validate`.
4. Run `paseo reload`.

## Delivery boundary and risk

This is one coherent outcome: the roles, providers, policy, runner action, and
contract text must land together. Without all of them, the runner would launch
planners that the config or policy does not declare. It stacks on
`model-roster-refresh` (PR #27). Its branch is `consult-planners`, created
from that branch head, and its PR targets `model-roster-refresh` until that PR
merges. Target about 11 files and well under 1,000 changed lines. If it
exceeds 15 files or 1,000 lines, return to Plan.

Risks:

- **A planner gaining write or session tools:** mitigated by the
  prefix-based policy, disabled Paseo tools, and tests.
- **Consult workers inheriting implementer behavior through the `phase`
  overload:** mitigated by the explicit `kind` and tests.
- **Paid long-context usage on Fable:** mitigated by `forceTwoHundredK`.
- **Workflows initialized before sync cannot consult:** accepted, with an
  explicit refusal.

Rollback: revert through a normal PR and rerun sync from `main`.
