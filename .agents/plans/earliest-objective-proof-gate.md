# Earliest Objective Proof Gate

## Goal

Make planning guidance and readiness validation block plans that defer proof of
the named new capability too late.

The first observable outcome is that a plan like the recent `hw-admin`
operational verification spec fails readiness because real confirmation of
`hw-admin` verification arrives at Task 3.1 instead of deliverable 1 or 2.

## Motivation

The current planning surface blocks lifecycle-only, validation-only, and
proof-only task shapes, but a deliverable-shaped plan can still delay the
confidence moment for the actual objective. In the `hw-admin` case,
`design.md` said registered targets were required coverage, while `tasks.md`
scheduled the first real hosted proof of `ai/nitro-forks/hw-admin` under Task
3.1.

That plan was cleaner than the earlier lifecycle-phase version, but it still
missed the product question: when can the user confirm the new capability
works?

## Domain Terms

| Term | Meaning |
| --- | --- |
| Objective proof | The earliest deliverable where the named new capability is exercised through its real entrypoint and produces visible success or failure evidence. |
| Named new capability | The new target, workflow, integration, provider, runtime path, or behavior that motivates the plan. |
| Setup-only deliverable | A deliverable that prepares registry, metadata, schema, helper, config, or validation surfaces but does not exercise the named new capability. |
| Proof marker | Explicit planning syntax naming where objective proof happens, such as `Proof location:` or `First real confirmation:`. |
| `needs_spec_redesign` | The blocking status for plans or OpenSpec tasks that are shaped correctly as deliverables but delay objective proof beyond the allowed window. |

## Scope

### In Scope

- Update `skills/brainstorming/SKILL.md` with an Earliest Objective Proof rule.
- Add anonymized `hw-admin` planning failure evidence to the brainstorming skill.
- Update `skills/plan-ready/SKILL.md` and `skills/plan-ready/agents/openai.yaml`
  so readiness treats missing or late objective proof as blocking.
- Update `skills/plan-ready/scripts/plan-ready.ts` so `validate-blueprint`
  rejects blueprints where objective proof is not explicit by task 1 or task 2,
  or where more than one setup-only deliverable precedes proof.
- Update `skills/openspec-tasks/SKILL.md` and
  `skills/openspec-tasks/agents/openai.yaml` so OpenSpec task auditing blocks
  existing `tasks.md` files with the same late-proof shape.
- Update `skills/openspec-tasks/scripts/openspec-tasks.ts` to detect the
  objective-proof marker in task text or nested bullets and return
  `needs_spec_redesign` when proof is missing, too late, implicit, or
  marker-only.
- Add regression coverage for both blueprint validation and OpenSpec task audit,
  using the `hw-admin` failure shape without committing private thread
  provenance.
- Apply `writing-skills` validation expectations to the changed skill behavior.
- Refresh and validate installed skill runtime copies before treating the change
  as live.

### Out Of Scope

- Redesigning the `hw-admin` operational verification spec itself.
- Creating or updating OpenSpec files for this planning-surface change.
- Changing `plan-orchestrator`, `plan-review`, or `plan-unit-sequencer` unless
  implementation discovers they need wording-only alignment to preserve the new
  gate.
- Inferring objective proof from broad words like "end-to-end" without an
  explicit marker.
- Allowing more than one setup-only deliverable before objective proof.

## Desired Behavior

Planning artifacts must make objective proof explicit.

For atomic plans, the approved unit must identify the objective proof in its
acceptance or verification language.

For OpenSpec blueprints and existing `tasks.md` files:

Deliverable 1 should contain objective proof by default. A setup-only
deliverable 1 is a tolerated fallback, not an equally preferred shape; the
validator enforces the positional rule below rather than judging whether setup
was necessary.

- deliverable 1 may be setup-only;
- deliverable 2 must contain objective proof if deliverable 1 is setup-only;
- any objective proof first appearing in deliverable 3 or later blocks with
  `needs_spec_redesign`;
- more than one setup-only deliverable before objective proof blocks with
  `needs_spec_redesign`;
- the proof location must use explicit wording such as `Proof location:` or
  `First real confirmation:`;
- the marker content must describe the real capability path being exercised
  through the real entrypoint and the visible success or failure evidence;
- marker text that says proof is deferred, names only setup/config/metadata, or
  lacks visible outcome evidence does not count as objective proof;
- verification bullets and proof notes may carry the marker, but they must be
  attached to deliverable 1 or 2.

## Implementation Tasks

### 1. Brainstorming Guidance

- [ ] 1.1 Add an Earliest Objective Proof section to
  `skills/brainstorming/SKILL.md` that states the first implementation slice
  should prove the named new capability end to end; if a setup deliverable is
  unavoidable, the second slice must consume it and prove the capability.

  Acceptance:

  - The skill names the one-setup-only limit.
  - The skill requires explicit `Proof location:` or
    `First real confirmation:` wording in planning artifacts.
  - The skill says the marker must name a real entrypoint plus visible
    success/failure evidence, not setup/config readiness alone.
  - The skill includes anonymized RED evidence for a deliverable-shaped
    `hw-admin` plan that delayed first real confirmation to Task 3.1.
  - `writing-skills` RED/GREEN pressure validation shows the new guidance
    prevents the late-proof failure before installed copies are refreshed.

