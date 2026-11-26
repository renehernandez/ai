# Fable 5.2 consult planner

## Objective

Move the managed Fable consult planner (`planner-fable`) from Fable 5.1 to
Fable 5.2, and raise the managed Pi pin to the first release whose model
catalog lists Fable 5.2.

## Accepted scope

One atomic plan plus implementation in one AI-repository PR on GitHub
`origin`, targeting `main`. The personal profile requires no hosted CI or
hosted reviewer. The user authorized the Pi upgrade, the PR, its merge, and
the post-merge live sync in this session.

Out of scope: the orchestrator, implementer, and reviewer routes; upgrading
`pi-claude-bridge` or `pi-mcp-adapter`; the Astra consult planner.

## Evidence

- The managed launcher refuses any route that differs from
  `hooks/pi/routes.json`, so the model can only change there.
- `pi-claude-bridge` 0.9.3 registers models from the host Pi's `pi-ai`
  anthropic catalog. Pi 1.5.0 lists `claude-fable-5-1` but not
  `claude-fable-5-2`; `@earendil-works/pi-ai` 1.6.1, the dependency of Pi
  1.6.1, lists `claude-fable-5-2`.
- The bridge's bundled Claude Code (Agent SDK 0.3.318, CLI 2.1.318) warns
  `unrecognized_model` for `claude-fable-5-2` but serves it: a print-mode call
  returned `ok` with `canonicalModel: claude-fable-5-2` on the user's
  subscription. The bridge therefore needs no upgrade.
- `pi-claude-bridge` 0.9.3 accepts `pi-ai` >=0.86.1, and `pi-mcp-adapter`
  7.0.0 accepts `pi-ai` ^1.0.0, so both extensions support Pi 1.6.1.

## Behavior

- `planner-fable` routes to `claude-bridge/claude-fable-5-2:medium` with the
  same label, tools, MCP access, and bridge loading as before.
- The managed mise pin for `npm:@earendil-works/pi-coding-agent` becomes
  1.6.1.
- `claude-fable-5-2` replaces `claude-fable-5-1` in the bridge's
  `forceTwoHundredK` list, so the consult planner never requests paid
  long-context usage. The bridge has no measured 1M row for 5.2 and would
  already serve it at 200K; the explicit entry keeps that guarantee stable
  across bridge upgrades.
- Workflow states record routes at `init`, so states initialized before live
  sync keep consulting Fable 5.1 until a new `init`. That is accepted.

## Reuse and deviation

- `hooks/pi/routes.json` remains the single route owner; herdr templates and
  Paseo providers derive from it.
- `ax.config.json` owns the mise pin and bridge settings.
- `docs/ax.md` states the targeted Pi version; the existing contract test
  binds it to the mise pin.
- No new mechanism.

## Acceptance and proof

- Unit tests assert the new `planner-fable` route, launch arguments, and
  `forceTwoHundredK` list.
- Native hooks run the full suite on commit.
- After merge, from the clean `main` worktree: `pnpm ax sync`, `pnpm ax
  validate`, install Pi 1.6.1 through mise, and confirm
  `claude-bridge/claude-fable-5-2` resolves in Pi.

## Delivery boundary and risk

About 7 files and under 50 changed lines. Risks: Pi 1.6.1 regressions in
managed launches (mitigated by peer-range checks and the post-merge Pi
smoke), and the bundled CLI's generic limits for an unrecognized model (200K
context, matching the managed cap). Rollback: revert through a normal PR and
rerun sync from `main`.
