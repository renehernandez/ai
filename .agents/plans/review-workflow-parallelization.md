# Review Workflow Parallelization And Convergence

## Goal

Reduce planning, POC, implementation-review, and review-fix wall-clock time by
running independent work concurrently, minimizing delegated context, and
avoiding redundant review invalidation while preserving one complete
exact-head review gate before publication.

The first real confirmation is a focused contract test that proves a completed
POC or final implementation cannot pass publication review without five
distinct findings-only reviewers on the exact target, while the
first-objective-proof checkpoint requires only independent Code Quality and
Scrutinize results plus targeted behavior verification.

## Context

The current workflow has strong target-specific review coverage, exact-head
publication checks, and single-writer ownership. Its orchestration contract can
still produce avoidable latency:

- a POC receives the complete implementation baseline at first objective proof
  and again at its completed head;
- any target change invalidates all review evidence, including unaffected
  intermediate review surfaces;
- planning artifacts can enter Doc Smith reader-persona review in addition to
  the planning baseline;
- delegated reviewers can inherit a long conversation instead of receiving one
  exact target and bounded assignment;
- independent reviewers can be launched and polled incrementally instead of as
  one work-conserving wave;
- findings can trigger serial edit-and-rereview loops as they arrive;
- environment and toolchain mismatches can appear after substantial
  implementation; and
- `code-simplifier`, `deslop`, and parts of `scrutinize` currently carry edit or
  automatic-fix behavior that conflicts with Review's read-only authority.

The accepted direction keeps Review rigorous at the publication boundary and
optimizes the work leading to that boundary.

## Accepted Decisions

### Keep intermediate evidence scoped and the publication gate complete

- Intermediate review evidence is reviewer- or lane-scoped. A changed target
  reruns the reviewers and verification surfaces affected by that change.
- Before Plan hands an artifact to Execute, run the complete planning baseline
  once against the final artifact fingerprint.
- Before Finish publishes or updates a hosted artifact, run the complete
  implementation baseline once against the final target-base SHA and HEAD.
- Any target-base or HEAD change still invalidates the complete publication
  checkpoint. Intermediate reuse never weakens the final exact-head gate.

### Narrow the first-objective-proof POC checkpoint

At first objective proof, pause before broadening the POC and require:

1. `code-quality-review` against the exact proof diff;
2. `scrutinize` with the architecture-fit/reuse and real-system-path contract;
   and
3. targeted verification of the real entrypoint and visible success or failure
   outcome.

Do not run Simplification, Deslop, or the complete Diff Review baseline against
intentionally incomplete POC code. Run all five required implementation
reviewers at the completed stable POC head.

### Require five independent findings-only implementation reviewers

Every completed POC and final implementation requires five distinct reviewer
identities:

| Reviewer | Required lens |
| --- | --- |
| `code-simplifier` | Avoidable branches, concepts, wrappers, nesting, and behavior-preserving simplification opportunities. |
| `code-quality-review` | Architecture, ownership, abstraction quality, boundaries, maintainability, and reuse. |
| `deslop` | AI-shaped clutter, style drift, defensive noise, type-system bypasses, unnecessary comments, and local-convention violations. |
| `diff-review` | Correctness, regressions, verification gaps, security, performance, usability, and user-visible behavior. |
| `scrutinize` | Intent, simpler alternatives, real-system-path claims, and adversarial end-to-end validation. |

- The writer, coordinator, automated tests, hosted bots, and provider status do
  not count toward the five identities.
- Each reviewer independently receives the same immutable target identity.
- Preserve the current correctness, regression, maintainability, verification,
  and architecture-fit/reuse concerns as coverage mapped into these five
  reviewer contracts. Do not retain separately passable pseudo-identities that
  could satisfy the gate without five independent reviewers.
- Select affected-domain specialists adaptively from the actual diff and risk
  profile. Security, data, infrastructure, UI, documentation/agent alignment,
  AX compatibility, performance, migration, and provider specialists are added
  beyond the five-reviewer floor.
