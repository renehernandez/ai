# Agent Runtime CLI Skill

## Goal

Create a shared `agent-runtime-cli` skill that teaches agents how to use the
repo-managed `agent-runtime` CLI for reusable runtime assets, including
OpenSpec configuration through `agent-runtime openspec`.

The skill should prevent agents from bypassing the wrapper with raw upstream
commands, misplacing runtime profile flags, or treating OpenSpec `install` and
`update` as interchangeable.

## Motivation

The runtime CLI is the stable entrypoint for this repo's shared agent assets:

- shared skills under `skills/`;
- installed skill/runtime copies under profile-specific targets;
- portable `AGENTS.md` and rules symlinks;
- runtime hooks;
- repo-local OpenSpec scaffolding.

Agents currently need to infer command behavior from `package.json`,
`agent-runtime.config.json`, existing instructions, and `scripts/agent-runtime.ts`.
That makes it easy to drift into direct filesystem edits, raw upstream
`openspec init`, or invalid flag combinations.

This skill should be the reusable operational guide for the CLI.

## Domain Terms

| Term | Meaning |
| --- | --- |
| `agent-runtime` | The package-managed CLI invoked with `pnpm agent-runtime ...`; this is the preferred entrypoint over direct script execution. |
| Runtime profile | A named install/update target such as `personal` or `work`; accepted by top-level lifecycle commands and scoped `skills` / `instructions` commands. |
| Runtime scope | A CLI area: top-level all-assets lifecycle, `skills`, `instructions`, `hooks`, or `openspec`. |
| Managed asset | A skill, instruction, hook, generated OpenSpec asset, or symlink controlled by `agent-runtime.config.json`. |
| OpenSpec setup state | `missing`, `configured`, or `partial`, as defined by the guided OpenSpec runtime setup plan. |

## Scope

### In Scope

- Add shared skill source at `skills/agent-runtime-cli/SKILL.md`.
- Teach command selection for top-level lifecycle commands and the `skills`,
  `instructions`, `hooks`, and `openspec` scopes.
- Teach profile/config flag placement from current CLI help.
- Include an OpenSpec setup guide that routes through
  `pnpm agent-runtime openspec install|update|status|validate`.
- Include writing-skills RED/GREEN validation evidence in the new skill.
- Validate the skill and refresh installed runtime copies for affected profiles.

### Out Of Scope

- Changing `scripts/agent-runtime.ts` command behavior.
- Implementing the guided OpenSpec setup feature itself.
- Creating or changing generated `.agents/skills/openspec-*` workflow skills.
- Creating a separate OpenSpec change for this skill-only delivery.
- Opening a PR; this repo publishes direct commits to `main` when validation is
  clean.

## Desired Skill Behavior

The skill should make these choices obvious:

| Situation | Recommended command |
| --- | --- |
| Need all managed assets current for one profile | `pnpm agent-runtime update --profile <name>` |
| Need all managed assets current for every profile | `pnpm agent-runtime update --all-profiles` |
| Need only shared skills refreshed | `pnpm agent-runtime skills update --profile <name>` |
| Need instruction/rule symlinks refreshed | `pnpm agent-runtime instructions update --profile <name>` |
| Need hooks refreshed | `pnpm agent-runtime hooks update` |
| Need repo-local OpenSpec scaffolding refreshed | `pnpm agent-runtime openspec update` |
| Need to inspect before mutation | `pnpm agent-runtime status ...` or scoped `status` |
| Need delivery confidence after mutation | `pnpm agent-runtime validate ...` or scoped `validate` |

The skill should also teach these guardrails:

- Use package-managed invocation: `pnpm agent-runtime ...`.
- Check `--help` for current flags before using uncommon options.
- Use `--profile` or `--all-profiles` only where the current CLI accepts them.
- Do not pass runtime profile flags to `hooks` or `openspec` commands.
- Do not run raw upstream `openspec init` for managed repo-local setup.
- For OpenSpec, use `install` only when setup is missing; use `update` for
  configured projects; report partial setup instead of overwriting it.
