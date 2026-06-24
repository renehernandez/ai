## 1. Planning Workflow Skill Packaging

- [x] 1.1 Package required helper logic inside `openspec-tasks`, `plan-ready`,
      `plan-review`, `plan-orchestrator`, `plan-unit-sequencer`, and
      `plan-unit-delivery` so those skills no longer import repo-level helpers
      such as `../../../scripts/*` or sibling-skill helpers such as
      `../../openspec-tasks/scripts/*`, and their documented commands run from
      each skill folder. First real confirmation: execute the `pnpm exec tsx scripts/plan-ready.ts detect` CLI command from `skills/plan-ready` and observe successful JSON output.
- [x] 1.2 Remove AX command examples, installed runtime paths, private
      plan-artifact commands, and profile refresh mechanics from non-`ax-cli`
      shared skill instructions and adapter prompts while preserving portable
      `.agents/plans` repo artifact guidance and existing plan-unit-delivery
      task-delta behavior.

## 2. Portable Boundary Gate

- [ ] 2.1 Add `scripts/skill-validate.ts` portable-boundary checks for
      non-`ax-cli` skill text, adapter prompts, skill-root-local command
      examples, and script imports, with regression coverage for blocked AX
      commands, installed runtime paths, machine-specific paths, allowed
      `.agents/plans` repo artifact guidance, and legitimate-rule rollback
      containment. First real confirmation: run the `pnpm skills:validate` CLI entrypoint and observe failure output for a non-`ax-cli` AX-command fixture plus pass output for legitimate `.agents/plans` repo artifact guidance.

## 3. Authoring Boundary Alignment

- [ ] 3.1 Update `AGENTS.md`, `instructions/AGENTS.md`,
      `rules/command-and-tools.md`, `rules/investigation-and-implementation.md`,
      `skills/ax-cli/SKILL.md`, and `ax.config.json` so portable skills are
      self-contained, only `ax-cli` teaches AX/runtime mechanics, and
      `runtime.reusableScripts` is no longer the accepted shared-skill
      portability mechanism.
