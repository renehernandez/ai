## Context

The pre-change managed runtime contains 34 skills with 44,657 words, plus four generated
OpenSpec adapters with 3,355 words. Runtime instructions currently duplicate
shared rules, deterministic script behavior, provider command recipes,
historical RED/GREEN evidence, common-mistake rhetoric, and assumptions that
newer models need exhaustive procedural narration. The repository already has
canonical rule, script, schema, test, fixture, and reference owners for most of
that material.

This is a cross-cutting prompt-runtime migration. It adds a model-evaluation
dependency, changes every managed skill, updates generated adapters at their
generator, and must preserve lifecycle authority and bounded specialist
leverage. The OpenSpec route supplies a complete disposable POC before the
clean final delivery stack. The accepted POC head `d620625` retained 33 runtime
skills at 8,947 words, generated four adapters at 3,513 words, and covered 85
changed files. Its review repaired capability narrowing and answer leakage, and
left one nonblocking snapshot-performance finding plus an unexecuted Claude
lane caused by the configured Bedrock gateway failing before inference.

## Goals / Non-Goals

**Goals:**

- Preserve the accepted POC's order-of-magnitude prompt reduction without a
  hard word-count gate.
- Establish behavior evals before prompt reduction.
- Assign every removed concept to one surviving canonical owner or delete it
  explicitly when it has no valid runtime purpose.
- Preserve all named specialist outputs and Plan, Execute, Review, and Finish
  authority boundaries.
- Keep every final delivery unit reviewable, safe when merged in order, and
  within repository delivery budgets.

**Non-Goals:**

- Changing the five-mode lifecycle contract or creating generic replacements
  for behavior-bearing specialists.
- Rewriting deterministic validators, schemas, and collectors when moving
  prose to their existing ownership is sufficient.
- Turning approximate prompt budgets into validation failures.
- Hand-editing generated OpenSpec adapters.
- Mutating provider state, merging, deploying, or synchronizing the live AX
  runtime from a feature branch.

## Decisions

### Behavior evals precede simplification

Add Vitest 4 and `vitest-evals` with one custom harness for the AX-managed Codex
and Claude runtime shapes. Each run uses an isolated HOME, runtime root,
temporary repository, and provider-command shims. Runner and model identity are
explicit inputs and result metadata.

Scenario-specific expected labels never enter the model prompt. Plan and
Execute scenarios prove their authority through observable writes inside the
temporary repository; read-only lanes prove restraint against the same
available write surface. Provider receipts distinguish retrieval from mutation
and fail closed on malformed calls. Each lane receives only safe runtime and
runner-specific environment variables, while tool metadata preserves the
production capabilities needed by cross-repository lifecycle modes.

Source and sandbox integrity use streamed per-file digests rather than retained
base64 snapshots. This keeps the same tamper signal without scaling memory with
the encoded repository. Final readiness requires an explicit successful Codex
lane and Claude lane; the accepted POC's pre-inference Bedrock failure remains
a verification gap rather than a waived behavior contract.

Deterministic assertions own filesystem changes, tool selection, provider-shim
calls, structured output, freshness, and escalation. Semantic judges assess
only judgment that cannot be represented structurally. A semantic score never
overrides a forbidden mutation. Live model evals remain separate from
pre-commit because they require network access and credentials; deterministic
harness and scenario validation remains in the native test suite.

Alternative considered: extend the existing phrase-presence tests. Rejected
because they preserve wording rather than assembled agent behavior and make
prompt simplification artificially expensive.

### Runtime ownership follows the existing hierarchy

| Concept removed from runtime skills | Surviving source of truth |
|---|---|
| Mode entry, authority, and transitions | `AGENTS.md`, `instructions/AGENTS.md`, workflow charter |
| Routing, worktree ownership, scheduling, POC lifecycle, budgets | `rules/investigation-and-implementation.md` |
| Hook and full-suite ownership | `rules/testing-and-verification.md` |
| Publication, provider routing, merge readiness, human-readable messages | `rules/git-and-review.md` |
| Immutable publication and handoff packets | `rules/handoff-and-resume.md` |
| Nitro request timing and command selection | `rules/fullscript/nitro-review.md` |
| Review catalog, closure, and readiness schemas | `skills/review/scripts/review-contract.ts` |
| Plan, Execute, and Finish route validation | Existing mode contract scripts |
| OpenSpec task structure and proof position | `openspec-tasks.ts` and fixtures |
| Nitro pagination, identities, chronology, and receipts | Nitro collectors and gate scripts |
| AI-readiness YAML correctness | `ai-readiness-upkeep.ts` |
| Provider CLI/API procedures | One-level references or executable collectors |
| Templates and worked examples | Skill references |
| RED/GREEN history and pressure evidence | Behavior evals and test fixtures |
| Generated adapter lifecycle overlay | `scripts/ax/openspec-sync.ts` |

Fixed threat quotas, speculative financial estimates, generic compliance
boilerplate, repeated rationalization counters, and model-obvious instructions
have no surviving runtime owner.

