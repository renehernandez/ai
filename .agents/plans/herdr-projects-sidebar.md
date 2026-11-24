# Herdr projects sidebar

## Objective

Ship a personal Herdr app sidebar, owned by this repository and installed by
AX, that groups spaces into user-defined projects, nests each worktree space
under its repo, opens new tabs and agents at the space's worktree root, and
lets the user manage projects from the sidebar and from one dedicated
shortcut. Project data lives in Herdr's config folder, never in this
repository.

## Accepted decisions

- Personal mod, not a community-mod install. pixeline/herdr-projects-mod
  (reviewed at 727e692) is reference only; its `match` rules are rejected.
- Every space is a worktree created from the repo's main checkout; no space is
  expected to sit in the main checkout itself. The main checkout is the source
  for new worktrees, not a place to open tabs.
- The `tabs` and `new-menu` mods are not forked. The tab-bar **+**, `cmd-t`,
  and `cmd-shift-t` keep Herdr's behavior.
- Projects are managed from the sidebar and a dedicated dialog, not by hand.
  Hand edits still work and apply live.
- The dialog opens with `cmd-k p` (`cmd-k`, then `p`). The user accepted that
  AX editing `keys.json` stops Herdr from upgrading its default shortcuts.
- The new layout becomes the user's default by switching to it once after
  merge; Herdr remembers the shown layout in its own `shared.json`. AX never
  writes Herdr-written state.
- One plan-plus-implementation PR.

## Observable behavior

### Sidebar (`projects` mod, layout `projects`)

- The sidebar lists projects in configured order. Each project lists its
  repos as header rows; each repo lists the spaces whose first terminal is in
  one of that repo's checkouts. A repo header shows even when none of its
  spaces is open. Spaces in no configured repo, or in no repo, are listed
  under an **Other** group, keeping the shipped grouping by machine there.
- A repo is identified by its main checkout path and machine (null for this
  computer). A space belongs to the repo whose `git --git-common-dir`
  resolves to that main checkout on the space's machine. `~` in config
  expands on that machine.
- A repo belongs to at most one project. Identity compares the expanded,
  trailing-slash-free main-checkout path and the machine, so `~/x` and
  `/Users/me/x` on the same machine are the same repo. Adding a repo that is
  already in another project moves it there. When a hand edit lists the same
  repo more than once, the first occurrence wins, later ones are ignored, and
  the sidebar shows an error line naming the duplicate.
- Space rows keep the shipped `spaces` sidebar behavior: avatar, name,
  branch, ahead/behind and changes; click to select; right-click menu;
  drag to reorder within a machine; narrow-rail mode.
- A repo header **+** opens Herdr's New worktree dialog
  (`worktree` mod, `action: "new"`) with `folder` set to the main checkout
  and that repo's `machine`.
- A space row **+** opens a small menu: Terminal and each installed agent
  (`knownAgents({ on })`). Each runs `tab.new` in that space with `folder`
  set to the space's worktree root (`git --show-toplevel` of its first
  terminal's folder), regardless of the focused pane's current folder. A
  space outside any repo gets `tab.new` without `folder`.
- Config errors (unreadable file, invalid JSON, invalid shape, a repo path
  that is not a git checkout, an unreachable machine) show as a line at the
  top of the sidebar or on the affected repo header. The sidebar keeps
  rendering the last good config and every space.

### Managing projects

- Right-click a repo or space under **Other**: **Add to project ▸** each
  existing project, or **New project…** (name prompt).
- Right-click a project header: **Rename…**, **Move up/down**, **Remove**.
  Removing a project closes nothing; its spaces move to **Other**.
- Right-click a repo header: **Remove from project**.
- `cmd-k p` toggles the **Projects** dialog (`projects-edit` mod via
  `mod.open`). It lists projects and repos and supports add, rename, reorder
  and remove for projects; add a repo from an open space's repo, from a local
  folder (`pickFolder`), or as a machine plus path; and remove a repo.
- Every write uses `writeTextFile(path, text, expected)` with the content
  last read. A conflicting concurrent edit is never overwritten: the mod
  reloads, shows a notification, and the user retries.

### Config file

`~/.config/herdr-app/projects.json`, created by the first sidebar or dialog
edit. It sits outside every AX-owned path and is never read from or written
to this repository. The mod reloads it live through `watchFolder` on its
folder, filtered to that file.

```json
{
  "projects": [
    {
      "name": "AI tooling",
      "repos": [
        { "path": "~/personal/projects/ai" },
        { "path": "~/src/deploy", "machine": "vps" }
      ]
    }
  ]
}
```

Readers accept a bare string as shorthand for `{ "path": ... }`; writers
emit the object form. Unknown keys are preserved on write.

Rejected: a section in `settings.json`. Herdr's Settings screen rewrites that
file, so a mod writing to it would race the Settings UI and could trigger the
`settings.error` fallback for every setting.

## Ownership and AX

Source lives under `herdr-app/` at the repository root, mirroring the target
home (`herdr-app/mods/projects/`, `herdr-app/mods/projects-edit/`,
`herdr-app/layouts/projects.json`).

