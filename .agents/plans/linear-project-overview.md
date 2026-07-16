# Linear Project Overview Skill

## Objective

Create a shared `linear-project-overview` skill that drafts, reviews, and safely
updates the stable summary and description of a Linear project. The skill must
keep project purpose separate from detailed design, delivery breakdown, current
status, and native Linear resources.

The delivered skill should make a Linear project understandable from its
overview while preventing the recurring failure where current mechanisms,
future-adjacent work, milestone inventories, or transient progress become the
project definition.

## Context

The existing skill stack has clear owners for the surrounding work:

- `start-project` maps a new effort and returns a read-only Project Brief.
- `brainstorming` resolves purpose, scope, and material design decisions.
- `linear-breakdown` turns accepted planning into milestones and issues.
- the generic Linear connector reads and mutates provider state.
- `doc-smith` writes and reviews engineering documentation.

None owns the semantic contract for Linear's project-level `summary` and
`description`. A real Nitro project-overview discussion demonstrated the gap:
the draft correctly reframed the project around the broader agent-invocation
outcome, but initially promoted future Automation work into the current project
until the user corrected it.

Current Linear workspace examples and official Linear documentation reinforce
the required boundary. Strong project descriptions consistently explain why a
project exists, its intended outcome, its scope, and its success signal.
Detailed specs and PRDs have a project-document surface; delivery stages have
milestones; current progress, health, blockers, and next steps have project
updates; external links have native Resources.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Project overview | The paired Linear `summary` and `description` that define the project's stable purpose and boundaries. |
| Proposed project | An accepted effort that does not yet have a Linear project record. The skill may draft its overview but may not create it. |
| Material feedback | Unresolved team feedback that would change project purpose, outcome, scope, non-goals, or success. |
| Drift | A change to the target project's summary, description, or relevant unresolved feedback after the user approved a preview. |
| Native Resources | Linear's project-level documents and external links. The skill inspects but does not mutate them. |

## Accepted Decisions

### Overview structure

The summary is one project-level outcome statement within Linear's 255-character
limit. It should remain true if milestones, dates, or implementation choices
change.

The base description uses this order:

1. `Why` - the current problem or opportunity and its consequence.
2. `Outcome` - the durable target state established by the project.
3. `Scope` - project-level capabilities, responsibilities, or changes owned by
   the project.
4. `Non-goals` - included only when adjacent scope could reasonably be
   confused with the project.
5. `Success` - observable project-level end states or meaningful KPIs.

The base description has no `Resources` heading. Stable links may appear inline
only when needed to understand a specific statement; the native Resources
surface remains the normal link and document owner.

### Abstraction boundary

The overview may describe architecture when establishing that architecture is
itself the project outcome, but it should name stable responsibilities and
boundaries rather than volatile interfaces or implementation sequence.

The overview excludes:

- milestone and issue inventories;
- delivery order, rollout sequence, and current status;
- detailed technical decisions that belong in a design document;
- project updates, blockers, risks, and next steps;
- issue-level acceptance criteria or verification steps; and
- future-adjacent work unless a conditional non-goal is needed to prevent a
  plausible scope misunderstanding.

### Draft, review, and update boundary

The skill supports:

1. drafting an overview for a proposed or existing project;
2. reviewing an existing overview for purpose, stability, scope, and drift;
3. updating an existing project's approved summary and description.

The first drafting or review turn is read-only, traverses every project-comment
page until no next-page cursor remains before selecting relevant unresolved
feedback, and returns an exact preview. Provider mutation requires a later
explicit instruction that approves that preview. The later apply step is owned
by Finish and must:

1. re-fetch the exact project and traverse every project-comment page until no
   next-page cursor remains before selecting relevant unresolved feedback;
2. compare its current summary and description exactly with the preview
   snapshot and stop on any mismatch;
3. compare each relevant unresolved feedback item's identifier, resolution
   state, body, update timestamp, and anchored quoted text with the snapshot,
   then stop on material feedback drift;
4. update only the approved `summary` and `description`; and
5. verify both fields exactly on readback and return the project link.

Materially contradictory unresolved feedback blocks finalization. Minor wording
feedback is surfaced without blocking. The skill never creates a Linear
project and never changes teams, initiatives, lead, members, status, dates,
labels, priority, milestones, issues, updates, comments, documents, or native
Resources.

### Lifecycle ownership

The skill is a bounded specialist, not a sixth lifecycle owner. Drafting and
review run under Explore and remain read-only. A later explicit instruction to
apply an approved preview enters Finish for the authenticated Linear mutation
and readback. The central agent-surface routing contract must record this split
so installation does not create an implicit write path outside the five modes.

### Source precedence

Build and review the overview using this precedence:

