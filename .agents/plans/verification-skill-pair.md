# Project-local Verification Skill Pair

## Goal

Add two portable personal skills that create and maintain a repository-owned
application-driving skill. The generated skill must teach a future agent how to
launch the real application, diagnose whether it is safe to drive, exercise its
user-facing surface, retain evidence, and clean up only what it started.

The companion maintenance skill must keep that application-driving contract and
its feature map honest by comparing every mapped feature with current source and
exercising every mapped feature live.

## Selected Approach

Deliver `create-verification-skill` and `maintain-verification-skill` together as
one atomic plan-plus-implementation change set and one final GitLab MR. Adapt the
useful behavioral contract from Cursor pstack while preserving this repository's
five-mode authority model and existing specialist ownership.

The portable skills live in this repository's shared `skills/` source and are
registered in the `personal-skills` AX block. A generated project-local skill
prefers `.agents/skills/verify-<app>` only when the target repository already
uses `.agents` as its canonical agentic layout. Generation does not create or
repair Codex, Claude, Cursor, or other discovery links. If no canonical
project-local skill layout can be established safely from the repository, the
generator reports the unresolved location instead of inventing one.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Verification skill | A generated project-local `verify-<app>` skill that owns application-driving mechanics, not general test or workflow policy. |
| Feature map | The verification skill's user-facing index and one file per mapped feature. It is local to that skill, not a global registry. |
| Source coverage | Evidence from current product source identifying how one mapped feature is reached and implemented. |
| Live coverage | A real drive of one representative user path for a mapped feature with an observable result and retained evidence. |
| Product regression | Mapped behavior that current source still promises or exposes but live verification proves is broken. It is not documentation drift. |

## Observable Behavior

### Create verification skill

`create-verification-skill` should:

1. inspect repository instructions, documented run commands, application entry
   points, routes, commands, menus, and existing test or driving harnesses;
2. identify the primary user-facing surface and relevant secondary surfaces;
3. reuse existing Playwright, Cypress, browser, CLI, PTY, HTTP, desktop, mobile,
   or application harnesses before proposing new mechanics;
4. verify that the checkout can build or start and refuse to write instructions
   against a broken or unverified baseline;
5. generate a project-local `verify-<app>` skill with concrete Launch, Doctor,
   Drive, Evidence, and Cleanup contracts plus documented executable helpers
   only when the repository requires them;
6. create a feature-map index and one file per identified user-facing feature,
   seeded from real routes, commands, menus, or documentation rather than a
   generic inventory; and
7. execute the generated instructions end to end for one mapped feature,
   confirm evidence survives cleanup, and return `blocked` if that proof cannot
   complete safely.

Repository interviewing and baseline diagnosis are read-only Explore work.
Writing the generated skill belongs to an authorized Execute lane. The skill
must not repair product code, add dependencies without the active implementation
contract, or gain lifecycle authority from its own trigger.

### Generated verification skill

Every generated skill owns only its application's driving mechanics:

- **Launch:** exact repository-native startup or per-drive invocation, readiness
  signal, isolation constraints, and teardown boundary.
- **Doctor:** a read-only health check that decides whether the current instance
  or session is safe to drive.
- **Drive:** stable repository-backed selectors, commands, routes, prompts, or
  protocol operations that exercise real user paths.
- **Evidence:** durable proof of the action and result, including observable side
  effects where applicable; evidence survives cleanup.
- **Cleanup:** removes only processes and scratch state started by the drive,
  never broad process-name targets or retained evidence.

The generated feature map uses a concise README index plus one Markdown file per
feature. Each feature describes its user-visible purpose, sub-features, user-POV
entry path, harness-specific driving recipe, observable end state, and material
prerequisites or gotchas.

### Maintain verification skill

`maintain-verification-skill` should:

1. locate one project-local verification skill with a feature map, asking the
   user only when several candidates remain and routing to creation when none
   exists;
2. reconcile the feature-map index with its sibling feature files without
   generating a second inventory;
