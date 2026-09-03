# Block Agent Force Pushes

## Goal

Preserve the implementation and repair history of an open change request by
preventing agents from publishing rewritten Git history. When the target branch
moves upstream, automated reconciliation uses an additive merge commit and a
normal fast-forward push instead of rebasing and force-pushing the feature
branch.

The first visible proof is an agent shell guard that rejects every recognized
force-push form with guidance to stop, report the branch and local/remote heads,
and either merge the target branch additively or hand a genuinely linear-history
rewrite to the user.

## Selected Approach

Make force-push publication human-only across the portable agent workflow.
Strengthen the canonical Git and authority rules so automatic implementation,
feedback repair, CI repair, restacking, and upstream reconciliation never grant
an agent force-push authority. Reconcile an updated target branch by merging it
into the feature branch, resolving conflicts, committing normally, and pushing
without force.

Add an AX-managed `PreToolUse` shell guard for Codex and Claude. The guard denies
agent commands that express forced Git publication, including `--force`, `-f`,
`--force-with-lease`, and force refspecs such as `+HEAD:<branch>`, including
supported literal wrappers. Its denial explains the additive merge path and the
evidence required when stopping for a human-owned rewrite.

The guard has no bypass for conversational authorization. An explicit user
request can reserve a rewrite for the user, but does not make an agent-side
force push executable. Local Git operations that do not publish rewritten
history remain available; agents should not locally rebase a branch that they
are expected to publish automatically.

## Ownership, Reuse, and Deviation

- Extend `rules/git-and-review.md` as the canonical owner of branch safety and
  publication behavior.
- Keep the portable `instructions/AGENTS.md`, repository entrypoint, Finish
  behavior, and stacked-diff guidance aligned with that canonical rule rather
  than creating another authority model.
- Reuse the existing repository-relative TypeScript hook source, AX hook
  registration, Codex/Claude synchronization, discovery metadata, structured
  deny response, and isolated-runtime verification patterns.
- Add one new hook because the current deletion guard owns filesystem deletion,
  not Git publication. Combining unrelated command policies would weaken hook
  ownership and diagnostics.
- This deliberately replaces the current exception that lets agents
  force-push for authorized rebases or conflict recovery. Additive merge commits
  are the automatic reconciliation mechanism; linear-history rewrites become a
  human boundary.

## Observable Behavior

1. Ordinary agent commits and fast-forward pushes continue unchanged.
2. When a target branch advances, the agent fetches it, merges it into the
   feature branch, resolves conflicts, creates a normal commit, and pushes
   without force.
3. Agent shell commands cannot force-push through long options, short options,
   lease options, or a leading-plus refspec.
4. A blocked attempt tells the agent to stop rather than search for a bypass.
   The report includes the repository, feature branch or detached state,
   matching PR/MR, target branch, local head, remote head, and why additive
   reconciliation is insufficient.
5. Human terminal use remains unaffected because enforcement is registered on
   agent tool surfaces rather than installed as a repository Git `pre-push`
   hook.
6. The guard is documented as an intercepted-shell guardrail, not an operating-
   system or provider-side security boundary.

## Implementation Scope

- Update canonical and mirrored workflow prose, removing agent force-push
  exceptions and defining additive upstream reconciliation.
- Update Finish and stacked-diff guidance that currently directs agents to
  publish rebased history with `--force-with-lease`.
- Add and register the TypeScript force-push guard for both managed agent
  harnesses.
- Add focused behavioral contract coverage for the rules and adversarial hook
  coverage for allowed pushes, every blocked syntax, wrappers, malformed input,
  and discovery/help output.
- Update hook operational documentation and focused-verification commands.

## Constraints and Non-Goals

- Do not install or activate the new hook in the live runtime from this feature
  branch. Prove synchronization only with isolated HOME and runtime roots.
- Do not mutate MR !269 or any Stat branch as part of this change.
- Do not block fetches, merges, conflict resolution, ordinary pushes, or local
  inspection.
- Do not add a repository-local Git hook that would also constrain humans.
- Do not attempt to detect whether conversational wording constitutes an
  exception; there is no agent-side exception.
- Merge, deployment, cleanup, and post-merge live AX synchronization remain
  separately authorized Finish actions.

## Delivery Shape and Risk

Deliver one atomic AI-repository MR containing the plan, policy, hook,
registration, documentation, and tests. The primary risk is an incomplete
command matcher that either misses a force syntax or blocks a normal push.
Mitigate it with table-driven adversarial tests, conservative matching limited
to Git push commands, and explicit allowed-command cases. The fallback is to
remove the registration while retaining the policy; no repository history or
provider state migration is involved.

The implementation footprint is 24 files and about 1,200 changed lines, so it
exceeds the normal 15-file and 1,000-line delivery ceilings. The user explicitly
approved this one-MR exception
after repository discovery showed that the existing startup hook automatically
rebases feature worktrees and the stacked-diff guidance still instructs agents
to rewrite published branches. Splitting policy/enforcement from those runtime
and workflow corrections would leave an intermediate state where automation
rewrites local history and then cannot publish it, or where documented stack
recovery bypasses the new invariant. The repository charter additionally routes
these behavior changes through its canonical lifecycle, skill-eval, and hook-
registration pressure suites. Review the policy, both hook paths, stacked
publication guidance, registration, and behavioral contracts as one effective
change.

## Verification

- Run the focused force-push hook integration suite and workflow contract tests.
- Run hook-registration and isolated runtime synchronization tests covering
  both Codex and Claude.
- Run `writing-skills` against the changed shared rule and skill behavior.
- Commit through the native pre-commit hook, which supplies the complete local
  suite evidence.
- In isolated HOME/runtime roots, synchronize hooks and validate that both
  managed harness registrations point to the new guard without touching the
  live runtime.
- After draft publication, request exact-head Nitro review and complete the
  repository's Standard delivery gates without merging.