### 2. Blocking Readiness Gate

- [ ] 2.1 Update `skills/plan-ready/SKILL.md`,
  `skills/plan-ready/agents/openai.yaml`, and
  `skills/plan-ready/scripts/plan-ready.ts` so `validate-blueprint` returns
  `needs_spec_redesign` when objective proof is missing, too late, implicit, or
  preceded by more than one setup-only deliverable.

  Acceptance:

  - A blueprint passes when `Proof location:` appears in task 1.
  - A blueprint passes when one setup-only task is followed by
    `First real confirmation:` in task 2.
  - A blueprint fails when objective proof is missing.
  - A blueprint fails when objective proof is delayed to task 3.
  - A blueprint fails when marker text defers proof to a later task, describes
    only setup/config/metadata readiness, or lacks visible success/failure
    evidence.
  - The validator uses shared objective-proof analysis rather than a second
    ad hoc implementation of the same rule.

### 3. OpenSpec Task Audit Gate

- [ ] 3.1 Update `skills/openspec-tasks/SKILL.md`,
  `skills/openspec-tasks/agents/openai.yaml`, and
  `skills/openspec-tasks/scripts/openspec-tasks.ts` so audit reads enough
  task-local content to identify explicit objective-proof markers in task text
  or nested bullets and blocks late objective proof in existing OpenSpec task
  lists.

  Acceptance:

  - Parsed OpenSpec tasks retain task-local body text or another normalized
    deliverable text representation for nested proof notes.
  - The OpenSpec audit uses the same objective-proof analyzer as plan-ready.
  - A `tasks.md` passes when `Proof location:` appears in task 1.
  - A `tasks.md` passes when one setup-only task is followed by
    `First real confirmation:` in task 2, including when the marker appears in a
    nested proof note.
  - A `tasks.md` fails when objective proof is missing.
  - A deliverable-shaped `tasks.md` that avoids lifecycle-only phases but puts
    first real confirmation under Task 3.1 returns `needs_spec_redesign`.
  - A `tasks.md` fails when marker text defers proof to a later task, describes
    only setup/config/metadata readiness, or lacks visible success/failure
    evidence.

## Acceptance

- `brainstorming` tells agents to design for objective proof in slice 1 or,
  after one setup-only deliverable, slice 2.
- `plan-ready validate-blueprint` blocks late, missing, or implicit objective
  proof with `needs_spec_redesign`.
- `openspec-tasks audit` blocks existing OpenSpec `tasks.md` files where
  objective proof first appears after the second deliverable.
- Regression tests include the anonymized `hw-admin` failure shape.
- Installed runtime skill copies are refreshed and validated after source
  changes.

## Verification

Minimum verification for the delivery slice:

```bash
pnpm test:unit
pnpm ax skills validate --profile personal
pnpm ax skills validate --profile work
pnpm ax skills update --profile personal
pnpm ax skills update --profile work
pnpm ax skills status --profile personal
pnpm ax skills status --profile work
pnpm ax validate --profile personal
pnpm ax validate --profile work
```

Focused validation should also include direct negative checks for:

- `plan-ready validate-blueprint` rejecting objective proof delayed to task 3;
- `openspec-tasks audit` rejecting a deliverable-shaped `tasks.md` where first
  real confirmation is Task 3.1.
- `plan-ready validate-blueprint` and `openspec-tasks audit` rejecting missing
  proof and marker-only text that lacks a real entrypoint plus visible
  success/failure evidence.
- `writing-skills` pressure validation for the changed skill behavior, including
  RED/GREEN evidence that the new guidance prevents the late-proof failure.

## Risks And Controls

| Risk | Control |
| --- | --- |
| The gate becomes too fuzzy and agents infer proof generously | Require explicit `Proof location:` or `First real confirmation:` wording. |
| Marker-only detection false-passes weak proof | Require marker content to name the real entrypoint and visible success/failure evidence, and test deferred/setup-only marker text as negative cases. |
| Legitimate setup work is blocked | Allow one setup-only deliverable before objective proof. |
| Validators cannot understand nested proof notes | Parse task-local nested bullets, not only checkbox titles. |
| Plans pass `plan-ready` but fail later in OpenSpec audit | Implement the rule in both `plan-ready` and `openspec-tasks`. |
| Runtime skill copies drift from source | Refresh and validate installed skills after source changes. |

## Recommended First Slice

Implement this as one atomic shared-planning delivery. The outcome is one
runtime behavior change: future brainstorming, readiness validation, and
OpenSpec task auditing all reject plans that delay the named capability's first
real confirmation beyond deliverable 2.
