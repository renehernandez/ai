# Reduce Mode Confirmation Churn

## Goal

Keep lifecycle authority explicit without repeatedly asking the user to approve
low-risk defaults, in-scope repairs, or validator-compatible wording. A task
should normally need one transition from read-only exploration into write
authority, then continue within that granted scope until it encounters a
material decision, required human action, or a new authority boundary.

## Approach

- Define one shared interruption rule across the five modes and their bounded
  specialists. Ask the user only when work would expand authority, choose
  between materially different contract outcomes, or require an external human
  action that the agent cannot complete.
- Treat explicit recommendation bundles as accepted together when the user's
  response clearly refers to the bundle. Continue to exclude unstated scope and
  unrelated downstream authority.
- Make brainstorming state low-risk defaults and evidence-backed
  recommendations without serial confirmation. Keep its discussion queue for
  genuinely material behavior, architecture, safety, ownership, operational,
  cost, or user-visible choices.
- Let Plan, Execute, Review, and Finish repair wording, formatting, validation,
  CI, and review failures automatically when the repair preserves the accepted
  contract and remains inside the active mode's authority.
- Distinguish mechanical OpenSpec task conformance from genuine specification
  redesign. The read-only task auditor still never edits the artifact; Plan
  owns automatic conformance repairs, while changes to behavior, delivery
  boundaries, objective proof, safety, or ownership return to the user.

## Scope

Align the shared lifecycle instructions, investigation and implementation
rules, Brainstorming, Plan, OpenSpec Tasks, and any other mode guidance that
currently converts an in-scope repair into a new permission prompt. Update the
focused mode, brainstorming, and OpenSpec-task regression coverage, including
the cited sequence where Plan paused twice for validator-recognized proof
wording after the user had already said `proceed`.

Preserve the mandatory opening Explore pass, the explicit transition into Plan
or Execute, worktree ownership, dependency-change approval, provider policy,
and explicit merge, deployment, destructive cleanup, credential entry or
grant, and other terminal-action authority. Existing authenticated commands do
not require renewed approval. Do not add a permission database, new lifecycle
mode, hidden approval state, or generic orchestration mechanism.

## Reuse And Deviation Contract

The five lifecycle modes and the central investigation rules remain the
canonical authority owners. Brainstorming remains the canonical owner of
Explore interaction, Plan remains the owner of planning-artifact repairs, and
OpenSpec Tasks remains a read-only delivery-queue auditor. Existing mode and
skill tests remain the verification owners.

The only new contract is an explicit distinction between an interruption and
an in-scope continuation. It extends the existing Review precedent, which
already routes in-scope failures back to the current owner automatically and
asks only for a genuinely new contract decision or reserved authority. No
parallel authority mechanism is introduced.

## Acceptance

- A recommendation bundle followed by `agreed`, `agreed with the recs`, or an
  equivalent clear response accepts every explicit recommendation in that
  bundle, but grants no unstated scope or mutation authority.
- Brainstorming does not ask for confirmation of low-risk defaults or walk the
  user through a sequence of individually recommended decisions.
- After `proceed` grants Plan authority, validator-compatible wording,
  formatting, and other contract-preserving artifact repairs are applied and
  revalidated without another user prompt.
- Validation or review findings that would change behavior, architecture,
  safety, ownership, delivery shape, migration, objective proof, or another
  durable contract boundary still stop for one focused decision.
- Execute owns in-scope implementation and test repairs, while Finish continues
  provider follow-through and routes CI or hosted-review repairs back to that
  owner without renewed permission. Merge, deployment, destructive cleanup,
  dependency graph changes, credential entry or grants, and authority expansion
  keep their existing explicit gates.
- Mode and authority announcements occur once on entry or genuine authority
  expansion, not after ordinary answers, corrections, or repair iterations.

## Verification

- Focused unit and integration coverage for shared mode routing,
  recommendation-bundle agreement, low-risk brainstorming defaults, and
  contract-preserving Plan repairs.
- OpenSpec-task audit coverage that separates mechanical proof-expression
  failures from material delivery or objective-proof redesign.
- `writing-skills` RED/GREEN pressure scenarios using the cited Stat task: the
  RED baseline pauses twice after Plan authority for wording-only repairs; the
  GREEN response repairs and validates them without asking again.
- Repository formatting, type, and behavior-specific validation required by
  the changed shared instruction and skill sources.

## Risk

Over-broad continuation could silently change an accepted contract. The guard
is semantic: automatic repair is allowed only when the observable behavior,
architecture, safety, ownership, migration, delivery boundary, objective
proof, and granted authority remain unchanged. Uncertainty at one of those
boundaries is a material decision and still interrupts.

## First Real Confirmation

Run the clean-context Stat scenario through Explore and Plan. After the user
accepts the explicit recommendation bundle and says `proceed`, the agent should
write the planning artifact, repair validator-recognized proof wording, rerun
validation, and return the valid result without requesting another approval.
The same scenario must still stop before implementation or terminal actions
that were not granted.

## Delivery

Deliver this plan and the coherent shared-workflow updates together in one
final draft MR. No POC or OpenSpec is required.
