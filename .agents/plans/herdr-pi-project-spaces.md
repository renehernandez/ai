# Herdr: Pi project spaces and `cmd-k cmd-s`

## Objective

Make a new Herdr space start Pi instead of a bare shell, and give the
`projects` sidebar's "New space in <project>" a keyboard shortcut,
`cmd-k cmd-s`, that also lets the person pick another project.

## Accepted decisions

- `cmd-k cmd-s` (cmd held for both keys, like `cmd-k cmd-p`) opens a
  keyboard-driven "New space in…" chooser listing every project. Picking one
  runs the existing New space flow: a fresh worktree from `origin`, then a
  space in it.
- Every space this repo's mods or keys create starts Pi: the project New space
  flow, the header menu's plain "New space", and `cmd-n`. They pass
  `argv: ["pi"]` to Herdr's `space.new`; Pi runs inside the interactive shell,
  which stays open after Pi exits. The tab menu's "Terminal" row still opens a
  shell.
- `cmd-n` becomes an AX-managed key:
  `{"command": "space.new", "args": {"argv": ["pi"]}}`. Herdr's default is a
  plain `space.new`.
- Herdr's `mod.open` takes no props and a popup opens at the pointer, so a key
  can't open the chooser directly. The key sends `projects.new_space`, which
  Herdr delivers to the shown `projects` sidebar's `nextCommand()`; the
  sidebar opens the chooser as a `projects-edit` dialog. The shortcut works
  only while the `projects` layout shows, the same as the sidebar.
- Chooser keys: `1`–`9` pick a project; up and down move the highlight; Enter
  picks it; Esc closes. Clicking a row works too. With no projects, it says so
  and offers nothing to pick.
- One plan-plus-implementation PR, published draft per the personal profile.

## Reuse and deviation

- Precedents: [herdr-projects-key-cmd-k-cmd-p.md](herdr-projects-key-cmd-k-cmd-p.md)
  (an AX-managed `herdrKeys` leaf),
  [herdr-project-fresh-worktrees.md](herdr-project-fresh-worktrees.md) (the
  New space flow), and Herdr's shipped `win98` mod (key commands through
  `nextCommand()`).
- Reused owners: `runtime.configs.herdrKeys` gains a second managed leaf;
  `projects-edit` keeps owning popups, dialogs and New space; `projects`
  keeps owning the sidebar. `config-sync.ts` already accepts object values.
- New mechanism: the sidebar's `nextCommand()` listener, because no other
  documented route lets a key open an overlay with props.

## Observable behavior

- `pnpm ax sync` sets `global."cmd-k cmd-s"` = `"projects.new_space"` and
  `global."cmd-n"` = the Pi `space.new` object in
  `~/.config/herdr-app/keys.json`, and keeps every other key. Status and
  validate report drift when either is missing or different.
- In the `projects` layout, `cmd-k cmd-s` opens the chooser; picking `ai`
  opens the "New space in ai" window, which then runs
  `space.new {folder, argv: ["pi"]}`.
- `cmd-n` and the header menu's plain "New space" run
  `space.new {argv: ["pi"]}`.

## Proof

Before merge, by the implementer:

- `tests/unit/herdr-projects-load.test.ts`: the sidebar opens the chooser on
  `new_space` and ignores other commands; the chooser picks by digit, by
  arrows plus Enter, and by click, and closes on Esc; New space and the plain
  "New space" pass `argv: ["pi"]`.
- `tests/unit/json-config-sync.test.ts` and
  `tests/unit/skill-rule-eval-contract.test.ts` cover both managed keys.
- The native pre-commit hook's full suite passes.

After merge and live `pnpm ax sync`, by the orchestrator: `pnpm ax validate`
returns `ok: true`, and a diff of a `keys.json` backup against the live file
shows only the two managed leaves changed.

Unverified until the person's next use: agents can't press keys in Herdr, so
the PR states that the real `cmd-k cmd-s` press, the chooser's look, and Pi
starting in a new space are unverified.

## Risk and rollback

- Low risk: two managed JSON leaves and two personal mods. A mod that fails to
  load leaves Herdr on its last working copy.
- `cmd-n` stops opening a shell; a plain shell stays one tab-menu click away.
- Rollback: revert the PR and sync, then restore `"cmd-n": "space.new"` and
  delete `"cmd-k cmd-s"` in `keys.json` by hand, because AX never removes a
  key it stops managing.
