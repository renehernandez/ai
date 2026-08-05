# Close POC Publication Permission Loopholes

## Objective

Prevent accepted OpenSpec POC work from stopping for renewed permission at an
internal first-objective Review barrier or before creating its required draft
PR/MR. Preserve exact destination-bound confirmation for the narrower set of
GitLab and Linear conversational messages submitted through Rene Hernandez's
identity.

## Accepted Contract

- An accepted POC route continues through complete draft technical readiness
  and personal acceptance unless a later action exceeds that route or introduces
  a material contract decision.
- The first-objective checkpoint is a mutation barrier while Review is
  unresolved, not a user-approval checkpoint. A pass resumes the accepted POC;
  contract-preserving findings return automatically to Execute; material
  architecture, ownership, scope, safety, migration, delivery, or proof changes
  return to Plan and the user.
- A completed hook-clean POC publishes its required draft review-only PR/MR,
  requests hosted review, and then receives completed-code Review against that
  exact hosted head. Completed-POC Review gates technical readiness, not initial
  draft creation.
- PR/MR titles and descriptions are hosted artifact metadata, not covered
  conversational provider messages. Their creation or update proceeds through
  `change-request-create` under existing Finish authority without a separate
  destination-bound confirmation.
- Destination-bound confirmation remains mandatory for GitLab and Linear
  comments, notes, discussion replies, issue comments, and project updates
  submitted through Rene's identity. Command-only review notes, service-generated
  output posted through a distinct service identity, commits, PR/MR titles or
  descriptions, issue bodies, and historical messages remain outside that checkpoint.
- Personal acceptance remains an exact-head POC judgment after local and hosted
  evidence is current. Merge, deployment, POC closure, runtime activation, and
  cleanup remain separately scoped terminal actions.

## Reuse And Deviation Contract

Reuse `rules/investigation-and-implementation.md` as the canonical owner of
accepted-proposal continuation and POC lifecycle routing. Reuse
`rules/git-and-review.md` as the canonical owner of destination-bound provider
message confirmation. Align `execute`, `finish`, and `change-request-create` as
specialist mirrors of those owners rather than adding another authority store,
approval state, lifecycle mode, or publication mechanism.

The only deviation from shipped behavior is eliminating two accidental user
checkpoints: one after a passing first-objective Review and one before an
authorized PR/MR description is published. The existing material-decision,
human-message, credential, merge, deployment, disposal, and cleanup boundaries
remain unchanged.

## Delivery Shape

Deliver one atomic plan-plus-implementation MR targeting `main`. The rule,
skill, and regression changes implement one authority-continuation contract
with one rollback and review boundary. No OpenSpec or disposable POC is needed.
The expected footprint is the plan plus the two canonical rules, three
specialist skills and provider handoffs, and focused tests. The provider
handoffs are inseparable because stale approval vocabulary there can recreate
the same prompt after the owning skill has routed publication.

## Acceptance

- After an accepted POC reaches a passing first-objective checkpoint, the next
  action is remaining POC implementation rather than a request to accept the
  proof or authorize expansion.
- Contract-preserving first-proof findings are repaired and re-reviewed without
  renewed permission; a material contract finding still returns for one focused
  decision.
- After the completed POC is hook-clean and the provider route is known, Finish
  creates the draft review-only PR/MR without previewing its title or description
  for approval.
- Draft publication precedes completed-code Review; local Review, configured CI,
  and hosted automated review converge on the exact hosted head before personal
  acceptance.
- GitLab and Linear conversational prose through Rene's identity still stops on
  the exact destination-bound draft and disclosure notice before submission.
- Tests distinguish the whole message-confirmation checkpoint from mere notice
  placement and explicitly exempt PR/MR titles or descriptions and issue bodies.
- No changed guidance weakens provider routing, template preservation, hosted
  readback, personal POC acceptance, or terminal-action authority.

## Verification

- RED pressure scenario derived from task
  `019fcd53-a12d-7171-94c0-a8979b46e333`: accepted complete POC, passing
  first-objective Review, remaining units ready. Capture whether current skills
  ask for acceptance or continue automatically.
- RED pressure scenario from the same task: completed hook-clean POC, known
  GitLab route, finalized template-safe title/body. Capture whether current
  skills preview the description or create the draft.
- GREEN reruns of both scenarios against the revised skills, plus controls for a
  material first-proof finding and a covered GitLab discussion reply.
- REFACTOR pressure combining deadline, ambiguity in the word `approved`, and
  the broad phrase `human-readable message` to prove the specialist skills use
  the canonical boundaries instead of inventing another prompt.
- Focused agent-instruction source-contract tests, skill validation, repository
  formatting and type validation, and native hook-enabled commit verification.
- Run `writing-skills` RED, GREEN, and REFACTOR scenarios before publication and
  record their outcomes task-locally.

## First Real Confirmation

Exercise the accepted-POC sequence through the real agent instruction surfaces.
The visible result after a passing first-objective Review must be continued POC
implementation, and the visible result after a completed hook-clean POC must be
a created draft PR/MR followed by hosted-head Review. Neither path may ask for
renewed permission. The paired covered-comment control must still stop with the
exact destination and rendered disclosure-bearing draft.

## Risks

- Over-broad exemption could let agents post conversational prose without Rene's
  confirmation. Keep the covered message list explicit and canonical.
- Over-broad continuation could hide a material architecture decision. Preserve
  the semantic finding classifications and return material changes to Plan.
- Ambiguous publication terminology could reintroduce review-before-creation
  ordering. Use `draft publication` and `technical readiness` consistently.
- Source assertions alone may pass while agents still rationalize a stop. Pair
  them with behavioral pressure tests under `writing-skills`.
