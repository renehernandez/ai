# Post-Merge Main Worktree AX Sync

## Goal

Make every successful AI-repo merge finish by converging the dedicated `main`
worktree and the live AX runtime.

## Decision

After every successful merge, Finish must locate the worktree that owns
`refs/heads/main`, require it to be clean, fast-forward it from `origin/main`,
verify its `HEAD` matches `origin/main`, and run live `pnpm ax sync` followed by
`pnpm ax validate` from that worktree. If any step cannot complete, Finish
reports the concrete blocker and does not substitute a feature or disposable
worktree.

## Scope

- Tighten the AI project root `AGENTS.md` post-merge AX rule.
- Add a focused unit assertion for the complete sequence.
- Keep portable user instructions and shared rules unchanged; they already
  require merged default-branch source and live AX sync, while this repository
  needs the stronger dedicated-worktree sequence.

## Reuse And Deviation Contract

- Reuse the existing `AGENTS.md` AX-runtime rule, the established
  `git worktree list --porcelain` ownership signal, fast-forward-only Git
  update, and native `pnpm ax sync` / `pnpm ax validate` commands.
- Extend the current unit-test surface in
  `tests/unit/agent-instructions.test.ts` rather than adding another validator.
- No new workflow mode, hook, command, runtime state, or source of truth is
  introduced.

## Acceptance

- `AGENTS.md` says the rule applies after every successful merge.
- The rule requires locating the `main`-owning worktree, a clean
  fast-forward-only update, exact `HEAD`/`origin/main` agreement, and live
  `pnpm ax sync` plus `pnpm ax validate` from that worktree.
- The rule forbids falling back to a feature or disposable worktree and
  requires reporting a blocker.
- Focused agent-instruction tests and repository skill validation pass.

## Verification

- `pnpm exec tsx --test tests/unit/agent-instructions.test.ts`
- `pnpm run skills:validate`
- `pnpm ax status`
- `pnpm ax validate`
- `git diff --check`

## Risk

The post-merge refresh mutates a live runtime. The clean-worktree,
fast-forward-only, exact-ref, and merged-`main` gates prevent unmerged or local
content from being installed.
