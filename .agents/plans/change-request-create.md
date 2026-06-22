# Change Request Create Plan

## Objective

Create a managed, host-neutral `change-request-create` skill that opens or
updates hosted change requests across GitHub pull requests and GitLab merge
requests. The skill should route to the correct provider adapter, preserve
repo-local templates, and produce reviewer-facing descriptions that omit
unnecessary internal process and tooling references.

## Background

The existing provider-specific skills cover GitHub PR creation and GitLab MR
creation. Their body guidance already discourages local-only artifacts, but the
creation workflow can still leak author workflow details into reviewer-facing
descriptions. A recent GitLab MR description included internal delivery gates,
local skill/script paths, and routine validation commands that did not help a
reviewer understand the change.

External skill review added useful patterns:

- Cline's `create-pull-request` skill emphasizes reading project PR templates,
  inferring context from branch names, commits, and diffs before asking, and
  using body files for complex Markdown.
- GitHub's `my-pull-requests` skill emphasizes purpose, details, review state,
  and actionable CI failure reporting.

## Proposed Shape

Add `change-request-create` as the host-neutral entrypoint.

Responsibilities:

- Select the intended hosted artifact route by consuming
  `review-feedback-routing` and its configured `artifact.create_adapter` result.
- Ask or block when GitHub/GitLab routing remains ambiguous.
- Gather description context from branch name, commits, diff stat, changed
  files, linked issues, existing artifact state, hosted checks gathered by the
  host inspect adapter when needed, and repo templates.
- Compose or update the change-request description using shared reviewer-facing
  body policy.
- Delegate provider-specific creation/update mechanics to `github-pr-create` or
  `glab-mr-create`.

Routing precedence:

1. Existing PR/MR URL when updating an artifact.
2. Explicit user-requested artifact host.
3. Repo or machine review routing policy, using the same source order as
   `review-feedback-routing`.
4. Target push remote when review routing has no match.
5. Ask or block when host selection remains ambiguous.

`change-request-create` must not become a `create_adapter` value in
`review-routing.yaml`; provider adapters remain the `create_adapter` targets.
The router consumes route selection and delegates to the selected adapter.

Keep provider adapters focused on CLI mechanics:

- `github-pr-create` handles GitHub auth, branch/base detection, duplicate PR
  checks, push/head handling, draft/readiness flags, labels, reviewers, and
  `gh` command details.
- `glab-mr-create` handles GitLab auth, target/source branch detection,
  duplicate MR checks, push handling, draft/readiness flags, labels, reviewers,
  squash/remove-source-branch conventions, and `glab` command details.

## Description Policy

The description should answer:

- What changed?
- Why did it change?
- Where should reviewers focus?
- What targeted evidence or hosted failure/status changes the review decision?

The description should preserve repo templates when present, then fill them
with scrubbed reviewer-facing content. If a template includes checklist items,
complete only the entries that provide reviewer value and avoid exposing local
workflow machinery.

Template and update safety rules:

