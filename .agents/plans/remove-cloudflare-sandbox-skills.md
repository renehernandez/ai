# Remove Cloudflare Sandbox Skills

## Goal

Remove Cloudflare's obsolete Sandbox skill selection from the managed AX
runtime so `pnpm ax sync` can resolve every configured source and converge the
installed runtime again. [confidence: 0.99 - certain | reason: the user selected
removal and the current upstream no longer provides the configured name]

## Approach

- Remove `sandbox-sdk` from the Cloudflare names in `ax.config.json` and add it
  to `runtime.retiredSkills` so the next live sync deletes stale installations.
- Do not select `sandbox-stable`, `sandbox-next`, or
  `sandbox-migrate-to-next`; no standalone Sandbox skill will be installed.
  The general `cloudflare` skill may continue to provide product references.
- Preserve the Cloudflare source, every other selected Cloudflare skill, the
  active runtime profile, and AX transaction behavior.

## Reuse And Deviation Contract

Reuse `ax.config.json` as the canonical managed-skill inventory and the existing
AX transaction engine as the sole owner of installed runtime convergence. The
closest precedent is AX's configured skill removal path: omit an unneeded
source skill from desired state, then let `pnpm ax sync` replace exact managed
targets and prune retired runtime paths. No new installer, migration, cleanup
script, or manual installed-runtime deletion is introduced.

The deliberate deviation from Cloudflare's upstream split is to install none of
the three replacement Sandbox skills. This matches the user's selected scope
and avoids choosing a stable, preview, or migration package line that the
managed corpus does not need. [confidence: 0.98 - certain | reason: upstream
exposes three mutually routed replacements and the user explicitly chose
removal]

## Scope

In scope: the Cloudflare skill-name selection in `ax.config.json`, this atomic
plan, isolated synchronization proof, repository verification, and post-merge
live AX convergence.

Out of scope: editing Cloudflare's upstream skills, manually deleting installed
skills, changing AX transaction logic, changing the selected profile, or adding
replacement Sandbox guidance.

## Delivery Shape

Deliver the plan and configuration removal together as one atomic MR targeting
`main`. The change is one coherent desired-state correction and requires no
OpenSpec, POC, dependency change, or migration design. Merge remains separately
authorized.

## Acceptance

- `ax.config.json` selects no Sandbox-specific Cloudflare skill.
- All non-Sandbox Cloudflare skill selections remain unchanged.
- An isolated `pnpm ax sync` resolves the configured sources successfully.
- Isolated `pnpm ax validate` passes and contains no installed `sandbox-sdk`,
  `sandbox-stable`, `sandbox-next`, or `sandbox-migrate-to-next` target.
- After merge, live `pnpm ax sync` and `pnpm ax validate` pass from the clean,
  updated `main` worktree and AX removes stale retired paths transactionally.

## Verification

- Validate JSON and run the AX-focused repository tests.
- Run an isolated HOME and runtime-root synchronization through the real AX CLI.
- Apply `writing-skills` verification because the managed skill corpus changes.
- Commit through native hooks, then publish one draft GitLab MR and follow
  required CI and Nitro feedback on the exact source head.

## Risks And Controls

- Removing the selection retires standalone Sandbox routing from future tasks.
  This is intentional; general Cloudflare guidance remains selected.
- A feature-branch sync must not touch the live runtime. Use isolated HOME and
  runtime roots until the change is merged.
- Do not hand-delete stale `compound` or Sandbox paths. AX owns their
  transactional removal during synchronization.

## First Real Confirmation

Synchronize the changed config through `pnpm ax sync` using an isolated HOME and
runtime root, then show that AX completes source resolution and validation with
no Sandbox-specific installed skill while preserving every other configured
Cloudflare skill. [confidence: 0.96 - certain | reason: this exercises the real
failure boundary without mutating the live runtime]
