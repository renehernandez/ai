# Prefer Linear Integration With Linearis Fallback

## Goal

Use the connected Linear MCP or app integration as the preferred provider
adapter while retaining the authenticated `linearis` CLI as an automatic
fallback when the integration is unavailable, unauthenticated, or lacks the
required operation.

## Approach

- Select an available and authenticated Linear integration first for supported
  reads and writes, including approved rich Markdown mutations.
- Fall back to `linearis` when the integration is missing, has lost
  authentication, or does not expose the required operation.
- Do not require integration reauthentication when `linearis` can safely
  complete the operation. Preserve the CLI's live-usage discovery, pagination,
  immutable-identity, safe-argument, and exact-readback rules on the fallback
  path.
- Report a capability blocker only when neither adapter can safely complete the
  operation.

## Scope

Align the shared agent entrypoints, provider-tool rule, its surface and
pre-implementation routing consumers, the Linearis adapter skill, the Linear
project-overview skill, the Linear breakdown skill, and focused executable
contracts. Preserve lifecycle authority, exact mutation previews, explicit
approval requirements, human-authentication boundaries, and post-write
verification.

Do not install or configure a Linear integration, change credentials, weaken
provider-write approval, or add a new generic provider abstraction.

## Reuse And Deviation Contract

`rules/command-and-tools.md` remains the canonical provider-routing owner.
`skills/linearis/SKILL.md` remains the owner for CLI mechanics and becomes the
explicit fallback adapter. `skills/linear-project-overview/SKILL.md` and
`skills/linear-breakdown/SKILL.md` remain the semantic owners for their current
workflows. `AGENTS.md` and `instructions/AGENTS.md` remain aligned concise
entrypoints.

The only material deviation from the current CLI-only precedent is adapter
priority: an authenticated connected Linear integration becomes primary and
the CLI becomes fallback. No new adapter layer is needed because the canonical
rule can define routing while each existing skill retains its semantic or
mechanical ownership. End-to-end proof will cover primary integration use,
authentication-loss fallback, unsupported-operation fallback, rich Markdown
completion through the integration, and the blocker when neither adapter is
safe.

## Acceptance

- An available, authenticated Linear integration is selected before
  `linearis`.
- Missing tools, authentication failures, and unsupported integration
  operations fall back to `linearis` without requiring integration login.
- Approved rich Markdown writes use the integration when supported instead of
  returning the CLI file-input blocker.
- CLI fallback retains cursor-complete reads, immutable identifiers, safe
  argument handling, exact pre-write comparison, and exact post-write
  readback.
- The workflow reports a blocker without mutation when neither adapter can
  safely perform the operation.
- Semantic preview, approval, lifecycle, and provider-message requirements are
  unchanged.

## Verification

- RED/GREEN application scenarios for integration-first routing, expired
  integration authentication, unsupported integration operations, rich
  Markdown mutations, and total adapter failure.
- Focused unit contracts for the shared instructions, routing consumers, and
  three Linear skills.
- Repository formatting, unit tests, and skill validation through the native
  project commands.
- Exact target-base diff review under the existing draft-publication
  checkpoint.

## Risk

Ambiguous fallback wording could cause repeated authentication prompts,
silently weaken write approval, or apply CLI safety constraints to the
integration path. Keep adapter availability separate from semantic authority,
name the automatic fallback conditions explicitly, and retain adapter-specific
verification requirements.

## First Real Confirmation

Run clean-context Linear project-overview and breakdown scenarios with both
adapters visible. The agent must use the authenticated integration first,
complete an approved rich Markdown mutation through it, switch to `linearis`
after an integration authentication or capability failure, and stop only when
both routes are unsafe or unavailable.

## Delivery

Deliver this plan and the aligned shared instruction, skill, and test changes
together in one final draft MR from
`codex/linear-integration-fallback`. No OpenSpec or POC is required.