1. explicit decisions in the current user conversation;
2. an accepted Project Brief, design, plan, or specification;
3. verified current repository or system behavior;
4. team feedback requiring resolution; and
5. the existing Linear overview, initiative, milestones, and resources as
   context and drift evidence.

Do not infer project purpose from the existing overview when that overview is
being corrected. Do not reverse-engineer purpose from the milestone or issue
inventory.

## Reuse And Deviation Contract

### Inspected precedents and canonical owners

- `skills/start-project/SKILL.md` owns read-only new-effort intake and the
  portable Project Brief.
- `skills/brainstorming/SKILL.md` owns purpose and scope discussion before a
  project definition is stable.
- `skills/linear-breakdown/SKILL.md` owns project milestones, issues, and
  delivery slicing after overview agreement.
- `skills/doc-smith/SKILL.md` owns engineering-document quality, not Linear
  project semantics.
- `skills/start-project/agents/openai.yaml` and
  `tests/unit/start-project-skill.test.ts` provide the closest shared-skill
  metadata and static contract-test patterns.
- `rules/agent-surface-routing.md` owns the five-mode boundary for bounded
  specialists, while `tests/unit/five-mode-cutover.test.ts` protects the
  installed retained-specialist set.
- `ax.config.json` owns installation of repo-managed skills into the personal
  and work profiles.

### Reuse and extension

- Reuse the bounded-specialist pattern rather than adding a lifecycle mode or
  broad Linear project manager.
- Consume Project Brief and brainstorming outputs without copying either
  workflow into the skill.
- Follow `linear-breakdown`'s preview-before-provider-write precedent while
  adding overview-specific drift detection and exact-field readback.
- Follow the existing skill source, OpenAI metadata, focused unit-test, and AX
  registration patterns.

### New mechanism and justified deviations

Add one new specialist because no existing owner can enforce the project-level
abstraction boundary without taking on unrelated behavior:

- extending `doc-smith` would import Docusaurus, Diataxis, filesystem, and
  reader-persona assumptions into a tracker artifact;
- extending `start-project` would violate its whole-turn read-only intake
  boundary;
- extending `linear-breakdown` would mix stable project definition with
  downstream delivery decomposition; and
- relying on the generic Linear connector would provide CRUD without content
  quality, approval, or drift semantics.

The new skill is intentionally narrower than a project manager. It owns only
the summary-and-description lifecycle described above.

### End-to-end proof

Using the Nitro project snapshot and the accepted agent-invocation design, the
skill produces a preview whose summary and description follow the agreed
structure, keep Automation out of current scope except as a conditional
non-goal when necessary, exclude milestone and implementation inventories, and
perform no Linear mutation. Controlled apply scenarios use recorded Linear tool
responses to prove that changed project text or material feedback refreshes the
preview instead of being overwritten, while an unchanged target emits only the
approved field update and verifies the exact readback. These scenarios validate
the skill's agent and tool-call contract without mutating a live project; the
connector continues to own provider mechanics.

## Scope

### In Scope

- Add `skills/linear-project-overview/SKILL.md` with concise triggering,
  lifecycle, content, source-precedence, preview, drift, and apply contracts.
- Add matching `skills/linear-project-overview/agents/openai.yaml` metadata.
- Register the skill's Explore/Finish split in the central bounded-specialist
  routing contract without adding lifecycle authority.
- Register the skill in the repo-managed personal-skills block so both installed
  profiles receive it through AX.
- Extend the retained-specialist assertion and add focused contract tests for
  metadata, section shape, routing boundaries, read-only preview, exact apply
  scope, feedback handling, and drift behavior.
- Use `writing-skills` RED-GREEN-REFACTOR validation with the observed Nitro
  failure and additional application scenarios before delivery.
- Validate the skill through the repository's focused unit, skill, runtime, and
  full verification layers.

### Out Of Scope

- Creating Linear projects or choosing their metadata.
- Mutating native Resources, comments, milestones, issues, updates, or any
  project field other than the approved summary and description.
- Adding Linear API wrappers, scripts, dependencies, schemas, templates, or
  custom persistence.
- Rewriting `start-project`, `brainstorming`, `linear-breakdown`, `doc-smith`,
  or the generic Linear plugin.
- Creating a workspace or team-level Linear project template.
- Creating an OpenSpec change or disposable POC.
- Running live AX convergence from the feature branch. Live runtime sync remains
  post-merge work from the clean durable `main` checkout.

## High-Level Implementation Approach

### 1. Prove the missing behavior before authoring the skill

Use the observed Nitro thread as the first RED case and run additional baseline
application scenarios without the new skill. Capture failures such as promoting
future work into scope, copying milestones into purpose, overwriting drift, or
performing same-turn provider mutation.

First real confirmation: the corresponding GREEN scenarios with the new skill
produce the stable overview and approval preview through the real skill
entrypoint, with the prohibited behaviors absent.

