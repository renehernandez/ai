# Issue Shape and Proof Contract

Use outcome-centered titles and this body shape:

```markdown
## Goal
## Outcome Slice
## Scope
## Acceptance Criteria
## Verification
## Out of Scope
## Dependencies
## References
```

For hosted, CI, deploy, integration, webhook, automation, migration, sync, or
external-system claims, add `## Proof Required Before MR Ready`. Require the
specific run/job/environment/event/data change/artifact proving the new path,
the relevant link or evidence summary, and an explicit pass/fail disposition.
Disabled, skipped, absent, or code-only paths do not complete such a claim.

Keep proof proportional. For runtime activation, name the flag, environment,
rule, cron, queue, webhook, deploy target, migration gate, or third-party
configuration and whether advisory/disabled behavior counts as incomplete.
Across systems, name the canonical identifier representation used by producer,
transport, consumer, tests, and proof.