- Every selected specialist uses a reviewer-run identity distinct from the five
  core reviewers and from other selected specialists.
- Record the rationale for every selected specialist and every risk-relevant
  omission in task-local evidence.

### Make every required reviewer findings-only

- Convert `code-simplifier` and `deslop` from editing skills into findings-only
  reviewer skills while retaining their installed names for compatibility.
- Remove automatic-fix behavior from `scrutinize`.
- Make `diff-review` unconditionally findings-only, even when the user also
  wants fixes.
- Keep `code-quality-review` findings-only.
- Route accepted findings to the single Execute owner. The writer applies fixes
  in one coherent batch and owns all repository mutation.

### Use immutable task packets and clean delegated context

Every delegated reviewer or bounded specialist receives a task packet with:

- artifact path and exact artifact fingerprint, or target base, resolved base
  SHA, HEAD, and diff identity;
- assigned reviewer contract and normalized output requirement;
- changed-file list or exact diff scope;
- applicable repository rules and accepted reuse/deviation decisions;
- current verification evidence and known gaps; and
- only the accepted decisions required to interpret the target.

In Codex, default delegated review work to `fork_turns="none"`. Use bounded
recent-turn inheritance only when the assignment genuinely depends on an
unresolved conversational decision. Full-thread inheritance is an exceptional
recovery path and requires a task-local rationale. Other harnesses use the
equivalent clean-context mechanism.

### Schedule review as work-conserving waves

- Construct the dependency graph and ready queue before delegation.
- Reserve coordinator capacity and launch all currently independent reviewers
  together, up to the runtime's available worker capacity.
- Backfill a freed slot immediately from the ready queue.
- Join at one phase barrier after all required results arrive; use completion,
  failure, and genuine-stall events instead of repeated status polling.
- If worker capacity is below the required reviewer count, preserve all
  reviewers across the minimum number of waves. Never reduce review coverage to
  fit the current runtime ceiling.
- Launch review only after the relevant target is stable enough for that phase.
  Increased fanout must not create more knowingly stale evidence.

### Batch findings and converge deliberately

- Hold repository mutation until the review-wave barrier.
- Normalize, deduplicate, and reconcile findings into one task-local batch with
  reviewer, severity, evidence, affected location, remediation outcome, and
  invalidated review/verification surfaces.
- Let read-only agents investigate ambiguous findings or propose tests in
  parallel. Keep one writer in the implementation worktree.
- Apply accepted fixes as one coherent batch, then rerun only the invalidated
  intermediate reviewers and verification surfaces concurrently.
- When convergence is reached, run the complete five-reviewer exact-head wave
  once for the publication checkpoint.

### Use preflight and progressive verification

Before implementation writes, run a lightweight environment preflight that
resolves the documented setup, actual runtime and package-manager versions,
required commands, required credentials, and one small representative command.

Escalate verification with target maturity:

1. During implementation, run affected unit tests, type checks, lint, or other
   narrow project-native verification for touched areas.
2. At first objective proof, run the targeted integration, route, browser, or
   other real-entrypoint proof.
3. At a stable final head, run all repository-required verification, scheduling
   independent commands concurrently when safe.
4. When a final failure may predate the branch, reproduce it against the target
   base before attributing it to the change.

### Keep planning contracts out of Doc Smith reader personas

- Atomic plans and OpenSpec artifacts are planning contracts reviewed by the
  planning baseline. They do not also run Doc Smith's new-engineer and
  cross-team reader personas.
- Reserve Doc Smith reader personas for user-facing or operational
  documentation where audience comprehension is part of acceptance.
- Run those reader personas once, in parallel, against final stable document
  text rather than after every intermediate edit.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Reviewer identity | The task-local identity of one independent agent run; a reviewer skill or lane name alone is not an identity. |