### 2. Add the bounded specialist and runtime registration

Create a concise skill and OpenAI adapter metadata that implement the accepted
contract. Keep the complete behavior in `SKILL.md`; add no scripts, assets, or
reference files unless implementation demonstrates a repeated deterministic
need that cannot fit concisely in the primary skill.

Align the central bounded-specialist routing rule with the skill's read-only
Explore path and approved-write Finish path. Register the skill through the
existing local personal-skills owner so both managed profiles receive the same
source, and extend the existing retained-specialist assertion.

### 3. Enforce and validate the contract

Add focused static contract tests that protect the trigger, base structure,
conditional non-goals, routing boundaries, two-turn mutation authority,
exact-field apply scope, feedback gate, and drift/readback behavior.

Run `writing-skills` GREEN and REFACTOR scenarios against realistic proposed
and existing projects. Validate the managed skill source and both isolated
profile installations, then run the repository's normal full verification
before commit. Keep validation evidence task-local.

## Acceptance Criteria

- The installed skill is discoverable as `linear-project-overview` for requests
  to draft, review, or update a Linear project summary or description.
- The skill remains a bounded specialist: Explore owns read-only drafting and
  review, Finish owns a later explicitly approved provider update, and no new
  lifecycle mode or implicit mutation path is introduced.
- The skill routes unresolved purpose to `brainstorming`, new-effort intake to
  `start-project`, and milestones/issues to `linear-breakdown` without invoking
  or duplicating those workflows.
- Proposed-project requests can produce a draft, but project creation and all
  project metadata remain outside the skill.
- Summary output stays within 255 characters and describes a stable
  project-level outcome rather than a milestone or mechanism by default.
- Descriptions require `Why`, `Outcome`, `Scope`, and `Success`, include
  `Non-goals` only for plausible adjacent-scope ambiguity, and omit a
  `Resources` heading.
- Reviews detect descriptions that act as PRDs, delivery inventories, status
  reports, or implementation diaries and recommend the correct Linear owner.
- The first skill turn is read-only and presents the exact proposed summary and
  description plus alignment, drift, feedback, and intentional-exclusion
  findings.
- A later explicit apply instruction revalidates the exact project and preview
  snapshot before updating anything.
- Materially contradictory unresolved feedback and changed approved fields
  block overwrite and produce a refreshed preview; minor wording feedback is
  reported without blocking.
- A clean apply changes only the exact approved summary and description, reads
  both back, and reports the project link.
- No Linear provider writes occur during skill validation; application tests
  use supplied snapshots and recorded tool responses to assert tool selection,
  update arguments, drift handling, and readback handling.
- The new skill passes `writing-skills` RED-GREEN-REFACTOR scenarios, focused
  contract tests, managed-skill validation for both profiles, and the repo's
  full verification layer.

## Delivery And Policy

This is one coherent atomic implementation unit: skill source, UI metadata,
runtime registration, contract tests, and behavior validation share one owner,
review boundary, and rollback path. Deliver the plan and implementation as one
change set in one final draft GitLab MR targeting `main`. There is no planning
MR, OpenSpec, or POC.

Linear work for this delivery is disabled. The implementation and validation do
not update the live Nitro project or create tracker records. The shipped skill's
future apply path remains governed by its explicit preview approval and Finish
authority contract.

## Risks And Controls

| Risk | Control |
| --- | --- |
| The skill becomes a general project manager | Restrict writes to an existing project's approved summary and description and route every adjacent surface to its current owner. |
| The overview becomes a PRD or delivery diary | Enforce the stable base structure and explicit exclusions; validate against product, technical, and incident-shaped examples. |
| Existing Linear text or team feedback is overwritten | Snapshot the preview inputs, re-fetch before apply, and block on material drift. |
| Conditional non-goals are omitted when they matter | Require a plausible-adjacent-scope test and cover the Nitro Automation boundary in behavior scenarios. |
| The skill duplicates links already owned by native Resources | Omit a Resources heading and inspect native resources without mutation. |
| Trigger wording collides with `start-project` or `linear-breakdown` | Anchor discovery to Linear summary/description work and add positive and negative routing scenarios. |
| Static prose tests pass while agent behavior still fails | Pair focused contract tests with RED-GREEN-REFACTOR application scenarios using raw project artifacts. |
| Feature-branch runtime validation changes the live machine | Use isolated runtime roots and HOME where configuration is involved; reserve live AX sync for post-merge `main`. |

## Rollback

Revert the new skill source, metadata, routing-rule addition, profile
registration, focused tests, and associated managed runtime metadata as one
change set. After merge of a revert, run live AX sync and validation from the
clean durable `main` checkout so the skill is removed from installed profiles
without touching unrelated skills or unowned configuration.
