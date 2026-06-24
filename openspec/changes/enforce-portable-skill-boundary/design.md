## Context

This repo installs shared skills into multiple agent runtimes, but those skills
are authored from the AI repo source tree. Several planning workflow skills
currently import helpers through `../../../scripts/*`, and some non-`ax-cli`
skills teach AX commands for private plan-artifact storage. That works in the
source checkout, but it breaks the mental model that a skill folder is a
portable unit.

The durable invariant is stricter than the current implementation:

- a portable skill must carry the files it needs inside the skill folder;
- only `skills/ax-cli` explains AX commands and runtime layout;
- precommit validation must reject regressions because this repo has no CI.

## Goals / Non-Goals

**Goals:**

- Make the portable skill boundary enforceable through `pnpm skills:validate`.
- Package current planning workflow helper dependencies inside affected skill
  folders.
- Remove AX command examples from non-`ax-cli` skills while keeping legitimate
  repo artifact paths such as `.agents/plans`.
- Align repo instructions, runtime rules, AX guidance, and config with the new
  invariant.

**Non-Goals:**

- Adding a dependency manifest or generic skill dependency resolver.
- Adding an allowlist for known non-portable first-party skills.
- Replacing AX as the local runtime-management interface.
- Refreshing installed runtime copies in the planning artifact.

## Decisions

### Validate The Boundary At Skill Source

`scripts/skill-validate.ts` remains the enforcement point because it already
runs under `pnpm skills:validate` and precommit. The validator should inspect
`SKILL.md`, `agents/openai.yaml`, and skill-local scripts for non-portable
patterns.

The rule must distinguish project artifact paths from installed runtime
surfaces. `.agents/plans` is allowed when a skill describes repo files.
`~/.agents`, `~/.codex`, `.codex/skills`, `.claude/skills`, machine-specific
absolute paths, and AX command examples remain disallowed outside `ax-cli`.

### Package Helpers Per Skill

The initial implementation packages helper logic inside the six planning
workflow skills that currently import repo-level scripts:

- `openspec-tasks`
- `plan-ready`
- `plan-review`
- `plan-orchestrator`
- `plan-unit-sequencer`
- `plan-unit-delivery`

Duplication is accepted for this change because the invariant is folder-level
portability. A later reusable package can replace duplication only if it is a
real package dependency available to the installed skill, not another repo-root
path.

### Keep AX Knowledge In `ax-cli`

Non-`ax-cli` skills can say that support artifacts belong in the thread or
private workflow storage, but they must not teach `pnpm ax ...` or `ax ...`
commands. The concrete commands for recording and recovering private artifacts
belong in `skills/ax-cli` and repo-local runtime rules.

### Remove `runtime.reusableScripts` As A Skill Portability Mechanism

`ax.config.json` and instruction text currently describe shared repo scripts as
runtime-installed reusable assets. This change removes that as the accepted
path for shared-skill portability. AX can still manage runtime installation,
but a portable skill must not rely on those external script paths.

## Risks / Trade-offs

- Over-broad text checks could block legitimate project guidance. Mitigation:
  add red and green fixtures for AX command examples, installed runtime paths,
  machine-specific paths, and allowed `.agents/plans` usage.
- Copied helper logic can drift. Mitigation: keep tests at the behavior and
  skill-command boundary so each skill proves the behavior it packages.
- Removing AX command guidance from planning skills can make recovery commands
  less discoverable. Mitigation: point users to `ax-cli` for runtime/private
  artifact commands without spelling those commands in non-`ax-cli` skills.
- Instruction changes can accidentally erase AI repo authoring guidance.
  Mitigation: keep detailed runtime mechanics in root `AGENTS.md`,
  `rules/command-and-tools.md`, and `skills/ax-cli`, while portable
  instructions state the principle concisely.
