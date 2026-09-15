# Paseo MCP configuration startup compatibility

Paseo adds `--mcp-config <path>` when a chat has MCP integration. The managed
launcher currently rejects this supported pi-mcp-adapter flag before Pi starts.

Accept this value-bearing flag for planner and implementer roles, which load
the pinned adapter. Preserve both split and equals argument forms, reject
missing values, and keep reviewer roles unable to configure MCP. Keep model,
reasoning and tool overrides restricted.

Deliver one focused fix with regression coverage and an actual isolated Paseo
nonreview session using MCP injection. Verify successful first-message response,
fixed model/effort, and rejection of prohibited overrides. Publish a PR; merge
and live activation require separately scoped authority for this new PR.
