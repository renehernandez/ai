# GitLab Monitoring Rate-Limit Safety

## Goal

Make requests to monitor GitLab feedback use one rate-aware observation lane
instead of multiplying provider reads across parallel agents. Preserve prompt
feedback and exact-head readiness while preventing synchronized polling and
repeat requests during a GitLab cooldown. [confidence: 0.98 - certain |
reason: the current Nitro evidence contract enforces one-minute polling and the
accepted change explicitly replaces it with serialized five-minute monitoring]

## Accepted Decisions

- Treat one complete set of GitLab reads needed to decide current MR state as a
  provider snapshot. One monitor owner per MR may initiate repeated snapshots;
  Review consumes its evidence and does not create a competing poller.
- Permit one immediate snapshot after a relevant push, review request, or
  provider mutation. While state is pending, start the next snapshot no sooner
  than five minutes after the prior snapshot completes. A status request inside
  that window reports the latest timestamped evidence.
- Serialize task-local GitLab snapshots that share a host and credential, and
  wait at least 30 seconds after one snapshot completes before starting a
  different MR's snapshot. Treat unknown credential identity on the same host
  as shared. Other local, repository, and non-GitLab work remains eligible for
  normal concurrency.
- Use a timer or supported wakeup for the delay. Do not poll a clock or GitLab
  to determine whether the delay elapsed.
- On HTTP 429, abort the remaining snapshot reads and suspend all task-local
  GitLab reads and writes that share the host and credential. Resume after the
  latest valid `RateLimit-ResetTime`, `RateLimit-Reset`, or `Retry-After`
  deadline, plus 60 seconds, with a minimum five-minute delay.
- When no valid server deadline exists, wait 15 minutes. Consecutive recovery
  probes that receive 429 use 30- and then 60-minute fallback floors. Allow one
  lightweight MR read as the recovery probe before resuming serialized
  snapshots.
- Keep cooldown and ownership coordination task-local. Do not add a persistent
  scheduler, machine-global lock, credential state file, or provider wrapper.
  Separate root tasks cannot share cooldown state; portable cadence and
  task-local fanout control are the accepted first boundary.

## Scope

### In Scope

- Canonical GitLab monitoring cadence, snapshot ownership, task-local
  serialization, cached status, and 429 recovery rules.
- Narrow Finish, GitLab Review adapter, and Fullscript Nitro projections.
- A five-minute Nitro feedback evidence contract and focused regression tests.
- Skill pressure tests and repository-native validation of the changed shared
  behavior.

### Out Of Scope

- A persistent or cross-task rate-limit coordinator.
- GitLab client replacement, credential changes, GitLab administrator limits,
  or changes to external Fullscript skills.
- GitHub monitoring policy, merge, deployment, cleanup, or live-runtime sync
  before merge.

## Reuse And Deviation Contract

- `rules/git-and-review.md` remains the canonical owner of provider polling and
  hosted feedback follow-through. Extend it with the snapshot and cooldown
  contract.
- `rules/investigation-and-implementation.md` remains the scheduling owner.
  Add shared-credential GitLab serialization as a concrete provider constraint
  without weakening the general user-throughput priority.
- `rules/fullscript/nitro-review.md` remains the Nitro request and latest-head
  closure owner. Project the generic monitoring contract and its five-minute
  cadence there.
- `skills/finish/SKILL.md` remains the mutation and monitoring owner;
  `skills/gitlab-adapter-review/SKILL.md` remains the read-only retrieval
  adapter. Finish owns repeat scheduling, while the adapter may consume a
  current snapshot or perform one explicitly scheduled collection.
- The Nitro feedback renderer and gate remain the executable evidence-contract
  owners. Change their existing interval rather than introducing a second
  monitoring schema or helper.
- Existing Nitro unit tests and publication lifecycle integration tests remain
  the regression owners. No new testing framework or runtime state is needed.

The material deviation from the current throughput precedent is deliberate
serialization of GitLab snapshots sharing one credential. GitLab rate limits
are a concrete provider constraint, while repository writes and unrelated
review work retain their existing concurrency. End-to-end proof binds the
portable rule, mode projections, and executable five-minute gate to that one
ownership model.

