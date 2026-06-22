# Reusable Runtime Script Dependency Guard

## Goal

Make installed planning skills fail validation before runtime when they import a
repo shared script that is not installed into the runtime roots.

The first observable outcome is that the installed `plan-review` validator can
run its request validation path after `scripts/nitro-feedback-gate.ts` is
installed as a reusable runtime script, and future missing shared-script imports
are caught by `agent-runtime validate`.

## Motivation

The installed `plan-review` and `plan-unit-delivery` skills currently import:

```ts
../../../scripts/nitro-feedback-gate.ts
```

but the runtime configuration only installs `scripts/planning-contracts.ts`.
That leaves `pnpm agent-runtime status` looking healthy while the installed
skill crashes with a missing module error during a real planning-review flow.

The runtime already has a reusable-script mechanism. This plan tightens the
contract so local managed skills and reusable runtime scripts stay in sync.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Reusable runtime script | A repo `scripts/*.ts` file declared in `runtime.reusableScripts` and copied into runtime roots such as `~/.agents/scripts`. |
| Installed skill | A runtime copy under a managed skill root such as `~/.agents/skills/<skill-name>`. |
| Local managed skill | A skill sourced from this repo's configured local skill blocks, such as `skills/*`. |
| Shared-script import | A skill script import that references `../../../scripts/<file>.ts` from an installed skill script. |
| Dependency completeness | The invariant that each local managed shared-script import has a matching `runtime.reusableScripts` entry. |

## Scope

### In Scope

- Add `scripts/nitro-feedback-gate.ts` to `runtime.reusableScripts`.
- Add validation that scans local managed skill scripts for
  `../../../scripts/*.ts` imports.
- Fail validation when a local managed skill imports a shared runtime script
  that is not declared in `runtime.reusableScripts`.
- Keep remote-installed skills outside the v1 dependency contract.
- Refresh installed runtime copies after the config/runtime change.
- Prove the original `plan-review validate-request` failure is fixed using the
  installed skill path.
- Confirm current `nitro-feedback-gate.ts` import consumers, including
  `plan-review` and `plan-unit-delivery`, are covered by the config repair and
  validation guard.

### Out Of Scope

- Auto-discovering and installing shared scripts without explicit config.
- Full TypeScript module resolution for every possible import shape.
- Supporting remote skill dependencies on this repo's private shared scripts.
- Redesigning skill packaging or introducing a generic dependency manifest.
- Changing the `plan-review` workflow semantics.

## Desired Behavior

`agent-runtime` should treat reusable script declarations as the source of truth.
When validating the runtime configuration, it should inspect local managed skill
source files and require every shared-script import to be declared.

For example, if `skills/plan-review/scripts/plan-review.ts` imports
`../../../scripts/nitro-feedback-gate.ts`, validation should require
`scripts/nitro-feedback-gate.ts` in `runtime.reusableScripts`.

The error should name the importing skill and missing reusable script, for
example:

```text
Skill plan-review imports reusable runtime script scripts/nitro-feedback-gate.ts, but it is not listed in runtime.reusableScripts
```

Status output should continue to show reusable script install state, but
validation is the hard gate.

## Implementation Tasks

### 1. Runtime Config Repair

- [ ] 1.1 Add `scripts/nitro-feedback-gate.ts` to
  `agent-runtime.config.json` under `runtime.reusableScripts`.
- [ ] 1.2 Confirm both declared reusable scripts exist in the source checkout.

### 2. Local Skill Import Guard

- [ ] 2.1 Derive local managed skills from the existing selected-profile skill
  expansion path, reusing or extracting around `expandSkillSources` /
  `buildSkillInstallPlans`, then filtering with `isLocalSource`.
- [ ] 2.2 Scan TypeScript files under each local skill's `scripts/` directory.
- [ ] 2.3 Detect imports matching `../../../scripts/<file>.ts`.
- [ ] 2.4 Normalize matches to `scripts/<file>.ts`.
- [ ] 2.5 Fail validation when a normalized import is absent from
  `runtime.reusableScripts`. Build the declared reusable-script set from
  `runtimeFileTargetPath(...)` after `validateReusableScriptConfig` so both
  string and `{ sourcePath, targetPath }` reusable-script entries remain
  supported.
- [ ] 2.6 Ignore remote skill blocks for this v1 guard.
- [ ] 2.7 Add a negative validation test or fixture that omits
  `scripts/nitro-feedback-gate.ts` from `runtime.reusableScripts` while a local
  managed skill imports it, and assert the missing reusable script error.
