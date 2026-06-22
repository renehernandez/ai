## Context

The repo already separates review artifact routing from review feedback routing.
`review-feedback-routing` selects artifact hosts and provider adapters through
`artifact.create_adapter`, while `github-pr-create` and `glab-mr-create` own
provider CLI mechanics. The new behavior should preserve that boundary.

The problem is not provider mutation mechanics. The problem is that change
request descriptions can drift into author workflow bookkeeping, especially when
planning, subagent, and local verification workflows produce useful internal
evidence that is not useful to hosted reviewers.

## Goals / Non-Goals

**Goals:**

- Add `change-request-create` as a host-neutral skill for GitHub PR and GitLab
  MR creation or update.
- Keep full reviewer-facing description policy in the neutral entrypoint.
- Preserve project PR/MR templates and existing manually authored hosted body
  content.
- Consume `review-feedback-routing` for configured artifact host selection.
- Delegate mutation mechanics to `github-pr-create` or `glab-mr-create`.
- Add pressure scenarios that prove descriptions omit internal process/tooling
  references while preserving useful targeted evidence.

**Non-Goals:**

- Create provider-neutral CLI scripts or a generic provider adapter framework.
- Change Nitro review request semantics.
- Change hosted review feedback parsing.
- Change `review-feedback-routing` route semantics beyond documenting how the
  new skill consumes them.
- Mechanically rewrite existing hosted PR/MR descriptions unless an update flow
  is explicitly requested.

## Decisions

### Use `change-request-create` As The Description Policy Owner

The host-neutral skill owns the full body policy because it is the only layer
that sees neutral intent before provider routing. Provider adapters keep minimal
fallback rules for explicitly direct GitHub-only or GitLab-only requests.

Alternative considered: duplicate the full body policy in each provider adapter.
That risks drift between GitHub and GitLab, and it was the source of the current
maintenance pressure.

### Consume Routing Instead Of Replacing It

`change-request-create` reads route decisions from `review-feedback-routing` and
delegates to the selected provider adapter. It must not become an
`artifact.create_adapter` value itself, because that would make the routing layer
recursive and ambiguous.

Routing precedence for this workflow is:

1. existing PR/MR URL when updating an artifact;
2. explicit user-requested artifact host;
3. repo or machine review routing policy;
4. target push remote when routing has no match;
5. ask or block if host selection remains ambiguous.

### Preserve Templates And Existing Hosted Context

The skill should preserve template shape and reviewer-authored context rather
than replacing hosted descriptions wholesale.

GitHub templates are discovered from `.github/pull_request_template.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, and `.github/PULL_REQUEST_TEMPLATE/*.md`.
GitLab templates are discovered from provider/project defaults when available
and repo-local `.gitlab/merge_request_templates` conventions when present. If
multiple templates match without a user choice, the skill asks instead of
guessing.

For updates, the skill fetches the current title and body, preserves
user-authored reviewer context, resolved checklist state, links, and manually
added sections, then updates only clearly managed sections or asks before
replacement.

### Keep Evidence Reviewer-Relevant

Descriptions should answer what changed, why it changed, where reviewers should
focus, and what targeted evidence or hosted failure/status changes the review
decision.

Keep head-SHA-specific evidence, reproduction steps, fixture/migration/browser
checks, operational verification, reviewer-requested proof, failed hosted
checks, unavailable hosted status, stale review state, and required reviewer
status. Drop local paths, internal gates, subagent/planning workflow labels, and
routine validation already visible in CI or standard repo hooks.

## Risks / Trade-offs

- Over-scrubbing can remove useful targeted evidence. The keep/drop rubric must
  be explicit in the skill and pressure scenarios.
- Existing artifact updates can destroy reviewer context. The update path must
  preserve ambiguous human-authored content or ask before replacing it.
- Mixed GitHub/GitLab remotes can route incorrectly. Explicit artifact URL and
  review-routing precedence must be validated.
- Provider adapters can drift if they duplicate the full body policy. They
  should delegate neutral requests and retain only minimal direct-use fallback.
