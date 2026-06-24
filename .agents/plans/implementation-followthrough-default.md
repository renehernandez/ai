# Implementation Followthrough Default

## Goal

Make accepted implementation work end with hosted-review-ready delivery by
default. When a user asks an agent to implement, fix, build, apply changes, or
address review feedback, the agent should verify the result, commit through the
repo-approved commit path, push the working branch upstream, and create or
update a PR or MR when the project has a hosted-review workflow.

For Fullscript GitLab repositories that use Nitro, the delivery flow must also
request Nitro review with `/request_review @nitro` after MR creation and after
material follow-up pushes.

## Motivation

Agents currently read broad safety guidance such as "do not commit or push
unless explicitly asked" before they read narrower delivery guidance. That can
lead an agent to stop after local implementation and verification, forcing Rene
to issue a second prompt for commit and push. The intended behavior is that
agreeing to implementation work includes ordinary feature-branch publication and
hosted review routing, while still preserving safeguards for default branches,
force pushes, unrelated user changes, secrets, generated noise, and unresolved
verification or product decisions.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Accepted implementation work | A user request or delivery workflow step that asks the agent to implement, fix, build, apply changes, or address review feedback. Brainstorming, design agreement, troubleshooting-only investigation, code review without an edit request, `plan-ready` output, OpenSpec proposal creation, planning review, and other planning-gate states are excluded until the user or workflow enters an implementation or delivery step. |
| Done with implementation | The local diff has been made, reviewed enough for handoff, and verified as far as practical for the repo. |
| Push upstream | Push the current non-default source branch to its configured remote, usually GitLab `origin` in Fullscript repositories. This never means pushing `main` or `master` without explicit permission. |
| Hosted-review workflow | A project convention that expects a GitHub PR or GitLab MR before delivery is considered review-ready. Provider selection follows project instructions, existing artifact URLs, and `change-request-create` for host-neutral requests; agents pause when the provider remains ambiguous. |
| Nitro review | A Fullscript GitLab-only review request made by posting `/request_review @nitro` on the MR. Nitro review rules do not apply on personal machines, personal GitHub repositories, repositories where Nitro is unavailable, or non-Fullscript GitLab contexts. |

## Scope

### In Scope

- Update portable user-level instructions in `instructions/AGENTS.md`.
- Update repo-local instructions in `AGENTS.md`.
- Update implementation-routing rules in
  `rules/investigation-and-implementation.md`.
- Update git and hosted-review rules in `rules/git-and-review.md`.
- Update Fullscript Nitro review rules in
  `rules/fullscript/nitro-review.md`.
- Clarify that accepted implementation work includes ordinary feature-branch
  commit and push followthrough by default.
- Clarify that PR or MR creation/update is part of completion when the project
  has a hosted-review workflow.
- Clarify hosted-review provider selection: project instructions and existing
  artifact URLs decide the provider; host-neutral requests route through
  `change-request-create`; unresolved provider ambiguity pauses publication.
- Keep Nitro review requests scoped to Fullscript GitLab repositories where
  Nitro is available, preserving the existing exclusions for personal machines,
  personal GitHub repositories, and repositories where Nitro is unavailable.
- Keep detailed implementation followthrough behavior in central rule files,
  with `AGENTS.md` and `instructions/AGENTS.md` acting as concise entrypoints
  that route agents to those rules.
- Preserve existing safeguards for default-branch pushes, force pushes,
  unrelated user changes, secrets, generated noise, destructive commands,
  dependency installs, unresolved verification failures, and product decisions.
- Run writing-skills review because this changes shared agent behavior.
- Refresh and validate only the affected installed runtime instruction profile
  surfaces for both `personal` and `work` after the source changes are
  implemented, because this portable behavior should apply everywhere while the
  Fullscript Nitro rider remains work-scoped.

### Out Of Scope

- Implementing hooks or command enforcement for automatic commits.
- Changing `ax commit` behavior.
- Changing Nitro itself.
- Changing project-specific branch protection or CI configuration.
- Automatically merging PRs or MRs.
- Pushing default branches without explicit user permission.
- Force pushing ordinary follow-up work.
- Requiring Nitro review outside Fullscript GitLab repositories.

## Desired Behavior

When accepted implementation work is complete, the agent should:

1. Run the repo's relevant verification or clearly report any blocked
   verification.
2. Inspect the working tree for unrelated user changes, secrets, generated
   noise, or other unsafe publish contents.
3. Stage only the intended files.
4. Commit through the repo-approved path, such as `ax commit` when that rule is
   active.
5. Push the current non-default source branch upstream.
6. Create or update a PR or MR when the project has a hosted-review workflow,
   resolving the provider through project instructions, existing artifact URLs,
   or `change-request-create` for host-neutral requests.
7. Inspect CI or no-pipeline state when a hosted artifact exists.
8. In Fullscript GitLab repositories that use Nitro, request Nitro review after
   MR creation and after material follow-up pushes unless the user opted out,
   Nitro is unavailable, or a review is already in flight for the same diff.

The agent should pause and ask before publishing when:

- the target push is `main`, `master`, or another protected default branch;
- the workflow requires a force push or history rewrite;
- the diff includes unrelated user changes;
- the diff may include secrets or private generated noise;
- branch-caused local verification or CI failures remain unfixed;
- verification is blocked by an external/tooling limitation that cannot be
  disclosed clearly in the PR/MR or final handoff;