| Coverage lens | The behavior, quality, proof, or architecture concern assigned to a reviewer contract. |
| Intermediate evidence | Review or verification evidence used to guide convergence before the final planning handoff or publication checkpoint. |
| Publication baseline | The complete required reviewer and specialist set bound to one exact target-base SHA and HEAD. |
| Review wave | All currently ready read-only reviewer assignments launched concurrently and joined at one phase barrier. |
| Task packet | The minimal immutable context required for a delegated agent to inspect one exact target without inheriting the conversation. |
| Findings batch | Deduplicated task-local findings handed together to the single Execute owner. It is not committed workflow state or a durable ledger. |
| Affected-domain specialist | An additional reviewer selected by diff evidence and risk beyond the five required implementation reviewers. |

## Reuse And Deviation Contract

### Inspected precedents and canonical owners

- `skills/review/SKILL.md` owns read-only target review, baselines, hosted
  normalization, and publication-checkpoint creation.
- `skills/review/scripts/review-contract.ts` owns deterministic reviewer
  contracts and checkpoint validation.
- `skills/execute/SKILL.md` and
  `skills/execute/scripts/execution-contract.ts` own worktree exclusivity,
  implementation loops, and POC expansion checks.
- `skills/plan/SKILL.md` owns planning-artifact review and Execute handoff.
- `skills/finish/SKILL.md` and `rules/git-and-review.md` consume the final local
  publication checkpoint.
- `rules/testing-and-verification.md` owns verification-layer selection and
  reporting.
- `skills/doc-smith/SKILL.md` and `rules/docs-and-specs.md` own documentation
  review and reader testing.
- `skills/code-simplifier`, `skills/code-quality-review`, `skills/deslop`,
  `skills/diff-review`, and `skills/scrutinize` are the existing installed
  specialist owners for the accepted five review lenses.
- `tests/integration/mode-lifecycle.test.ts` owns the current target-baseline,
  stale-checkpoint, and POC-checkpoint regression scenarios.
- `.agents/plans/reuse-first-poc-architecture-gates.md` is the closest accepted
  precedent for extending Review's catalog and POC checkpoint without adding a
  new lifecycle mode or persistent gate state.
- `.agents/plans/restore-specialist-leverage.md` is the closest precedent for
  preserving bounded specialist behavior under the five lifecycle owners.

### Direct reuse and extension

- Extend Review and its existing TypeScript contract instead of adding another
  orchestrator, review database, hook, lifecycle mode, or provider gate.
- Extend Execute's POC checkpoint and single-writer loop instead of introducing
  a second fix owner.
- Reuse the five installed specialist packages and change their authority and
  rubric boundaries in place.
- Reuse task-local publication evidence; add reviewer-run identity and
  specialist selection to that evidence rather than committing a ledger.
- Keep provider review, CI, and local Review as distinct gates.

### New mechanisms and justified deviations

- Add reviewer-run identity to checkpoint results because the current validator
  verifies passed lane strings but cannot prove separate reviewers.
- Add phase-aware baselines because the current POC baseline is unnecessarily
  repeated at first proof and completed head.
- Add task-packet and work-conserving-wave guidance because no current owner
  defines clean-context delegation, capacity filling, or barrier convergence.
- Change intermediate invalidation from whole-target to affected-surface while
  retaining whole-target invalidation for the final publication checkpoint.
- Exclude planning contracts from Doc Smith reader testing because planning
  Review already owns their audience, readiness, risk, scope, and delivery
  scrutiny.

No new dependency, manifest, runtime config, provider integration, private
database, committed reviewer ledger, or agent-count override is required.

## Scope

### In Scope

- Update `skills/review/SKILL.md`, its OpenAI metadata, and
  `skills/review/scripts/review-contract.ts` with phase-aware baselines,
  five-reviewer independence, adaptive specialists, task packets, review waves,
  barriers, findings batching, and exact-head publication validation.
