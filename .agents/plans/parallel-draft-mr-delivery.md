# Parallel Draft MR Delivery

## Goal

Speed up multi-MR feature delivery by developing eligible delivery units in
parallel, one writer and worktree per MR, while one coordinator keeps the
stack current and follows every pipeline and hosted-review cycle through
technical readiness.

Publishing an MR is an intermediate state. The workflow completes only when
every MR is still draft, its effective diff is current, required pipelines
pass, and every configured required reviewer has no actionable feedback in its
complete available feedback surface. The complete stack is then ready for the
user's acceptance. Marking ready and merging remain separate, explicitly
authorized actions.

## Context

The current delivery guidance preserves one total Git predecessor order but
encourages sequential execution: implement one unit, publish it, clear Nitro,
and only then advance. That leaves independent work idle. It also allows an
agent to stop after MR creation, a green pipeline, or the reassuring opening
sentence of an automated-review note.

GitLab MR `ai/nitro!845` provides a historical monitoring-failure snapshot from
2026-07-10 at 15:11 EDT. Nitro's note began with `No findings to raise` but
continued by carrying two prior findings forward as still applicable and worth
addressing before merge. The next commit changed only CI metadata, the pipeline
passed, two Nitro discussions remained unresolved at that snapshot, and
follow-through stopped until later activity resumed. Later resolution does not
remove the regression value of that contradictory note shape. The first
iteration should correct agent behavior through strong instructions and
scenario validation, without introducing persistent workflow state.

This plan starts from `29e2aefb87aa298993d0820968e59823bf3fa125` and includes
the following pre-existing atomic-plan/POC cleanup as accepted adjacent scope
in the same final MR:

- `AGENTS.md`
- `instructions/AGENTS.md`
- `openspec/specs/openspec-implementation-rehearsal/spec.md`
- `openspec/specs/reviewed-plan-artifacts/spec.md`
- `rules/git-and-review.md`
- `rules/investigation-and-implementation.md`
- `skills/execute/SKILL.md`
- `skills/finish/SKILL.md`
- `skills/plan/SKILL.md`
- `tests/integration/mode-lifecycle.test.ts`
- `tests/unit/agent-instructions.test.ts`

The two existing canonical-spec edits remain part of that accepted cleanup;
this feature does not expand them or create a new OpenSpec change. The final
Review must inspect the combined target-base diff, including those edits.

## Decisions

- Deliver this workflow improvement and the accepted adjacent cleanup in one
  final MR using this atomic plan. This is the user's explicit route for the AI
  repo even though the portable semantic router would otherwise select
  OpenSpec for a durable cross-component contract.
- The AI repo uses atomic plans for new repository work and does not create a
  new OpenSpec change for this feature. Broader AI-repo work is split into
  separately accepted atomic changes instead of manufacturing an OpenSpec
  stack. Keep this project override in repo-local policy; portable instructions
  remain capable of routing other repositories to OpenSpec.
- Create one branch and worktree per planned MR before implementation begins.
  Each worktree has exactly one writer; the coordinator schedules work and
  provider actions but never edits another owner's worktree.
- Classify each unit in the accepted planning handoff:
  - `independent` requires no predecessor output beyond the accepted plan and
    starts immediately;
  - `contract-dependent` consumes an interface or behavior fully fixed by the
    accepted plan and starts once that contract is present in the stack seed;
  - `implementation-dependent` requires predecessor code, generated artifacts,
    runtime behavior, or verification evidence and waits for that output.
  A contract is stable only when the accepted planning artifact resolves its
  behavior and verification with no material decision left for implementation.
- Prefer disjoint paths, but do not require them. Declare overlapping paths as
  integration hotspots, and make the descendant owner responsible for normal
  restack conflict resolution. Material contract conflicts return to Plan.
- Preserve one total Git predecessor order. Seed the branch chain from the
  accepted stack base before implementation: the root unit targets the normal
  target branch, and every descendant targets its immediate predecessor source
  branch. Development and feedback loops run concurrently. Before first
  publication, each descendant restacks onto the predecessor's current
  published head so its MR contains only its unit diff.
- While a predecessor remains open, its child continues targeting that source
  branch. After a predecessor squash-merges, retarget the immediate child to
  the normal target branch and restack it with the verified merged commit, old
  predecessor head, and child head so predecessor commits are not replayed.
  Deeper descendants continue targeting their immediate predecessor branches;
  repeat the transition one level at a time during bottom-to-top merge.
- Create every final MR as draft and verify the live provider state after
  creation or update. CI, Nitro, Codex Review, approvals, or internal
  `draft_stack_ready` status never remove draft status.
