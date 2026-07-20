# Internalize Glab Stacked Diffs

## Goal

Make the AI repository the canonical owner of `glab-stacked-diffs`, preserve its
installed identity, and adapt it to Rene's progressive, critical-path-first
stack workflow. Deliver this ownership transfer and skill behavior as one
plan-plus-implementation MR. [confidence: 0.99 - certain | reason: Rene
explicitly selected internalization and reserved broader workflow changes for
a separate MR]

## Motivation

The Fullscript-owned skill is installed into Rene's runtime but contains stack
guidance that contributed to delayed descendant propagation and a no-op sync
after a direct commit bypassed `glab stack` metadata. Owning the skill locally
allows its mutation, recovery, publication, and merge guidance to align with
Rene's portable authority and throughput contracts without waiting on an
organization-wide upstream policy. [confidence: 0.98 - certain | reason: the
installed and upstream skill content plus the !883 failure were inspected]

## Decisions

- Import the complete current upstream `glab-stacked-diffs` directory and
  record its source repository and commit as one-time provenance. The AI
  repository becomes authoritative after import; no automatic upstream sync or
  dual ownership remains. [confidence: 0.97 - certain | reason: the user chose
  internalization specifically to evolve the skill locally]
- Preserve the skill name and installed targets. Move its AX selection from the
  Fullscript remote block to the local `personal-skills` block in one config
  change so duplicate-name validation never observes two sources. Do not retire
  or rename the skill. [confidence: 0.99 - certain | reason: AX authoritative
  sync preserves target identity and rejects duplicate sources]
- Treat the skill as a bounded specialist inside the current Plan, Execute, or
  Finish authority. It never grants repository writes, provider publication,
  ready-state changes, merge, or cleanup by itself. [confidence: 0.97 -
  certain | reason: all shared skills must remain subordinate to the five-mode
  lifecycle]
- Separate substantive MR changes from dependency propagation. Keep each
  behavioral correction scoped to its owning MR, but after every published
  ancestor-head change immediately propagate affected descendants in
  topological order while independent CI, hosted review, verification, and
  audits continue concurrently. [confidence: 0.99 - certain | reason: this is
  the explicit correction from the !883 and !881-!890 workflows]
- Require managed-stack preflight before mutation. A `glab stack`-managed diff
  uses its amend/save metadata path; a no-op sync is failed propagation
  evidence. Non-managed stacks use the repository's normal exact-head branch
  workflow. [confidence: 0.98 - certain | reason: direct commit on !883 caused
  `glab stack sync` to propagate nothing]
- Normalize imported guidance to Rene's portable rules: native hooks stay
  enabled, commands remain one per tool call, destructive recovery requires
  explicit authority, MR descriptions route through `change-request-create`,
  final MRs stay draft until explicit merge authority, and force updates use
  exact expected remote-head leases. [confidence: 0.97 - certain | reason: the
  upstream references currently contain conflicting examples]

## Domain Terms

| Term | Meaning |
| --- | --- |
| Internalized skill | A skill whose authoritative source, evolution, and AX selection live in this AI repository. |
| Identity-preserving source move | Changing the AX source while keeping the skill name and installed runtime targets unchanged. |
| Substantive change | Behavior owned by one visible MR rather than dependency-only ancestry propagation. |
| Stack propagation | Updating affected descendant heads after a published ancestor changes, in dependency order. |
| Stack freshness | Every descendant's effective diff is based on the latest published immediate predecessor head. |

## Scope

### In Scope

- Import `glab-stacked-diffs/SKILL.md` and its reference files from the latest
  verified Fullscript skills source.
- Add `glab-stacked-diffs` to the local skill selection and remove only that
  name from the Fullscript remote selection.
- Add concise one-time upstream provenance.
- Align the skill and references with five-mode authority, stack-mechanism
  preflight, progressive substantive work, eager descendant propagation,
  concurrency, draft/merge authority, exact-head safety, provider-description
  ownership, and recoverable troubleshooting.
- Add focused configuration, skill-contract, and lifecycle regression tests.
- Run `writing-skills` RED-GREEN-REFACTOR pressure scenarios for the !883,
  !881-!890, small-single-MR, and true dependency-chain cases.
- Validate installation through isolated AX sync/status/validate before merge.

### Out Of Scope

- The broader portable user-efficiency priority, execution-graph contract, or
  changes to `brainstorming`, `explore`, `plan`, `execute`, `review`, `finish`,
  and shared rules; those form the separately requested second MR.
- Any project-specific `AGENTS.md` change.
- Persistent squads, project leads, organizational agents, orchestration state,
  deeper agent nesting, or runtime telemetry.
- Modifying the Fullscript skills repository or automatically synchronizing
  future upstream changes.
- Merging this MR without explicit user authority.

