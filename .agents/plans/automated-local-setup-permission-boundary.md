# Automated Local Setup Permission Boundary

## Goal

Allow agents to run documented automated setup and install the dependency graph
already declared by a project without requesting separate permission, while
keeping dependency additions, updates, downgrades, removals, and dependency-file
changes permission-gated.

## Scope

- Align `AGENTS.md`, `instructions/AGENTS.md`, and
  `rules/command-and-tools.md` on the operation-based permission boundary.
- Preserve explicit authorization for destructive commands and dependency graph
  changes.
- Require an agent to stop when setup would change a dependency manifest or
  lockfile instead of silently accepting the change.
- Add a unit-level contract regression covering both instruction entrypoints and
  the detailed command rule.
- Run `writing-skills` baseline and post-change pressure scenarios for the
  changed agent behavior.

## Acceptance

- A fresh worktree may run its documented setup command and install existing
  declared or locked dependencies without a permission prompt.
- Adding, updating, downgrading, or removing a dependency still requires direct
  user authority or an accepted implementation contract.
- An automated setup command that would alter dependency manifests or lockfiles
  stops at that boundary and requests authority.
- Unit tests and the configured instruction-surface validation pass.

## Delivery

Deliver the plan, instruction changes, rule change, and regression test as one
atomic final MR. Do not refresh the live installed runtime before merge.
