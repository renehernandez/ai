# Documentation and specification rules

## Documentation

- Use `doc-smith` for non-trivial user-facing or operational documentation
  creation, editing, review, or audit, including work under `docs/` and
  substantial Markdown guides, references, explanations, onboarding material,
  ADRs, or solution notes.
- Atomic plans and OpenSpec artifacts are planning contracts. Review them with
  the planning baseline and do not run Doc Smith reader personas.
- Run Doc Smith reader personas once, in parallel, against final stable document
  text when audience comprehension is part of acceptance. Do not rerun them
  after every intermediate edit.
- Trivial typo, stale-path, and one-line clarity fixes do not require the full
  documentation workflow.
- Verify commands, configuration keys, paths, and behavior against source.
- Prefer direct, imperative prose. Remove filler, formulaic contrast phrases,
  unexplained terms, and steps that depend on unstated context.

## Machine-readable thread contracts

Before a machine-readable YAML or JSON block, include a concise
`## Readable Summary` with status, artifact or scope, verification, blockers,
and next action as applicable. Keep the structured block immediately after the
summary. Ordinary config snippets and scalar command output are exempt.

## OpenSpec routing

Ordinary language routes through the five modes. Generated `openspec-*`
adapters and `/opsx:*` commands are explicit developer commands; do not infer
them from ordinary requests to explore, plan, implement, review, finish, or
archive work.

- Explore clarifies an uncertain change without writing artifacts.
- Plan creates or reconciles the OpenSpec when the accepted contract requires
  it.
- Execute implements the reconciled tasks.
- Review inspects exact planning and implementation targets.
- Finish publishes artifacts and performs authorized completion actions.

Every OpenSpec receives one complete disposable implementation POC before final
implementation. The POC remains draft, review-only, and closes unmerged after
current automated review and personal exact-head acceptance.

## OpenSpec task shape

An OpenSpec `tasks.md` top-level heading is a delivery unit. Each top-level
delivery unit maps to one final implementation PR/MR. Nested checkboxes are work
items delivered cohesively inside that PR/MR, usually as focused commits.

Keep the OpenSpec artifacts complementary. The proposal owns motivation,
outcomes, scope, and delivery shape. Design owns durable technical decisions,
boundaries, and tradeoffs. Specs own observable requirements and
boundary-defining scenarios. Tasks remain a high-level delivery queue with
end-to-end proof, not a duplicate specification or implementation log.

For multiple final units, the proposal includes a concise delivery-shape table
that identifies each unit as `groundwork`, `outcome`, or `hardening`, with its
local outcome, dependency or enabled successor, local proof, and stack objective
proof ownership. When prior implementation or POC evidence exists, include the
affected ownership or review domains and evidence-backed split rationale.
Proposal count, task headings, tracker units when required, and intended stack
order must agree; nested work items never declare themselves final PRs/MRs.

Derive top-level units from behavior, ownership, deployment, security,
migration, rollback, verification, and repository boundaries before mapping
tasks onto them. Existing headings are hypotheses, not accepted delivery
boundaries. When earlier implementation, POC, PR/MR, or incident evidence
exists, use its actual footprint and findings to challenge the proposed split.

Plan must establish one reviewable outcome, a safe merged intermediate state,
owned local proof, a coherent reviewer/risk/rollback/deployment boundary, and
predecessor output and integration hotspots for each unit. The artifact
records the outcome, dependency, proof, and only material rollback or deployment
decisions; detailed mechanics remain task-local. Split materially
different shared prerequisites, feature behavior, proof infrastructure,
activation, repositories or owners, security boundaries, rollback paths, and
deployment mechanisms. Combine candidates that would otherwise leave unused
plumbing, an unverifiable or unsafe intermediate state, or checkbox-only
PRs/MRs with the same review and rollback boundary. File count and diff size are
evidence, not delivery-shape thresholds.

Prefer stack objective proof in the first unit. Permit one or two groundwork
units first only when each safely improves the current system, owns local proof,
directly simplifies or enables a named successor, and reduces the size or risk
of the first outcome MR. Stack objective proof must appear by unit 3. A third
pre-outcome unit or speculative groundwork blocks readiness. When real footprint
evidence shows that the root unit dominates the stack or crosses independent
ownership, security, deployment, rollback, or review seams, replan it even if
it contains valid early proof.

- Use headings for reviewable implementation outcomes, never workflow phases.
- Keep work items at the outcome level. Do not add exact files, symbols,
  commands, exhaustive edge cases, or test matrices unless they express a
  material contract decision.
- Put documentation, linting, testing, review, validation, verification, proof,
  cleanup, and archival inside the work item that owns the behavior. They are
  separate units only when that surface is itself the feature.
- Put the first real stack objective confirmation by top-level delivery unit 3.
  Name the real entrypoint and visible pass/fail evidence; every earlier
  groundwork unit still owns local proof.
- Target 2-6 nested work items. More than 6 and at most 8 requires a concrete
  delivery-boundary justification. More than 8 blocks readiness and requires a
  new breakdown.
- One work item is acceptable only when risk, ownership, deployment, or
  reviewability explains the separate delivery boundary.
- In the last final unit, Execute completes task state, synchronizes delta specs
  into canonical specs, and moves the verified change into the dated archive
  before the final hook-clean commit and draft publication. Incomplete or
  unverified requirements block archival.
- Planning reviewers inspect the resulting canonical-spec/archive state on the
  exact implementation head. Finish requires that state for readiness and does
  not perform archival as merge follow-through or branch/worktree cleanup.
- Re-run delivery decomposition after the POC using its actual implementation
  and review evidence. A material top-level-unit change returns to the user
  before final implementation; do not silently rewrite the accepted shape.

Do not publish a separate planning PR/MR or reconciliation-only PR/MR. The
initial locally reviewed OpenSpec enters the POC. Reconciled planning state then
ships with the owning final unit.

## Plan artifact boundary

Only primary atomic-plan Markdown files are allowed under `.agents/plans`.
Reviewer selections, requests, blueprints, handoffs, ledgers, fingerprints,
validation inputs, and other private evidence stay task-local. OpenSpec is the
only planning representation when Plan selects OpenSpec.

Every non-trivial primary plan or OpenSpec includes a concise reuse and
deviation contract: inspected precedents and canonical owners, reused or
extended elements, genuinely new mechanisms, justified deviations, and the
proof for the chosen ownership. `No applicable precedent found` requires
repository evidence. Do not create a separate reuse ledger or sidecar.

Planning artifacts preserve the objective, high-level approach, material
decisions and constraints, delivery shape, and the earliest real entrypoint
with visible success or failure evidence. Keep step-by-step instructions, file
inventories, exact commands, exhaustive test or edge-case matrices, provider
receipts, review chronology, and intermediate findings task-local unless they
change externally observable behavior, architecture or ownership, safety or
rollout policy, migration, delivery boundaries, or end-to-end acceptance.

## Diagrams

Use Mermaid for diagrams in Markdown documentation. Prefer `flowchart` for
architecture and request flow, `sequenceDiagram` for interactions over time,
`erDiagram` for data models, and `stateDiagram-v2` for lifecycles. Do not use
ASCII-art diagrams.
