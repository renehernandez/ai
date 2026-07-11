# Agent Run

Linear issue title: `<Role purpose> <NN> — <short scope>`, where `<NN>` is a
monotonic two-digit sequence within the parent Squad or Workstream. Examples:
`Implementer 01 — API contract`, `Reviewer 01 — Security`, and `Worker 01 —
Repository inventory`. Never reuse a completed sequence.

Use these exact schema fields in the normalized record body:

- `record_type`: run
- `id`:
- `created_at`:
- `classification`:
- `summary`:
- `source_links`:
- `next_check_at`:
- `invocation_id`:
- `state`:
- `workspace_generation`:
- `role_variant`:
- `model_profile`:
- `model_routing_reason`:
- `sandbox_mode`:
- `tool_policy_attestation`:
- `mode`:
- `authority_grant`:
- `canonical_sources`:
- `objective`:
- `acceptance`:
- `verification`:
- `stop_condition`:
- `escalation_route`:
- `attempt`:
- `worktree`:
- `head`:
- `handoff`:
