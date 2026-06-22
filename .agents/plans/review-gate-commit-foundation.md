# Review Gate Commit Foundation

## Goal

Add a private `ax commit` path and shared review-gate validation core so agents
can commit through one deterministic local gate before ordinary Git commit
execution.

The first observable outcome is that `ax commit -m "..."` validates the current
staged diff against Git-private review-gate state, explains missing or stale
review evidence with `ax review-gate status`, and delegates to `git commit`
only when the gate passes or no active plan-delivery gate is armed.

## Motivation

Plan delivery needs a commit-time blocker that is private to Rene's local agent
workflow. It should not modify project Lefthook, Husky, CI, or committed hook
configuration. The foundation should establish the state file, validator, status
diagnostics, and agent-facing commit wrapper before plan skills start depending
on them.

## Domain Terms

| Term | Meaning |
| --- | --- |
| `ax commit` | The agent-facing commit command that validates the review gate before delegating to `git commit`. |
| Review gate | The local policy check that decides whether the staged diff has completed required local review passes. |
| Gate state | Git-private JSON stored under `$(git rev-parse --git-dir)/ax/review-gate.json`. |
| Staged diff fingerprint | A deterministic hash of the exact staged diff that would be committed. |
| Active plan-delivery gate | Gate state indicating plan delivery has armed commit blocking for the current staged diff or unit. |
| Review pass ID | A stable workflow result identifier such as `implementation-scrutiny` or `code-quality-review`; v1 gate state stores pass IDs, not skill display names. |

## Scope

### In Scope

- Add `ax commit` as the preferred agent commit path for normal staged
  commits.
- Add `ax review-gate status`.
- Add `ax review-gate validate-commit`.
- Resolve gate state at `$(git rev-parse --git-dir)/ax/review-gate.json`.
- Define and validate the v1 gate-state JSON shape.
- Extract shared review-gate logic into `scripts/review-gate.ts` so later plan
  workflow skills can reuse the same state IO, staged diff hashing, schema
  validation, and validation result model.
- Add `scripts/review-gate.ts` to `runtime.reusableScripts` if managed skills
  will import it in follow-up work.
- Compute a staged diff fingerprint from the current index.
- Validate required review-pass completion against the current staged diff
  fingerprint.
- Fail validation for missing required review passes, stale review results,
  unresolved blocking findings, or malformed state.
- Allow `ax commit` when no active plan-delivery gate exists.
- Update repo-local and installed portable instructions so agents use
  `ax commit` instead of raw `git commit`.
- Update `rules/git-and-review.md` so `ax commit` is the agent commit entrypoint
  and older `/glab-commit` guidance is retired, narrowed, or rephrased as
  host/publish workflow guidance.
- Update `skills/ax-cli/SKILL.md` so agents can discover and use `ax commit`
  and `ax review-gate`.
- Add tests for the new CLI commands, schema validation, staged diff
  fingerprinting, missing/stale/blocking failure modes, and no-gate allow path.

### Out Of Scope

- Wiring `plan-unit-delivery` to arm or update the gate.
- Recording reviewer outcomes from plan workflow skill reviews.
- Adding Codex or Claude command hooks that block raw agent `git commit`.
- Installing local `.git/hooks` or editing project-owned Lefthook, Husky, or CI
  configuration.
- Enforcing the gate for manual terminal `git commit`.
- Building a fully autonomous local reviewer runner.
- Dynamic reviewer routing or dynamic reviewer policy validation.
- Accepted-risk policy beyond requiring no unresolved blocking findings.
- Supporting commit-shape-mutating modes such as `--amend`, `-a`, `--all`,
  `--include`, `--only`, or pathspec commits.

## Desired Behavior

`ax commit` should behave like the safe commit entrypoint for agents:

1. Confirm the command is running inside a Git repository.
2. Confirm a staged diff exists.
3. Run `ax review-gate validate-commit`.
4. If validation passes, delegate to `git commit` with supported normal staged
   commit arguments.
5. If validation fails, print a short summary and tell the agent to run
   `ax review-gate status`.
6. Never pass `--no-verify` or otherwise bypass project hooks.

V1 `ax commit` should support normal staged commits with explicit message input,
such as `ax commit -m "Message"`. It should reject commit modes that can make
the committed content differ from the already-validated staged diff, including
`--amend`, `-a`, `--all`, `--include`, `--only`, pathspec commits, and
`--no-verify`. Rejected modes should print a clear diagnostic rather than
falling through to Git.

`ax review-gate status` should be diagnostic-only. It should show:

- state path;
- whether a gate is present and active;
- current staged diff fingerprint;
- required review passes;
- completed review passes;
- missing review passes;
- stale review passes;
- unresolved blocking findings;
- exact next command, when applicable.

`ax review-gate validate-commit` should exit non-zero only when an active gate
exists and the staged diff does not satisfy it. If no gate state exists, or if
the state explicitly reports no active plan-delivery gate, the command should
exit zero with a concise note.

## Gate State JSON

V1 state lives only in the Git directory:

```text
$(git rev-parse --git-dir)/ax/review-gate.json
```

