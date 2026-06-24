## Context

`merge-followthrough` is a shared workflow skill, not a provider adapter. Its
job is to decide how an agent should continue an already identified PR/MR or
stack workflow using the host tools and repo rules available in the current
project.

The current skill describes several finish actions but keeps merge permission
separate from the skill invocation. That makes status-only behavior too easy in
the exact case where the user asked for follow-through. The new contract should
make the invocation decisive while preserving explicit check-only wording and
guardrails for destructive actions.

This repo installs shared skills into runtime profiles, so source edits are not
live until profile update/status/validation prove the installed surface changed.

## Goals / Non-Goals

**Goals:**

- Make `$merge-followthrough` finish one active MR/PR by default unless
  check-only wording is present.
- Support explicitly targeted stacks with current-state validation and
  bottom-to-top merge order.
- Make branch cleanup a guarded default finish step.
- Require default-branch CI graph success after merge before reporting done.
- Allow high-confidence fix-forward MR/PR creation after branch-caused
  post-merge failure while never auto-merging the fix-forward artifact.
- Prove the skill behavior with focused tests and `writing-skills` RED/GREEN
  pressure scenarios before runtime refresh.

**Non-Goals:**

- Build a provider-neutral stack manager or merge-queue adapter.
- Change `plan-orchestrator`, `plan-unit-sequencer`, or stack-ready semantics.
- Make deployment verification a default finish requirement.
- Automatically merge fix-forward artifacts.

## Decisions

### Finish Mode Is The Default For Active Artifacts

Invoking `$merge-followthrough` for one active MR/PR is explicit permission to
finish that artifact. The skill should not require a second "merge it" prompt
after it proves the artifact is green and mergeable. Check-only wording has
higher precedence, so "watch checks", "inspect", "report status", "update
only", "see where this is", or "do not merge yet" prevent merge/queue.

Alternative considered: require a literal merge verb every time. That preserves
conservatism but repeats the current failure mode, where the skill can inspect
and stop at ready-to-merge despite being invoked for follow-through.

### Stack-Wide Permission Requires Fresh Evidence

Single-artifact finish mode must not widen into an implicit stack. Stack-wide
merge requires explicit stack/all wording or freshly validated stack-ready
workflow evidence. The agent must prove current MR/PR IDs, head SHAs, source
and target branches, open/non-draft state, required reviews, required CI graph,
and intended order before merging a stack.

Alternative considered: merge every related artifact discovered from host
metadata. That is too broad because relationship discovery can be stale,
ambiguous, or based on branches that still need retargeting.

### Cleanup Runs Only After Hosted And Local Safety Checks

Branch cleanup is part of finish mode, but it must be guarded. Local checks
alone are not enough: the branch might still be source or target/base for
another open MR/PR, especially in a stack. Cleanup should defer or report a
blocker when hosted dependencies still reference the branch.

### Default-Branch CI Graph Replaces Deployment As The Default Proof

The default finish proof is successful required CI on the default branch for
the merge commit or resulting default-branch head. The proof includes child or
downstream pipelines when the host exposes them as required. Deployment checks
remain explicit-only or repo-required-only.

Alternative considered: keep deployment verification in the default workflow.
That overstates the normal requirement for this skill and makes "done" depend
on environments that may not exist for the repo.

### Fix-Forward Creation Is Narrow And Never Self-Merging

Finish mode authorizes fix-forward MR/PR creation only after a post-merge
default-branch CI failure is evidence-backed branch-caused and both diagnosis
and fix confidence are above 0.90. The fix-forward artifact uses the repo's
normal commit and hosted-review route, including `ax commit` and Nitro where
applicable. The skill must never merge the fix-forward artifact automatically.

Alternative considered: investigate and always ask before authoring a fix. That
is safer but misses the requested behavior for high-confidence fix-forward
proposal. The threshold and no-auto-merge boundary keep the action bounded.

### Behavioral Tests And Writing-Skills Pressure Are Required

Structural skill validation cannot prove finish/check-only, stack, cleanup,
default-branch CI, or fix-forward semantics. Implementation should add a
focused unit test for the skill contract and run `writing-skills` RED/GREEN
pressure scenarios before runtime refresh.

## Risks / Trade-offs

- Accidental merge when the user wanted status only -> Check-only examples are
  explicit, higher precedence, and covered by tests.
- Unexpected stack widening -> Stack-wide permission requires explicit wording
  or freshly validated stack-ready evidence.
- Branch cleanup breaks downstream artifacts -> Cleanup checks hosted source
  and target/base references before deletion.
- Default-branch failures compound through a stack -> Later stack items stop
  after failed, blocked, or missing default-branch CI graph.
- Fix-forward bypasses review -> Fix-forward artifacts request normal review
  gates and Nitro where applicable, and are never merged automatically.
- Runtime copies stay stale -> Runtime update/status/validation is an
  activation gate after source changes.
