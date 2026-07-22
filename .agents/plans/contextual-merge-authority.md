# Contextual Merge Authority

## Goal

Let `proceed` authorize the one merge action that the agent just presented as
the sole pending next action. Preserve the explicit authority gate when the
conversation does not identify one exact merge action and artifact scope.

## Approach

Treat merge authority as a turn-level contract rather than a magic-word
classifier. Explicit action wording continues to grant authority directly.
`Proceed` grants merge authority only when the immediately preceding agent turn
identifies one exact MR or MR-stack merge sequence as awaiting the user's
approval.

The contextual grant is narrow:

- it covers only the named merge action and artifact scope;
- it does not extend to another MR, a broader stack, deployment, cleanup, or
  any later terminal action;
- denial, qualification, or a competing instruction in the user response takes
  precedence;
- an ambiguous artifact, multiple proposed terminal actions, informational
  discussion, or an intervening turn requires explicit action wording; and
- project policy may still grant authority independently through the existing
  path.

## Scope

Align the repo and portable lifecycle instructions, Git and review rules,
Finish skill, executable Finish authority contract, and focused regression
coverage. Keep draft-by-default delivery, technical-readiness reporting,
exact-head gates, provider review, and post-merge follow-through unchanged.

Do not add persisted approval state, conversation storage, a new lifecycle
mode, broad intent inference, automatic merge policy, contextual deployment or
cleanup approval, or changes to deployment and cleanup safety. Do not revise
historical plan artifacts.

## Reuse And Deviation Contract

Finish remains the canonical owner of provider and terminal authority.
`skills/finish/scripts/finish-contract.ts` remains the executable regression
owner, and the existing lifecycle instruction and integration tests remain the
verification owners. The shared recommendation-bundle rule provides the
precedent for accepting a response in the context of the immediately preceding
agent turn.

Extend those owners with a bounded contextual-acceptance input. Do not create a
second authority resolver. The material deviation from the current precedent
is that plain `proceed` is no longer always publication-only: it may authorize
one merge action when the prior turn supplies the missing action and exact
artifact scope. This restores the original explicit-acknowledgement intent
without weakening context-free terminal gates.

## Acceptance

- After an agent states that exact MR `!219` is technically ready and presents
  marking that MR ready and merging it as the sole pending action, the user's
  immediate `proceed` authorizes that ready-and-merge sequence.
- `Proceed` without an immediately preceding single merge-action proposal
  retains publication and hosted-follow-through authority only.
- `Proceed` does not authorize a merge when the prior turn names multiple MRs
  without presenting one exact stack sequence, offers alternatives such as
  merge or deploy, discusses a hypothetical action, or leaves the artifact
  scope unclear.
- Contextual approval covers only the proposed action and artifact. Any later
  deployment, cleanup, additional MR, or stack action requires its own authority.
- Explicit phrases such as `merge MR !219`, `proceed to merge`, and `merge when
  green` retain their current behavior.
- The instructions no longer tell users to repeat a fixed phrase when
  `proceed` can unambiguously accept the pending merge action.

## Verification

- Focused unit assertions for the shared lifecycle instructions and Finish
  authority wording.
- Finish-contract integration scenarios for contextual `proceed`, explicit
  denial, standalone `proceed`, ambiguous proposals, multiple artifacts,
  contextual deployment and cleanup rejection, and explicit merge wording.
- `writing-skills` RED/GREEN pressure scenarios covering the exact MR `!219`
  exchange and ensuring the agent acts after the first unambiguous contextual
  approval without requesting magic wording.
- Repository formatting, type, unit, and integration validation selected by
  the changed shared instruction, skill, and TypeScript surfaces.

## Risk

An agent could overread `proceed` as merge authority. The guard is exact
contextual binding: one immediately preceding agent turn, one pending merge
action, and one exact artifact scope. If any element is missing or conflicting,
no contextual merge authority exists.

## First Real Confirmation

Run the Finish authority contract with a preceding turn that identifies MR
`!219` as technically ready and makes marking it ready and merging it the sole
pending action. The following user response `proceed` must resolve to merge
authority for MR `!219`. The paired standalone and ambiguous-context scenarios
must remain non-merge.

## Delivery

Deliver this plan and the coherent workflow correction together in one final
draft MR targeting `main`. No POC or OpenSpec is required. Publication and
hosted review follow the repository Finish policy; merging the final MR remains
outside this plan's authority.
