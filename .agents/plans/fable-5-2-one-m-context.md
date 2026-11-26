# Fable 5.2 consult planner at 1M context

## Objective

Let the Fable consult planner (`planner-fable`, `claude-fable-5-2`) use its
1M context window through the Claude bridge, and record the operator's actual
subscription plan.

## Accepted scope

One atomic plan plus implementation in one AI-repository PR on GitHub
`origin`, targeting `main`. The personal profile requires no hosted CI or
hosted reviewer. The user confirmed a Claude Max subscription and asked to lift
the Fable cap. Merge requires separate user authority.

Out of scope: lifting the cap for Opus 5.5 or Sonnet 5.5, enabling
`longContextExtraUsage`, routes, and models.

## Evidence

- `pi-claude-bridge` 0.13.0 requests `claude-fable-5-2[1m]` (1M) unless the
  model is listed in `provider.forceTwoHundredK`.
- The bridge's measurement notes record `claude-fable-5-2` serving 1M on the
  Max plan. They record Fable 5 needing Extra Usage on Pro, so the Pro
  behavior of Fable 5.2 is unmeasured.
- `provider.plan` was `"pro"`, which did not match the operator's subscription.
  In 0.13.0 it only gates `claude-opus-4-6`, which no route uses.

## Behavior

- `provider.forceTwoHundredK` becomes `["claude-opus-5-5", "claude-sonnet-5-5"]`.
- `provider.plan` becomes `"max"`.
- `provider.longContextExtraUsage` stays `false`, so 1M comes only from the
  plan, never from metered Extra Usage.
- Every other Claude bridge route stays capped at 200K.

## Reuse and deviation

`ax.config.json` stays the owner of bridge settings; `docs/ax.md` states the
operator-facing context policy. No new mechanism.

## Acceptance and proof

- Contract tests derive the capped list from `routes.json` minus the Fable
  consult planner, require the Max plan, and keep Extra Usage off.
- Native hooks run the full suite on commit.
- After merge, from the clean `main` worktree: `pnpm ax sync`, `pnpm ax
  validate`, and confirm Pi lists `claude-bridge/claude-fable-5-2` at 1M.

## Delivery boundary and risk

About 5 files and under 80 changed lines. Risk: if the account cannot serve
`[1m]`, every Fable consult fails with 400/429 instead of degrading; rollback
is re-adding the model to `forceTwoHundredK` through a normal PR and rerunning
sync. Larger contexts also consume more of the plan's usage limits.
