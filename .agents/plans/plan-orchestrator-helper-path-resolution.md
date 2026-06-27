# Plan: Clarify Plan-Orchestrator Helper Path Resolution

## Objective

Prevent `plan-orchestrator` users and agents from treating target repositories
such as Nitro as the source of shared AI workflow helper scripts. The
`plan-orchestrator` instructions should make clear that helper scripts are
resolved relative to the loaded `plan-orchestrator` skill directory, while
commands still run with the target repository as the working directory.

## Problem

During a Nitro stack workflow, an agent reported that the checkout did not
contain `scripts/plan-orchestrator.ts` and skipped the literal
`validate-stack-ready` helper. That conclusion was misleading because Nitro
should not contain the shared `plan-orchestrator` script. The script belongs to
the loaded `plan-orchestrator` skill directory, while source-checkout tests may
exercise the source copy.

## Scope

In scope:

- Update `skills/plan-orchestrator/SKILL.md` to document helper path
  resolution for target repositories.
- Update `skills/plan-orchestrator/agents/openai.yaml` so the agent prompt
  instructs agents to resolve helper scripts from the loaded
  `plan-orchestrator` skill directory.
- Add or update focused regression coverage that prevents the guidance from
  drifting back to target-repo-relative helper paths.
- Preserve the portable skill boundary: do not add root-level wrappers in Nitro
  or other work-project repositories.

Out of scope:

- Changing Nitro.
- Creating `scripts/plan-orchestrator.ts` at the root of target repositories.
- Reworking the helper runner into a new `ax` command.
- Changing `validate-stack-ready` contract semantics.

## Proposed Implementation

Update the `plan-orchestrator` skill documentation with a short helper path
resolution section:

- `scripts/plan-orchestrator.ts` is relative to the loaded skill directory.
- Keep the command working directory in the target repository so live Git,
  OpenSpec, and hosted-review checks inspect the target repository.
- Invoke helper scripts from the loaded `plan-orchestrator` skill directory,
  not from the target repository.
- Do not copy or expect shared workflow helper scripts in the target repo.

Update the OpenAI adapter prompt with equivalent guidance, because this failure
was an agent behavior issue.

Add regression coverage in the existing instruction tests to assert that both
the skill docs and adapter prompt mention loaded-skill-directory resolution,
target-repository working-directory preservation, and warn against target-repo
helper lookup. The coverage should also prevent machine-specific installed
paths or repo-root `skills/...` helper examples from being added to the
portable skill or adapter prompt.

## Acceptance

- Agents are told to resolve `plan-orchestrator` helper scripts from the loaded
  skill directory when the active working directory is a target repo.
- The guidance preserves target-repo `cwd` for live repository inspection.
- The guidance explicitly avoids adding or expecting root-level helper wrappers
  in Nitro or other work-project repos.
- The guidance avoids machine-specific installed paths and repo-root
  `skills/...` command examples in portable skill and adapter text.

## Verification

- `pnpm exec node --import tsx --test tests/unit/agent-instructions.test.ts`
- `pnpm exec node --import tsx --test tests/unit/plan-orchestrator-script.test.ts`
- `pnpm ax validate --all-profiles`