- Discover GitHub templates from `.github/pull_request_template.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, and
  `.github/PULL_REQUEST_TEMPLATE/*.md`; use a default template when one is
  unambiguous, and ask when multiple templates match without a user choice.
- Discover GitLab templates from provider/project defaults when available and
  repo-local `.gitlab/merge_request_templates` conventions when present.
- Preserve required template section shape and checklist semantics while
  replacing filler with concise reviewer-facing content.
- For existing PR/MR updates, fetch the current title and body, preserve
  user-authored reviewer context, resolved checklist state, links, and manually
  added sections, then update only clearly managed sections or ask before
  replacing ambiguous content.

Omit unnecessary references anywhere in the body, including:

- local absolute paths;
- skill names, internal scripts, subagent gates, planning gates, and internal
  process labels;
- routine formatter, linter, typecheck, pre-commit, pre-push, or diff hygiene
  checks when CI or repo hooks already represent that validation style;
- hosted check summaries when the platform already shows routine green checks.

Include evidence when it changes reviewer confidence:

- targeted behavior tests or reproduction checks for the changed behavior;
- migration, fixture, browser route, or operational verification that is not
  obvious from routine CI;
- hosted failures, pending or unavailable checks, missing checks, downstream
  verification state, required reviewer status, stale hosted review evidence, or
  head-SHA-specific review evidence.

Keep/drop rubric:

- Keep head-SHA-specific evidence, reproduction steps, fixture/migration/browser
  checks, operational verification, reviewer-requested proof, failed hosted
  checks, unavailable hosted status, and required reviewer status.
- Drop local file paths, internal gates, routine local validation, and validation
  already visible in routine CI or repo hook style.
- Include GitHub checks/workflow runs/reviews and GitLab
  pipelines/jobs/discussions/approval rules/Nitro latest-head evidence only
  when the fact affects review or merge confidence.

## Suggested OpenSpec Change

Suggested ID: `add-change-request-create`

Title: Managed change request creation

Spec areas:

- New capability: change request creation.
- New OpenSpec spec: `change-request-creation`.
- Affected OpenSpec spec: `review-first-plan-orchestration` for shared rule and
  runtime alignment only.
- Routing input: `review-feedback-routing` skill and `review-routing.yaml`.

Proposed requirements:

- Change request creation SHALL route to GitHub or GitLab from explicit artifact
  URL, explicit user host, configured review routing, or target push remote in
  that precedence order.
- Change request creation SHALL ask or block when artifact host selection is
  ambiguous.
- Change request creation SHALL consume `review-feedback-routing` as the source
  of truth for configured artifact route selection and SHALL delegate to the
  provider-specific `artifact.create_adapter`.
- Change request creation SHALL NOT redefine review feedback policy, Nitro
  routing, route precedence inside `review-feedback-routing`, or hosted feedback
  parsing.
- Change request creation SHALL preserve project PR/MR templates when present.
- Change request creation SHALL preserve existing PR/MR title and body content
  that appears user-authored or reviewer-authored, updating only clearly managed
  sections unless the user approves replacement.
- Change request creation SHALL compose descriptions from inferred branch,
  commit, diff, issue, template, hosted status, and verification context before
  asking for missing details.
- Change request descriptions SHALL omit unnecessary internal process and
  tooling references anywhere in the body.
- Change request descriptions SHALL omit routine validation evidence when it is
  already represented by CI, hooks, or standard repo validation style.
- Change request descriptions SHALL include targeted evidence, hosted failures,
  missing hosted checks, or required reviewer status when those facts affect
  review or merge confidence.
- Provider adapters SHALL delegate host-neutral PR/MR creation or update
  requests to `change-request-create` and retain only provider-specific mechanics
  plus minimal safe fallback body guidance for explicitly direct use.
- Skill behavior SHALL be validated with documented RED/GREEN pressure
  scenarios covering GitLab leak rejection, GitHub template preservation, hosted
  failure inclusion, existing artifact update, and ambiguous remote blocking.
- Shared review rules SHALL expose the same reviewer-facing description contract
  outside local-only skill discovery.

## Implementation Slices

### 1. Define OpenSpec Contract And Route Boundaries

Deliverable: Materialize the OpenSpec change with a new
`change-request-creation` spec and any narrowly required
`review-first-plan-orchestration` delta for shared rule/runtime alignment.

Acceptance:

- The spec states the routing precedence in observable terms.
- The spec says `change-request-create` consumes `review-feedback-routing` and
  delegates to provider `create_adapter` skills.
- The spec keeps review feedback policy, Nitro routing, hosted feedback parsing,
  and generic adapter frameworks out of scope.
- The spec includes Given/When/Then scenarios for mirrored remotes, explicit URL
  override, ambiguous routing, existing artifact update, template preservation,
  description scrubbing, and hosted failure inclusion.

Verification:

- `pnpm ax openspec validate`

### 2. Add Contract-Only Host-Neutral Skill

Deliverable: Add `skills/change-request-create/SKILL.md` with routing,
description policy, template preservation, context gathering, ambiguity handling,
and provider delegation guidance.

Acceptance:

- The skill names `change-request-create` as the host-neutral entrypoint.
- The skill frontmatter includes `name`, a `description` that starts with
  `Use when`, and only supported keys.
- The skill routes GitHub PR and GitLab MR creation/update through the existing
  provider adapter skills.
- The skill contains the shared description scrub policy and reviewer-facing
  evidence rules.
- The skill is contract-only: no new shared scripts, hosted-status fetchers,
  provider-neutral CLI helpers, or generic provider framework.

Verification:

- `pnpm run skills:validate`
- `pnpm ax skills validate --profile personal`
- `pnpm ax skills validate --profile work`
- Manual skill review against the GitLab MR description leak scenario.

### 3. Align Durable Rules And Provider Adapter Guidance

Deliverable: Update `rules/git-and-review.md`, and any required
`rules/feature-delivery.md` or skill trigger wording, plus
`skills/github-pr-create/SKILL.md` and `skills/glab-mr-create/SKILL.md`.

Acceptance:

- Durable rules identify `change-request-create` as the artifact-host-neutral
  create/update entrypoint.
- Provider adapters delegate neutral requests to `change-request-create`.
- Direct provider adapter descriptions retain minimal safe direct-use body
  guidance without duplicating the full router policy.
- Provider adapters use the safest provider-supported body transport when
  receiving a composed body, such as body files for complex Markdown.
- Artifact-host-agnostic plan delivery and review workflows can discover the new
  entrypoint, while explicit GitHub-only or GitLab-only requests remain direct
  adapter use cases.

Verification:

- `pnpm run skills:validate`
- `pnpm ax skills validate --profile personal`
- `pnpm ax skills validate --profile work`
- Manual comparison of GitHub and GitLab adapter guidance for consistent body
  policy boundaries.

### 4. Add Pressure Scenarios And Validation Coverage

Deliverable: Add or update skill validation scenarios so the behavior is
pressure-tested before runtime refresh.

Acceptance:

- A GitLab MR scenario based on the leaked description rejects internal process
  labels, local paths, and routine validation commands.
- A GitHub PR scenario preserves a repo template while omitting unnecessary
  internal tooling and routine validation details.
- A hosted failure scenario includes the relevant failing check and reviewer
  action context.
- An ambiguous remote scenario asks or blocks instead of choosing the first
  remote.
- An existing PR/MR update scenario preserves hand-authored reviewer notes,
  resolved checklist state, and manual links.
- A multi-template scenario asks when the correct template is ambiguous.
- A routine local typecheck is omitted when CI covers it, while a targeted
  regression command is retained.

Verification:

- RED/GREEN pressure-test transcript or fixture evidence for the listed
  scenarios.
- `pnpm run skills:validate`
- `pnpm test:unit`
- `pnpm test`

### 5. Run Shared Skill Review And Runtime Surface Gates

Deliverable: Run the shared-skill review and live-surface verification required
for changed shared skill, rule, and instruction behavior.

Acceptance:

- `writing-skills` review has no unresolved actionable findings for the changed
  skill behavior.
- Personal and work skill validation passes.
- If live runtime refresh is intended, installed skill copies are refreshed and
  status confirms the active surfaces.

Verification:

- `pnpm ax skills validate --profile personal`
- `pnpm ax skills validate --profile work`
- `pnpm ax skills update --profile personal`
- `pnpm ax skills update --profile work`
- `pnpm ax skills status --profile personal`
- `pnpm ax skills status --profile work`

## Out Of Scope

- Creating provider-neutral CLI scripts or a generic platform adapter framework.
- Mechanically rewriting existing hosted PR/MR descriptions.
- Changing Nitro review request semantics.
- Changing hosted review feedback parsing.
- Changing `review-feedback-routing` route semantics, except documenting how the
  new router consumes them.
- Changing runtime install/update behavior beyond normal shared-skill refresh
  and status verification.

## Risks

- Over-scrubbing could remove useful targeted evidence. The policy should allow
  targeted behavior evidence and hosted failure/status details when they change
  reviewer confidence.
- Template preservation can conflict with body minimization. The router should
  preserve section shape but populate it with concise reviewer-facing content.
- Routing ambiguity is easy to mishandle in mirrored repositories. The router
  should prefer explicit artifact URLs for updates and configured review routing
  for creation, then ask or block if the host remains unclear.
- Existing description updates can destroy reviewer context if the body is
  treated as disposable. The update path should preserve user-authored and
  reviewer-authored content unless replacement is clearly safe or explicitly
  approved.
