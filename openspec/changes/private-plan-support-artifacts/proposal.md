## Why

Atomic plan markdown files under `.agents/plans/**` are useful durable planning
artifacts, but the same folder has also become a landing zone for
reviewer-selection YAML, review requests, blueprints, ledgers, and validation
inputs. Those support artifacts should remain available for debugging and
resume, without being committed or published as hosted review content.

## What Changes

- Keep primary atomic plan markdown files under `.agents/plans/**` as valid
  durable plan artifacts.
- Treat support workflow artifacts as thread evidence plus private AX plan
  workspace records, not repo sidecars beside the plan.
- Add a minimal `pnpm ax plans artifact record|list` command family that stores
  file-backed support artifacts under `~/.ax/plans/` for the invocation target
  repo.
- Require deterministic private workspace identity from the target repo,
  repo-relative plan path, and plan content fingerprint.
- Require recoverable private workspace writes with immutable blobs,
  manifest/index metadata, duplicate tolerance, and repair guidance for
  partial or corrupt state.
- Update `plan-review` validation so `artifact_type: plan` allows primary
  markdown plan docs but rejects touched support sidecars under
  `.agents/plans/**`.
- Preserve the existing OpenSpec invariant that `artifact_type: openspec`
  planning diffs contain no `.agents/plans/**` paths.
- Update shared planning skills, adapter prompts, rules, and AX CLI guidance so
  agents store support evidence privately and do not leak local private paths
  into hosted review descriptions.
- Refresh managed skill and instruction surfaces after implementation.

## Capabilities

### New Capabilities

- `ax-plan-artifact-storage`: private local storage and lookup for file-backed
  plan workflow support artifacts.

### Modified Capabilities

- `review-first-plan-orchestration`: distinguish primary atomic plan markdown
  artifacts from support sidecars, reject support sidecars in hosted planning
  diffs, and keep hosted review descriptions free of local private paths by
  default.
- `ax-cli`: expose the `plans artifact` command family as a repo-local target
  scope and include it in CLI/runtime guidance.

## Impact

- `scripts/ax.ts`, AX command dispatch/help, and likely a shared
  `scripts/plan-artifacts.ts` or `scripts/planning-contracts.ts` helper.
- `skills/plan-ready`, `skills/plan-review`, `skills/plan-orchestrator`, and
  `skills/ax-cli` source and adapter prompts.
- `skills/plan-review/scripts/plan-review.ts` and planning path validation
  tests.
- Repo rules describing `.agents/plans/**` planning artifacts and hosted review
  evidence.
- OpenSpec specs for reviewed planning orchestration and AX CLI behavior.
- Managed runtime skill and instruction refresh evidence for personal and work
  profiles.
