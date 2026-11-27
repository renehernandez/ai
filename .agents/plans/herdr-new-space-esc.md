# Herdr New space: no orphan worktree on Esc

## Objective

Fix two issues the local review of the fresh-worktree change (#40) found in
`projects-edit`. First, Esc while `git worktree add` is running closes the
New space dialog. The add finishes, but the dialog's work stops, so the new
worktree gets no space. Second, the view's own `close()` method shares its
name with the `close(cx)` cleanup hook that Herdr calls when an overlay goes
away.

## Observable behavior

- **New space** opens as a centered Herdr `window` overlay instead of a
  modal `dialog`. A window passes Esc to the mod, while a dialog's Esc is
  handled by Herdr itself. Like before, a click beside it doesn't close it.
  It no longer dims the rest of Herdr.
- **Esc during the fetch** closes the window and marks the run cancelled.
  `newWorktree` checks that flag before the add, so nothing is created even
  if Herdr's task cancellation is late.
- **Esc during the add** does nothing. The footer says the add can't be
  cancelled. The window closes on its own when the space opens.
- **After an error,** Esc or the footer's Close control closes the window.
  A window has no Herdr-level close, and Close still works after the window
  has lost focus.
- The view's own closing method is renamed from `close()` to `dismiss()`.
  Herdr's cleanup hook no longer runs it a second time on an overlay that
  is already closed. Nothing changes that a user can see.

## Reuse and deviation

- Precedents inspected:
  - The shipped `worktree` mod. Its dialog also closes on Esc while it is
    busy, and it also names its method `close()`.
  - Herdr's `OverlaySpec` docs: a window keeps Esc for the mod, a click
    beside it doesn't close it, and it opens centered.
  - The overlay cleanup docs in Herdr's `AGENTS.md`: `close(cx)` runs when
    an overlay goes, then unfinished tasks are cancelled, while an `exec`
    that has already started keeps running.
- Reused: `newWorktree`'s `step` callback, which now also says whether the
  current step can be cancelled. Also the view's existing focus handle and
  `key()` handler, which already receive Esc.
- Deliberately not done: moving creation into the long-lived sidebar mod.
  That would need a copy of `newWorktree` in the `projects` mod and a
  channel to report progress, for the same result.

## Acceptance and proof

Before merge, automated only:

- Edit unit tests: the fetch step is reported as cancellable and the add
  step as not.
- The headless load test:
  - Every way into New space opens the window spec.
  - With the add held open, Esc doesn't close the window. Once the add
    finishes, the space opens and the window closes.
  - Esc during the fetch closes the window, and no add runs.
  - After a failure, Esc closes the window.
- Lint, format, typecheck and the full unit suite run through native hooks.

After merge and live `pnpm ax sync`, the user checks in Herdr that the
window takes Esc and is centered. Whether Herdr routes Esc to a focused
window mod stays unproven until then.

## Delivery boundary and risk

One atomic change on branch `herdr-new-space-esc` from `origin/main`
(`1df5186`), as one GitHub PR to `main` on `origin`. The personal profile
requires no hosted CI or hosted reviewer. Forecast: about 6 files and under
250 changed lines. Merge needs the user's approval.

Risks:

- A window doesn't dim Herdr, and switching layouts closes it (and the
  sidebar too).
- An add that hangs keeps the window open until the 10-minute `exec`
  timeout, after which its error shows and Esc works again.

Rollback: revert the PR.
