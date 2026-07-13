# Restore Specialist Leverage Within The Five-Mode Workflow

## Goal

Keep Explore, Plan, Execute, Review, and Finish as the only lifecycle modes
while restoring the bounded specialist skills, executable contracts, and
regression scenarios that were over-compressed during the five-mode cutover.

The first real confirmation is a paired pressure test:

- a brainstorming request produces the map-first orientation, domain-term
  pass, recommended defaults, and short discussion queue; and
- a POC MR-description fixture derived from `ai/nitro!848` is rejected when it
  fills an author-owned template section or narrates routine gates, then is
  rendered as concise reviewer-facing content through the restored description
  policy.

## Context

The five-mode simplification correctly separated lifecycle authority, but it
retired nineteen packages and moved only abbreviated portions of several
specialist contracts into the mode skills. The resulting runtime is internally
consistent: `ax status` reports the configured mode-only inventory without
drift. The source contract itself has lost leverage.

Observed losses include:

- `Explore` mentions an orientation map but no longer carries the tested
  brainstorming format, hard stops, scope-pressure rules, slicing guidance, or
  earliest-objective-proof behavior;
- `Finish` contains a short description-policy paragraph but no longer has the
  template-ownership, read-before-update, reviewer-risk filtering, or concrete
  regression scenarios previously owned by `change-request-create`;
- `Plan` describes delivery-unit quality but no longer has the reusable
  `openspec-tasks` parser and audit contract;
- `Review` names baseline lanes and providers but does not define the reviewer
  rubrics or the provider-specific retrieval and normalization workflows; and
- the shared instructions still require a nonexistent `hallmark` skill even
  though that frontend specialist is intentionally retired and will be
  replaced separately in the future.

The archived five-mode design said required behavior would move into the owner
while bounded specialists remained directly invokable. Commit
`86a5d8d211592d71336ca8b65d54612b4e237937`, the parent of the five-mode
cutover, is the pinned recovery source for the retired skill packages and their
tests. This change restores the intended boundary from that evidence instead
of recreating the former lifecycle graph wholesale.

## Decisions

### Keep five modes as the sole authority owners

Specialists add domain workflow and validation but never create a sixth mode or
expand mutation authority:

- Explore owns read-only discovery and invokes `brainstorming` or
  `start-project` when their trigger matches.
- Plan owns planning-artifact writes and invokes `openspec-tasks` to inspect an
  existing OpenSpec delivery shape.
- Review owns read-only local and hosted-finding normalization and invokes the
  provider review specialists.
- Finish owns provider mutation and invokes `change-request-create` plus the
  selected GitHub or GitLab creation adapter.

An explicitly named specialist routes through its owning mode's authority
boundary. Calling a specialist never independently authorizes repository,
tracker, provider, merge, deployment, or cleanup writes.

### Restore proven specialists rather than inventing a generic framework

Recover the last pre-cutover contracts as source material, then update their
terminology and cross-links for the five-mode model. Restore these bounded
specialists:

| Owner | Specialists |
| --- | --- |
| Explore | `brainstorming`, `start-project` |
| Plan | `openspec-tasks` |
| Review | `github-adapter-review`, `gitlab-adapter-review`, `nitro-review-feedback` |
| Finish | `change-request-create`, `github-pr-create`, `glab-mr-create` |

Do not add a new provider-neutral mutation framework or one broad
`hosted-review` abstraction. The existing specialist boundaries already
separate host-neutral description policy, provider mechanics, provider review
surfaces, and automated-review feedback.

### Restore behavior, not the retired lifecycle graph

Keep these names retired:

- `session-start`; its behavior remains in `rules/session-startup.md` and mode
  preflights;
- `plan-ready`, `plan-review`, `plan-orchestrator`, `plan-poc`,
  `plan-unit-delivery`, and `plan-unit-sequencer`; their lifecycle authority
  remains in Plan, Execute, Review, and Finish;
- `merge-followthrough`; Finish remains the terminal workflow entrypoint; and
- `review-feedback-routing`; provider precedence remains direct user
  instruction, project policy, workflow-policy profile, then remote inference.

Keep `codex-review-feedback` retired. GitHub PR review continues to inspect the
artifact, diff, threads, approvals, and Actions state, but the workflow does not
request, poll, normalize, or gate on Codex-authored PR feedback.

Recover only still-required deterministic helpers from those retired packages
inside the owning mode or restored specialist. Do not restore planning-only
MRs, committed ledgers, private sidecars, duplicate handoff schemas, or the old
multi-entry orchestration graph.

