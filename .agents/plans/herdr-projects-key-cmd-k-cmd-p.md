# Herdr projects dialog key: `cmd-k cmd-p`

## Objective

Make the Projects dialog open with `cmd-k cmd-p`, so cmd can stay held for
both keystrokes. The AX-managed key `global."cmd-k p"` from
[herdr-projects-sidebar.md](herdr-projects-sidebar.md) becomes
`global."cmd-k cmd-p"`, with the same action, `"mod.open:projects-edit"`.

## Accepted decisions

- The user confirmed that `cmd-k`, release, `p` opens the dialog, so Herdr
  binds `keys.json` sequences. Herdr's `src/keys.rs` passes every binding to
  GPUI's `KeyBinding::load`, which reads space-separated keystrokes as a
  sequence. Holding cmd for both keys sends `cmd-k cmd-p`. No binding matches
  that today, so `cmd-p` (the picker) runs.
- `cmd-k cmd-p` is the only AX-managed Herdr key. `cmd-t` and `cmd-shift-t`
  stay untouched.
- AX gains no way to remove keys. `herdrKeys` keeps managing exactly one
  JSON leaf; it never removed leaves, and this change doesn't add that.
- After merge and live sync, the orchestrator deletes the leftover
  `global."cmd-k p"` line from the live `~/.config/herdr-app/keys.json` by
  hand, keeping every other key. This is user-chosen option 3; it is a
  one-time live edit, not repository behavior.
- [herdr-projects-sidebar.md](herdr-projects-sidebar.md) stays as merged: it
  records what PR #31 accepted. This plan supersedes its key decision.
- One plan-plus-implementation PR, published Ready.

## Observable behavior

- `pnpm ax sync` sets `global."cmd-k cmd-p"` = `"mod.open:projects-edit"` in
  `~/.config/herdr-app/keys.json` and leaves every other key as it is,
  including an existing `cmd-k p`.
- `pnpm ax status` and `pnpm ax validate` report drift when
  `global."cmd-k cmd-p"` is missing or different, and still refuse to create
  a missing `keys.json`.
- `cmd-p` alone still opens the picker. After `cmd-k`, GPUI waits for the
  next keystroke, so `cmd-p` then completes `cmd-k cmd-p`.

## Changes

Reuse the existing owners; no new mechanism.

- `ax.config.json`: `runtime.configs.herdrKeys.managedPaths[0].path` becomes
  `["global", "cmd-k cmd-p"]`; the value is unchanged.
- `docs/ax.md`: the `herdrKeys` paragraph names `global."cmd-k cmd-p"`, says
  cmd stays held for both keys, and notes that AX never removes a key it
  stops managing, so a `cmd-k p` left by an earlier sync stays until deleted
  by hand.
- `herdr-app/mods/projects/main.js` and `herdr-app/mods/projects-edit/main.js`:
  the header comments name `cmd-k cmd-p`. No behavior changes.
- `tests/unit/json-config-sync.test.ts`: every `cmd-k p` fixture, assertion,
  drift message and test name becomes `cmd-k cmd-p`.
- `tests/unit/skill-rule-eval-contract.test.ts`: the GREEN `herdrKeys`
  assertion and its name use `cmd-k cmd-p`. The existing RED/GREEN pair still
  covers the `ax.config.json` change (`scripts/charter-validator-contracts.ts`,
  `skill-rule-evals`).
- `tests/unit/herdr-projects-load.test.ts`: drift repair, unrelated to the
  key change. Herdr's updated `gpui-kit.d.ts` declares
  `ScrollHandle extends ScrollPosition`, which the PR #31 test's `members()`
  didn't accept, so the suite failed on `main` too. `members()` now allows an
  `extends` clause and still reads only the named interface's own block.
- `.agents/plans/herdr-projects-key-cmd-k-cmd-p.md`: this plan.

Forecast: 8 files, under 100 changed lines, within the repository's
15-file and 1,500-line targets.

## Proof

Before merge, by the implementer:

- The three changed test files pass, then the native pre-commit hook's full
  suite passes.
- A search of the worktree finds `cmd-k p` only in
  `.agents/plans/herdr-projects-sidebar.md`, in this plan, in the
  `docs/ax.md` leftover note, and in the leftover-key test in
  `tests/unit/json-config-sync.test.ts` (its name and fixture).
- A `herdrKeys` unit test syncs a `keys.json` that already holds
  `"cmd-k p"` and asserts that the result adds `"cmd-k cmd-p"` and keeps
  `"cmd-k p"` and every other key unchanged, using the existing test
  helpers.

After merge and live `pnpm ax sync`, by the orchestrator:

- `pnpm ax validate` returns `ok: true`.
- Comparing a backup of `keys.json` with the live file shows exactly one
  added line, `"cmd-k cmd-p": "mod.open:projects-edit"`.
- The orchestrator deletes the `"cmd-k p"` line, then confirms that the file
  parses as JSON, that it differs from the backup only by that key swap, and
  that `~/.config/herdr-app/keys.error` is absent.

Unverified until the user's next normal use: managed agents can't send
keystrokes to Herdr or run `herdr-app check` (`hooks/pi/policy.ts`), so
whether the held-cmd `cmd-k cmd-p` press opens the dialog is stated as
unverified in the PR. If it doesn't, a follow-up changes the key.

## Risk and rollback

- Low risk: one managed JSON leaf, comments, docs and tests.
- If `cmd-k cmd-p` doesn't work in Herdr, the dialog has no key until a
  follow-up, because the old line is deleted. Projects can still be edited
  from the sidebar's menus. Rollback: revert the PR, sync, and re-add
  `"cmd-k p"` by hand.
- Deleting the old line is a live edit outside AX. The orchestrator backs up
  `keys.json` to the task scratch folder first and restores the backup on a
  parse failure or a `keys.error`.