- Keep one coordinator active after publication. It monitors the full pipeline
  graph and configured hosted review, routes in-scope failures to the owning
  worktree, and continues until the draft stack is technically ready or a
  genuine authority, contract, credential, or provider blocker requires user
  action.
- For every configured required reviewer, inspect its complete available
  feedback surface rather than a summary status. For Nitro specifically, read
  the entire note and every unresolved Nitro-authored discussion. Do not
  classify a result from its first sentence or from phrases such as
  `no findings` or `no blocking issues`. Actionable language anywhere in the
  response remains active until fixed or explicitly dispositioned in the task.
- Keep coordination, review evidence, and dispositions in the task and live
  provider state. Do not create a ledger, YAML/JSON sidecar, workflow database,
  scheduler, or intermediate tracking file.
- After every head-changing push, request fresh configured review and monitor
  the new pipeline graph. A green parent pipeline does not hide failed child or
  downstream pipelines.
- Bind readiness to the effective diff: source HEAD, target branch, and exact
  target HEAD. An upstream change invalidates descendant review evidence even
  if the descendant source SHA does not change.
- Coalesce restacks. When several upstream heads arrive before a descendant is
  ready to rebase, skip obsolete intermediate heads and restack directly onto
  the newest reviewed predecessor.
- Restacks are required history repair and use an exact expected remote-head
  lease. The lane owner rechecks predecessor and remote source identity before
  pushing so concurrent external work is never overwritten.
- If the lease is rejected or the remote branch changes unexpectedly, stop the
  push, fetch and inspect the external commits, and re-establish ownership or
  perform an explicit handoff before integrating them. Never retry by merely
  replacing the lease with the newly observed SHA.
- On resume, reconstruct state from worktrees, branches, MRs, full discussions,
  and pipeline graphs. Do not trust stale conversational summaries as current
  evidence.
- Route feedback to the current lane owner. If the original writer is no
  longer available, confirm it is inactive and perform the existing ownership
  handoff with branch, worktree, HEAD, changed and untracked paths, and diff
  fingerprint before the replacement writer edits. If exclusive ownership
  cannot be established, that lane is blocked without blocking independent
  lanes.
- `draft_stack_ready` reports technical readiness while all MRs remain draft.
  It grants no merge authority.
- Explicit merge language such as `proceed to merge` starts a frozen,
  bottom-to-top terminal sequence. Revalidate the stack, mark only the current
  bottom MR ready, merge it, verify the merged commit, restack and refresh the
  next draft MR, then mark that MR ready immediately before its merge. Plain
  `proceed`, manual ready state, or review requests do not grant merge
  authority.
- If marking ready triggers a new required provider review, wait for and handle
  that review before merging even when the source and target SHAs are unchanged.
- If an agent-controlled MR becomes stale after being marked ready but before
  merge, return it to draft and refresh its gates.

## Scope

In scope:

- Align repo and portable lifecycle instructions with parallel worktree lanes,
  draft-only publication, persistent Finish follow-through, and explicit merge
  authority.
- Update implementation ownership rules so parallel units may declare
  integration hotspots instead of requiring globally disjoint paths.
- Update Git/review and Fullscript Nitro rules for effective-diff freshness,
  full-note reading, unresolved-discussion inspection, complete pipeline-graph
  monitoring, coalesced restacking, and draft-stack readiness.
- Update Plan, Execute, Review, and Finish skills so their handoffs and authority
  boundaries describe the same workflow.
- Recognize explicit `proceed to merge` authority without treating plain
  `proceed`, ready state, or review requests as merge authorization.
- Add focused instruction/contract regression tests and writing-skills
  scenarios for the accepted workflow.
- Preserve the existing atomic-plan/POC cleanup already present in this
  worktree as declared Context scope and review the combined final diff.

Out of scope:

- A persisted feedback ledger or state file.
- A custom scheduler, monitoring daemon, workflow service, or database.
- Natural-language parsing code for Nitro notes.
- Automatic merge without explicit authority.
- Deploying, cleaning up worktrees or branches, or changing live runtime state
  before verified merged source exists.
- Creating a new OpenSpec change or expanding the existing canonical-spec edits for
  this feature.
- Solving arbitrary contract dependencies by speculative parallel work.

## Implementation

### 1. Align lifecycle and ownership contracts

Update the repo entrypoint, portable instructions, and investigation rules so
Plan records total Git order, semantic parallel eligibility, expected worktree
ownership, and integration hotspots. Execute creates or verifies one owned
worktree per eligible unit and allows those units to progress concurrently.

Keep restack propagation ordered. A unit may continue cohesive local work while
its effective diff is stale, but it cannot publish, claim current review, or
become ready until its owner restacks onto the current predecessor.

Files or areas:

