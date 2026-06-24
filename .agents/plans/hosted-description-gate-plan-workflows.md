# Hosted Description Gate For Plan Workflows

## Objective

Make hosted PR/MR description quality an explicit, portable workflow gate in
the reviewed plan delivery skills. Plan-created and plan-updated review
artifacts should not request Nitro, report readiness, or continue delivery until
the hosted description for the current artifact state is reviewer-facing,
current, and owned by the appropriate change-request or provider adapter policy.

## Background

The existing `change-request-create`, `glab-mr-create`, and `github-pr-create`
skills already contain reviewer-facing description rules. The plan workflow
skills do not consistently make those rules a required gate when they create or
update planning and implementation MRs.

That gap showed up in a stacked Nitro plan where MR descriptions drifted into
author-process history. A planning MR section described how the plan changed
during our own design iteration instead of describing the current plan scope and
the behavior reviewers needed to assess.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Hosted description gate | The required workflow checkpoint proving the PR/MR description is current and reviewer-facing before hosted feedback is requested or readiness is reported. |
| Description policy owner | The skill or equivalent provider adapter responsible for constructing or updating the hosted body, such as `change-request-create`, `glab-mr-create`, or `github-pr-create`. |
| Artifact state | The hosted PR/MR URL plus head SHA or equivalent current artifact identifier that the description describes. |
| Readback evidence | Evidence that the current hosted description was fetched or inspected after create/update, without relying only on command intent. |
| Process-history drift | Author-only iteration history, local workflow detail, or plan-design churn that does not help reviewers assess the current artifact. |

## Scope

### In Scope

- Add a portable hosted-description gate to `plan-review` and
  `plan-unit-delivery`.
- Keep the normative contract in `SKILL.md` and script templates/validators.
- Mirror the contract into `skills/plan-review/agents/openai.yaml` and
  `skills/plan-unit-delivery/agents/openai.yaml` as harness-specific
  convenience, not as the source of truth.
- Require the gate after artifact routing and before Nitro request, hosted
  feedback waits, or final readiness/delivery reporting.
- Represent the selected description policy owner in workflow evidence.
- Require read-before-update safety for existing PR/MR bodies.
- Require enough pre-update body evidence to recover when a hosted description
  update damages manual content or targets the wrong section.
- Preserve repo templates, reviewer-authored notes, links, checklist state, and
  manual sections unless a managed section or unambiguous template section is
  being updated.
- Tie description freshness to the current artifact state, especially material
  head-changing pushes, restacks, feedback fixes, and plan or documentation
  changes that affect reviewer understanding.
- Require structural freshness evidence when prior description evidence is
  reused after a head-changing event.
- Reject process-history drift in hosted descriptions, including sections that
  describe our own plan iteration instead of current scope, behavior,
  boundaries, and verification evidence.
- Add focused tests or validation scenarios that make missing
  `description_policy` evidence fail readiness or delivery validation.
- Add focused tests or validation scenarios that reject stale prior-head
  description evidence and damaged-manual-section readback.
- Add RED/GREEN skill evidence for the specific "What Changed In The Plan"
  failure shape.

### Out Of Scope

- Building a full Markdown body linter.
- Changing hosted review feedback semantics, Nitro routing, or latest-head
  feedback gates.
- Replacing `change-request-create`, `glab-mr-create`, or `github-pr-create`.
- Introducing a provider-neutral PR/MR mutation framework.
- Requiring a specific shell command transcript as the gate pass condition.
- Forcing managed HTML markers into existing PR/MR descriptions that do not
  already use them.
- Changing OpenSpec schema or creating OpenSpec files directly from this plan.

## Implementation Boundaries

Expected implementation areas:

- `skills/plan-review/SKILL.md`
- `skills/plan-review/scripts/plan-review.ts`
- `skills/plan-review/agents/openai.yaml`
- `skills/plan-unit-delivery/SKILL.md`
- `skills/plan-unit-delivery/scripts/plan-unit-delivery.ts`
- `skills/plan-unit-delivery/agents/openai.yaml`
- focused tests for the changed plan-review and plan-unit-delivery validator
  behavior

Do not update provider adapter implementation logic unless the plan workflow
contract exposes a concrete incompatibility. `change-request-create`,
`glab-mr-create`, and `github-pr-create` remain the description policy owners.

## Desired Behavior

### Plan Review

`plan-review` must create or update the planning-only PR/MR through the selected
description policy owner before requesting hosted feedback.

The hosted-description gate passes only when:

1. Artifact routing selected the hosted artifact provider.
2. The workflow identified the description policy owner.
3. Existing hosted body content was read before update when an artifact already
   existed.
4. The hosted body was created or updated for the current planning artifact
   state.
5. The current hosted body was read back or inspected after create/update, with
   readback tied to the current planning artifact head.
6. The body states that implementation has not started, names the plan or
   OpenSpec artifact, names requested feedback, includes exact planning
   validation when it matters to reviewers, and omits private/local workflow
   detail.
7. The body describes current scope and behavior rather than author-process
   history.
8. If readback detects lost manual content, the wrong section updated, or a
   body that is less accurate than the prior description, the workflow restores
   the prior body through the selected description policy owner or blocks with
   explicit recovery evidence.

`plan-review` must not request Nitro or emit `planning_review` until this gate
passes or blocks with evidence.

### Plan Unit Delivery

`plan-unit-delivery` must create or update the implementation PR/MR through the
selected description policy owner after `review-feedback-routing` and before
artifact-host review, Nitro request, pipeline monitoring, or final delivery
reporting.