3. give every mapped feature source coverage against current product source;
4. sweep concrete recent user-facing source changes for missing mapped features;
5. give every mapped feature live coverage, using one representative user path
   rather than terminalising every sub-feature or permutation;
6. preserve evidence through resets and cleanup, rerun Doctor after surprising
   behavior, and clean failed-drive residue safely;
7. classify findings as documentation drift, harness drift, an explicitly
   evidenced unreachable prerequisite, or product regression; and
8. edit only the selected verification skill directory and re-drive every
   changed harness or instruction before handoff.

Maintenance returns exactly one outcome:

- `clean`: every mapped feature received source and live coverage and no
  verification-skill correction is needed;
- `changed`: proven corrections exist only within the verification skill
  directory and are ready for the active Execute/Finish workflow; or
- `blocked`: coverage could not complete safely, a correction could not be
  proven, or live verification exposed a product regression.

`clean` and `blocked` create no branch or PR/MR. A product regression is reported
with its source path, attempted user route, live evidence, and product-facing
impact; the maintenance skill must not hide it by weakening or rewriting the
feature map. `changed` does not itself create a branch or MR: repository writes
remain Execute-owned and publication remains Finish-owned.

## Canonical Ownership And Deviations

### Reused owners

- The five-mode workflow owns authority: Explore inspects, Plan captures this
  contract, Execute writes, Review inspects exact artifacts, and Finish owns
  provider publication and hosted follow-through.
- `writing-skills` owns portable skill quality, progressive disclosure, and
  evaluation-first RED/GREEN proof.
- `ai-readiness-upkeep` remains a findings-only readiness gate. It may route a
  concrete `create_skill` finding to `create-verification-skill` when the
  missing enforceable capability is application-driving verification.
- Existing repository-native application and test harnesses remain canonical;
  the generated skill documents and composes them rather than replacing them.
- AX's `personal-skills` block remains the managed registration source for the
  two portable skills.

### Deliberate separation

- The generated verification skill owns project-specific driving instructions;
  it does not become a generic verification framework, validator, scheduler, or
  global feature registry.
- `maintain-verification-skill` owns feature-map and harness upkeep only. It does
  not absorb product fixes, docs-wide alignment, CI policy, or AI-readiness
  classification.
- The pair does not create scheduled or periodic automation in this version.
  Invocation cadence remains caller-owned.

### Material adaptation from pstack

The design preserves pstack's repo interview, Launch/Doctor/Drive/Evidence/
Cleanup structure, feature-level maintenance rigor, and real proof requirement.
It changes Cursor-specific paths and direct branch/PR behavior to use the
repository's canonical `.agents` convention and five-mode authority owners.
This is necessary for portability and to prevent a bounded specialist from
gaining repository or provider authority.

## Implementation Scope

One cohesive implementation unit includes:

- both portable skill directories with concise `SKILL.md` entrypoints;
- `agents/openai.yaml` metadata for each skill;
- progressively loaded references for the feature-map contract and
  project-local layout/driving mechanics where detail would otherwise bloat the
  entrypoints;
- registration of both skills in the `personal-skills` block of
  `ax.config.json`;
- narrow `ai-readiness-upkeep` routing for applicable `create_skill` findings,
  without changing its findings-only verdict mechanics;
- deterministic unit coverage for registration, routing, location choice,
  output semantics, edit boundaries, complete feature coverage, and forbidden
  product/discovery-link mutations; and
- one executable behavioral evaluation scenario per new skill, using the
  repository's existing skill-rule evaluation surface.

## Out Of Scope

- OpenSpec, a disposable POC, or multiple delivery units.
- A shared harness abstraction or generic verification runtime.
- A repository-wide or cross-repository feature registry.
- Product-code repairs discovered during creation or maintenance.
- Automatic creation or repair of `.codex`, `.claude`, `.cursor`, or other
  discovery links.
- Scheduled jobs, recurring automations, CI wiring, or cadence policy.
- Exhaustive live verification of every sub-feature, permutation, platform, or
  external integration.