## Atomic Implementation Unit

Deliver this plan, canonical rules, two skill projections, Nitro evidence
contract, and focused tests in one final MR. Splitting cadence from ownership
or 429 recovery would leave parallel agents able to recreate the same request
burst. The change has one provider-safety outcome, rollback boundary, and
review surface and needs no POC. [confidence: 0.96 - certain]

The implementation forecasts 13 files, above the 10-file planning target but
below the 15-file hard cap. The repository charter requires the two additional
canonical RED/GREEN contract files whenever these shared behavior owners
change. Splitting those executable scenarios would leave the behavior change
uncommittable and unprotected by its native hook. [confidence: 0.99 - certain |
reason: the first native commit attempt named both required contract files]
The thirteenth file updates the existing Nitro delivery-plan examples that
hosted semantic review identified as contradicting the new validator.

## Acceptance Criteria

- “Monitor GitLab feedback” selects one monitor owner per MR and does not
  create independent repeat pollers in Review agents.
- Pending snapshots have a five-minute minimum completion-to-start interval;
  status requests inside it reuse timestamped evidence.
- Snapshots sharing a task-local GitLab host and credential do not overlap and
  a different MR's snapshot starts at least 30 seconds after the prior snapshot
  completes. Unknown credential identity on the same host remains serialized.
- A 429 aborts remaining reads and establishes one shared task-local cooldown
  for GitLab reads and writes, using server deadlines when available and the
  accepted bounded fallback otherwise.
- Recovery uses one lightweight probe and cannot create a retry burst.
- Nitro's generated and validated gate requires
  `poll_interval_minutes: 5` and rejects the previous value of one.
- No persistent throttle, machine-global lock, new scheduler, or duplicate
  provider owner is introduced.

## First Real Confirmation

Run a pressure scenario with eight draft MRs, eight available Finish lanes, a
shared credential, a short release deadline, a two-minute status request, and a
429 without headers. The expected behavior assigns one owner per MR,
serializes provider snapshots, reports cached evidence at two minutes, waits at
least five minutes between pending snapshots, and moves every task-local GitLab
lane into one 15-minute cooldown after the 429. [confidence: 0.97 - certain]

## Verification Strategy

- Capture RED behavior from the current skills, then rerun the same pressure
  scenario after the skill changes and close any observed loopholes.
- Extend Nitro gate unit coverage for the five-minute accepted value and the
  rejected one-minute legacy value.
- Extend publication lifecycle integration coverage for monitor ownership,
  task-local serialization, cached status, timer waiting, and shared 429
  cooldown semantics.
- Run the affected unit and integration tests, `pnpm run skills:validate`,
  `pnpm run charter:validate`, and `pnpm run biome:lint-format`.
- Commit with native hooks. Publish one draft GitLab MR targeting `main`,
  request Nitro, and complete exact-head Review and hosted follow-through.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Five-minute cadence delays a fast completion signal | Allow one immediate post-mutation snapshot and continue non-provider work while the timer runs. |
| Serialization is mistaken for a global reduction in concurrency | Limit it to snapshots sharing one GitLab host and credential. |
| Review starts another poller for fresher evidence | Make Finish the repeat-scheduling owner and let Review consume the current snapshot. |
| A 429 is followed by the rest of a multi-endpoint collection | Require immediate snapshot abortion before establishing the shared cooldown. |
| Missing headers cause rapid fallback retries | Use 15-, 30-, and 60-minute fallback floors with one recovery probe. |
| Rules imply cross-task protection that does not exist | State that coordination is task-local and exclude persistent shared state. |

## Delivery Policy

The plan and implementation ship together in one draft GitLab MR targeting
`main`. Accepted implementation authority includes draft publication, current
CI or explicit no-pipeline handling, Nitro review, in-scope repair, and
technical readiness. It does not include merge, deployment, cleanup, or live
AX runtime synchronization.