- `runtime.configs.herdrApp` targets `~/.config/herdr-app`. It owns whole the
  files present under `herdr-app/` in source, with the same generated-file
  drift and transaction path as `herdrTemplates`. Herdr-written files inside
  owned mod folders (`jsconfig.json`, `gpui-kit.d.ts`) and every other file
  in the Herdr home are unowned and untouched. Source files removed in a later
  change are not deleted from the target; that stays a manual step.
- `runtime.configs.herdrKeys` targets `~/.config/herdr-app/keys.json` with one
  JSON managed path, `["global", "cmd-k p"]` = `"mod.open:projects-edit"`,
  through the existing JSON `managedPaths` mechanism. Every other key stays.
  When `keys.json` is missing, AX reports drift and does not create it,
  because a minimal file would replace Herdr's whole default key table.
- The `projects` layout is a copy of the shipped `main` layout with only the
  `spaces` block's `content.mod` changed to `projects`. It does not follow
  later changes to `main`.
- `projects.json`, `settings.json`, `shared.json`, `layouts/.state/` and all
  shipped mods and layouts are never AX targets.
- Rollback: switching back to the shipped `main` layout
  (`layout.switch {name: "main"}` or `cmd-shift-l`) restores Herdr's own
  sidebar at once. AX never owns the shown-layout state, so a sync never
  undoes that switch. The escape hatch `ctrl-alt-shift-escape` also returns
  to `main`.
- The derived mod and the layout copy are tied to the Herdr app version they
  were derived from (0.1.16). A Herdr upgrade that changes the shipped
  `spaces` mod, the `main` layout or the mod API needs a follow-up change
  that re-derives them; until then the user can switch back to `main`.
- `docs/ax.md` documents both targets, the files they own and never own,
  the rollback, and the re-derive rule.

## Reuse and deviation

- Precedents inspected: `runtime.configs.herdrTemplates`
  (`scripts/ax/herdr-templates.ts`, `scripts/ax/config-sync.ts`,
  `docs/ax.md`), JSON `managedPaths` for Pi settings, Herdr's shipped
  `spaces`, `worktree` and `new-menu` mods, and Herdr's `main` layout.
- Reused: AX's generated-whole-file config path and its JSON managed-path
  path; the `worktree` dialog's `{ folder, machine }` contract; `knownAgents`
  and `tab.new { folder }` as `new-menu` uses them.
- Extended: the shipped `spaces` mod is the base of `projects`, with its
  license and attribution preserved in the mod folder (verify the shipped
  mods' license before copying; stop and ask if it forbids derivation).
- New: the `herdrApp` and `herdrKeys` targets, because no current AX target
  owns files in the Herdr app home; the project grouping and editing.
- Deviation: data in a standalone `projects.json` instead of the
  `settings.json` mod-preference precedent, for the write-race reason above.
- Pure logic (config parse and normalize, repo resolution, grouping, edit
  operations) sits in a module with no `herdr` import so repository unit
  tests run it under Node.

## Delivery shape

One atomic plan and one Ready GitHub PR to `main` on `origin`, carrying this
plan and the whole change. Personal profile: no required hosted CI or hosted
reviewer. Merge, live sync and cleanup need separate user authority.

Size forecast: about 14 files and 1,700 to 2,200 changed lines, above this
repository's 1,500-line target. Rationale: the derived sidebar (about 650
lines) and the dialog are one user-visible feature that is inert without its
AX target and layout, and the AX target is untestable end to end without a
mod to install. A split would merge either an uninstalled mod or a target
with nothing to sync. Above 3,000 lines or 30 files returns to Plan.

## Proof

Before merge, automated and isolated only:

- Unit tests for the pure module: string and object repo forms, `~`
  expansion inputs, invalid-shape errors with the last good config kept,
  duplicate repos (first wins with an error; adding to another project
  moves the repo; `~` and absolute spellings collide),
  grouping into project, repo, space and **Other**, worktree-root selection,
  and each edit operation preserving unknown keys.
- AX tests with an isolated HOME and runtime root: `herdrApp` creates and
  updates owned files, reports drift for a changed owned file, ignores
  `jsconfig.json`, `gpui-kit.d.ts` and other files; `herdrKeys` sets only
  `global."cmd-k p"`, preserves every other key, and refuses to create a
  missing `keys.json`; `ax validate` covers both targets.
- `herdr-app check` passes for both mods from an isolated copy. Managed
  agents may not run `herdr-app check`, so the user runs it (`!` command)
  with the exact command the implementer reports; the result is recorded in
  the PR.
- The `cmd-k p` chord form is confirmed against Herdr's key parser (shipped
  `keys()` consumers or an isolated `keys.error` check). If Herdr does not
  accept a chord, stop and return to the user for another key.

After merge and live `pnpm ax sync`, as user-authorized follow-through:

- `layout.switch {name: "projects"}`, then `herdr-app shot` shows the
  projects sidebar; `layout.switch {name: "main"}` restores the shipped
  sidebar, and switching back to `projects` shows it again.
- With two repos in one project and one worktree space, the sidebar groups
  and nests them; a repo with no open space still shows its header.
- After `cd` into a subfolder of a worktree space, the space **+** Terminal
  and an agent start at the worktree root.
- Adding and removing a project from the sidebar and from `cmd-k p` updates
  `projects.json` and the sidebar without an AX sync; a hand edit does too.