- Merge, deployment, cleanup of hosted artifacts, or live runtime refresh before
  the final MR is merged.

## Acceptance Criteria

- Both portable skills validate with required frontmatter and OpenAI metadata
  and are installed by the personal AX profile.
- Create selects the repository's real user-facing surface and existing driving
  precedent before describing new mechanics.
- Create refuses to teach commands against a baseline it cannot build, launch,
  or otherwise verify safely.
- A generated skill contains concrete Launch, Doctor, Drive, Evidence, and
  Cleanup behavior and a feature map grounded in the target repository.
- Create proves one mapped feature through launch, doctor, drive, retained
  evidence, and cleanup before reporting success.
- Maintain gives every feature file both source and live coverage and reports
  incomplete or unreachable coverage honestly.
- Maintain edits only the verification skill directory; product regressions are
  `blocked` and remain product findings rather than documentation corrections.
- `clean` and `blocked` do not create a branch or PR/MR; `changed` routes writes
  and publication through Execute and Finish.
- `ai-readiness-upkeep` remains findings-only and routes only the applicable
  application-driving `create_skill` case.
- No generic framework, second validator, global registry, discovery-link
  repair, or scheduled automation is introduced.
- Deterministic tests and one behavior scenario per skill prove the authority,
  coverage, and failure-path contracts.

## Verification Strategy

Use `writing-skills` to establish RED on minimal fixtures or clean-context
behavior scenarios before changing runtime instructions, then rerun the same
proof for GREEN.

The first visible proof for create is a fixture repository with an existing
application harness where the skill selects `.agents/skills/verify-<app>`,
produces the required mechanics and feature map, drives one mapped feature, and
preserves evidence after cleanup. A paired negative fixture has a broken
baseline and proves the skill stops without generating speculative commands.

The first visible proof for maintain is a mapped multi-feature fixture where
source and live coverage are required for every feature. A product behavior
failure must yield `blocked`, preserve the feature map, and produce no
branch/publication action; a harness-only drift fixture may yield `changed` only
after the repaired drive succeeds.

Implementation verification should include the affected deterministic unit and
integration suites, the two executable skill-rule behavior scenarios, the
repository skill validator for all applicable profiles, and the native
hook-enabled commit suite. Runtime installation proof before merge must use an
isolated HOME and runtime root. Live AX synchronization is post-merge work from
the clean default-branch worktree only.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Generated instructions are plausible but never worked | Require baseline verification and one complete mapped-feature proof before success. |
| Maintenance becomes shallow documentation review | Require source and live coverage for every feature file. |
| Maintenance hides a broken product | Classify confirmed product failures as `blocked`; prohibit product edits and feature-map weakening. |
| The pair duplicates existing verification infrastructure | Require repository precedent reuse and keep mechanics inside the generated skill. |
| Cross-tool portability creates discovery-link churn | Prefer an existing `.agents` canonical layout and prohibit silent link creation or repair. |
| The skill entrypoints become procedural walls of text | Keep unique judgment and output contracts in `SKILL.md`; progressively load layouts and harness mechanics. |
| Clean maintenance creates provider noise | Prohibit branch and PR/MR creation for `clean` and `blocked`. |
| Live drives disturb user sessions or shared services | Require isolation discovery, Doctor checks, ownership-bound cleanup, and explicit blocking when safe isolation is unavailable. |

## Rollback

Revert the two portable skill directories, their AX registration, the narrow
AI-readiness routing change, and their tests/evaluation scenarios as one atomic
change. After a merged rollback, refresh the live AX runtime only from the clean
default-branch worktree so installed profiles converge to the reverted managed
source.

## Delivery Route

This is one coherent implementation and review unit with one ownership story,
one end-to-end verification story, no migration, no durable cross-component
contract, and no mandatory rehearsal. Use one atomic plan and one final draft
GitLab MR targeting `main`; do not create an OpenSpec change or a planning-only
MR. Merge remains separately authorized.
