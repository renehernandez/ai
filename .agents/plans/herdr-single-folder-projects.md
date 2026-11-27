# Herdr single-folder projects

## Objective

Second of three changes. A Herdr project becomes one local git repo, named
after its folder, with its open spaces directly under it. This replaces the
project → repo → space layering, where a one-repo project drew three rows
with the same name. The next change makes every new space in a project
start in a fresh worktree.

## Observable behavior

- **`projects.json`** is `{ "projects": [{ "path": "~/x" }] }`. A project
  without a `path` (the old `{name, repos}` shape) makes the file invalid.
  As before, an invalid file is still shown from its last good version and
  blocks every save. The error names the new shape and says to delete the
  file. There is no migration: the only live file holds one empty project.
- **New project…** (header `+`, project menu, dialog button) opens the
  dialog, which opens the system folder picker. A folder in a git repo
  (subfolder or linked worktree included) is saved as its repo's main
  checkout. A folder outside a repo saves nothing and notifies "Not a git
  repo". A repo that already is a project saves nothing and notifies that
  it is already a project. A cancelled pick saves nothing.
- **Names.** A project shows its folder's name; there is no rename. Two
  projects whose folders share a name each show their dim parent folder.
- **Grouping.** An open local space belongs to a project when git names
  the project's folder as its main checkout, so the main checkout and every
  linked worktree group under it. Spaces sit directly under the project
  row: no repo row, no "Add a repo…" row. Remote spaces and spaces outside
  a project stay under **Other**, grouped by machine. A project folder git
  can't resolve shows its error on the project row.
- **Labels.** Inside a project, an unnamed space shows its branch (or
  `(detached)`) instead of the repeated repo name. Named spaces keep their
  names. Duplicates keep the tab-name / `#index` tail.
- **Menus.** Project menu: the moves that apply, New project…, Remove.
  Other menu for a local space in a repo: "New project from this repo",
  then Space…. Other remote spaces get the shipped space menu. The repo
  menu is gone.
- The project row keeps the repo row's `+`, which opens Herdr's shipped
  New worktree dialog on the project folder; the next change replaces it.
- Remote projects are out of scope; remote spaces stay under Other.

## Reuse and deviation

- Precedents inspected: `model.js` (`parseConfig`, `resolveProjects`,
  `groupSpaces`, `mainCheckout`, `duplicateLabels`), the sidebar's
  `resolveRepos` main-checkout lookup and `repoHead` error and `+`, the
  `adding` dialog prop and `addFolder` from `herdr-projects-dialog-trim.md`,
  `saveConfig`'s conflict-safe write, and the popup writes in `edit.js`.
- Reused: grouping by git common dir with configured-folder → main mapping,
  `addFolder`'s pick-then-resolve flow (now New project), the conflict-safe
  save, the dialog-hosted picker (a popup closes on click), the popup rows
  and the duplicate-label tail.
- Removed: repos inside projects, `addRepo`, `removeRepo`, `repoEntry`,
  `repoKey`, `machinesIn`, project names and their form, remote homes in
  the sidebar and dialog, the repo row, the "Add a repo…" row and the repo
  menu.
- No new mechanism.

## Acceptance and proof

Before merge, automated only:

- Model unit tests: the new shape parses; old-shape, empty and duplicate
  paths are reported; folder names with parent disambiguation; grouping of
  main and linked checkouts with the rest in Other; add (main checkout,
  already a project), move and remove by path, keeping unknown keys.
- Edit unit tests: project and Other menu rows and their writes, the
  conflict and error paths of `saveConfig` without machine homes.
- The headless load test: sidebar rows (project, its spaces, Other, no
  repo rows), branch labels, the project `+`, the dialog's New project
  pick (repo, worktree, non-repo, existing, cancelled), the project menu
  rows and the Other menu's write. Any imported name no longer used leaves
  its reviewed API list.
- `docs/ax.md` describes the new sidebar.
- Lint, format, typecheck and the full unit suite run through native hooks.

After merge and live `pnpm ax sync`, by the user in Herdr: delete
`~/.config/herdr-app/projects.json`, add `ai` with New project…, and see
its spaces under it labelled by branch. Real rendering and the picker over
Herdr's mod loader stay unproven until then.

## Delivery boundary and risk

One atomic change on branch `herdr-single-folder-projects` from
`origin/main` (`dfa0971`), one GitHub PR to `main` on `origin`. Personal
profile: no required hosted CI or hosted reviewer. Measured: 10 files and
about 1,930 changed lines (+716/−1,212), above the forecast of 1,000 and
the repository's 1,500-line target, under its 3,000-line limit. The config
shape, the sidebar and the dialog that read it change together: split,
either half merges a broken intermediate state. Most of the size is
deletion that no split reduces, with `model.js` counted twice because each
mod keeps a copy. The user accepted this size for one PR. It follows the dialog trim (merged) and
precedes fresh worktrees. The user authorized merge and live sync for all
three changes.

Risks: the live `projects.json` reads as invalid until the user deletes it;
its error says so. Rollback: revert the PR and restore the old file.