### Reinstate the brainstorming interaction contract

The restored `brainstorming` specialist must preserve the behavior that was
previously pressure-tested:

- inspect project context before asking discoverable questions;
- lead with a compact orientation map;
- always include a lightweight domain-terms pass;
- keep a discussion queue of one to three material decisions;
- show recommended defaults and do not re-litigate accepted ones;
- hard-stop when a recommendation would smuggle a high-cost architecture or
  safety decision;
- separate first proof from future platform shape;
- require a visible end-to-end first confirmation in the first slice, or the
  second after at most one setup-only slice; and
- recommend the appropriate artifact without writing it from Explore.

Explore should route matching requests to this specialist instead of trying to
duplicate its detailed contract.

### Reinstate project-intake boundaries

The restored `start-project` specialist owns the Project Brief format,
new-effort trigger boundary, and whole-turn no-write behavior. The brief
contains the goal, scope, systems, current state, interfaces, constraints,
assumptions, risks, open questions, recommended next mode, and a tracker-ready
summary. A mixed request such as “start this project and create tickets”
returns the brief and stops;
tracker or artifact mutation requires a later accepted transition out of
Explore.

### Make change-request descriptions a required specialist pass

`change-request-create` is the host-neutral description-policy owner. Finish
must use it before every PR/MR creation or description update, including POCs,
and then delegate provider mechanics to `github-pr-create` or
`glab-mr-create`.

The description contract must:

- read the live template and existing body before authoring or updating;
- preserve manual content, links, checklist state, and user/author-owned
  sections;
- never auto-fill a template section that explicitly requires human or MR-owner
  input;
- describe current scope, intent, behavior, review focus, and only evidence
  that helps assess changed behavior, answers a reviewer request, or exposes an
  actionable gap;
- omit routine commands, clean CI, clean automated-review state, private
  workflow artifacts, local reviewer identities, fingerprints, and process
  narration;
- use a body file or another shell-safe mechanism for multiline Markdown;
- read back the hosted body after mutation and block or restore when manual
  content was damaged; and
- apply the POC qualifier (`POC:` title, review-only, close unmerged) without
  turning the body into a lifecycle ledger.

The Nitro `default.md` Testing-section ownership language and the body shape
observed on `ai/nitro!848` become anonymized regression fixtures. This plan does
not mutate that MR.

### Restore OpenSpec task-shape enforcement as a Plan specialist

Restore the portable `openspec-tasks` parser and audit helper in its owning
skill folder. Preserve the useful contract:

- top-level headings represent reviewable delivery units;
- nested checkboxes represent cohesive work items;
- lifecycle-only validation, documentation, review, or deployment phases fail
  unless that machinery is the feature;
- objective proof appears in unit one, or unit two after at most one setup-only
  unit;
- duplicate IDs, orphan tasks, invalid manual work, broad mixed outcomes, and
  unjustified sizing return structured failures; and
- Plan receives `pass`, `needs_spec_redesign`, or `needs_human_action` without
  the specialist rewriting `tasks.md` automatically.

Keep the prior task-shape sizing contract: two to six nested work items is the
normal target; seven or eight requires an attached `Justification:`; more than
eight returns `needs_spec_redesign`; and a one-item unit requires a concrete
risk, deployment, reviewability, or ownership rationale. These are task-shape
signals, not substitutes for Plan and Review's semantic delivery decomposition.
Update terminology only where current five-mode delivery rules intentionally
changed. Do not restore the old ledger, sequencer state, or planning-MR
workflow.

### Define Review lanes instead of naming them only

Add a reviewer catalog owned by Review. Every baseline ID must resolve to one
portable rubric defining:

- objective and target type;
- required inputs and exact target identity;
- questions and evidence to inspect;
- `passed`, `finding`, and `blocked` criteria; and
- the normalized output shape with source evidence.

Cover all current planning and implementation baseline IDs. Add affected-domain
specialists through the same catalog boundary rather than free-form names that
have no prompt contract.

Restore the GitHub and GitLab host-review specialists plus Nitro's Fullscript
GitLab reviewer specialist as read-only adapters. They retrieve the complete
provider surface and return the normalized input expected by Review. Finish
continues to own review-request writes and provider polling. Nitro handling
must read complete notes and unresolved Nitro-authored discussions and bind
feedback to the effective diff. GitHub review has no Codex reviewer request,
polling, normalization, or readiness gate.
Each adapter must discover its required CLI or connector before use and report
an explicit unavailable, unauthenticated, or degraded state when the provider
surface cannot be verified. Local refs, memory, or a summary field never stand
in for inaccessible required hosted evidence.

