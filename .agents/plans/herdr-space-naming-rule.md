# Agents name their Herdr space after the work

## Objective

New project spaces start in a worktree with a random adjective-animal
branch, such as `keen-fox`. That name says nothing about the work, so the
person can't scan the sidebar to see what each space is doing. Agents
should name the space they run in after the work as it progresses.

## Observable behavior

- An agent running in a Herdr terminal names its space with a short summary
  of the current work, about 40 characters or less. It does this when it
  starts a substantive task and again when the work changes direction. An
  example is "Sidebar Esc fix".
- The agent finds its space from its own terminal. It reads
  `HC_TERMINAL_ID`, then the terminal's `herdr.space` label from
  `hc get <terminal> --json`, and renames that space with Herdr's
  `space.rename` command through `herdr-app do`.
- Outside Herdr, where `HC_TERMINAL_ID` or the label is missing, the agent
  skips the step without telling the person. If a command fails, for
  example on another machine without `herdr-app`, it skips the step and
  carries on with the task.
- The agent never passes an empty name, because an empty name resets the
  space to Herdr's automatic name.
- Renaming is local Herdr UI state, not repository, tracker or provider
  state. It is allowed in every mode, including read-only Explore and
  Review.
- The agent always updates the name. A name the person set by hand is
  replaced by the next agent update. When agents share a space, the last
  update wins.
- The sidebar doesn't change. A named space already shows its branch dimmed
  beside the name, and it stays grouped under its project by its git
  checkout.

## Reuse and deviation

- Precedents inspected:
  - Herdr's `space.rename {id, name}` command (`herdr-app commands`), and
    the shipped `menu` mod's Rename item that already uses it.
  - The `herdr.space` label Herdr sets on every terminal it starts, and the
    `HC_TERMINAL_ID` variable in agent terminals.
  - `rules/session-startup.md`, the shared startup pass installed in both
    the personal and work profiles.
- Extended: `rules/session-startup.md` owns the behavior as a short new
  section, since naming the space starts a task. `instructions/AGENTS.md`
  gets a one-line pointer so the rule is seen without loading the rule
  file.
- No new mechanism. There is no helper script, because two existing commands
  do the work.
- Deferred:
  - A description field in New space.
  - Double-click to rename.
  - Keeping names the person set by hand.

## Acceptance and proof

- Before merge:
  - A unit assertion in `tests/unit/agent-instructions.test.ts` checks that
    the startup rule names the Herdr space through `space.rename`. It also
    checks that the rule skips the step outside Herdr.
  - The charter gate's RED and GREEN scenarios. In
    `agent-workflow-lifecycle.test.ts`, the rename stays local UI state and
    gives read-only modes no write authority. In
    `skill-rule-eval-contract.test.ts`, it is a rule both profiles install,
    not a skill.
  - `writing-skills` validation of the changed rule behavior.
  - Lint, the charter, skills and the full unit suite pass through native
    hooks.
- During Execute, a live run of the exact commands renames a scratch space,
  then gives it its old name back.
- After merge and live `pnpm ax sync`, the person checks that a new agent
  session names its space.

## Delivery boundary and risk

- One atomic change on branch `herdr-space-naming-rule` from `origin/main`
  (`13488d2`), as one GitHub PR to `main` on `origin`.
- The personal profile requires no hosted CI or hosted reviewer.
- Forecast: 6 files, under 200 changed lines.
- Merge needs the person's approval.
- Risks:
  - Agents in a space shared by several tasks keep renaming it.
  - An agent may forget the update when the work changes direction.
- Rollback: revert the PR.
