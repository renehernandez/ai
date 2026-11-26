# Upgrade pi-claude-bridge to 0.13.0

## Objective

Move the managed Claude bridge from `pi-claude-bridge` 0.9.3 to 0.13.0 so its
bundled Claude Code recognizes `claude-fable-5-2` and stops serving the
consult planner with generic unrecognized-model limits.

## Accepted scope

One atomic plan plus implementation in one AI-repository PR on GitHub
`origin`, targeting `main`. The personal profile requires no hosted CI or
hosted reviewer. The user authorized the upgrade, the PR, its merge, and the
post-merge live sync in this session.

Out of scope: routes, models, thinking levels, the `forceTwoHundredK` context
cap, `pi-mcp-adapter`, and installing the separate AskClaude package.

## Evidence

- 0.13.0 declares peers `@earendil-works/pi-ai` and
  `@earendil-works/pi-coding-agent` `>=1.5.1`; the managed Pi is 1.6.1.
- 0.13.0 pins Agent SDK 0.3.321 (Claude Code 2.1.321). Its darwin-arm64 CLI
  contains `claude-fable-5-2`; the 2.1.318 CLI bundled with 0.9.3 does not.
- The 0.13.0 config loader reads `provider.plan`, `longContextExtraUsage`,
  `forceTwoHundredK`, `strictMcpConfig`, `autoMemoryEnabled`, and
  `askClaude.enabled` (only to warn that AskClaude moved to
  `pi-claude-bridge-askclaude`). It no longer reads `askClaude.allowFullMode`
  or project-level `.pi/claude-bridge.json`.
- The new `provider.systemPromptPreset` defaults to the `claude_code` preset,
  which 0.9.3 already always applied.
- 0.13.0 lists `claude-fable-5-2` among models that serve 1M on every plan.
  The managed `forceTwoHundredK` cap still pins it to 200K; changing that
  policy is a separate decision.

## Behavior

- `ax.config.json` and `hooks/pi/launch.ts` pin `npm:pi-claude-bridge@0.13.0`.
  Sync's `append-unique` merge replaces the old bridge entry in Pi
  `settings.json` and preserves unowned packages.
- The `askClaude.allowFullMode` managed leaf is removed because 0.13.0 does not
  read it. `askClaude.enabled: false` stays, so the bridge never warns.
- The bridge registers no tools of its own; AskClaude is not installed, so
  role tool allowlists are unchanged.

## Reuse and deviation

`ax.config.json` stays the desired-state owner for the Pi package pin and
bridge settings; `hooks/pi/launch.ts` stays the only owner of explicit
extension pins. `docs/ax.md` states the targeted bridge version. No new
mechanism.

## Acceptance and proof

- Unit tests assert the new pin in Pi settings and launch arguments, and the
  absence of `askClaude.allowFullMode`.
- Native hooks run the full suite on commit.
- After merge, from the clean `main` worktree: `pnpm ax sync`, `pnpm ax
  validate`, `pnpm run pi:packages-install`, and confirm Pi lists
  `claude-bridge/claude-fable-5-2` through the 0.13.0 bridge.

## Delivery boundary and risk

About 6 files and under 100 changed lines. Risk: bridge behavior changes
across four minor releases (mitigated by the config-loader review and the
post-merge Pi smoke). Rollback: revert through a normal PR, rerun sync, and
reinstall packages from `main`.