### Remove the stale frontend-skill requirement

Remove `hallmark` from repo and portable instructions. Do not replace it with a
different mandatory frontend skill in this change. A future user-owned frontend
specialist will be planned and installed separately.

## Scope

### In Scope

- Restore the nine bounded specialist packages listed above, including OpenAI
  metadata and portable helpers owned by each package.
- Update Explore, Plan, Review, and Finish to invoke the specialists at their
  respective boundaries.
- Add the Review rubric catalog and deterministic catalog validation.
- Restore focused parser/validator logic for OpenSpec task shape and Nitro
  feedback only where it remains compatible with current five-mode contracts.
- Update `ax.config.json` so restored specialists are installed in both
  profiles and removed from `runtime.retiredSkills`.
- Update repo and portable instructions/rules to distinguish lifecycle modes
  from bounded specialists.
- Remove the stale `hallmark` instruction without prescribing a replacement.
- Replace the cutover test's blanket retirement assertion with assertions that
  the five modes remain the only authority owners and restored specialists are
  bounded to an owner.
- Restore or rewrite focused skill regression tests using the pre-cutover tests
  and the observed post-cutover failures as evidence.
- Run `writing-skills` and AI-readiness review against every changed shared
  behavior surface.

### Out Of Scope

- Restoring the old plan orchestration graph, planning-only MRs, committed
  workflow ledgers, private plan sidecars, or runtime transaction state.
- Restoring `merge-followthrough`, `review-feedback-routing`, or
  `session-start` as public skills.
- Restoring `codex-review-feedback` or requesting/gating on Codex PR review.
- Changing the five lifecycle modes or their mutation authority.
- Creating a new generic provider framework.
- Implementing or selecting Rene's future frontend-design skill.
- Updating or closing `ai/nitro!848`.
- Refreshing the live AX runtime from this feature branch; live sync occurs
  only after merge from a clean default-branch source.

## Implementation Tasks

### 1. Restore Explore specialists

- [x] 1.1 Recover and modernize `brainstorming` and `start-project`, their
      OpenAI metadata, and focused regression scenarios.
- [x] 1.2 Route matching Explore requests through the specialists while
      preserving Explore's read-only authority and explicit Plan transition.

Acceptance:

- A brainstorming request emits the orientation map, domain terms, one-to-three
  item discussion queue, recommended defaults, and first question.
- Hard-stop and earliest-objective-proof scenarios reproduce the pre-cutover
  protections.
- A project-intake request emits the complete Project Brief.
- Mixed intake-plus-write prompts perform no repository, tracker, or provider
  mutation in that turn.

### 2. Restore planning and Review leverage

- [x] 2.1 Recover `openspec-tasks` with its self-contained parser, structured
      audit, current delivery-unit terminology, and focused tests.
- [x] 2.2 Add the Review rubric catalog and require every baseline and selected
      specialist ID to resolve to a complete rubric.
- [x] 2.3 Recover the GitHub and GitLab host-review specialists plus Nitro's
      reviewer specialist, and route their normalized read-only findings
      through Review.

Acceptance:

- Existing valid OpenSpec tasks pass without mutation.
- Lifecycle-only groups, late objective proof, duplicate IDs, and invalid
  manual work fail with the correct structured status.
- Two-to-six work-item units pass the sizing shape; seven or eight requires a
  justification; more than eight and unjustified one-item units return
  `needs_spec_redesign`.
- Every current baseline reviewer has a validated objective, inputs, decision
  criteria, and output contract.
- Provider adapters return complete, effective-diff-bound findings without
  gaining fix, publication, or merge authority.
- Missing or unauthenticated provider tooling returns an explicit degraded or
  blocked result instead of a guessed pass.
- GitHub PR review contains no Codex request, polling, feedback normalization,
  or readiness requirement, and `codex-review-feedback` remains retired.

### 3. Restore change-request authoring and provider adapters

- [x] 3.1 Recover `change-request-create`, `github-pr-create`, and
      `glab-mr-create` with Finish-aware authority and template-safe workflows.
- [x] 3.2 Require Finish to route every create/update body, including POCs,
      through `change-request-create` before provider mutation.
- [x] 3.3 Add regression fixtures for reviewer-risk filtering, protected
      template sections, read-before-update preservation, shell-safe body
      updates, readback recovery, and POC description shape.

Acceptance:

- The `ai/nitro!848`-derived fixture fails before the restored policy and passes
  with routine gate narration removed.
- Nitro's human-owned Testing section is left for the MR owner instead of being
  auto-generated.
