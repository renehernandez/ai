# Repository size limit

## Objective

Give this repository its own change-size limit in its repo-local
`AGENTS.md`. The general rules stay unchanged for every other repository.

## Accepted scope

Add one entry to the "Repository Finish policy" section of the repo-root
`AGENTS.md`. The user supplied these numbers:

- A non-removal PR/MR in this repository targets at most 15 changed files and
  1,500 changed lines (additions plus deletions) across its complete
  effective diff. Above either target, the plan records why another safe
  semantic split is impractical.
- A forecast or measured diff above 30 files or 3,000 changed lines returns to
  Plan. The only exception is a user approval bound to the named artifact,
  accepted outcome, and unsafe-to-split rationale, preserved the same way the
  general rules preserve it.
- This entry overrides the general 10-file/500-line target and
  15-file/1,000-line cap for this repository only.
- The 50-file hard cap for non-removal final MRs, the removal-only exemption,
  and the POC exemption still apply unchanged.

The entry must state that it is repository-specific, and must link the
general owner (`rules/git-and-review.md`) for everything it does not
override.

## Behavior

Agents working in this repository read the repo `AGENTS.md` as the
higher-precedence project instruction. Its own "Scope and precedence" section
places it after system, developer, and user instructions and before the rule
files. They therefore apply 15/1,500 and 30/3,000 here, and the general
numbers everywhere else.

## Reuse and deviation

- Owner: the repo-root `AGENTS.md`, "Repository Finish policy". It already
  holds repository-specific publication policy that overrides general rules
  for this repo.
- Unchanged:
  - `instructions/AGENTS.md`, the portable user-level entrypoint;
  - everything under `rules/`, including the charter and
    `git-and-review.md`, `investigation-and-implementation.md`, and
    `docs-and-specs.md`;
  - archived OpenSpec and historical plans.
- Rejected:
  - Editing the general rules, which the user explicitly declined.
  - Adding the entry to `rules/git-and-review.md`'s "AI repository delivery"
    section, which is still a shared rule file the runtime installs.

## Acceptance and proof

- The new `AGENTS.md` entry contains the four numbers and the exception
  rule.
- The diff touches no file under `rules/` and does not touch
  `instructions/AGENTS.md`.
- Existing instruction, charter, and lifecycle tests stay green. Several of
  them read the repo `AGENTS.md`: `agent-instructions`,
  `agent-workflow-charter`, `agent-workflow-lifecycle`,
  `communication-rules`, and `ax-runtime-identity-docs`.
- Add one focused assertion to an existing repo-`AGENTS.md` test, for
  example `tests/unit/agent-instructions.test.ts`. It pins that the
  repository entry states 15 files / 1,500 lines and 30 files / 3,000 lines,
  and that `rules/git-and-review.md` still states the general 15 files /
  1,000 changed-line cap.
- Run lint, format, unit tests, skill and charter validation through native
  hooks.
- Run `writing-skills` RED/GREEN for the changed instruction text: the new
  assertion fails on the base and passes on the change.

## Delivery boundary and risk

This is one atomic change of about 3 files and well under 100 changed lines.
It is independent of the open consult-planners stack: branch
`repo-size-limit` from `origin/main`, PR targeting `main`. The risks are that
agents read the general rule first and miss the override, and that
divergence goes unnoticed. The precedence statement and the pinned test
mitigate both. Rollback: revert through a normal PR.