The hosted-description gate passes only when:

1. The implementation artifact is separate from the planning-review artifact.
2. The selected description policy owner handled the body create/update, or an
   equivalent provider adapter was used in a harness where the named skill is
   unavailable.
3. Existing hosted body content was read before update when an artifact already
   existed.
4. The body describes the approved unit, current behavior, review focus,
   targeted evidence, and hosted status that changes reviewer confidence.
5. The body omits routine local validation, private workflow artifacts, raw
   ledgers, local paths, subagent gates, and author-only plan iteration.
6. The body was read back or inspected for the current artifact head.
7. If readback detects lost manual content, the wrong section updated, or a
   body that is less accurate than the prior description, the workflow restores
   the prior body through the selected description policy owner or blocks with
   explicit recovery evidence.

Material head-changing pushes must refresh the gate when the change affects
reviewer understanding. Metadata-only changes may reuse prior description
evidence only when the body remains accurate for the current artifact head and
the ledger records a metadata-only materiality decision.

## Proposed Contract Shape

Workflow ledgers should carry portable evidence, not command transcripts:

```yaml
description_policy:
  status: passed
  owner: change-request-create | glab-mr-create | github-pr-create | equivalent_provider_adapter
  artifact: <hosted PR or MR URL>
  head_sha: <current artifact head sha or equivalent>
  update_mode: created | updated | reused_current
  materiality_decision: material_update | metadata_only_reuse
  reuse_rationale: <required when update_mode is reused_current>
  readback_head_sha: <current artifact head sha or equivalent>
  read_before_update: true
  pre_update_body_evidence: <summary, hash, artifact note, or equivalent recovery evidence>
  readback_after_update: true
  preserved_manual_sections: true
  rollback_or_restore_evidence: <required when readback detects a bad update, otherwise none>
  evidence:
    - <artifact read/update/readback evidence>
  omitted_process_history: true
  omitted_private_artifacts: true
```

Validation should stay lightweight. It should reject missing
`description_policy`, missing owner, missing artifact/head evidence, missing
current-head readback evidence, or a status other than `passed` where a final
planning or delivery gate claims readiness. It should also reject
`update_mode: reused_current` unless a metadata-only materiality decision and
reuse rationale are present for the current artifact head.

## Acceptance

- `plan-review` documents the hosted-description gate as required before Nitro
  request and before `planning_review`.
- `plan-unit-delivery` documents the hosted-description gate as required before
  artifact-host review, Nitro request, and final delivery reporting.
- `skills/plan-review/agents/openai.yaml` and
  `skills/plan-unit-delivery/agents/openai.yaml` mirror the portable gate
  without becoming the normative source of truth.
- The final `planning_review` contract, template, and
  `validate-planning-review` validator include passed `description_policy`
  evidence tied to `review_artifact` and `reviewed_head`. The internal
  `plan_review_gate_ledger` may also carry the evidence, but downstream
  readiness cannot depend on the internal ledger alone.
- Script templates for `delivery_gate_ledger` include `description_policy`
  evidence.
- Validators reject final planning or delivery ledgers that omit the
  description-policy gate or mark it pending, stale, unavailable, or blocked.
- Validators reject `description_policy` evidence tied to a prior head after a
  material push.
- Validators reject `update_mode: reused_current` without a current-head
  metadata-only materiality decision and reuse rationale.
- Existing body update safety is explicit: read current hosted body, preserve
  manual content, update only managed or unambiguous sections, and ask or block
  when ownership is ambiguous.
- Existing body recovery is explicit: retain enough pre-update evidence to
  restore or block when readback detects lost manual content or a wrong-section
  update.
- Test evidence covers the process-history failure where "What Changed In The
  Plan" describes author iteration rather than current reviewer-facing scope.
- Test evidence covers bad-update recovery and stale prior-head evidence
  rejection.
- The implementation does not create committed readiness reports, reviewer
  reports, ledgers, screenshots, or private workflow sidecars.

## Verification

- `pnpm exec tsx skills/plan-review/scripts/plan-review.ts gate-template`
- `pnpm exec tsx skills/plan-unit-delivery/scripts/plan-unit-delivery.ts gate-template`
- Focused unit tests for the plan-review and plan-unit-delivery ledger
  validators.
- `$writing-skills` review against the changed skill behavior, including
  RED/GREEN evidence for the process-history-description failure shape.
- `pnpm run skills:validate`
- `pnpm run test`
- `pnpm ax skills validate --profile personal`
- `pnpm ax skills validate --profile work`
- `pnpm ax validate --profile personal`
- `pnpm ax validate --profile work`
- If the implementation refreshes live runtime copies, run
  `pnpm ax skills update --profile personal`, `pnpm ax skills update --profile
  work`, and then confirm with `pnpm ax skills status --profile personal` plus
  `pnpm ax skills status --profile work` or full profile validation.

## Risks

- The gate could become too command-specific and lose portability across Codex,
  Claude Code, and other coding harnesses. Keep pass conditions tied to hosted
  artifact state and evidence instead of a single command transcript.
- The gate could overreach into body linting. Keep v1 validation structural and
  let skill prose carry qualitative description guidance.
- Existing dirty workflow changes in the repo may overlap with plan-ready
  scripts. Implementation should inspect current diffs before editing and avoid
  reverting unrelated work.

## Recommended Delivery Route

Treat this as one atomic implementation unit. It has one system outcome, one
primary ownership area, and one verification story: plan workflow skills must
fail closed unless hosted description policy evidence is present and current.