- any verification failure or limitation requires a product or delivery
  decision;
- hosted-review provider selection is ambiguous;
- the user explicitly asked for local-only work, planning, brainstorming,
  troubleshooting, or review-only output.

If verification is blocked by external state or missing local tooling and no
safety or product decision is pending, the agent may publish only after
disclosing the limitation in the PR/MR description or final handoff.

## Implementation Tasks

### 1. Portable and Repo-Local Entrypoints

- [ ] 1.1 Reword the broad no-commit/no-push safety rule in
  `instructions/AGENTS.md` so it allows ordinary implementation followthrough
  on feature branches.
- [ ] 1.2 Apply the same rewording to the repo-local `AGENTS.md`.
- [ ] 1.3 Keep destructive commands, dependency installs, default-branch
  pushes, and force pushes behind explicit user permission.
- [ ] 1.4 Keep `AGENTS.md` and `instructions/AGENTS.md` concise: update only
  the top-level safety and permission wording and point to the rule files; do
  not duplicate the completion checklist, pause-condition list, GitLab MR
  mechanics, or Nitro command details there.

### 2. Implementation Completion Contract

- [ ] 2.1 Update `rules/investigation-and-implementation.md` to define accepted
  implementation work and the default completion contract by replacing or
  reworking the existing "non-feature implementation work" commit/push boundary
  so the file has one coherent publication rule instead of two overlapping
  concepts.
- [ ] 2.2 Keep brainstorming, planning, troubleshooting, and review-only modes
  excluded from automatic commit and push.
- [ ] 2.3 Name the pause conditions for unsafe publish contents or unresolved
  verification/product decisions.
- [ ] 2.4 Explicitly exclude plan approval, `plan-ready` output, OpenSpec
  proposal creation, planning review, and troubleshooting findings until the
  user or workflow enters an implementation or delivery step.

### 3. Git, Hosted Review, and Nitro Routing

- [ ] 3.1 Preserve the existing `rules/git-and-review.md` feature-work
  completion behavior, which already covers verification, commit, branch push,
  PR/MR create/update, CI monitoring, and branch-caused failure followthrough;
  only tighten it where needed for hosted-review provider selection or
  interaction with the AGENTS entrypoint precedence fix.
- [ ] 3.2 Keep default-branch pushes and force pushes protected by explicit
  permission.
- [ ] 3.3 Update hosted-review provider guidance so project instructions,
  existing artifact URLs, and `change-request-create` decide between GitHub PRs
  and GitLab MRs for host-neutral requests; pause if ambiguity remains.
- [ ] 3.4 Require branch-caused verification and CI failures to be fixed before
  publish; allow publish with blocked external verification only when the
  limitation is disclosed and no safety, product, or delivery decision is
  pending.
- [ ] 3.5 Update `rules/fullscript/nitro-review.md` so Nitro request and
  re-request behavior is clearly Fullscript GitLab-only and triggered by MR
  creation or material follow-up pushes.
- [ ] 3.6 Preserve the existing Nitro exclusions for personal machines,
  personal GitHub repositories, and repositories where Nitro is unavailable.

### 4. Runtime and Review Validation

- [ ] 4.1 Run writing-skills review against the changed instruction/rule
  behavior before committing.
- [ ] 4.2 Run the repo's relevant formatting, tests, or validation commands for
  instruction and rule changes.
- [ ] 4.3 Refresh only the affected installed runtime instruction profile
  surfaces with `pnpm ax instructions update --profile personal` and
  `pnpm ax instructions update --profile work`.
- [ ] 4.4 Validate and inspect the refreshed profiles with
  `pnpm ax instructions validate --profile personal`,
  `pnpm ax instructions validate --profile work`,
  `pnpm ax instructions status --profile personal`, and
  `pnpm ax instructions status --profile work`.
- [ ] 4.5 Stop and report if runtime refresh mutates hooks, skills, OpenSpec
  assets, installer code, or unrelated runtime state.

## Acceptance Criteria

- Agents reading the updated instructions can tell that accepted implementation
  work should not stop at a local diff.
- Agents still know they must ask before default-branch pushes, force pushes,
  destructive commands, dependency installs, unrelated-change publication, or
  product-decision failures.
- Plan approval, `plan-ready`, OpenSpec proposal creation, planning review, and
  troubleshooting findings do not by themselves authorize commit and push.
- Hosted-review provider selection follows project instructions, existing
  artifact URLs, or `change-request-create`; ambiguous provider selection
  pauses publication.
- Branch-caused verification and CI failures must be fixed before publish;
  blocked external verification may be published only when clearly disclosed
  and no safety, product, or delivery decision is pending.
- The central rule files and concise AGENTS entrypoints agree on the
  implementation completion contract.
- Detailed implementation followthrough behavior has a single source of truth
  in central rule files; AGENTS entrypoints summarize and route to those files.
- Nitro review routing remains limited to Fullscript GitLab repositories where
  Nitro is available.
- The plan remains one atomic delivery because it changes one behavioral
  contract across existing instruction surfaces.

## Verification

- `pnpm run biome:check`
- `pnpm run test:unit`
- `writing-skills` review of the changed instruction and rule behavior
- `pnpm ax instructions update --profile personal`
- `pnpm ax instructions update --profile work`
- `pnpm ax instructions validate --profile personal`
- `pnpm ax instructions validate --profile work`
- `pnpm ax instructions status --profile personal`
- `pnpm ax instructions status --profile work`