## Reuse And Deviation Contract

Reuse the existing Fullscript skill identity, command coverage, workflow
references, AX local-skill source mechanism, deterministic duplicate-source
failure, skill validator, isolated runtime sync pattern, five-mode authority,
`change-request-create` description policy, and exact-head Git safety rules.

The intentional ownership deviation is a full fork into the AI repository.
This is required because Rene wants the skill optimized for his workflow rather
than constrained by the organization-wide upstream contract. The behavior
deviation replaces batch-at-end feedback sync with progressive scoped mutation
plus eager propagation and removes examples that conflict with portable safety
and authority rules. No new stack engine, orchestration database, or runtime
adapter is introduced.

## Atomic Implementation Unit

Deliver one AI-repo MR containing the plan, exact source import, AX ownership
transfer, tailored skill behavior, and regression proof. Import without the
source move would be unused duplication; the source move without behavior
alignment would preserve the failure; splitting tests would leave the new
canonical owner unproved. The unit is safe independently of the later broader
efficiency MR because the skill carries its complete stack-specific contract.
[confidence: 0.98 - certain | reason: all changes share one skill identity,
runtime activation boundary, reviewer, and rollback path]

## Acceptance Criteria

- The AI repository contains the complete `skills/glab-stacked-diffs` package
  with recorded upstream provenance.
- AX selects `glab-stacked-diffs` exactly once from the local skill block and no
  longer selects that name from the Fullscript remote block.
- Isolated AX synchronization installs the local content at the existing
  Agents, Codex, and Claude runtime targets without collision or identity
  change.
- The skill cannot expand lifecycle authority and keeps final MRs draft until
  explicit merge authority.
- Managed-stack preflight prevents ordinary commits from bypassing `glab stack`
  metadata.
- A published ancestor change starts descendant propagation without waiting for
  merge or current-MR hosted gates; linear descendants remain topologically
  ordered.
- Each substantive correction remains visible on its owning MR and no workflow
  recommends reconstructing the complete desired stack before publication.
- No active guidance recommends `--no-verify`, compound shell commands,
  unapproved destructive recovery, blind force-push, or direct MR-description
  replacement.
- Focused contract tests, skill validation, isolated AX proof, native repository
  hooks, hosted review, and exact-head local Review pass.
- No project-specific `AGENTS.md` is changed.

## First Real Confirmation

In an isolated HOME and runtime root, run the real AX synchronization entrypoint
from the implementation branch and show that `glab-stacked-diffs` is installed
from the AI-repo source at its unchanged runtime path. Then run fresh-agent
pressure scenarios where the !883 ancestor update uses the managed-stack amend
path and begins descendant propagation while current-MR hosted gates remain in
flight. [confidence: 0.97 - certain | reason: this exercises both the ownership
move and the user-visible behavior that motivated it]

## Verification Strategy

- Add focused tests for local-vs-remote AX ownership, configured-name coverage,
  skill metadata/references, authority boundaries, and prohibited guidance.
- Run `pnpm run skills:validate` and the focused unit/integration tests that own
  AX selection and five-mode lifecycle contracts.
- Use `writing-skills` to capture failing baseline rationalizations, revised
  passing behavior, and loophole-closing controls without committing reviewer
  transcripts.
- Run isolated `pnpm ax sync`, `pnpm ax status`, and `pnpm ax validate`; inspect
  installed file equality and target links.
- Commit with native hooks, publish one draft GitLab MR targeting `main`,
  request Nitro, and run exact-head local Review using hook evidence.

## Risks And Controls

| Risk | Control |
| --- | --- |
| AX observes duplicate local and remote skill names | Add and remove the selection in one config change; preserve deterministic collision tests. |
| The import silently misses newer upstream content | Refresh the upstream source first, record its exact commit, and compare the imported tree. |
| Internalization creates a drifting dual source | Declare the AI repo authoritative and keep only one-time provenance; no sync mechanism. |
| Eager propagation creates repeated churn | Trigger on published heads, not uncommitted edits; preserve topological order and exact leases. |
| Parallelism violates Git dependencies | Run the propagation lane concurrently with independent gates while processing a linear chain in dependency order. |
| The skill bypasses five-mode authority | State bounded mode ownership and test draft, publication, ready, merge, and recovery limits. |
| Imported troubleshooting conflicts with safety rules | Remove bypass and destructive defaults; use explicit authority and recoverable inspection paths. |

## Delivery Policy

The atomic plan and implementation ship together in one draft GitLab MR
targeting `main`. Implementation authority includes draft publication, Nitro,
CI or explicit no-pipeline handling, review repair, and technical readiness. It
does not include merge. The separately requested general user-efficiency and
lifecycle improvements begin only in their own second branch and MR after this
skill MR is technically ready.
