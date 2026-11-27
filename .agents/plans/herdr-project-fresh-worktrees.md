# Herdr project fresh worktrees

## Objective

Third of three changes. Every new space in a Herdr project starts in its own
new git worktree, on a random branch cut from a freshly fetched `origin`
default branch, so the user never works in a project's main checkout. The
previous change made a project one local repo; its row's `+` still opens
Herdr's New worktree dialog, which branches from the local `HEAD` without
fetching and asks for a branch name.

## Observable behavior

- **New space in a project** (the project row's `+`, the project menu's
  New space, and the header `+` popup's New space in \<project\>) opens a
  small modal dialog, "New space in \<project\>". A click beside it doesn't
  close it; Esc does. On this machine, in the project folder, it:
  1. runs `git fetch origin`;
  2. takes the default branch from `origin/HEAD`, else `origin/main`, else
     `origin/master`;
  3. picks a random adjective-animal branch (`brave-otter`) with no local
     branch, no `origin` branch and no folder of that name, retrying a
     bounded number of times;
  4. runs `git worktree add --no-track -b <branch> <root>/<repo>/<branch>
     origin/<default>`, where `<root>` is `worktrees.directory` from Herdr's
     `settings.json` (default `~/.herdr/worktrees`), read and checked the
     way the shipped `worktree` mod reads it, and `<repo>` is the project's
     name;
  5. opens an unnamed space in the new checkout and closes the dialog. The
     space groups under its project, labelled by its branch.

  The dialog shows the current step while it runs. If any step fails
  (offline, auth, no `origin`, no default branch, bad setting, no free
  name, add fails), the dialog shows git's error, nothing past the failed
  step is created, and no space opens. `--no-track` keeps a bare
  `git push` from targeting the default branch. Fetch and add may each
  take up to 10 minutes, Herdr's `exec` limit.
- **Header `+` popup**: one **New space in \<project\>** row per project,
  then **New space** (a plain `space.new`, for an occasional scratch
  space), then **New project…**.
- **Project menu**: New space, the moves that apply, New project…, Remove.
- **Project row `+`**: tooltip "New space"; it no longer opens the shipped
  New worktree dialog.
- Closing or moving a space never deletes its worktree. Removing one stays
  Herdr's guarded **Remove worktree** in the space menu. Other spaces and
  their menu are unchanged.

## Reuse and deviation

- Precedents inspected: the shipped `worktree` mod (`root()` reading
  `worktrees.directory`, its `<root>/<repo>/<slug>` layout, `create()` with
  a 600,000 ms add timeout and an unnamed `space.new`), `projects-edit`'s
  dialog hosting the folder picker because a popup closes on click, its
  popup rows (`menuParts`, `projectMenuRows`, `clickItem`), and the
  sidebar's project `+`.
- Reused: the shipped mod's settings reading and checks, folder layout,
  timeout and unnamed-space convention; the projects-edit dialog as host
  for work that outlives a popup (now `modal`); the popup rows; the
  sidebar's grouping and branch labels, which place the new space.
- Deliberately separated from the shipped `worktree` mod: it branches from
  the checkout's local `HEAD` without fetching and needs a typed branch,
  which contradicts the fresh-default-branch requirement, and shipped mods
  are not edited. The create step lives in `projects-edit`'s `edit.js`,
  the Node-testable module of the only mod that runs it, with `exec`,
  settings reading and randomness injected. It does not go in `model.js`,
  which the sidebar never uses for this and both mods would copy.
- New mechanism: only the fetch-and-branch create step and the random
  branch name; no current owner can take them without editing a shipped
  mod.

## Acceptance and proof

Before merge, automated only:

- Edit unit tests with a fake `exec`: the git calls in order with their
  folders and the fetch/add timeouts; the `origin/HEAD` → `origin/main` →
  `origin/master` fallback; re-rolling a name taken locally, on `origin`
  or by a folder, and the error when no name is free; `worktrees.directory`
  default, `~` expansion and invalid values; every failure (fetch, no
  default branch, add) stops before a space opens and reports git's error.
  The project menu rows start with New space.
- The headless load test: the project row `+` opens the modal New space
  dialog for that project; the header popup lists New space in \<project\>
  per project, New space and New project…; the dialog runs the create step
  against stubbed git, opens the space on success and shows the error on
  failure. Any newly used Herdr name joins its reviewed API list.
- `docs/ax.md` describes new spaces in a project.
- Lint, format, typecheck and the full unit suite run through native hooks.

After merge and live `pnpm ax sync`, by the user in Herdr: use the `ai`
project's `+` and confirm a new `~/.herdr/worktrees/ai/<adjective-animal>`
checkout on the freshly fetched `origin/main` opens as a space under `ai`,
labelled by its branch. Real git over Herdr's `exec`, the modal dialog and
whether a closed dialog's work continues stay unproven until then.

## Delivery boundary and risk

One atomic change on branch `herdr-project-fresh-worktrees` from
`origin/main` (`cee06e4`), one GitHub PR to `main` on `origin`. Personal
profile: no required hosted CI or hosted reviewer. Forecast: about 8 files
and 600–900 changed lines, within the 15-file / 1,000-line budget. The
create step, the dialog that runs it and the entry points that open it are
one behavior: a split would merge an unreachable step or entry points with
nothing behind them. It follows single-folder projects (merged). The user
authorized merge and live sync for all three changes.

Risks: a new space waits on the network; the dialog shows the step and any
error. Esc during a run may leave a worktree without a space if Herdr stops
the dialog's work after the add; the checkout then shows in Herdr's Open
worktree list. Rollback: revert the PR; created worktrees stay as ordinary
git worktrees.
