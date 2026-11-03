# Paseo orchestrator role

## Objective

Replace the managed Pi/Paseo `planner` role with an `orchestrator` role that
names its real job, offer one Orchestrator profile in Paseo with a choice of
models, and close two gaps in its tool policy. This is the second of the two
changes planned alongside `paseo-delivery-evidence-and-adoption.md`; the first
merged as PR #22.

## Accepted scope

One atomic plan plus implementation in one Ready AI-repository PR on GitHub
`origin`, no hosted CI or reviewer required. Merge needs separate user
authority.

User decisions (this session):

- One Paseo profile and provider, "Orchestrator", with two models: Claude Opus
  5.5 through `claude-bridge` (the default) and Astra through `openai-codex`,
  both at medium thinking. New tabs open on Opus; Astra is chosen from the
  model menu. The separate "Opus 5.5 · Plan" and "Astra · Plan" profiles go
  away.
- Block package-manager commands that change dependencies for the
  orchestrator: `pnpm` and `npm` `install`/`i`/`add`/`remove`/`rm`/
  `uninstall`/`update`/`up`, including `ci`. Running scripts and tools through
  `pnpm run`, `pnpm exec`, `pnpm dlx`, `npm run`, and `npx` stays allowed.
- Allow `paseo --help`/`-h`, `paseo <subcommand> --help`/`-h`, and the global
  `paseo --version`/`-v` for every managed role; they observe and never
  dispatch. A version flag after a subcommand gets no allowance.

Out of scope: other package managers, implementer or reviewer model choice,
`!` command handling, removing leftover provider entries from live Paseo
config, and retiring the `planner` alias.

## Behavior

Role. The role is `orchestrator`. `planner` remains an accepted alias with
identical policy in the Pi role contract and the runner's caller check, so
sessions launched before this change (their Paseo provider `ax-planner` stays
in live config because config sync never removes unmanaged leaves) keep
working and can still orchestrate. User-facing policy messages say
"Orchestrator policy".

Model choice. The `ax-orchestrator` provider declares both models; Opus is
`isDefault`. Its launch command lists the allowed routes instead of one. The
launcher selects the route that matches the model and thinking Paseo passes at
launch, falls back to the default route when none is passed, and refuses
anything else. The chosen route is then fixed for the session exactly as
today: model, provider, and thinking overrides, cycling, and runtime drift are
refused. Implementer and reviewer roles keep exactly one fixed route.

Runner. The runner never launches the orchestrator, so it stops requiring an
orchestrator provider route when it initializes a workflow; worker routes are
validated as before. Only an `orchestrator` or `planner` caller may run
orchestrator actions. The saved-workflow marker `planner-v2` and every existing
state stay readable and unchanged.

Policy. The dependency-change block applies to orchestrator (and alias) agent
shell calls, including nested shell and `env -S` payloads, and fails closed on
dynamic subcommands the way the existing git-mutation block does. It finds
the subcommand after any leading global options, including value options such
as `npm --prefix <dir>`, `pnpm --dir <dir>`, `pnpm -C <dir>`, and
`pnpm --filter <pkg>`; an option it cannot classify before the subcommand
fails closed. The
`--help`/`--version` allowance applies only when the invocation is a pure help
or version request and must not open a path to dispatch (for example a
`--help` that is really a value of another option, or a dispatch followed by a
help flag in a later segment).

## Reuse and deviation

- `ax.config.json` stays the owner of Paseo profiles and providers; the
  profile list is one managed leaf, so sync replaces it whole.
- `hooks/pi/launch.ts` owns route enforcement; it gains an allowlist for the
  orchestrator only, reusing `parseContract`, `rpcDenial`, and
  `runtimeDenial`.
- `hooks/pi/policy.ts` owns tool policy; the dependency block follows the
  existing git-mutation detector's shape and wrapper handling, and the help
  allowance lives in the existing Paseo dispatch detector.
- `skills/paseo-orchestration/scripts/paseo-workflow-state.ts` and
  `paseo-workflow.ts` own roles, route validation, and the caller check.
- `skills/paseo-orchestration/references/paseo-workflow.md` stays the only
  normative contract; `SKILL.md` and `docs/ax.md` summarize.
- No new mechanism. Rejected: two separate orchestrator providers (the user
  wants one profile), and renaming the state marker (would strand existing
  workflow files for no behavior gain).

## Acceptance and proof

First visible proof: under an isolated HOME and runtime root, sync the branch
config and show one "Orchestrator" profile whose provider lists both models
with Opus as default, then launch the managed wrapper with each model's
arguments and with none, and show the contract role and route it fixes.
Before publication, prove the provider accepts Astra at medium with one direct,
non-Paseo Pi print-mode call using the user's existing Pi credentials and no
saved session (`pi --provider openai-codex --model gpt-6-astra --thinking
medium --no-session -p "Reply OK"`). It starts no Paseo agent and changes no
runtime or config. If the provider rejects medium, stop and report before
committing the Astra route.

Unit tests:

- the launcher selecting Opus by default, Astra when Paseo passes it, and
  refusing an unlisted model or thinking level; mid-session model, provider,
  and thinking changes and cycling still refused for the chosen route;
- implementer and reviewer routes still single and fixed;
- `planner` and `orchestrator` getting identical write, git, compound, and
  dependency policy, and both passing the runner caller check;
- dependency-changing `pnpm`/`npm` commands denied for the orchestrator,
  including wrapped and nested forms, dynamic subcommands, and forms behind
  global options such as `npm --prefix <dir> install` and
  `pnpm --dir <dir> add <pkg>`, and allowed for the implementer;
  `pnpm run`/`exec`/`dlx`, `npm run`, and `npx` allowed, also behind those
  options;
- `paseo --help`/`-h`, `paseo <subcommand> --help`/`-h`, and global
  `paseo --version`/`-v` allowed; `paseo <subcommand> --version` and dispatch
  disguised with a help flag still denied;
- runner `init` succeeding without an orchestrator provider route and
  existing `planner-v2` states still loading;
- profile/config tests asserting the single Orchestrator profile and
  medium thinking for both models.

Run the project's lint, format, skill and charter validation, native hooks,
and `writing-skills` RED/GREEN scenarios for the changed contract text. After
authorized merge, fast-forward the clean `main` worktree, run live
`pnpm ax sync` and `pnpm ax validate`, and confirm a new Paseo tab offers
"Orchestrator" with Opus selected and Astra available, as operational
confirmation of the pre-publication proof.

## Delivery boundary and risk

One coherent outcome: the orchestrator role, its model choice, and its policy
share the same role contract and launcher, so splitting them would ship a
renamed role with the wrong policy or a model picker the launcher refuses.
Target about 12 files and well under 1,000 changed lines; above 15 files or
1,000 lines, return to Plan. Risks: locking out live planner sessions (the
alias and preserved old providers control it), widening route enforcement
beyond the orchestrator (single-route tests for every other role), and the
help allowance becoming a dispatch bypass (adversarial tests).
Rollback: revert the merge through a normal PR and rerun the same sync and
validation from `main`.