- `AGENTS.md`
- `instructions/AGENTS.md`
- `rules/investigation-and-implementation.md`
- `rules/handoff-and-resume.md`
- `rules/session-startup.md`
- `skills/plan/SKILL.md`
- `skills/execute/SKILL.md`

### 2. Make draft publication and follow-through persistent

Update Finish so every final MR is published as draft, its live draft state is
verified, and it remains draft through all implementation and review cycles.
Finish must stay active after publication, monitor parent and downstream
pipelines plus configured hosted review, and route in-scope failures or findings
back to the current lane owner without requiring another user prompt. Preserve explicit
no-pipeline policy, required versus allowed-failure jobs, and provider-specific
manual-job semantics. Follow the newest non-superseded pipeline; canceled or
superseded older pipelines do not pass or fail the current gate. An inaccessible
required downstream pipeline blocks readiness, while a transient provider
outage remains under monitoring or a supported wakeup. Missing credentials or
permissions are genuine user-action blockers.

Review normalizes the complete configured feedback surface retrieved by Finish.
Require full Nitro-note reading and inspection of every unresolved
Nitro-authored discussion. Treat any actionable request or carried-forward
concern as active even when the response begins with reassuring language.
Latest-head success is insufficient while older findings still apply.

The universal hosted-review rule is to inspect all actionable feedback from
configured required reviewers. The Nitro-specific rule below adds full-note
and unresolved Nitro-discussion inspection.

Files or areas:

- `rules/git-and-review.md`
- `rules/fullscript/nitro-review.md`
- `skills/review/SKILL.md`
- `skills/finish/SKILL.md`

### 3. Tighten terminal authority and regression proof

Extend the existing terminal-authority contract so `proceed to merge` grants
merge authority while plain `proceed`, an MR becoming ready, or a review
request does not. Keep merge execution just-in-time and bottom-to-top.

Add regression assertions and writing-skills scenarios covering parallel
ownership, draft invariants, effective-diff invalidation, persistent pipeline
and Nitro monitoring, contradictory review summaries, unresolved carried-forward
findings, resume behavior, coalesced restacks, and explicit merge authority.

Files or areas:

- `skills/finish/scripts/finish-contract.ts`
- `tests/integration/mode-lifecycle.test.ts`
- `tests/unit/agent-instructions.test.ts`

## Acceptance

- A multi-unit delivery plan records semantic eligibility and a total Git order,
  and each eligible unit can be implemented concurrently in its own singly
  owned worktree.
- Overlapping paths do not prohibit parallel work when integration ownership is
  explicit; unresolved contract conflicts still return to Plan.
- Every final MR is created as draft, verified live as draft, and remains draft
  after local Review, successful CI, clean Nitro, approvals, and
  `draft_stack_ready`.
- MR creation, a pending pipeline, a green parent pipeline, a Nitro request, or
  a reassuring first sentence never ends Finish follow-through.
- Finish monitors downstream pipelines and inspects the complete available
  feedback surface for every configured required reviewer after every relevant
  head change; Nitro specifically requires the full note and all unresolved
  Nitro-authored discussions.
- A Nitro response shaped like `No findings to raise ... two unresolved threads
  still apply and are worth addressing before merge` is classified as active
  feedback and routed to Execute.
- In-scope pipeline and Nitro findings are fixed, locally reviewed, pushed, and
  re-reviewed without another user prompt. Material contract changes and real
  authority or external blockers return to the user.
- Descendant evidence becomes stale when its predecessor HEAD changes.
  Restacks coalesce onto the newest predecessor and use exact remote-head
  leases.
- A rejected lease stops publication until the external commits and ownership
  are understood; the workflow never retries by blindly accepting the new
  remote SHA.
- Resume reconstructs state from live Git and provider evidence without reading
  or writing a persisted ledger, and safely transfers a lane when its original
  writer is unavailable.
- `draft_stack_ready` requires every effective diff, pipeline graph, approval,
  dependency, and actionable feedback item from configured required reviewers
  to be current, including unresolved Nitro-authored discussions when Nitro is
  required, while leaving all MRs draft.
- Plain `proceed` authorizes publication/follow-through only. Explicit
  `proceed to merge` authorizes a revalidated, one-at-a-time ready-and-merge
  sequence. Manual ready state and review requests never imply merge authority.
- No new OpenSpec change, workflow sidecar, scheduler, service, or state
  database is introduced.
- Required jobs and accessible required downstream pipelines pass, allowed
  failures/manual jobs follow project policy, superseded pipelines are ignored
  in favor of the newest effective diff, and explicit no-pipeline state remains
  valid when project policy permits it.

## Verification

Run behavior-specific verification against the exact implementation diff:

1. Focused lifecycle and instruction regression tests:

   ```bash
   pnpm exec node --import tsx --test tests/integration/mode-lifecycle.test.ts tests/unit/agent-instructions.test.ts
   ```

