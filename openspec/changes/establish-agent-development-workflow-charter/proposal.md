## Why

Agent-development behavior is distributed across entrypoints, rules, skills, and workflow helpers, which allows duplicated guidance and independently selectable adapters to bypass accepted policy. A universal charter and validation gate are needed to keep every kind of work aligned while preserving autonomous delivery, resource-conscious review, and final user authority.

## What Changes

- Add a universal agent-development workflow charter that governs all work and makes future agent-behavior changes pass a charter-compliance gate.
- Apply the gate to instructions, rules, skills, agent definitions, hooks, validators, and automation prompts, with structural ownership checks and behavior pressure scenarios.
- Add authored-file refactoring signals, enabling-refactor sequencing, progressive-disclosure guidance, and canonical-owner reuse.
- Exempt removal-only MRs from numeric delivery caps while preserving semantic cohesion, verification, and fail-closed classification.
- Replace exact-HEAD size-exception renewal with artifact-scoped semantic approval that survives contract-preserving rebases and feedback repairs.
- Prohibit non-removal final MRs above 50 changed files, even under an exception.
- Create real-diff OpenSpec final MRs sequentially in Git order, then defer each child restack until its predecessor merges.
- Keep POCs open until explicit closure or contextual acceptance through readiness for stack breakdown, and reconcile durable POC learnings into the OpenSpec before final delivery.
- Require an explicit Nitro request after every pushed head, monitor the latest-head review through closure, and route requests by effective-diff size.
- Make `change-request-create` the only selectable change-request creation and description-policy owner; retain GitHub and GitLab mechanics as internal references and retire standalone creation adapters.
- Exclude automatic task housekeeping and portfolio redesign from this change.

### Delivery Shape

| Unit | Kind | Local outcome | Dependency or enabled successor | Local proof | Stack objective proof |
| --- | --- | --- | --- | --- | --- |
| Charter and validation foundation | groundwork | Every agent-behavior change has one universal charter and an executable compliance gate | Enables lifecycle and publication policies to reference one governing contract | A contradictory rule or skill fixture is rejected while a compliant change passes | Yes: the real shared-behavior validation entrypoint visibly blocks charter drift |
| Delivery lifecycle alignment | outcome | Delivery budgets, exception authority, OpenSpec POC handling, stack promotion, and Nitro closure follow the accepted resource-conscious workflow | Depends on the charter vocabulary and gate | Lifecycle and Nitro scenarios prove removal exemptions, semantic exception persistence, promotion-only restacking, POC closure authority, and latest-head feedback closure | No |
| Change-request ownership consolidation | hardening | One selectable owner constructs and mutates reviewer-facing change requests without a provider-adapter bypass | Depends on the charter’s canonical-owner rule | Explicit GitLab/GitHub and raw-description pressure scenarios route through `change-request-create` and preserve hosted readback | No |

## Capabilities

### New Capabilities

- `agent-workflow-charter-compliance`: Universal workflow principles, canonical ownership, context discipline, change-control validation, and removal-aware delivery standards.
- `change-request-publication`: Single-owner reviewer-facing description policy and internal provider mutation mechanics.

### Modified Capabilities

- `agent-workflow-modes`: Delivery sizing, semantic exceptions, sequential stack publication, and promotion-only restacking change.
- `reviewed-plan-artifacts`: Planning review must validate charter compliance and reconcile POC learnings under the revised closure authority.
- `openspec-implementation-rehearsal`: POC closure, reconciliation, Nitro request routing, and continuous feedback repair change.
- `review-first-plan-orchestration`: Nitro request mechanics, latest-head monitoring, stack freshness, and readiness semantics change.

## Impact

This change affects portable and repository instructions, shared workflow rules, lifecycle and review skills, AX-managed skill selection, OpenSpec canonical specifications, workflow validators, and focused regression fixtures. It introduces no product API, dependency, portfolio interface, automatic task housekeeping, deployment policy, or merge authority.
