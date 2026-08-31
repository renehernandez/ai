---
name: ai-readiness-upkeep
description: Use when project work may require updates to verification scripts, task commands, hooks, CI checks, agent instructions, rules, skills, review rubrics, or automation so the repo stays ready for AI-assisted development.
---

# AI Readiness Upkeep

Run a findings-only gate for changed contracts that future agents should verify
mechanically. Do not edit. Return implementer actions grounded in current
repository commands and enforcement.

## Judgment

Inspect the changed surface plus existing tests, task commands, hooks, CI,
generated-artifact/schema validation, release/deploy gates, agent instructions,
and review rubrics that could own the contract.

Prefer, in order:

1. an existing repo-native deterministic verifier;
2. the smallest extension to that command family;
3. an appropriate automation lane: task command, local hook, CI,
   release/deploy, or scheduled;
4. a nonblocking manual/deferred action when automation is unstable, expensive,
   networked, secret-bearing, unsafe, or outside scope.

A blocking finding requires concrete evidence, a repeatable contract, and a
cheap scoped enforceable lane. Manual/none lanes never block. Return
`not_applicable` for formatting, behavior-neutral generated churn, or isolated
prose that changes no workflow, command, verification path, schema, or agent
contract.

Use adjacent skills only to classify their domain: `docs-alignment-review` for
stale documentation and `writing-skills` for skill quality. The Execute owner
implements every accepted change.

Route `action_type: create_skill` to `create-verification-skill` only when the
evidenced gap is a missing project-local way to drive real user-facing
application behavior. Generic test, command, CI, or documentation gaps stay
with their existing owner.

## Output Gate

From this skill folder, run
`scripts/ai-readiness-upkeep.ts report-template` for the canonical YAML schema.
Populate evidence, blocking/nonblocking findings, and deferred items, then run
`scripts/ai-readiness-upkeep.ts validate-report --file <path>`. The script owns
schema, required fields, lane vocabulary, and verdict mechanics.

Judgment rules:

- `passed`: applicable and no finding remains;
- `findings`: only nonblocking or deferred work remains;
- `blocked`: at least one enforceable blocking finding remains;
- `not_applicable`: no readiness contract is exposed.

Each finding names the changed contract, evidence, smallest implementer action,
automation lane, and target surface. Report what was inspected even when clean.
