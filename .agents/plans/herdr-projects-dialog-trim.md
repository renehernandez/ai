# Herdr projects dialog trim

## Objective

First of three changes that turn a Herdr project into one local git repo
whose spaces sit directly under it, each new one in a fresh worktree. This
change removes the Projects dialog features that model does not keep, so the
next change (single-folder projects) stays small enough to review. The
`projects.json` format, the sidebar's grouping and AX targets stay as they
are.

## Observable behavior

- **Rename is gone.** The project menu lists the moves that apply, Add
  repo…, New project… and Remove. The dialog's project rows lose Rename.
- **Add repo opens the folder picker directly.** The project menu's Add
  repo…, the sidebar's "Add a repo…" row and the dialog's Add repo button
  open the system folder picker. The picked folder is saved as its repo's
  main checkout, through the existing conflict-safe save path, exactly as
  Choose a folder… does today. The inline panel, its "From an open space"
  list and its "On a machine…" form are gone.
- **No machine form.** Repos on other machines can no longer be typed in.
  Remote repos already in `projects.json` keep showing and grouping, and
  the Other menu still adds a remote space's repo to a project.
- New project… keeps its name form, including the Other menu's "with
  <repo>" variant.

## Reuse and deviation

- Precedents inspected: the dialog's `renderAdd` panel and its Choose a
  folder… handler, the `adding` dialog prop from
  `herdr-projects-menu-fixes.md`, the alone-opened `form` prop, and the
  popup writes in `edit.js`.
- Reused: the Choose a folder… handler becomes the only add path, hosted
  by the dialog (a popup closes on click, so it cannot outlive the
  picker); the `adding` prop keeps its project index and name check.
- Removed: `renameProject` and its form, the remote form, the open-spaces
  lookup, and the inline Add panel.
- No new mechanism.

## Acceptance and proof

Before merge, automated only:

- Unit tests: the project menu's rows at first, middle, last and sole
  positions without Rename; model tests drop rename.
- The headless load test: the dialog opened with `adding` starts the
  folder picker only while that project is still at its index with its
  name, and saves the picked folder's main checkout; the dialog's Add repo
  button does the same; the new-project form still renders and saves. Any
  imported name no longer used leaves its reviewed API list.
- Lint, format, typecheck and the full unit suite run through native hooks.

After merge and live `pnpm ax sync`, by the user in Herdr: Add repo… from
the project menu opens the picker and the repo appears under the project.
The real picker over Herdr's mod loader stays unproven until then.

## Delivery boundary and risk

One atomic change on branch `herdr-projects-dialog-trim` from `origin/main`
(`97947b5`), one draft GitHub PR to `main` on `origin`. Personal profile:
no required hosted CI or hosted reviewer. Forecast: about 7 files and
400–600 changed lines, mostly deletion. It merges before single-folder
projects, which merges before fresh worktrees; each opens after its
predecessor merges. Merge, live sync and cleanup need separate user
authority.

Risk: users lose rename and remote typing before the next change replaces
the model; both go away there anyway. Rollback: revert the PR.