- After changing shared skill, instruction, hook, or runtime guidance, run the
  relevant `agent-runtime ... validate` command and refresh installed runtime
  copies before treating the change as live.

## Skill Creation Plan

### 1. RED: Baseline Skill Tests

Use `writing-skills` TDD before writing the skill. Run baseline pressure
scenarios without the new skill and capture failures.

Required scenarios:

1. **OpenSpec bypass pressure**: agent is asked to initialize OpenSpec and
   chooses raw `openspec init` instead of `pnpm agent-runtime openspec install`.
2. **Invalid flag pressure**: agent passes `--profile` to
   `pnpm agent-runtime openspec install` or `pnpm agent-runtime hooks update`.
3. **Existing setup pressure**: agent sees an OpenSpec footprint and reruns
   `install` instead of using `status`, `update`, or repair reporting.
4. **Runtime refresh pressure**: agent edits a shared skill and forgets to run
   `pnpm agent-runtime skills update --profile <name>` and validation.

If the harness requires explicit authorization to spawn subagents for
writing-skills tests, stop and ask for that authorization before starting RED.

### 2. GREEN: Create The Skill

Create `skills/agent-runtime-cli/SKILL.md` with:

- concise frontmatter using only `name`, `description`, and `allowed-tools`;
- an overview that names `pnpm agent-runtime` as the CLI entrypoint;
- a lifecycle decision table for `install`, `update`, `status`, and `validate`;
- scoped guidance for `skills`, `instructions`, `hooks`, and `openspec`;
- profile/config flag placement rules;
- OpenSpec setup state guidance;
- verification and runtime-refresh checklist;
- common mistakes derived from RED failures;
- test evidence from RED/GREEN runs.

Keep the skill lean. Prefer `pnpm agent-runtime <scope> --help` over copying all
flag details.

### 3. GREEN: Validate And Refresh Runtime Copies

After writing the skill:

1. Run the skill validation command used by this repo.
2. Run GREEN pressure scenarios with the skill loaded.
3. Run `pnpm agent-runtime skills validate --profile personal`.
4. Run `pnpm agent-runtime skills validate --profile work`.
5. Run `pnpm agent-runtime skills update --profile personal`.
6. Run `pnpm agent-runtime skills update --profile work`.
7. Re-run profile validation if update changes installed runtime state.

### 4. Publish Directly

If validations are clean, commit the skill slice directly to `main` and push the
configured main remotes. Do not open a PR for this repo.

## Verification

Minimum verification for the delivery slice:

```bash
pnpm agent-runtime skills validate --profile personal
pnpm agent-runtime skills validate --profile work
pnpm test
```

If installed runtime copies change:

```bash
pnpm agent-runtime skills update --profile personal
pnpm agent-runtime skills update --profile work
pnpm agent-runtime skills status --profile personal
pnpm agent-runtime skills status --profile work
```

The exact command list may expand if RED/GREEN testing identifies a validation
gap.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Skill duplicates CLI help and becomes stale | Use decision guidance and refer to `--help` for flag details. |
| Agents treat OpenSpec setup as raw upstream CLI work | Include explicit managed-setup guardrails and RED/GREEN evidence. |
| Agents misuse runtime profile flags | Include scope-specific flag placement table tested by pressure scenarios. |
| Skill ships without proof | Follow `writing-skills`: RED baseline, GREEN validation, then commit. |
| Runtime installed copies drift from source | Refresh and validate profile installs before publishing. |

## Recommended First Slice

Implement the full shared skill in one direct-publish slice:

- RED baseline pressure scenarios;
- `skills/agent-runtime-cli/SKILL.md`;
- GREEN pressure scenarios;
- repo validation and runtime refresh;
- direct commit to `main`.

This is atomic because it produces one observable system outcome: future agents
can load a shared skill that guides correct `agent-runtime` CLI use.