2. Focused terminal-authority tests, including positive `proceed to merge` and
   negative `proceed`, ready-state, and review-request cases.
3. Full unit and integration suites:

   ```bash
   pnpm run test:unit
   pnpm run test:integration
   ```

4. Skill and repository formatting/lint validation:

   ```bash
   pnpm run skills:validate
   pnpm run biome:lint-format
   ```

5. Invoke the installed `writing-skills` workflow against the changed agent
   behavior with the scenarios below. The gate passes only when every scenario
   produces the accepted action without contradictory instructions or an
   unaddressed skill-quality finding:
   - three eligible units start in separate worktrees and preserve total Git
     ancestry through a coalesced upstream restack;
   - an implementation-dependent unit waits for required generated or runtime
     output, while a contract-dependent unit starts only after its fixed
     contract enters the stack seed;
   - an ordinary integration-hotspot conflict routes to the descendant owner,
     while a material contract conflict returns to Plan;
   - an MR is created draft and stays draft after clean local and hosted gates;
   - a pipeline or Nitro review remains pending and Finish keeps monitoring;
   - a green parent has a failed child pipeline and the lane remains active;
   - the latest Nitro note begins `No findings to raise` but carries prior
     concerns forward, and the owner fixes them instead of stopping;
   - the stack is technically ready and Finish reports `draft_stack_ready`
     without marking MRs ready;
   - `proceed to merge` marks and merges one current MR at a time, while plain
     `proceed` and manual ready state do not merge.
   - a ready transition starts a new required provider review and merge waits
     for that gate instead of treating the pre-ready result as sufficient;
   - a restack push loses its exact lease and stops for external-commit and
     ownership inspection instead of retrying blindly;
   - an original lane writer becomes unavailable and a replacement resumes only
     after the standard ownership handoff;
   - allowed manual jobs, superseded pipelines, explicit no-pipeline policy,
     and inaccessible required child pipelines receive their declared terminal
     treatment.
6. Exercise AX sync, status, and validation against isolated HOME and runtime
   roots:

   ```bash
   mkdir -p /tmp/ax-parallel-draft-home
   mkdir -p /tmp/ax-parallel-draft-runtime
   AX_ISOLATED_RUNTIME=1 HOME=/tmp/ax-parallel-draft-home pnpm ax --runtime-root /tmp/ax-parallel-draft-runtime sync
   AX_ISOLATED_RUNTIME=1 HOME=/tmp/ax-parallel-draft-home pnpm ax --runtime-root /tmp/ax-parallel-draft-runtime status
   AX_ISOLATED_RUNTIME=1 HOME=/tmp/ax-parallel-draft-home pnpm ax --runtime-root /tmp/ax-parallel-draft-runtime validate
   ```

   The gate passes when sync completes, status reports no managed-runtime drift,
   and validate succeeds. Do not refresh the live runtime from this feature
   branch. If the isolated HOME cannot authenticate a configured remote, report
   the verification gap and rely on the isolated AX integration suite; never
   retry with the normal HOME because `--runtime-root` alone does not isolate
   configured live target paths.

## Risks and Mitigations

- **Restack churn:** Frequent upstream fixes can repeatedly invalidate
  descendants. Coalesce onto the newest reviewed predecessor instead of
  replaying every intermediate head.
- **Conflicting parallel edits:** Shared paths can create expensive rebases.
  Declare integration hotspots and give normal conflict resolution to the
  descendant owner; return contract conflicts to Plan.
- **False clean hosted review:** Review summaries may mix reassuring openings
  with carried-forward concerns. Require full-note and unresolved-discussion
  inspection rather than keyword or first-line classification.
- **Monitoring never terminates:** External systems may remain pending. Continue
  monitoring through supported waits or wakeups and stop only for a genuine
  blocker that the current authority cannot resolve.
- **Provider-state drift:** An MR command may not produce the intended draft or
  target state. Read live MR state after every provider mutation.
- **Accidental merge authority:** Ready status and positive reviews can be
  mistaken for permission. Keep draft readiness separate and test explicit
  terminal-authority wording.
- **Instruction-only behavior regresses:** Regex assertions alone cannot prove
  agent conduct. Pair contract tests with writing-skills scenario evaluation
  based on the observed `ai/nitro!845` failure shape.

## Implementation Handoff

Implement this plan in `/Users/rene.hernandez/.codex/worktrees/5b04/ai` on
`codex/plan-parallel-mr-stacks`. Include and review the exact pre-existing
cleanup declared in Context, but do not expand its two canonical-spec edits or
create a new OpenSpec change. Use one write owner for this worktree, keep the
final change in one MR, and stop after Review and draft publication/follow-through
unless the user separately authorizes merge.
