# Model roster refresh

## Objective

Move the managed Pi/Paseo review roster from three Sol reviewers to four
reviewers on two model families, and move every active managed route to its
latest available model version. This is the first of two changes; the second,
Astra and Fable consult planners, follows on a branch stacked on this one.

## Accepted scope

One atomic plan plus implementation in one Ready AI-repository PR on GitHub
`origin`, targeting `main`. The personal profile requires no hosted CI or
hosted reviewer. Merge needs separate user authority.

User decisions (this session):

- Four reviewers: Sol, Terra, and two Sonnet sessions. Terra replaces one of
  the two Sol reviewers the user first proposed.
- Migrate relevant model versions to the latest: GPT-6.1 Sol replaces
  `gpt-5.6-sol`. Astra (`gpt-6-astra`) and Opus 5.5 are already latest.
- Opus stays the only implementer, including hosted repairs.

Version evidence: OpenAI's Codex models page (fetched 2026-11-04) lists Astra,
GPT-6.1 Sol ("near-Astra performance at a lower cost"), GPT-6.1 Terra ("fast,
efficient"), and Luna. Anthropic's models overview lists Fable 5.1, Opus 5.5,
Sonnet 5.5, and Haiku 5.5 as latest. Direct non-Paseo Pi print-mode calls with
the user's existing credentials returned `OK` at medium thinking for
`openai-codex/gpt-6.1-sol`, `openai-codex/gpt-6.1-terra`, and
`claude-bridge/claude-sonnet-5-5`.

Out of scope: consult planners (change 2); implementer model changes; the
retired GLM and DeepSeek provider entries and their model overrides, which
nothing dispatches; removing leftover provider entries from live Paseo config.

## Behavior

Roster. Review roles and routes, all at medium thinking:

| Role | Route | Planning lenses | Implementation lenses |
| --- | --- | --- | --- |
| `review-correctness` | `openai-codex/gpt-6.1-sol` | implementation-readiness | diff-review |
| `review-quality` (new) | `claude-bridge/claude-sonnet-5-5` | edge-cases-and-risk | code-quality-review |
| `review-architecture` | `openai-codex/gpt-6.1-terra` | code-simplifier, refactoring-opportunities | code-simplifier, deslop |
| `review-contract` | `claude-bridge/claude-sonnet-5-5` | delivery-shape | scrutinize |

Existing role IDs keep their names so live provider IDs, policy, and
`retry-launch` worker names stay stable; only `review-quality` is new.
Conditional lens routing is unchanged: security and production lenses go to
correctness, migration and data lenses to architecture, everything else to
contract. Every required lens is still assigned exactly once and every group
must be nonempty in both phases.

Profiles. `ax.config.json` declares four review profiles and providers with
labels naming model and focus (for example "Sonnet · Risk & Quality Review").
Sonnet reviewer launches load the pinned Claude bridge and strip alternate
billing environment exactly as Opus launches do today; reviewers remain
read-only and receive no MCP. Add `claude-sonnet-5-5` to the bridge's
`forceTwoHundredK` list so a 1M-context model never triggers paid long-context
usage.

Runner state. New workflow states carry a new roster marker (`focused-v2`)
and four review groups. States with `sol-focused-v1` or older markers stay
readable through `status`; `tick` and dispatch refuse them with a message
naming the current roster, following the existing legacy-roster precedent. A
workflow in flight at merge cannot continue after live sync; that is accepted.
The runner reads worker routes from live `~/.paseo/config.json`, so new
workflows require the post-merge `ax sync`.

## Reuse and deviation

- `ax.config.json` owns profiles, providers, and bridge settings.
- `hooks/pi/policy.ts` owns the role list; `review-quality` joins it with the
  existing read-only review policy (`review-` prefix).
- `hooks/pi/launch.ts` needs no new mechanism: bridge loading and environment
  stripping already key on provider `claude-bridge`.
- `skills/paseo-orchestration/scripts/paseo-workflow-state.ts` owns roles,
  `reviewRoles`, `lensOwners`, the roster marker, and legacy refusal.
- `skills/paseo-orchestration/references/paseo-workflow.md` stays the only
  normative contract; `docs/ax.md` summarizes.
- Before editing, discover every tracked source that states the current
  roster (for example "three fresh Sol", "focused Sol", `sol-focused-v1`,
  `gpt-5.6-sol`, three review groups) across `skills/`, `rules/`,
  `instructions/`, `docs/`, `hooks/`, `tests/`, and `evals/`, and update each
  real-roster statement. Historical `.agents/plans/` and archived OpenSpec
  files stay unchanged.
- No new mechanism. Rejected: renaming every review role to match its new focus
  (churns live provider IDs and worker names for no behavior gain), and
  running two models per lens (breaks the exactly-once lens contract).

## Acceptance and proof

First visible proof: under an isolated HOME and runtime root, sync the branch
config and show four review profiles with the routes in the table, then run
the managed wrapper's argument builder for each review role and show the fixed
contract route, read-only tool list, and bridge package only for Sonnet.

Unit tests:

- profile/config: four review profiles and providers with exact routes,
  medium thinking, and no MCP; `forceTwoHundredK` includes Opus and Sonnet;
- launch: each review role fixed to its single route; model, provider, and
  thinking overrides refused; Sonnet reviewer args include the bridge and
  exclude MCP; billing environment stripped for Sonnet;
- policy: `review-quality` accepted and limited to read tools;
- runner: `init` builds four routes from config and fails naming
  `ax-review-quality` when it is missing; lens assignment for both canonical
  catalogs matches the table, conditional lenses route as before, and every
  group is nonempty; new states carry `focused-v2`; `sol-focused-v1` states
  are readable through `status` and refused by `tick` and dispatch;
- existing tests updated wherever they assert the three-Sol roster or
  `gpt-5.6-sol` as the real route.

Roster drift proof: after the change, a repository search for the old roster
phrases and `gpt-5.6-sol` outside historical plans, archived OpenSpec, and
legacy-state test fixtures returns no matches; the report lists the search and
every remaining intentional match.

Run the project's lint, format, typecheck, unit tests, skill and charter
validation, native hooks, and `writing-skills` RED/GREEN scenarios for the
changed contract text. After authorized merge, fast-forward the clean `main`
worktree. Before live sync, list running Paseo agents (`paseo ls`); if any
managed review or implementer worker is still active, stop and ask the user
whether to wait or strand that workflow. Then run live `pnpm ax sync` and
`pnpm ax validate`, then `paseo reload`.

## Delivery boundary and risk

One coherent outcome: the roster, its routes, and the runner's lens assignment
must change together or the runner launches reviewers the config does not
declare. Target about 12 files and well under 1,000 changed lines; above 15
files or 1,000 lines, return to Plan. Risks: stranding in-flight workflows
(accepted, explicit refusal message), a Sonnet reviewer accidentally gaining
MCP or write tools (prefix-based policy plus tests), and paid long-context
usage (`forceTwoHundredK`). Rollback: revert the merge through a normal PR and
rerun sync from `main`.
