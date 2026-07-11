# Messages and invocation

Every message carries message ID, type, correlation ID, sender, recipient,
workspace generation, mode, objective, authority, canonical sources,
acceptance, verification, stop condition, model profile, escalation route, and
`next_check_at`. Agent Run messages also carry Run ID.

Use:

- `ASSIGN` for accepted bounded work.
- `ACK` to confirm identity, scope, authority, and contract.
- `CHECKPOINT` for meaningful progress, forecast, evidence, and next action.
- `DECISION_REQUEST` for a material choice outside current authority.
- `BLOCKED` or `URGENT` for attention with impact and deadline.
- `HANDOFF` for owner, exact artifact identity, dirty/untracked paths, risks,
  verification, and next action.
- `COMPLETE` only for a named entity whose acceptance and verification passed.
- `CANCEL` to terminate an Agent Run and increment generation when authority is
  revoked.

Retry with the same correlation ID and incremented attempt. Do not produce a
second logical assignment.

Activation `pre_create` context is not an invocation message because no task ID
exists yet. It contains the immutable creation tuple, null task ID, and
`activation_phase: pre_create`. After the ID is persisted and the sole allowed
`PENDING_CONTEXT` response is verified, the first follow-up is a normal `ASSIGN`
envelope with `activation_phase: post_create` context.
