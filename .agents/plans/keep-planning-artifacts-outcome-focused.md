# Keep Planning Artifacts Outcome-Focused

## Goal

Keep atomic plans and OpenSpec artifacts focused on durable decisions, the
high-level approach, delivery shape, and observable end-to-end outcomes.
Implementation mechanics and review discoveries that do not change that
contract remain task-local.

## Approach

- Define the durable planning boundary in Plan: objective, selected approach,
  material scope and constraints, delivery units, and end-to-end proof.
- Keep implementation instructions, file inventories, command matrices,
  exhaustive test cases, provider receipts, and review chronology out of the
  artifact unless they express a material behavior, architecture, ownership,
  safety, rollout, or delivery decision.
- Make planning Review distinguish durable contract findings from
  implementation considerations. Only durable findings require an artifact
  edit; implementation considerations are handed to Execute task-locally.
- Keep OpenSpec artifacts complementary: proposal explains why and scope,
  design records durable decisions and boundaries, specs define observable
  behavior, and tasks name outcome-oriented delivery units and work items.

## Scope

Update the existing Plan, Review, and OpenSpec Tasks guidance, their shared
planning rules, reviewer contract wording, and focused regression tests.
Preserve the current semantic routing, delivery-shape review, earliest
objective-proof requirement, OpenSpec POC contract, and provider policy.

Do not add templates, size limits, new validators, new review lanes, or
machine-readable planning state. Do not rewrite existing plans or OpenSpec
changes.

## Reuse And Deviation Contract

`skills/plan`, `skills/review`, `skills/openspec-tasks`, and the planning rules
remain the canonical owners. This change narrows what those existing owners
persist and review; it introduces no parallel planning representation or new
workflow mechanism. Existing instruction and mode-lifecycle tests provide the
verification owner and will be extended with the observed verbose-plan
regression.

## Acceptance

- A planning artifact can be implemented without preserving step-by-step
  mechanics or exhaustive verification detail.
- Planning Review requests an artifact edit only when a finding changes the
  durable contract; other findings remain task-local implementation
  considerations.
- OpenSpec tasks remain delivery-oriented and identify real end-to-end proof
  without becoming implementation or test logs.
- Material safety, ownership, rollout, migration, and delivery decisions remain
  durable even when their implementation details do not.
- The existing routing, review baseline, delivery decomposition, and proof
  timing behavior remain unchanged.

## Verification

- Focused unit and integration tests for Plan, Review, OpenSpec Tasks, and
  shared instruction alignment.
- Repository skill validation and formatting.
- `writing-skills` RED/GREEN pressure scenarios based on the cited atomic-plan
  and OpenSpec failure shapes.
- Exact target-base diff review under the existing publication checkpoint.

## Risk

Over-trimming could hide a real contract decision. The boundary therefore
keeps details durable when they change externally observable behavior,
architecture or canonical ownership, safety or rollout policy, migration,
delivery-unit boundaries, or end-to-end acceptance.

## First Real Confirmation

Re-run the clean-context baseline scenarios. The revised agents should retain
the high-level runtime and rollout decisions while classifying dotenv
forwarding, artifact expiry, helper filenames, exact commands, and exhaustive
edge-case matrices as task-local implementation considerations unless one of
them changes the durable contract.

## Delivery

Deliver this plan and the focused shared-workflow changes together in one final
draft MR from `codex/lean-planning-artifacts`. No POC or OpenSpec is required.