Alternative considered: create a shared skill-policy reference. Rejected
because it would duplicate the rule hierarchy and add another always-loaded
authority source.

### Main skill files keep only runtime judgment

Each `SKILL.md` retains its trigger, unique judgment, output contract, and
escalation points. Scripts and schemas own deterministic gates. Tests and
fixtures own regression evidence. References own templates, examples, provider
mechanics, and long procedures and are loaded only when needed.

Approximate budgets remain design pressure: routers and adapters 250–450 words,
focused review techniques 400–650 words, and complex lifecycle owners
700–1,000 words. A skill may exceed its range when cohesion or an essential
authority boundary requires it; corpus reporting records the reason without
failing validation.

### Every managed skill has an explicit disposition

| Skill group | Disposition |
|---|---|
| `brainstorming` | Rewrite; preserve the visible Orientation Map, 1–3 item Discussion Queue, and convergence boundary. |
| `explore`, `start-project` | Thin the router and preserve the complete read-only Project Brief intake. |
| `plan`, `execute`, `review`, `finish` | Retain unique mode decisions and escalation; route shared lifecycle mechanics to canonical rules and scripts. |
| `change-request-create` | Preserve sole ownership of reviewer-facing titles and descriptions, templates, and human-owned sections. |
| `nitro-review-feedback` | Preserve read-only identity, freshness, collection, and routing; scripts own deterministic evidence mechanics. |
| `openspec-tasks` | Preserve semantic task auditing and structured disposition; scripts own parsing and deterministic gates. |
| `security-review` | Replace with read-only, evidence-backed threat analysis; delete provider mutation, quotas, transcripts, estimates, and boilerplate. |
| `github-adapter-review`, `gitlab-adapter-review`, `glab-stacked-diffs` | Keep provider-specific retrieval and routing decisions; move commands and recovery procedures to references or collectors. |
| `linearis`, `linear-project-overview`, `linear-breakdown` | Preserve semantic preview, field mapping, drift, and outcome slicing; no specialist gains lifecycle or provider authority. |
| `doc-smith`, `docs-alignment-review`, `explain-diff-html` | Preserve specialist outputs; progressively load personas, templates, and renderer mechanics. |
| `code-simplifier`, `code-quality-review`, `diff-review`, `deslop`, `scrutinize` | Keep distinct evidence lenses and normalized findings; remove history and repeated review mechanics. |
| `ai-readiness-upkeep` | Keep judgment; its script owns schema and verdict mechanics. |
| `ax-cli`, `handoff-brief`, `project-health-brief` | Keep routing, safety, templates, and status taxonomy; move mechanics and examples out of the main file. |
| `research`, `research-content`, `research-technical` | Tighten routing and preserve focused evidence/output contracts. |
| `compound` | Retire from the runtime because its fourth-mode model conflicts with the five lifecycle owners; route explicit retrospective or solution-document requests through Explore and `doc-smith`. This leaves 33 retained runtime skills from the 34 starting dispositions. |
| `writing-skills` | Keep a concise evaluation-first contract; progressively load its testing method and remove repeated enforcement rhetoric. |

`deslop`, `research-content`, and `research-technical` need only light
tightening. Every other managed skill receives the disposition above rather
than a generic rewrite.

### Generated adapters are repaired at the generator

`scripts/ax/openspec-sync.ts` applies a compact, deterministic lifecycle overlay
after upstream generation and before content hashing. Explore remains
explicit-only and read-only; Propose maps to Plan; Apply maps to Execute and
the repository POC/review contract; Archive hard-blocks incomplete work and
maps final archival to the last Execute unit. Sync validation proves the
overlay and generated hashes converge. Generated files are never hand-edited.

### Historical evidence is removed only after equivalent coverage exists

Embedded Test Evidence and Validation/Verification Scenarios move out of
runtime prose after their affected behaviors have passing eval or deterministic
fixtures. Session IDs and narrative rationalizations are deleted. Exact wording
tests survive only for deliberate visible headings, templates, or
machine-readable contracts; other prose assertions become state, routing,
structured-output, freshness, or escalation tests.

### Accepted POC learnings

- Tool grants are behavior-bearing contracts. Prompt reduction must not narrow
  Plan, Execute, Review, Finish, Writing Skills, or Doc Smith below their
  cross-repository responsibilities.
- Eval prompts may expose a global behavior vocabulary but not a scenario's
  required or forbidden answers.
- Repository authority is observed through sandbox state changes, not enforced
  by withholding write tools from read-only lanes.
- Provider shims classify retrieval separately from mutation, and malformed
  receipts fail closed as mutation attempts.
- Lane environments contain only safe runtime and runner-specific variables;
  Claude receives no shell capability in the behavior harness.
- Full-tree base64 retention is unnecessary. Streamed digests preserve source
  and sandbox integrity at lower memory cost.
- The Claude lane remains required at final closure even though the accepted
  POC gateway failed before inference.

### Delivery topology

