# Messages and invocation

Every operation carries operation ID, type, correlation and idempotency IDs,
recipient, workspace generation, mode, objective, authority, canonical sources,
acceptance, verification, stop condition, model profile, sandbox mode,
repository path when authorized, escalation route, and creation time. Agent Run
messages carry the Run ID in their durable record or correlation chain.

Use:

- `ASSIGN` for accepted bounded work.
- `CHECKPOINT` for meaningful progress, forecast, evidence, and next action.
- `DECISION_REQUEST` for a material choice outside current authority.
- `BLOCKED` or `URGENT` for attention with impact and deadline.
- `HANDOFF` for owner, exact artifact identity, dirty/untracked paths, risks,
  verification, and next action.
- `COMPLETE` only for a named entity whose acceptance and verification passed.
- `CANCEL` to terminate an Agent Run and increment generation when authority is
  revoked.

Retry with the same correlation and idempotency IDs. Do not produce a second
logical assignment. Cloudflare admits and orders messages before local Flue
execution. Completion applies only when the operation generation still matches
the target agent.

The local runner receives the target Root and directly linked authoritative
records. Restricted records are reduced to identity and a redaction notice.
The structured result may contain checkpoints, typed record mutations, and
messages to other stable agent keys. Projection IDs are assigned by the control
plane, not the model.
