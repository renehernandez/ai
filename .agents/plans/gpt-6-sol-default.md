# Migrate the Sol default to GPT-6

## Objective

Use `openai-codex/gpt-6-sol` for the managed Sol implementer instead of
`openai-codex/gpt-5.6-sol`, retaining medium reasoning effort.

## Approach and ownership

Reuse `ax.config.json` as the sole desired-state owner. Change the implementer
profile, provider launch argument, and default model entry together. Preserve
Astra, GLM, DeepSeek, provider identity, labels, and enforcement behavior.
Update related test fixtures to exercise the new identifier without introducing
new routing or migration mechanisms. Historical planning artifacts remain
historical rather than being rewritten as current configuration.

Inspected precedents are the existing implementer declaration and neighboring
Astra configuration, Pi enforcement unit tests, JSON configuration sync unit
tests, and AX CLI integration tests. Existing AX convergence and role enforcement
remain the canonical implementation; no architectural deviation is needed.

## Constraints and delivery

Deliver one atomic plan-plus-implementation Ready GitHub PR targeting main.
Use the managed Pi/Paseo one-pass review and handoff workflow. Do not merge,
change dependencies, or mutate the live runtime. Activation is deferred until
an independently authorized merge and clean default-branch synchronization.
The current task uses the installed model route without overriding it to
bootstrap its own configuration change.

## Acceptance and proof

- All three desired-state Sol declarations agree on GPT-6 Sol and medium effort.
- Other model roles and runtime safety controls are unchanged.
- Existing enforcement unit, configuration-sync unit, and AX CLI integration
  coverage passes with the new fixtures; native commit hooks pass.
- Isolated configuration convergence, using both isolated HOME and runtime
  roots, demonstrates the resulting implementer route without touching live
  settings. This proves configuration, not remote model availability.
- Explicitly report any unavailable model-catalog or execution evidence; do not
  claim that local configuration tests prove provider access.

The configuration-only change is one cohesive unit within the normal delivery
budget. Rollback is an additive reversal of the model identifier change.
