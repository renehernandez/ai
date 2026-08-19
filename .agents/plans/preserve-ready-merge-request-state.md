# Preserve Ready Merge Request State

## Goal

Once a pull or merge request is marked ready, keep it ready unless Rene
specifically asks to return that exact request to draft.

## Approach

- Extend `rules/git-and-review.md`, the canonical provider-state owner, with an
  explicit one-way ready-state rule.
- Align the repo and portable entrypoints plus the Finish and stacked-diff
  execution guidance so repair, restack, base movement, CI failure, review
  feedback, and revalidation preserve an already-ready request's state.
- Preserve the existing default that new and technically ready requests remain
  draft until merge authority marks them ready.
- Add contract coverage that distinguishes a never-ready draft from an
  already-ready request.

## Reuse And Deviation Contract

Reuse `rules/git-and-review.md` as the canonical owner and the existing
entrypoint, Finish, and stacked-diff surfaces as consumers. No new state,
command, automation, or provider mechanism is introduced. The only deviation
from current behavior is that workflow pressure can no longer infer a
ready-to-draft transition; the exact request-scoped user instruction is the
sole authority for that transition.

## Scope

In scope: shared Git and review policy, its concise entrypoint summaries,
Finish and stacked-diff guidance, and focused contract tests.

Out of scope: when an MR may first become ready, merge authority, CI or review
gates, automated GitLab state enforcement, and changing requests that have
never been marked ready.

## Acceptance

- A request that has never been marked ready follows the existing draft-first
  lifecycle.
- An already-ready request stays ready across pushes, repairs, restacks, target
  movement, failed or pending CI, review findings, and renewed validation.
- Only Rene's specific request to return the exact pull or merge request to
  draft authorizes that transition.
- Canonical policy and execution guidance express the same rule without
  weakening merge or readiness gates.

## Verification

- Focused unit contract tests for the canonical, entrypoint, Finish, and
  stacked-diff surfaces.
- Charter validation and repository formatting.
- `writing-skills` RED/GREEN pressure test using an already-ready MR with a new
  HEAD, failing CI, restack pressure, and no user draft request.
- Exact `origin/main..HEAD` diff review before the direct push.

## Risk

GitLab may continue to present an invalid ready MR as mergeable until its gates
update. The rule preserves ready state but does not bypass current-head CI,
review, approval, or merge guards.

## First Real Confirmation

Repeat the baseline pressure scenario with the revised sources. The agent must
keep the already-ready MR ready, block merge on stale or failing gates, and
require a specific user request before returning it to draft.

## Delivery

Commit the plan and implementation together on `main` and push the exact commit
directly to the GitLab `origin` URL under the user's explicit exception. Do not
publish to the GitHub mirror and do not create an MR.
