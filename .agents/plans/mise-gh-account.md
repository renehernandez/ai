# Per-clone GitHub CLI account

## Objective

Let each clone of this repository pin `gh` to one GitHub account, so `gh`
commands no longer follow whichever account `gh auth switch` last selected.
This addresses the multi-account case in
[cli/cli discussion #12237](https://github.com/cli/cli/discussions/12237)
without separate `GH_CONFIG_DIR` directories.

## Accepted scope

- Add an `[env]` entry to the tracked `mise.toml` that sets `GH_TOKEN` from
  `gh auth token --user <account>`. The account comes from the clone's local
  git config key `credential.https://github.com.username`.
- With the key unset, or without `gh` (for example on CI), the command prints
  nothing and exits zero. An empty `GH_TOKEN` counts as unset, so `gh` keeps
  its normal behavior.
- Out of scope: the repo-local git credential helper that hands git the same
  account's token. It lives in `.git/config`, which git never tracks.

## Behavior

mise evaluates `exec()` in the config file's directory, so each worktree
resolves the shared repository git config. The command clears an inherited
`GH_TOKEN` and `GITHUB_TOKEN` for its `gh` call, because `gh auth token`
returns an environment token and ignores `--user`. The token is read from the gh
keychain on every environment load. `exec()` caching stays off because it
would store the token in plaintext under `~/.cache/mise/exec`.

## Reuse and deviation

- Owner: the repo `mise.toml`, which already owns repository tool and task
  configuration and is loaded by `mise activate` in interactive shells.
- Rejected: direnv `.envrc`, a second environment mechanism next to mise;
  an untracked `mise.local.toml`, which worktrees never receive; a
  hard-coded account name, which would bind every clone to one user.

## Acceptance and proof

- `tests/unit/toolchain-pins.test.ts` runs the extracted command in a fresh
  git repository, with `GIT_*` variables removed from every git call so a
  hook's `GIT_DIR` cannot redirect them to this repository, and an inherited
  `GH_TOKEN` set, and asserts empty output with the key unset and with an
  unknown account. The test fails on the base, which has no `[env]` entry,
  and without the inherited-token guard.
- In a worktree of this repository, with another account active,
  `mise exec -- gh api user --jq .login` returns the configured account;
  outside the repository it returns the active account.
- Native pre-commit hooks pass.

## Delivery boundary and risk

One atomic change: `mise.toml`, its test, and this plan, plus a separate
commit that repairs `tests/unit/herdr-projects-load.test.ts`. The Herdr app
now declares `ScrollHandle` with `extends ScrollPosition`, which the
allow-list parser did not match, so the pre-commit suite failed on
`origin/main` on any machine with current Herdr type files. The parser now
accepts an `extends` clause and includes inherited members. The user chose
to carry that fix in this PR rather than a separate one. Branch
`mise-gh-account` from `origin/main`, draft PR targeting `main`. Agent shells
that snapshot their environment at startup see the value only in sessions
started after the change. Rollback: revert through a normal PR.
