## Why

PR and MR descriptions should help reviewers understand the change, the risk,
and the evidence. Current provider-specific creation skills contain similar
body guidance, but host-neutral requests can still leak local agent workflow
details into reviewer-facing descriptions: internal skill paths, subagent or
planning gates, routine validation commands, and local process labels.

We need one managed change-request entrypoint that routes GitHub PR and GitLab
MR creation or update through existing provider adapters, preserves project
templates, and keeps the full reviewer-facing description policy in one place.

## What Changes

- Add a new `change-request-create` skill as the artifact-host-neutral entrypoint
  for creating or updating GitHub PRs and GitLab MRs.
- Add a new `change-request-creation` OpenSpec capability that defines route
  precedence, template preservation, existing body update safety, and
  description scrub behavior.
- Align `github-pr-create` and `glab-mr-create` as provider adapters that keep
  provider mechanics and minimal direct-use fallback body guidance.
- Align durable review rules so the same reviewer-facing body contract is
  available outside local-only skill discovery.
- Add RED/GREEN pressure scenarios for the leaked GitLab description case,
  GitHub template preservation, existing artifact updates, ambiguous routing,
  multi-template projects, and hosted failure reporting.

## Capabilities

### New Capabilities

- `change-request-creation`: host-neutral creation and update of reviewer-facing
  change request artifacts across GitHub PRs and GitLab MRs.

### Modified Capabilities

- `review-first-plan-orchestration`: shared rule and runtime alignment for the
  new change-request creation entrypoint and required shared-skill validation
  gates.

## Impact

- `skills/change-request-create` becomes the neutral entrypoint for “create or
  update the PR/MR” requests when the artifact host is not explicitly fixed by
  the user.
- `skills/github-pr-create` and `skills/glab-mr-create` remain the provider
  mutation adapters.
- `rules/git-and-review.md` and any necessary adjacent workflow wording will
  point host-neutral artifact creation/update to `change-request-create`.
- Runtime validation includes skill validation, `writing-skills`, RED/GREEN
  pressure evidence, and installed-surface update/status checks when live refresh
  is intended.