Minimum shape:

```json
{
  "version": 1,
  "active": true,
  "workflow": "plan-unit-delivery",
  "unit": {
    "id": "atomic",
    "title": "Review gate commit foundation"
  },
  "stagedDiffHash": "sha256:<hash>",
  "requiredReviewPasses": [
    "implementation-scrutiny",
    "code-quality-review",
    "code-simplifier",
    "deslop",
    "docs-alignment-review"
  ],
  "results": {
    "implementation-scrutiny": {
      "status": "passed",
      "diffHash": "sha256:<hash>",
      "completedAt": "2026-06-22T00:00:00Z",
      "summary": "No blocking findings."
    }
  },
  "blockingFindings": [],
  "updatedAt": "2026-06-22T00:00:00Z"
}
```

The validator should treat the JSON as evidence, not authority. The current
staged diff fingerprint must match every required review-pass result.

## Implementation Tasks

### 1. Shared Review Gate Core

- [ ] 1.1 Add `scripts/review-gate.ts` for locating the Git directory and gate
  state path.
- [ ] 1.2 Add deterministic staged diff fingerprinting based on the staged
  patch content.
- [ ] 1.3 Add JSON parsing and schema validation for the v1 gate state.
- [ ] 1.4 Validate active gate requirements: required review passes present,
  result statuses passing, result diff hashes match current staged diff, and
  blocking findings are empty.
- [ ] 1.5 Return structured validation details that can be shared by status,
  validate, and commit commands.
- [ ] 1.6 Add `scripts/review-gate.ts` to `runtime.reusableScripts` when follow-
  up managed skills need to import it.

### 2. CLI Surface

- [ ] 2.1 Add `ax review-gate status`.
- [ ] 2.2 Add `ax review-gate validate-commit`.
- [ ] 2.3 Add `ax commit` and delegate to `git commit` only after review-gate
  validation passes.
- [ ] 2.4 Implement explicit Commander pass-through handling for supported
  `git commit` message arguments.
- [ ] 2.5 Reject commit-shape-mutating or bypass flags, including `--amend`,
  `-a`, `--all`, `--include`, `--only`, pathspec commits, and `--no-verify`.
- [ ] 2.6 Keep manual raw terminal `git commit` outside this v1 enforcement
  path.

### 3. Agent Instructions

- [ ] 3.1 Update root `AGENTS.md` to require agents to use `ax commit` instead
  of raw `git commit`.
- [ ] 3.2 Update portable `instructions/AGENTS.md` with the same agent commit
  rule.
- [ ] 3.3 Update `rules/git-and-review.md` so commit guidance points agents at
  `ax commit`, while any older `/glab-commit` guidance is retired, narrowed, or
  moved to host-specific publish guidance.
- [ ] 3.4 Update `skills/ax-cli/SKILL.md` with `commit` and `review-gate`
  command guidance, including `status` before troubleshooting and common
  unsupported commit modes.
- [ ] 3.5 Clarify that this rule governs agent behavior and does not remove the
  user's manual terminal escape hatch.

### 4. Verification And Runtime Refresh

- [ ] 4.1 Add unit tests for gate-state path resolution in normal repos and
  linked worktrees.
- [ ] 4.2 Add unit tests for staged diff fingerprint stability and staleness.
- [ ] 4.3 Add CLI tests for `ax review-gate status`.
- [ ] 4.4 Add CLI tests for `ax review-gate validate-commit` pass, no-gate
  allow, missing review pass, stale review pass, blocking finding, and
  malformed JSON.
- [ ] 4.5 Add CLI tests for `ax commit` delegating only after validation passes.
- [ ] 4.6 Add instruction tests proving agent instructions mention `ax commit`
  and avoid raw `git commit` as the default agent path.
- [ ] 4.7 Run `writing-skills` review because this changes shared agent
  instructions/rules and likely the `ax-cli` skill.
- [ ] 4.8 Refresh and validate installed instructions for both `personal` and
  `work` profiles.
- [ ] 4.9 If `skills/ax-cli` changes, refresh and check installed skills for
  both `personal` and `work` profiles.

## Verification Commands

Expected verification for the implementation slice:

```bash
pnpm run test:unit
pnpm test:integration -- tests/integration/ax-cli.test.ts
pnpm ax validate --profile personal
pnpm ax validate --profile work
pnpm ax instructions update --profile personal
pnpm ax instructions update --profile work
pnpm ax instructions validate --profile personal
pnpm ax instructions validate --profile work
pnpm ax skills update --profile personal
pnpm ax skills update --profile work
pnpm ax skills status --profile personal
pnpm ax skills status --profile work
pnpm ax review-gate status
pnpm ax review-gate validate-commit
```

Implementation should also manually exercise `ax commit` in a temporary fixture
repository or test fixture so the project history is not polluted by a
throwaway commit.

## Rollout Notes

- This plan does not install or configure project Git hooks.
- This plan does not block manual terminal `git commit`.
- Plan workflow integration starts only after this foundation is merged and the
  commands are available to plan skills.