The complete POC implemented the whole change in one disposable review-only MR.
Post-POC decomposition accounts for its material footprint and uses this final
Git order. Units 1 and 2 are independently useful groundwork; unit 3 owns the
first stack-objective proof.

| Unit | Kind | Outcome | Depends on |
|---:|---|---|---|
| 1 | groundwork | Accepted contract and non-gating live corpus inventory | none |
| 2 | groundwork | Eval runtime dependencies and explicit configuration | 1 |
| 3 | outcome | Isolated behavior harness and lifecycle/specialist baseline | 2 |
| 4 | hardening | Deterministic eval contracts and charter routing | 3 |
| 5 | outcome | Read-only evidence-backed Security Review | 3 |
| 6 | outcome | Concise evaluation-first Writing Skills | 3 |
| 7 | outcome | Brainstorming Orientation Map and convergence rewrite | 3 |
| 8 | outcome | Thin Explore router and complete Start Project intake | 3 |
| 9 | outcome | Plan durable-choice contract and OpenSpec task auditing | 3 |
| 10 | outcome | Execute ownership and escalation contract | 3, 9 |
| 11 | outcome | Review coverage, findings, closure, and readiness contract | 3, 9 |
| 12 | outcome | Finish provider and terminal authority contract | 3, 11 |
| 13 | outcome | Change Request Create ownership and Nitro feedback routing | 3, 12 |
| 14 | outcome | GitHub, GitLab, and stacked-diff adapter routing | 3, 11, 12 |
| 15 | outcome | Linear adapter, overview, and breakdown specialists | 3 |
| 16 | outcome | Documentation and diff-explanation specialists | 3 |
| 17 | outcome | Focused reviewer techniques | 3, 11 |
| 18 | outcome | AX, AI-readiness, handoff, and project-health utilities | 3 |
| 19 | outcome | Research skills and Compound retirement | 3, 16 |
| 20 | hardening | Cross-skill behavioral contract migration | 4–19 |
| 21 | outcome | Generated OpenSpec lifecycle overlays and integrated archival | 9–20 |

Historical evidence removal is part of each owning skill unit rather than a
separate removal MR. Corpus reporting moves to unit 1 so the root MR combines
the accepted planning artifact with useful behavior instead of becoming a
planning-only artifact. The last feature unit owns final task state, canonical
spec synchronization, and archival on its reviewed head.

Every final unit targets at most 10 files and 500 changed lines. A forecast over
either target records an unsafe-to-split rationale; a forecast over 15 files or
1,000 changed lines returns to Plan. Post-POC planning Review is authoritative
for the final topology and may split a provisional unit when actual footprint
evidence proves it under-scoped.

## Risks / Trade-offs

- **Model eval variance** → Prefer deterministic state assertions, narrow
  rubrics, explicit model identity, and replayable normalized sessions.
- **Eval harness reaches real state** → Isolate HOME, runtime root, repository,
  and PATH; deny undeclared tools and inspect provider-shim logs.
- **Eval prompt teaches its answer** → Expose only the global vocabulary and
  grade required or forbidden behavior outside the prompt.
- **Integrity snapshots scale with repository encoding** → Compare streamed
  per-file digests instead of retaining base64 content.
- **One runtime lane is externally unavailable** → Keep the lane explicit and
  block final archival until both selected runtime shapes execute successfully.
- **Prompt reduction erases authority** → Gate each rewrite on relevant
  lifecycle and specialist behavior before removing prose.
- **References become hidden second owners** → Keep policy in rules and limit
  references to mechanics, templates, examples, and long procedures.
- **Grouped units exceed delivery budgets** → Reassess against POC footprint
  and split before final implementation; never use a mechanical file split.
- **Generated adapters drift after upstream changes** → Normalize and validate
  overlays in the generator and prove repeated sync convergence.
- **Compound retirement loses useful retrospectives** → Preserve the user
  outcome through Explore plus `doc-smith`, without retaining a sixth lifecycle
  owner or automatic post-task mutation.
- **Approximate budgets become policy** → Keep metrics informational and block
  only missing ownership, behavior regressions, or misplaced runtime content.

## Migration Plan

1. Commit and review the complete OpenSpec.
2. Build the full disposable POC, pausing at unit 2 for first-objective proof.
3. Publish the POC as draft, run local and hosted review, and obtain acceptance
   of its exact clean head.
4. Reconcile POC findings and actual footprint into this OpenSpec, validate the
   21-unit topology with the post-POC delivery-shape checkpoint, and close the
   accepted POC unmerged.
5. Implement final units independently in the accepted total Git order, with
   one branch/worktree and one draft MR per top-level unit.
6. In unit 21, verify the complete corpus, synchronize delta specs, complete
   task state, and archive the change before publication.

Rollback is per final unit. Revert the affected MR and restore the preceding
skill/reference/test owners; do not weaken eval thresholds or reintroduce
duplicate policy as a compatibility path.

## Open Questions

None. Post-POC delivery topology remains provisional by policy, but the outcome,
ownership model, safeguards, and initial total order are resolved.