- Manual sections and checklist state survive updates.
- Provider mechanics cannot bypass the shared description-policy pass.
- POC bodies remain reviewer-facing while clearly marked review-only and
  close-unmerged.

### 4. Align runtime and instructions

- [x] 4.1 Add restored specialists to the managed skill block, remove only
      those names from `runtime.retiredSkills`, and update mode/specialist
      inventory validation.
- [x] 4.2 Align `AGENTS.md`, `instructions/AGENTS.md`, relevant rules, and mode
      metadata with the new routing boundaries.
- [x] 4.3 Remove `hallmark` from both instruction entrypoints without adding a
      replacement frontend specialist.

Acceptance:

- AX desired inventory contains all restored specialists in personal and work
  profiles.
- Retired lifecycle names remain absent.
- Static validation fails if a restored specialist is referenced without an
  installed source or if a mode delegates authority to it incorrectly.
- No managed instruction names `hallmark` or another mandatory frontend skill.

### 5. Validate behavior and preserve simplification

- [x] 5.1 Run focused unit and integration suites, skill validation, AX
      validation, `writing-skills`, and AI-readiness review.
- [x] 5.2 Inspect the final target-base diff to confirm it restores specialist
      leverage without reintroducing the retired orchestration graph.

Acceptance:

- Focused RED/GREEN scenarios cover the two observed regressions:
  brainstorming-map loss and POC MR-description drift.
- Restored pre-cutover tests are narrowed to current contracts rather than
  copying obsolete ledger or planning-MR expectations.
- The five modes remain the only lifecycle authority packages.
- Specialist helpers are self-contained and installable across Codex, Claude,
  and the canonical Agents runtime.
- Review finds no unresolved correctness, scope, regression, documentation, or
  AI-readiness findings.

## Verification

- `pnpm run skills:validate`
- Focused unit tests for each restored specialist family
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm ax status`
- `pnpm ax validate`
- `pnpm exec biome check <changed TypeScript and JSON paths>`
- `git diff --check`
- `writing-skills` pressure tests for changed skill behavior
- AI-readiness upkeep review of runtime config, instruction routing, tests, and
  install/validation coverage

After merge, verify a clean local `main` source and run live `pnpm ax sync`.
Do not sync the live runtime from the feature branch or this disposable
worktree.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Restored specialists recreate lifecycle ambiguity | Bind each specialist to one owning mode and test that it cannot expand authority. |
| Copying old packages restores obsolete ledgers or planning MRs | Recover behavior selectively and reject old orchestration/state contracts in tests. |
| Provider adapters diverge from shared description policy | Make `change-request-create` the mandatory body-policy pass and keep provider adapters mechanical. |
| Reviewer names still lack meaningful behavior | Validate every reviewer ID against a complete rubric catalog. |
| OpenSpec task rules conflict with current semantic decomposition | Keep task audit mechanical and leave architecture-dependent split decisions with Plan and Review. |
| The skill list becomes noisy again | Restore only bounded, high-leverage specialists with distinct triggers; keep lifecycle names retired. |
| Runtime changes leak from a feature branch | Limit implementation verification to isolated status/validate and defer live `ax sync` until merged `main`. |
| Frontend work is left without a specialist | Accept that temporary gap explicitly; the future user-owned skill is separate scope. |

## Implementation Handoff

- Artifact: `.agents/plans/restore-specialist-leverage.md`
- Branch: `codex/restore-specialist-leverage`
- Worktree:
  `/Users/rene.hernandez/.codex/worktrees/3985a7bf-bbfb-4a21-ba7b-052913328379/ai`
- Planning base and current branch HEAD before the plan write:
  `d8c15bfa4f09e3642eed995bc33c0d52639d4b38`
- Pinned pre-cutover recovery source:
  `86a5d8d211592d71336ca8b65d54612b4e237937`
- Target: `main`
- Delivery: one atomic plan-plus-implementation change set in one final draft MR
- Linear policy: disabled; this repo has no accepted requirement for tracker
  mutation in this change
- Logical order: Explore specialists, Plan/Review specialists, Finish
  specialists, runtime/instruction alignment, regression verification
- Integration hotspots: `ax.config.json`, `AGENTS.md`,
  `instructions/AGENTS.md`, `skills/{explore,plan,review,finish}`, shared rules,
  and cutover/runtime inventory tests
- First real confirmation: the brainstorming-map and `ai/nitro!848`-derived
  description scenarios pass through the restored specialists
- Publication: include this plan and implementation together; create no
  planning-only MR and no POC
