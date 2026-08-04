# Consolidate Agent Authority And Safety Boundaries

## Objective

Replace the four open, overlapping agent-safety MRs with one coherent change
that keeps agent action inside the user's accepted scope. The change must bind
conversational authority to the accepted outcome and action path, prevent later
narrow messages from silently expanding that authority, scope terminal merge
authority to exact artifacts, and add a runtime guard against shell deletion
outside the session working directory.

## Approach

- Make `rules/investigation-and-implementation.md` the canonical owner of the
  accepted-proposal contract. Entry points and lifecycle skills remain thin
  projections of that owner.
- Interpret assent from its clear conversational referent instead of prescribed
  confirmation words. Continue routine work to the selected delivery
  checkpoint, while preserving separate boundaries for material contract
  changes, credentials, destructive actions, merge, deployment, cleanup, and
  POC disposal.
- Reclassify each new user message before acting. A diagnostic observation,
  correction, or question does not authorize a broader action such as stack
  surgery, force-pushing, moving work between delivery units, changing shared
  infrastructure, or altering required delivery behavior.
- Treat merge authority as artifact-scoped and consumable. Generic merge
  authority covers one unambiguous current or named MR. A multi-MR sequence
  requires user-authored aggregate scope, and a material effective-diff change
  fails closed by invalidating the active aggregate scope.
- Keep executable Finish verification structured around already-resolved
  artifact scope. Do not create a general natural-language intent parser or
  give one confirmation word special authority.
- Add the reviewed `PreToolUse` deletion guard and AX-managed registration as
  defense in depth. It denies supported shell deletion commands unless every
  statically visible target stays inside the hook payload's `cwd`, while
  preserving unrelated hook configuration and app-owned Codex trust.

## Material Decisions And Constraints

- Deliver the complete outcome in one atomic plan and one final draft MR.
- The user explicitly accepts exceeding the normal file and line targets for
  this named consolidation. The combined review surface is intentionally large
  because splitting would preserve several simultaneously open and partially
  contradictory authority contracts, which is the condition this change must
  remove.
- Rebuild from current `main`; do not merge, rebase, or cherry-pick the old MR
  histories. Transfer their accepted behavior and regression evidence into one
  internally consistent implementation.
- Keep only this primary atomic plan. The three prior authority plans and the
  delete-guard plan remain historical MR artifacts and are not copied into the
  consolidated branch.
- Do not add dependencies. Do not synchronize feature-branch hooks into the
  live runtime. Live AX synchronization and Codex hook trust review occur only
  from clean merged `main` under their normal authority boundary.
- Publication and hosted feedback follow-through are in scope. Merge and live
  runtime activation are not.

## Reuse And Deviation Contract

Reuse the accepted-proposal mechanics and canonical ownership developed in MR
!225, the latest-message scope boundary and examples from MR !169, the
artifact-scoped merge invariants and executable cases from MR !223, and the
deletion hook, registration convergence, documentation, and isolated-runtime
proof from MR !205.

Extend the existing owners rather than retaining parallel mechanisms:

- `rules/investigation-and-implementation.md` owns work-authority semantics;
- `skills/finish` owns terminal-action projection and executable verification;
- `rules/git-and-review.md` and the stacked-diff skill own ordered Git effects;
- `hooks/` owns command guards; and
- AX runtime synchronization owns managed hook installation and registration.

The material deviation from the prior MRs is consolidation around structured
authority. MR !223's phrase-oriented resolver is not copied wholesale because
it would contradict MR !225's no-magic-vocabulary contract. MR !169's separate
named gate becomes a concrete rule inside the accepted-proposal owner. The
runtime deletion guard remains a separate implementation owner inside the same
delivery because it provides fail-closed enforcement for the destructive
boundary that prose alone cannot guarantee.

## Acceptance

- Clear assent to a presented bounded work path authorizes that path through its
  normal Plan, Execute, Review, and Finish checkpoint without another
  mode-transition prompt.
- Design-only agreement remains read-only, explicit narrow-mode wording caps
  the route, and material changes or human-only actions interrupt normally.
- A later observation, correction, question, or diagnostic fact cannot expand
  prior authority into a broad inferred action without a focused proposal.
- Consolidation or replacement authority does not close the existing MRs;
  artifact disposal requires its own exact-scoped proposal and acceptance.
- Terminal actions require a separately presented exact action and target. Any
  clear contextual assent may accept that proposal; no confirmation word has
  special meaning.
- Single-MR merge authority is consumed after that merge. Multi-MR authority
  requires user-authored aggregate scope and survives only patch-equivalent
  restacks. A material effective-diff change invalidates the active scope.
- The executable Finish contract fails closed on unknown or ambiguous artifact
  scope and covers single, aggregate, denial, contextual-assent, and material-
  change cases without acting as a general intent parser.
- The deletion guard allows supported in-`cwd` targets, denies external,
  traversing, symlink-following, and ambiguous targets, and leaves unrelated
  commands unaffected.
- AX hook synchronization converges exactly one owned Codex and Claude
  registration, preserves unrelated settings, reports registration drift, and
  leaves Codex trust app-owned.
- Shared instructions, skills, rules, documentation, executable contracts, and
  tests describe one consistent boundary with no retained parallel policy.

## First Real Confirmation

Run the authority pressure scenarios against the shared rule and Finish
contract. Confirm that ordinary assent continues an accepted task, a later
narrow diagnostic message cannot trigger broad stack mutation, one exact MR
merge is consumable, aggregate scope is required for a sequence, and a material
effective-diff change invalidates the affected scopes.

Then synchronize the actual deletion hook into an isolated HOME and runtime
root. Invoke it with one in-`cwd` deletion payload and one out-of-`cwd` payload,
observe allow and deny behavior respectively, and confirm `ax hooks validate`
passes while unrelated Codex and Claude configuration remains unchanged.

## Delivery

Publish this plan and implementation together in one draft GitLab MR targeting
`main`. Run the repository's native hook-enabled commit gate, exact-head local
review, GitLab hosted review, and every available current-head pipeline. After
the consolidated MR proves that all accepted behavior is retained, the four
older MRs are eligible to be closed as superseded under explicit provider
authority. Do not merge or activate the runtime from the feature branch.
