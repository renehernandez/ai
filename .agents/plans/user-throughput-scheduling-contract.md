# User-Throughput Scheduling Contract

## Goal

Make user-visible latency the primary optimization objective inside accepted
authority and safety boundaries. Agents start every useful independent lane as
soon as it becomes eligible, preserve progressive reviewable checkpoints, and
serialize only for a concrete dependency, exclusive write ownership, provider
ordering, or an unstable target. Deliver the portable instructions, canonical
rules, lifecycle integration, and regression proof as one plan-plus-
implementation MR. [confidence: 0.99 - certain | reason: Rene explicitly made
parallelized user efficiency the highest workflow priority and accepted this
contract]

## Motivation

The current workflow contains correct but scattered concurrency guidance. In
practice, agents can over-apply one-writer ownership, Git predecessor order,
progressive MR updates, and review phase barriers as global wait conditions.
That produced two observed delays: reconstructing a complete final stack before
publishing useful MR checkpoints, and updating one substantive MR while leaving
descendants stale until merge. The newly internalized `glab-stacked-diffs`
skill fixes stack mechanics, but the broader lifecycle still lacks one explicit
scheduling priority that makes ordered work and concurrent work compose.
[confidence: 0.99 - certain | reason: the two inspected task histories and the
current instruction sources exhibit this exact gap]

## Accepted Decisions