- Update `skills/execute/SKILL.md`, its OpenAI metadata, and
  `skills/execute/scripts/execution-contract.ts` with environment preflight,
  progressive verification, the narrowed first-proof checkpoint, and batched
  fix convergence.
- Align `skills/plan/SKILL.md` and `skills/finish/SKILL.md` with lane-scoped
  intermediate evidence and complete final checkpoints.
- Convert `skills/code-simplifier/SKILL.md` and `skills/deslop/SKILL.md` to
  findings-only reviewers.
- Tighten `skills/diff-review/SKILL.md`,
  `skills/diff-review/agents/openai.yaml`, `skills/scrutinize/SKILL.md`, and
  `skills/scrutinize/agents/openai.yaml` to findings-only behavior.
- Preserve and align `skills/code-quality-review/SKILL.md` as findings-only.
- Exclude atomic plans and OpenSpec artifacts from Doc Smith reader personas and
  restrict persona runs to stable user-facing or operational documentation.
- Align `AGENTS.md`, `instructions/AGENTS.md`,
  `rules/investigation-and-implementation.md`,
  `rules/testing-and-verification.md`, `rules/docs-and-specs.md`, and
  `rules/git-and-review.md` without duplicating the detailed Review contract in
  every entrypoint.
- Add focused unit/integration fixtures for reviewer independence, phase
  selection, task packets, capacity-aware waves, intermediate invalidation,
  findings-only authority, Doc Smith routing, and progressive verification.
- Run `writing-skills`, AI-readiness upkeep, and project-native validation for
  the changed shared behavior.

### Out Of Scope

- Changing `agents.max_threads`, Codex Desktop slot limits, machine-local
  configuration, or the separately managed Codex config workflow.
- Adding an orchestration service, private database, committed reviewer ledger,
  persistent polling daemon, or generic agent scheduler.
- Changing the five lifecycle modes, provider selection, hosted-review policy,
  Nitro behavior, merge authority, or deployment authority.
- Allowing multiple writers in one worktree or automatically applying reviewer
  edits.
- Weakening the complete exact-head publication checkpoint.
- Making affected-domain specialist selection static or requiring every
  possible specialist on every diff.
- Adding, updating, or removing dependencies or accepting manifest/lockfile
  changes.
- Running live `ax sync` from the feature branch. Live convergence remains a
  post-merge action from a clean durable `main` worktree.

## Implementation Tasks

### 1. Encode phase-aware review and reviewer independence

- [x] 1.1 Replace the completed-code baseline's separately passable coverage
      lane IDs with the five accepted specialist reviewer IDs, while retaining
      the existing behavior, regression, maintainability, verification, and
      architecture concerns inside their reviewer contracts.
- [x] 1.2 Add a first-objective-proof baseline containing
      `code-quality-review` and `scrutinize`, plus required targeted-proof
      evidence in the POC expansion contract.
- [x] 1.3 Extend task-local review results and publication-checkpoint validation
      with reviewer-run identity, exact target identity, selected specialists,
      status, and normalized findings.
- [x] 1.4 Reject missing required reviewers, duplicate reviewer identities,
      stale results, unresolved blocking findings, and selected specialists
      without current passing results.
- [x] 1.5 Add a deterministic capacity-aware review-wave helper or equivalent
      executable contract that preserves the complete reviewer set across the
      minimum number of waves without counting coordinator capacity as a
      worker.

Acceptance:

- Completed POC and final implementation baselines contain exactly the five
  accepted reviewer skill IDs.
- The publication validator passes only when five distinct reviewer-run
  identities pass against the exact base and HEAD.
- A duplicate identity used for two reviewer skills fails even when every skill
  ID is present.
- A required affected-domain specialist cannot be omitted after selection.
- Selected specialists cannot reuse a core or specialist reviewer-run identity.
- First-objective-proof validation passes with separate Code Quality and
  Scrutinize identities plus targeted real-entrypoint verification, and does not
  require the other three final reviewers.