- [ ] 2.8 Add durable regression coverage proving:
  - undeclared local managed `../../../scripts/*.ts` imports fail validation;
  - declared local managed shared-script imports pass validation;
  - remote skill sources remain outside the v1 import-completeness guard.
- [ ] 2.9 Prefer extending `tests/integration/agent-runtime-cli.test.ts`,
  reusing its reusable-script fixture surface, unless implementation discovers a
  lower-level unit-test seam that covers the behavior more directly.

### 3. Documentation Alignment

- [ ] 3.1 Update `docs/agent-runtime.md` so validation explicitly covers local
  managed skill import completeness for reusable runtime scripts.
- [ ] 3.2 Leave `rules/command-and-tools.md` unchanged unless implementation
  changes the existing rule that shared skill dependencies must be declared in
  `runtime.reusableScripts`.

### 4. Verification And Runtime Refresh

- [ ] 4.1 Run profile validation before refresh to prove config validation is
  clean.
- [ ] 4.2 Run the relevant unit or integration test command for the regression
  coverage from task 2.8, expected to include
  `pnpm test:integration -- tests/integration/agent-runtime-cli.test.ts` if the
  existing integration fixture is extended.
- [ ] 4.3 Run `pnpm agent-runtime update --all-profiles`.
- [ ] 4.4 Run `pnpm agent-runtime validate --profile personal`.
- [ ] 4.5 Run `pnpm agent-runtime validate --profile work`.
- [ ] 4.6 Confirm `~/.agents/scripts/nitro-feedback-gate.ts` exists.
- [ ] 4.7 Confirm each configured runtime root has a healthy reusable-script
  target or symlink, including `~/.claude/scripts/nitro-feedback-gate.ts` when
  `~/.claude/skills` is configured as a skill symlink target.
- [ ] 4.8 Run installed `plan-review validate-request` from the canonical
  `~/.agents/skills/plan-review` path with a minimal valid request.
- [ ] 4.9 Run installed `plan-review validate-request` from each configured
  symlink target path, including `~/.claude/skills/plan-review` when present, or
  inspect `pnpm agent-runtime status` output showing the corresponding reusable
  script link is healthy.
- [ ] 4.10 Run the negative validation test from task 2.7 and confirm
  validation fails with the expected undeclared reusable script message.

## Verification

Minimum verification for the delivery slice:

```bash
pnpm agent-runtime validate --profile personal
pnpm agent-runtime validate --profile work
pnpm test:integration -- tests/integration/agent-runtime-cli.test.ts
pnpm agent-runtime update --all-profiles
pnpm agent-runtime validate --profile personal
pnpm agent-runtime validate --profile work
pnpm agent-runtime status
bun /Users/rene.hernandez/.agents/skills/plan-review/scripts/plan-review.ts validate-request
bun /Users/rene.hernandez/.claude/skills/plan-review/scripts/plan-review.ts validate-request
```

The installed `plan-review` commands should receive a minimal valid
`plan_review_request` on standard input:

```yaml
plan_review_request:
  status: ready_for_review
  artifact_type: plan
  artifact_ref: .agents/plans/reusable-runtime-script-dependency-guard.md
  review_goal: Validate the reusable runtime script dependency guard plan before implementation.
  requested_reviewers:
    - nitro
    - developers
  unresolved_blockers: []
```

Verification must also include a negative validation test or fixture proving
that omitting an imported reusable script from `runtime.reusableScripts` fails
before runtime. The config repair and validation proof should acknowledge both
current `nitro-feedback-gate.ts` import consumers:

- `skills/plan-review/scripts/plan-review.ts`
- `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts`

## Risks And Controls

| Risk | Control |
| --- | --- |
| Validation becomes too broad and flags remote skills | Limit v1 scanning to configured local skill blocks. |
| Import detection misses future shapes | Support the concrete relative import pattern used by current planning skills and defer general module resolution. |
| Runtime refresh mutates installed assets unexpectedly | Use the existing `agent-runtime update --all-profiles` path and inspect status afterward. |
| Config-only repair regresses later | Add validation so undeclared local shared imports fail before runtime. |

## Recommended First Slice

Implement this as one atomic runtime-maintenance delivery:

1. update reusable script config;
2. add local managed skill shared-import validation;
3. refresh installed runtime copies;
4. prove the installed `plan-review` request validator runs.

This produces one user-visible system outcome: installed planning skills no
longer crash from missing declared-local shared script dependencies, and future
missing dependencies are caught by validation.