- Optimize for time to the first useful checkpoint and total user-visible
  completion latency, not raw worker utilization. Concurrency is the default
  mechanism when it advances useful work faster. [confidence: 0.99 - certain |
  reason: this captures the user's stated priority without rewarding busywork]
- At each task or lifecycle transition, maintain a task-local dependency map
  and ready queue. Start all safe, authorized, useful independent lanes up to
  available capacity and backfill capacity as dependencies resolve. Do not add
  a persistent scheduler, repository ledger, squad lead, project lead, or new
  lifecycle owner. [confidence: 0.99 - certain | reason: the user accepted
  task-local scheduling and explicitly rolled back organizational agents]
- Require a concrete reason for serialization. Valid reasons are unresolved
  predecessor output, exclusive mutation ownership, ordered provider or Git
  ancestry, an unstable exact review target, unavailable capacity, or an
  authority, safety, credential, or external-state blocker. [confidence: 0.98
  - certain | reason: these are the existing workflow constraints that can
  legitimately prevent an immediate start]
- Apply exclusive ownership per worktree. One writer in one worktree does not
  limit independent writers in separately owned worktrees or read-only lanes.
  [confidence: 0.99 - certain | reason: this preserves safety while removing
  the observed initiative-wide serialization interpretation]
- Treat a phase barrier as a join point for already-started independent work,
  not a launch barrier. Provider waits, review waits, and ordered propagation
  do not block unrelated work whose target is stable. [confidence: 0.99 -
  certain | reason: current Review already has a work-conserving wave precedent]
- Preserve progressive visibility. Complete and publish the earliest
  substantive MR checkpoint before editing the next substantive MR, while
  immediately propagating its new base through descendants and starting stable
  audits, CI, and hosted review concurrently. [confidence: 0.99 - certain |
  reason: this is the accepted correction for both delay examples]
- Freeze a POC-derived contract once and hand final delivery a task-local
  execution seed containing delivery units, dependency classification, Git
  order, ownership, and required proof. Start independent units immediately,
  contract-dependent units when their interface is fixed, and implementation-
  dependent units when predecessor output exists. Never promote POC commits or
  reconstruct a complete final history before progressive publication.
  [confidence: 0.98 - certain | reason: it preserves the existing disposable
  POC contract while preventing rediscovery and batch-at-end stack synthesis]
- Keep small coherent work inline when delegation or lane setup would increase
  latency. Parallelization is required for eligible work, not as ceremony.
  [confidence: 0.98 - certain | reason: user efficiency rather than maximal
  fanout is the selected objective]

## Domain Terms

| Term | Meaning |
| --- | --- |
| User throughput | Time to the first useful checkpoint plus total completion latency within accepted authority and safety constraints. |
| Useful checkpoint | The smallest stable, reviewable, user-visible result that advances the accepted outcome. |
| Ready lane | Safe, authorized work whose required inputs and stable target already exist. |
| Dependency map | Task-local relationships that identify ready lanes and concrete serialization requirements; it is not a committed artifact. |
| Phase barrier | A join point that collects required results after independent work has already started. |
| Propagation lane | Ordered descendant restacking after an ancestor changes; it runs alongside independent audits and gates. |
| Execution seed | The task-local final-delivery handoff containing frozen contract, units, dependencies, Git order, ownership, and proof. |

## Scope

### In Scope

- Add the portable user-throughput priority without changing the project-
  specific root `AGENTS.md`.
- Establish one canonical scheduling contract covering dependency maps, ready
  queues, immediate starts, backfilling, explicit serialization reasons,
  per-worktree ownership, phase barriers, POC execution seeds, and the small-
  task exception.
- Integrate the contract narrowly into Explore/brainstorming, Plan, Execute,
  Review, and Finish where each mode owns a scheduling boundary.
- Align Git and verification rules so progressive substantive checkpoints,
  descendant propagation, focused proof, CI, hosted review, and stable-target
  audits overlap safely.
- Reuse `glab-stacked-diffs` as the sole stack-mechanics owner rather than
  duplicating its commands or recovery procedure.
- Add focused regression tests for the priority, routing, invariants, and
  prohibited hierarchy.
- Run `writing-skills` pressure scenarios against the changed agent behavior.

### Out Of Scope

- Changes to the project-specific root `AGENTS.md`.
- Squad leads, project leads, organizational agents, persistent orchestration
  state, durable dependency ledgers, runtime telemetry, or a new scheduler.
- Multiple writers in one worktree or weakening exact-head review, Git lease,
  provider-ordering, authority, safety, credential, or merge boundaries.
- Reimplementing stack commands already owned by `glab-stacked-diffs`.
- Changes to external Fullscript repositories or project-specific agent rules.
- Merge, deployment, or feature-branch/worktree cleanup.

## Reuse And Deviation Contract

### Canonical owners to extend

- `instructions/AGENTS.md` owns portable priority and five-mode workflow
  behavior.
- `rules/session-startup.md` owns mode-entry preflight.
- `rules/investigation-and-implementation.md` owns dependency classification,
  worktree ownership, POC handoff, and final-unit eligibility.
- `rules/git-and-review.md` owns branch order, publication, restack, and hosted
  gate behavior.
- `rules/testing-and-verification.md` owns proof-layer selection and safe
  verification concurrency.
- The existing lifecycle skills own mode-specific execution of the shared
  contract; Review's ready queue and phase barrier are the closest scheduling
  precedent.
- `skills/glab-stacked-diffs` owns progressive substantive MR updates and
  exact-leased atomic descendant propagation.
- Existing instruction, lifecycle, review-workflow, and stacked-diff contract
  tests own regression coverage.

### Reuse and deviation

Extend these owners in place. The intentional deviation is elevating existing
local concurrency guidance into a portable priority that applies across all
five modes, plus requiring every avoidable serialization decision to identify
its concrete blocker. No parallel doctrine, generic orchestrator, second stack
workflow, or new authority owner is introduced.

End-to-end proof will show that the entrypoint routes user-throughput priority
to one canonical scheduling rule, mode skills apply it without duplicating the
doctrine, stack guidance keeps progressive mutation and concurrent propagation
compatible, and regression tests reject initiative-wide one-writer or phase-
barrier-as-launch-barrier interpretations.

## Atomic Implementation Unit

Deliver one AI-repo MR containing this plan, the portable instruction priority,
canonical scheduling rules, narrow lifecycle integrations, and regression
tests. Splitting the priority from its mode integrations would leave the
contract advisory; splitting tests would leave the observed serializing
interpretations unproved. The change is one behavioral contract with one
rollback and review boundary and does not require a POC. [confidence: 0.98 -
certain | reason: every surface implements or proves the same scheduling
semantics]

## Acceptance Criteria

- Portable instructions explicitly prioritize user-visible latency and require
  immediate starts for safe, authorized, useful ready work.
- An agent with available capacity must start eligible work or identify the
  concrete dependency preventing it.
- Exclusive writer ownership remains per worktree; separate worktrees and
  read-only lanes may proceed concurrently.
- Explore, Plan, Execute, Review, and Finish each apply the scheduling contract
  at their owned transition without creating another lifecycle owner.
- Review phase barriers join launched work and do not become launch gates.
- A substantive ancestor MR update is published progressively, immediately
  starts ordered descendant propagation, and overlaps stable audits and gates.
- POC reconciliation produces one task-local execution seed and final delivery
  never reconstructs or promotes POC history.
- Small coherent work may stay inline when fanout would increase latency.
- No project-specific root `AGENTS.md`, organizational-agent hierarchy,
  persistent scheduler, or durable workflow ledger is added.
- Focused contract tests, skill validation, `writing-skills` pressure testing,
  native hooks, hosted review, and exact-head local Review pass.

## First Real Confirmation

Run focused behavior scenarios that present an agent with: one substantive MR
update, a linear descendant propagation chain, two stable read-only audits, and
an in-flight hosted gate. The expected answer must publish the substantive
checkpoint, start the ordered propagation lane immediately, launch both audits
and the hosted gate without waiting for merge, and keep only the next
substantive edit gated on its updated base. A second scenario with one small
coherent MR must remain inline instead of manufacturing parallel overhead.
[confidence: 0.99 - certain | reason: these scenarios reproduce both observed
failure modes and the accepted efficiency exception]

## Verification Strategy

- Add focused source-contract tests for the portable priority, canonical rule
  ownership, mode routing, valid serialization reasons, per-worktree ownership,
  phase-barrier semantics, and absence of organizational agents.
- Extend stacked-diff contract coverage only where needed to prove integration;
  keep concrete stack mechanics in the existing skill tests.
- Run the affected Node test files plus mode lifecycle integration tests.
- Run `pnpm run skills:validate` and the repository's behavior-specific lint,
  type, and test commands selected by the changed surfaces.
- Use `writing-skills` RED-GREEN-REFACTOR pressure scenarios for full-stack
  reconstruction, post-update restack delay, phase-barrier waiting, small-task
  overhead, and same-worktree multi-writer rationalization.
- Commit with native hooks, publish one draft GitLab MR targeting `main`,
  request Nitro, and run exact-head local Review using hook evidence.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Raw fanout creates busywork or coordination overhead | Optimize user latency, require useful ready work, and keep small coherent tasks inline. |
| Parallel writers collide | Preserve exactly one writer per worktree and use separate owned branches/worktrees. |
| Work starts against stale targets | Require stable target identity for target-sensitive review and verification lanes. |
| Git order is confused with implementation order | Record one total Git order separately from semantic eligibility and keep propagation topological. |
| Progressive delivery becomes serial delivery | Explicitly overlap propagation, stable audits, CI, and hosted review after each checkpoint. |
| A phase barrier delays launching reviewers | Define it only as the join after ready work starts and test that interpretation. |
| POC handoff repeats discovery or promotes rehearsal history | Freeze one execution seed and retain the existing prohibition on reusing POC commits. |
| Portable rules duplicate stack mechanics | Route mechanics exclusively to `glab-stacked-diffs` and keep shared rules semantic. |
| Strong defaults weaken authority or safety | Make concurrency subordinate to accepted authority, safety, credentials, ownership, and explicit terminal-action boundaries. |

## Delivery Policy

The atomic plan and implementation ship together in one draft GitLab MR
targeting `main`. Implementation authority includes draft publication, CI or
explicit no-pipeline handling, Nitro review, in-scope repair, and technical
readiness. It does not include merge, deployment, or cleanup.