- Worker capacities smaller or larger than five preserve every required
  reviewer and produce the minimum number of waves.

First real confirmation:

- A focused contract fixture passes a five-reviewer final implementation wave,
  rejects its duplicate-identity variant, and proves the two-reviewer-plus-proof
  POC checkpoint independently.

Verification:

- `pnpm exec node --import tsx --test tests/unit/review-workflow-contract.test.ts`
- `pnpm exec node --import tsx --test tests/integration/mode-lifecycle.test.ts`

### 2. Make the five specialist skills findings-only and non-overlapping

- [x] 2.1 Convert `code-simplifier` into a read-only simplification reviewer
      with normalized findings and no edit or verification-after-edit workflow.
- [x] 2.2 Convert `deslop` into a read-only local-convention and AI-clutter
      reviewer with normalized findings and no edit authority.
- [x] 2.3 Remove automatic fixing and mutation-oriented gate language from
      `scrutinize`; always return evidence-backed findings, residual risk, and a
      verdict to the lane owner.
- [x] 2.4 Remove the fix-on-request exception from `diff-review`; keep its
      comprehensive correctness, regression, verification, security,
      performance, usability, and docs-impact lens.
- [x] 2.5 Align `code-quality-review` and all five output contracts so overlap is
      deduplicated at the barrier while each reviewer retains a distinct primary
      question.

Acceptance:

- None of the five reviewer skills allows `Edit`, `Write`, commits, staging, or
  automatic fixes.
- Simplification, Code Quality, and Scrutinize may overlap on simpler paths, but
  their primary lenses and evidence requirements remain distinguishable.
- Deslop stays scoped to branch-delta artifacts and neighboring local
  conventions rather than broad refactoring.
- Diff Review remains the primary correctness and regression owner.
- Every skill returns findings that the single Execute owner can batch without
  interpreting prose-only approval.

Verification:

- `pnpm exec node --import tsx --test tests/unit/review-workflow-contract.test.ts`
- `pnpm run skills:validate`
- Run `writing-skills` pressure scenarios for each reviewer: a real finding, a
  clean diff, attempted mutation, overlapping findings, and insufficient target
  evidence.

### 3. Align orchestration, invalidation, verification, and documentation routing

- [x] 3.1 Add immutable task packets, clean-context delegation, ready-queue
      scheduling, work-conserving waves, event-driven barriers, and slot
      backfilling to Review's portable orchestration contract.
- [x] 3.2 Add task-local finding normalization, barrier deduplication, one-owner
      batched fixes, and affected-surface intermediate reruns to Review and
      Execute.
- [x] 3.3 Preserve a complete final planning baseline before Execute handoff and
      a complete five-reviewer exact-head implementation wave before Finish.
- [x] 3.4 Add the environment/toolchain preflight and progressive verification
      ladder to Execute and the central verification rule.
- [x] 3.5 Exclude atomic plans and OpenSpec artifacts from Doc Smith, and run
      reader personas only once against stable user-facing or operational
      documentation.
- [x] 3.6 Keep detailed behavior in canonical skills/rules and use concise
      entrypoint alignment in repo-local and portable `AGENTS.md` files.

Acceptance:

- A delegated reviewer prompt can be constructed entirely from the task packet
  without conversation inheritance.
- Codex guidance defaults bounded reviewer delegation to
  `fork_turns="none"` and permits larger context only with a concrete reason.
- The workflow launches all ready reviewers together, waits at a phase barrier,
  and does not prescribe short status-polling loops.
- An intermediate fix reruns only affected surfaces, while any final base or
  HEAD change invalidates the complete publication checkpoint.
- Findings arriving from several reviewers do not authorize edits until the
  barrier closes and the Execute owner accepts the batch.
- Preflight catches runtime, package-manager, command, credential, and
  representative-command blockers before implementation writes.
- Narrow verification runs during implementation; targeted proof runs at the
  POC checkpoint; the full required suite runs on stable final heads.
