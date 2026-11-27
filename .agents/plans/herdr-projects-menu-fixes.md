# Herdr projects menu fixes

## Objective

Make the Herdr `projects` sidebar usable end to end. A project the user
creates must be able to get repos from the sidebar itself, every control must
do what its place suggests, and identical space rows must be told apart. The
data model, `projects.json` format and AX targets set by
`herdr-projects-sidebar.md` stay unchanged.

## Problems

Observed in the live app with one project (`ai`, no repos) and four unnamed
`fillario` spaces under **Other**:

1. An empty project is a dead end. Its right-click menu offers only Rename,
   Move up/down and Remove, and nothing shows how to add a repo.
2. The **+** beside the "Projects" header creates a space, not a project.
3. Move up and Move down always show, disabled when they cannot apply.
4. Adding a repo is only discoverable through `cmd-k` or by right-clicking a
   space under **Other**. The hint shows only when no project exists.
5. Unnamed spaces in the same repo and branch render as identical rows.

## Observable behavior

- **Header +** opens a small popup with **New space** (the current
  `space.new`) and **New project…** (the existing name form, opened alone).
  It has a tooltip.
- **Project right-click menu** lists Rename…, the moves that apply, Add
  repo…, New project…, then Remove. Move up is absent on the first project
  and Move down on the last; neither shows with one project.
- **Add repo…** opens the Projects dialog with that project's existing Add
  repo panel already expanded: open spaces' repos, Choose a folder…, and On a
  machine…. Writes keep the existing conflict-safe save path.
- A project with no repos shows a dim inline **Add a repo…** row under its
  header with the same action. It is hidden in the narrow rail. This row,
  the menu item and the header popup make adding discoverable; the existing
  no-projects hint stays as is.
- **Duplicate rows**: when two or more unnamed spaces in the same sidebar
  group (a repo, or a machine under Other) share a name, each one's dim tail
  adds its active tab's name when someone named that tab and no other space
  in the duplicate set shows the same tab name; otherwise `#<index>`. Spaces
  the user named, and unique names, render as today.

## Reuse and deviation

- Precedents inspected: the shipped `spaces` mod header (`Spaces` + running
  `space.new`), the shipped `new-menu` popup rows, the existing
  `projects-edit` popups (`menuParts`, `clickItem`, `menuWrites`), its
  dialog's `renderAdd` panel, its alone-opened `props.form`, and
  `SpaceInfo.named` and `TabInfo.name/named` in Herdr's `herdr.d.ts`.
- Reused: `renderAdd` for every add-repo entry point; the alone-opened form
  for New project…; the popup row, sizing and scroll structure for the new
  header popup; `space.new` unchanged.
- Extended: `projects-edit` gains a `menu: "new"` popup and a dialog prop that
  opens one project's Add panel, checked against the project's index and
  name like every other edit. `projects` gains the inline row and the
  duplicate-name tail.
- Rejected: a separate add-repo flyout popup, because it would duplicate
  `renderAdd`; relabeling the header to "Spaces", because the sidebar's
  subject is projects; making **+** mean New project only, because one-machine
  setups would lose their only New space button.
- No new mechanism: duplicate detection is a pure function beside the
  existing sidebar helpers and runs under Node like the other helpers.

## Acceptance and proof

Before merge, automated only:

- Unit tests for the project menu's rows at first, middle, last and sole
  positions, and for the duplicate-name labels (named tab, unnamed tab
  falling back to `#index`, colliding tab names falling back to `#index`,
  user-named spaces untouched, uniqueness counted per group).
- The headless load test covers the header popup, the project menu's Add
  repo… and New project… actions, the dialog opened with one project's Add
  panel expanded, and the empty-project inline row. Any new imported name or
  element method joins its reviewed API list.
- Lint, format, typecheck and the full unit suite run through native hooks.

After merge and live `pnpm ax sync`, by the user in Herdr: right-click `ai`,
use Add repo…, add `fillario`, and confirm the four spaces move under it with
distinct tails; use the header **+** for both actions. Real rendering and
Herdr's mod loader stay unproven until then, as in the original plan.

## Delivery boundary and risk

One atomic change on branch `herdr-projects-menu-fixes` from `origin/main`,
one draft GitHub PR to `main` on `origin`. Personal profile: no required
hosted CI or hosted reviewer. Forecast: about 6 files and well under 1,000
changed lines. Merge, live sync and cleanup need separate user authority.

Open PR #32 (`herdr-projects-key-cmd-k-cmd-p`) changes the dialog shortcut
and touches header comments in both mods. Whichever merges second merges
`main` into its branch and resolves the comment conflict.

Risk: the derived mods drift further from Herdr 0.1.16's shipped `spaces`
mod, which raises re-derive cost on a Herdr upgrade. Rollback: revert the PR,
or switch to the shipped `main` layout.
