# Upgrade managed Pi to 1.5.0

## Objective

Move the managed Pi/Paseo runtime from Pi 0.85.1 to Pi 1.5.0 with compatible
pinned packages, while preserving the fixed-role launch contract, tool policy,
startup handshake, and workflow injection. This is the first of two changes;
the follow-up moves AI tool installation into a tracked Brewfile plus
AX-managed mise pins with a single bootstrap command.

## Accepted scope and defaults

- Pin Pi 1.5.0, `pi-claude-bridge` 0.9.3, and `pi-mcp-adapter` 7.0.0. The
  adapter upgrade is required, not optional: 2.34.0 declares support only for
  Pi 0.84–0.85. If 7.0.0 cannot satisfy the acceptance below, fall back to the
  newest 6.x release that does; anything older than 6.x cannot run on Pi 1.x.
- Do not change models, providers, thinking levels, roles, review groups, or
  Paseo profiles.
- Do not install Pi globally, run live `ax sync`, or touch live `~/.pi`,
  `~/.paseo`, or credentials. Live activation happens through the follow-up
  bootstrap change after merge. An interim live upgrade needs separate
  authorization.

## Compatibility decisions

- **Nested MCP tool calls.** Adapter 6.0+ on Pi 0.99+ runs each
  `mcp({ tool })` call as a nested Pi tool call named
  `mcp__<server>__<tool>`, and Pi 1.1+ `--tools` does not remove these
  deferred tools. The policy owner treats that name family as part of the
  existing `mcp` permission for roles that already have `mcp`: the same
  orchestration denial (`create_agent`, `update_agent`,
  `respond_to_permission`) applies to the nested name, and every other
  unlisted tool name still fails closed. Review roles keep no MCP access and
  do not load the adapter.
- **Deferred tool activation.** Pi 1.5's built-in `tool_search` and
  `codemode` can activate or call deferred tools. Neither is on any role
  allowlist, so the existing fail-closed allowlist already denies them; keep
  it that way and prove it rather than adding a mechanism.
- **Workflow injection.** Since Pi 0.86, `before_agent_start` prompt changes
  are recorded in the transcript, and since Pi 1.x the event also fires for
  custom-message runs. The managed workflow must appear exactly once per
  effective system prompt across turns, resume, and custom-message runs; fix
  the injection owner if it accumulates or is dropped.
- **Fail-closed `user_bash`.** Keep the existing `{ result }` denial shape;
  verify the denial still returns its message instead of an opaque abort.
- **Bridge settings.** Keep the managed `claude-bridge.json` leaves; drop or
  rename only leaves that 0.9.3 no longer reads, verified against its config
  loader.

## Reuse and deviation contract

- `ax.config.json` stays the desired-state owner for the Pi package pin in
  `settings.json`. `hooks/pi/launch.ts` stays the only owner of explicit
  extension pins and launch arguments. `hooks/pi/policy.ts` stays the single
  tool-permission owner; `enforcement.ts` keeps lifecycle wiring only.
- No new mechanism. The nested MCP name handling extends the existing `mcp`
  branch of `toolDenial`; it does not add a second policy table.
- `docs/ax.md` remains the operator reference for target versions and
  first-run package installation.

## Delivery shape

One atomic plan plus one implementation PR on `update-pi-automate-config`,
targeting `main` through the personal GitHub route. No OpenSpec, POC, or
planning-only PR. Budget: preferred 8 files and 300 changed lines; return to
Plan above 12 files or 600 lines, or if compatibility requires changing role
contracts, providers, or Paseo profiles.

First visible proof: a real Pi 1.5.0 managed launch, run in an isolated HOME,
reaches the enforcement handshake with the new pinned packages.

## Acceptance and named verification layers

1. **Policy unit tests:** nested `mcp__<server>__<tool>` calls are allowed for
   write roles, orchestration tools are denied under both `mcp` and nested
   names, review roles deny every MCP name, and unknown tools still fail
   closed, including `tool_search` and `codemode`. Launch-argument tests
   assert the new pins.
2. **AX config unit and integration tests:** the Pi `packages` leaf converges
   to the new bridge pin and still preserves unowned packages.
3. **Isolated managed-launch integration:** with an isolated HOME and Pi 1.5.0
   run through `mise exec npm:@earendil-works/pi-coding-agent@1.5.0`, the
   launcher starts every role in RPC mode, emits the nonce handshake, and
   exposes only the role's allowed tools. A non-review role loads the adapter
   and registers `mcp`; a denied orchestration MCP call and a denied
   prohibited tool are both blocked.
4. **Isolated multi-turn RPC check:** one Opus implementer session through the
   bridge completes two turns, a resume, and a custom-message run with the
   workflow present exactly once. This requires the operator's Claude
   subscription auth to be available in the isolated home; when it cannot be
   provided safely, report the layer as credential-blocked instead of passed.
5. **Agent-behavior validation:** run `writing-skills` against the changed
   operator doc and Pi/Paseo workflow guidance, and run charter validation.
6. **Project-native verification:** unit and integration suites, skill
   validation, and staged lint/format through native Lefthook hooks before
   commit. The personal GitHub route requires no hosted CI or automated
   reviewer.