- Planning contracts receive planning Review without Doc Smith reader personas.

Verification:

- `pnpm exec node --import tsx --test tests/unit/agent-instructions.test.ts tests/unit/review-workflow-contract.test.ts`
- `pnpm exec node --import tsx --test tests/integration/mode-lifecycle.test.ts`
- Inspect the final source diff and confirm no runtime config, provider policy,
  dependency, or persistent reviewer-state surface was added.

### 4. Run full shared-behavior validation

- [x] 4.1 Run AI-readiness upkeep against the changed instruction, skill,
      validator, fixture, and task-command surfaces.
- [x] 4.2 Run `writing-skills` against every changed shared skill behavior before
      committing.
- [x] 4.3 Run focused tests first, then the complete unit and integration suites,
      skill validation, instruction validation, and AX source validation.
- [x] 4.4 Confirm only the plan and its implementation are present in the final
      change set and leave live runtime sync for the post-merge `main` workflow.

Verification:

- `pnpm run biome:lint-format:staged`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm run skills:validate`
- `pnpm ax instructions validate`
- `pnpm ax skills validate`
- `pnpm ax validate`

## Acceptance Summary

- Completed code always receives five independent findings-only reviewers:
  Simplification, Code Quality, Deslop, Diff Review, and Scrutinize.
- A POC's first proof pauses for Code Quality, Scrutinize architecture/claim
  tracing, and targeted behavior proof instead of the full final baseline.
- A stable completed POC or final implementation receives the complete
  five-reviewer wave on the exact head.
- Adaptive specialists expand review according to actual diff risk without
  reducing the five-reviewer floor.
- Delegated work starts from immutable task packets and clean context.
- Ready reviewers consume available capacity in work-conserving waves and join
  at event-driven barriers.
- Findings are deduplicated and fixed in batches by one Execute owner.
- Intermediate evidence reruns by affected surface; publication evidence
  remains fully exact-head and exact-base.
- Environment issues fail early and verification grows from focused checks to
  complete stable-head proof.
- Planning artifacts no longer pay for duplicate Doc Smith reader personas.
- No runtime slot limit, dependency manifest, lockfile, provider policy,
  lifecycle authority, or merge/deployment contract changes.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Five reviewers make small diffs slower | Launch them concurrently with clean task packets; keep additional specialists adaptive and remove duplicate planning personas. |
| Reviewer lenses produce duplicate findings | Give each reviewer a primary contract and deduplicate at one task-local barrier before edits. |
| Lane-scoped invalidation misses a relevant consequence | Apply it only during intermediate convergence; rerun the complete required set at final planning handoff and publication. |
| Findings-only Simplification and Deslop no longer perform convenient cleanup directly | Route findings to the single Execute owner, who applies accepted fixes coherently and preserves behavior. |
| Clean-context reviewers miss an important decision | Require accepted decisions, reuse boundaries, exact target identity, rules, and verification evidence in every task packet; allow targeted follow-up context when evidenced. |
| Runtime capacity is lower than the required reviewer count | Preserve all reviewers across successive work-conserving waves; never silently lower the gate. |
| Runtime capacity is higher but remains idle | Fill every safe worker slot from the ready queue and backfill on completion while keeping one coordinator. |
| Instruction-level scheduling guidance is ignored by a harness | Keep wave construction in an executable pure contract where practical, cover the portable guidance with regression tests, and report runtime capacity as an external constraint rather than silently reducing coverage. |
| Delaying the full suite hides a defect | Run risk-proportionate focused verification continuously, targeted real-path proof at the checkpoint, and the complete required suite at every stable final head. |
| Doc Smith routing becomes too narrow | Exclude only planning contracts; retain reader personas for stable user-facing and operational documentation. |
| Task-local evidence grows into a private orchestration system | Keep it recomputable and uncommitted; add no database, sidecar, daemon, or durable ledger. |
