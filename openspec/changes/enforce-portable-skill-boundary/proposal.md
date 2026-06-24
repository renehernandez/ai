## Why

Shared skills currently depend on AI repo layout and AX runtime mechanics in
places where the skill should be reusable from its own folder. Agents can end up
searching target projects for helper scripts, then recover only by discovering
the shared AI checkout, which makes skill contracts brittle.

## What Changes

- Add a portable skill authoring contract: non-`ax-cli` shared skills must be
  self-contained and must not teach AX commands, installed runtime paths,
  private plan-artifact commands, or profile refresh mechanics.
- Extend `pnpm skills:validate`, already wired into precommit, to block
  non-portable skill instructions, adapter prompts, command examples, and script
  imports before commit.
- Package repo-level helper dependencies inside the current planning workflow
  skills that import `../../../scripts/*`.
- Remove AX command guidance from non-`ax-cli` planning skills while preserving
  ordinary repo artifact paths such as `.agents/plans`.
- Update AX/runtime guidance and runtime config so `runtime.reusableScripts` is
  no longer the accepted portability mechanism for shared skills.

## Capabilities

### New Capabilities

- `skill-authoring`: Defines portable shared-skill boundaries, validation, and
  allowed exceptions.

### Modified Capabilities

- `ax-cli`: AX remains the runtime-management surface and the only shared skill
  allowed to teach AX commands, installed runtime paths, private plan-artifact
  commands, and profile refresh mechanics.
- `review-first-plan-orchestration`: Planning workflow skills must remain
  reusable without depending on shared repo-level helper scripts or AX command
  knowledge.

## Impact

- Affected validator: `scripts/skill-validate.ts` and unit fixtures.
- Affected skills: `openspec-tasks`, `plan-ready`, `plan-review`,
  `plan-orchestrator`, `plan-unit-sequencer`, `plan-unit-delivery`, and
  `ax-cli`.
- Affected instruction surfaces: `AGENTS.md`, `instructions/AGENTS.md`,
  `rules/command-and-tools.md`, `rules/investigation-and-implementation.md`,
  and `ax.config.json`.
- Affected tests: skill validation, plan-unit-delivery script behavior, and
  instruction/rule assertions.
