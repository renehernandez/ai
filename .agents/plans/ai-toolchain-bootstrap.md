# One-command AI toolchain bootstrap

## Objective

Let the operator set up or refresh the whole AI system on a macOS machine with
one command from a clean `main` checkout: `bin/bootstrap <profile>`. The repo
becomes the source of truth for the AI-specific tools and their versions, not
only for their configuration.

## Accepted scope and defaults

- **Homebrew, through a tracked `Brewfile`:** `mise`, plus the `paseo`,
  `claude-code`, and `codex` casks. Homebrew does not pin versions; these track
  the latest release on each bootstrap.
- **mise, at exact versions:** Node, pnpm, Pi, and OpenSpec, installed as
  global tools from the user's `~/.config/mise/config.toml`. AX owns only those
  pin leaves and preserves every other entry.
- **Versions:** Node 26.3.0 (matches the repo `mise.toml`), Pi 1.5.0 (the
  managed launcher target), OpenSpec 1.15.0, and pnpm 12.16.1.
  - OpenSpec 1.16.0 is newer but younger than the repo's 7-day
    `minimumReleaseAge`; moving to it once eligible is a separate version bump.
  - pnpm 11.5.3, the current repo pin, is affected by high-severity advisories
    GHSA-vx52-2968-3vc6, GHSA-vq4v-j7r6-jq4m, and GHSA-c59q-g84q-2gj5. 12.16.1
    is unaffected and past the 7-day window.
- **pnpm is pinned in three places that must agree:** the repo `packageManager`
  field (pnpm switches itself to that version inside the repo), the repo
  `mise.toml` (so repo setup works on a fresh machine), and the global mise
  config (so hooks that run `pnpm exec` from any directory find it). The repo
  setup task stops calling `corepack enable`, because Node 26 no longer ships
  Corepack.
- **Pi packages:** the pinned bridge and MCP adapter are installed or
  pre-downloaded so the first managed launch does not spend its 60-second
  deadline downloading.
- **Out of scope:** gh, glab, general dotfiles, shell startup files,
  credentials and logins, Homebrew itself, Paseo's daemon pairing, and
  regenerating any repo's OpenSpec assets.
- Bootstrap never uninstalls anything. When an older copy of a managed tool
  would win on PATH, it reports the exact path and a suggested removal command.
  One-time cleanup of old installs needs separate operator approval.

## Behavior

`bin/bootstrap <profile>` is idempotent and stops at the first failing step
with that step named. In order, it:

1. requires Homebrew and installs the `Brewfile`;
2. trusts and installs the repo's own mise tools, then runs the documented repo
   setup;
3. installs the AX shim and runs `ax sync --profile <profile>`, which now also
   writes the global mise pins;
4. installs the global mise tools;
5. reconciles Pi packages and pre-downloads the launcher's explicit extension
   packages;
6. runs `ax validate`, confirms `pi`, `node`, and `pnpm` on PATH report the
   pinned versions, and reports any shadowing copies;
7. prints the remaining manual steps: restart Paseo (it captures PATH at app
   start), and sign in where needed.

Live AX sync keeps its existing guard: it only applies from the clean merged
default-branch source, so bootstrap is a `main`-checkout command.

## Reuse and deviation contract

- `runtime.configs` and the TOML handler in `scripts/ax` stay the owner of
  managed tool config leaves. Add a `mise` entry targeting
  `~/.config/mise/config.toml`. Extend the TOML writer to accept quoted keys
  from a safe character set, because mise names npm tools like
  `"npm:@earendil-works/pi-coding-agent"`. Add a mise validator beside the
  Codex validator that loads the candidate file through mise without touching
  the live config.
- `hooks/pi/launch.ts` stays the single owner of the explicit extension pins.
  Pre-download reads them from there instead of repeating them.
- The repo `mise.toml` setup task stays the owner of repo setup. Bootstrap
  calls it rather than duplicating its steps.
- The `packageManager` change goes through pnpm itself, per the package manager
  authority rule.
- `bin/bootstrap` is a shell script, a deliberate exception to the TypeScript
  preference: it must run before Node or pnpm exist on a fresh machine. It
  orchestrates existing owners and holds no config or version data of its own.
- A test asserts that pins kept in more than one place agree: Node across the
  global and repo mise configs, and pnpm across `packageManager`, the repo
  `mise.toml`, and the global mise config.

## Delivery shape

One atomic plan plus one implementation PR, stacked on #24 (it needs #24's Pi
1.5.0 pins). The PR targets `update-pi-automate-config` until #24 merges, then
retargets `main`. Budget: preferred 14 files and 700 changed lines; return to
Plan above 15 files or 900 lines, if the TOML writer change cannot keep the
existing Codex behavior byte-for-byte, or if pnpm 12 requires lockfile or
workspace-setting changes beyond its own version pin.

First visible proof: in an isolated HOME, `ax configs sync` writes the mise
pins into a config that already holds unrelated tools, mise loads the result,
and a second sync is a no-op.

## Acceptance and named verification layers

1. **TOML handler unit tests:** quoted-key leaves are created and updated in
   place, unowned entries and comments survive, unsafe keys are rejected, and
   existing Codex fixtures produce identical output.
2. **AX config integration test (isolated HOME):** the mise entry converges,
   is idempotent, and is rejected by the validator when mise cannot load it.
3. **Pin agreement unit tests:** Node and pnpm pins agree across their owners,
   and pre-download uses the launcher's exported packages.
4. **pnpm 12 compatibility:** with pnpm 12.16.1, `pnpm install
   --frozen-lockfile` succeeds with the lockfile unchanged, and the workspace
   settings raise no unrecognized-setting error.
5. **Bootstrap static verification:** `shellcheck` passes, and the script runs
   with `--help` and rejects a missing or unknown profile without side effects.
6. **Isolated pre-download run:** the pre-download step, run with a temporary
   Pi agent directory, fetches both pinned packages without credentials.
7. **Post-merge live run:** after #24 and this PR merge, run
   `bin/bootstrap personal` from the `main` worktree. It must finish with the
   pinned Pi, Node, and pnpm resolving first on PATH and `ax validate` passing.
   This layer can only run after merge; it is reported separately, not claimed
   before.
8. **Project-native verification:** unit and integration suites, charter and
   skill validation, and staged lint/format through native hooks.
