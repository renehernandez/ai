## Why

`$merge-followthrough` currently describes merge, queue, check watching, sync,
cleanup, and deployment follow-through, but it still leaves merge permission
ambiguous. Agents can reach a green and mergeable MR, report that state, and
stop because the skill invocation itself is not clearly defined as finish-mode
permission.

The skill also needs sharper boundaries for stacks, branch cleanup,
default-branch CI proof, and high-confidence fix-forward behavior so the new
default is decisive without becoming reckless.

## What Changes

- Define `finish mode` and `check-only mode` for `$merge-followthrough`.
- Treat invoking `$merge-followthrough` for one active MR or PR as finish-mode
  permission unless check-only wording is present.
- Require explicit stack intent or freshly validated stack-ready evidence before
  merging a stack.
- Require safe branch cleanup checks, including hosted source/target
  dependencies.
- Replace default deployment verification with required default-branch CI graph
  proof after merge.
- Allow fix-forward MR/PR creation only for evidence-backed branch-caused
  default-branch CI failures above 0.90 confidence, and never merge that
  fix-forward artifact automatically.
- Add behavior-focused skill tests plus `writing-skills` RED/GREEN pressure
  evidence before runtime refresh.

## Capabilities

### New Capabilities

- `merge-followthrough`: Defines finish-mode merge follow-through behavior for
  active MRs/PRs and explicitly targeted stacks, including cleanup,
  default-branch CI proof, and fix-forward boundaries.

### Modified Capabilities

## Impact

- Affected skill: `skills/merge-followthrough/SKILL.md`.
- Affected adapter prompt: `skills/merge-followthrough/agents/openai.yaml`.
- Affected tests: focused unit coverage for merge-followthrough skill contract
  behavior.
- Affected runtime profiles: installed skill copies for personal and work
  profiles after source changes.
