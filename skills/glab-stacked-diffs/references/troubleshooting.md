# Stacked Diffs Troubleshooting

Prefer recoverable inspection over destructive reconstruction. Every recovery
keeps the requested MR's incremental boundary and descendant ownership visible.

## Contents

- Amend or rebase conflict
- Wrong diff amended
- Direct Git commit in a managed stack
- Lease rejection or external remote-head change
- No-op or incomplete propagation
- Closed, merged, or missing MR
- Lost changes
- Authentication or repository mismatch

## Amend or Rebase Conflict

**Symptom:** `glab stack amend` stops while rebasing a descendant.

1. Inspect the current rebase and branch.
2. Abort the descendant rebase.
3. Verify every descendant ref still matches its captured preflight tip.
4. Inspect the amended source branch independently.
5. If the selected entry was already published, publish only that source
   branch with its exact-SHA lease and leave descendants untouched.

```bash
git status
```

```bash
git rebase --abort
```

If the conflict reveals a changed contract or ambiguous ownership, stop and
return to Plan. During initial unpublished construction, a deliberate full
local restack may instead resolve and continue the rebase before any MR exists.
Destructive reset is not the default recovery.

## Wrong Diff Amended

**Before publication:**

1. Inspect `git reflog` and the managed stack positions.
2. Create an explicit recovery branch at the valuable amended tip.
3. Return the wrong diff to its known pre-amend state through a recoverable
   operation.
4. Navigate to and verify the correct diff.
5. Restage the intended patch and use a native hook-enabled amendment for a
   published non-tip MR, or `glab stack amend` only for an unpublished entry or
   the stack tip.
6. Compare both incremental diffs before publication.

**After publication:**

1. Capture the live heads for the wrong MR and every descendant.
2. Remove the misplaced change from its owning incremental diff with a normal
   staged amendment.
3. Publish and verify only that MR source branch.
4. Add the change to the correct MR, amend, and publish only that source branch.

Do not move the patch between several local branches and defer one large
publication wave; that recreates the opaque boundary problem.

## Direct Git Commit in a Managed Stack

**Symptom:** valuable work was committed with ordinary `git commit`, and its
relationship to the managed diff is unknown.

Run these observations before rewriting:

```bash
git status --short
```

```bash
git branch --show-current
```

```bash
git rev-parse HEAD
```

```bash
git reflog -n 20
```

```bash
glab stack list
```

```bash
git branch -vv
```

Resolve the current MR and record descendant remote heads. Preserve each
valuable tip with an explicit recovery branch. Then decide:

- The patch belongs in the current MR: return it recoverably to the index or
  work tree and use a native hook-enabled amendment when it is a published
  non-tip MR; use `glab stack amend` only before publication or at the tip.
- The patch is a new reviewable unit after the current MR, the current entry is
  the last stack entry, and the new unit belongs at the tip: return it
  recoverably and run `glab stack save`.
- The patch would need a new unit after a middle entry: preserve it and return
  to Plan because version 1.108 `stack save` would append it to the tip.
- The topology or intended owner is ambiguous: freeze writes and return to
  Plan with the inspected evidence.

Compare the resulting tree with the preserved direct-commit tip and inspect all
incremental descendant diffs before progressive publication. Never force-push
the ordinary commit or rebuild the full stack merely to satisfy the deadline.

## Lease Rejection or External Remote-Head Change

**Symptom:** an exact-leased MR source push is rejected, or the remote source
SHA no longer matches the preflight value.

Stop. Fetch the branch, inspect the external commits and hosted artifact, and
re-establish sole-writer ownership. Do not retry by accepting the new remote SHA
blindly. Integrating another writer's work may change substantive ownership and
can require Plan. An exact lease rejection leaves the remote source unchanged.

## No-Op or Incomplete Propagation

**Symptom:** an amendment should have changed the current MR, but its expected
remote head remains unchanged after the leased push.

1. Compare the local managed branches with the captured remote heads.
2. Verify the intended branch was actually amended.
3. Confirm the pushed source ref names its intended local managed branch.
4. Verify descendant source heads were not changed.
5. Diagnose before another publication attempt.

An exit code of zero is insufficient. Publication succeeds only when the live
MR source head reflects the expected substantive update and descendants remain
untouched.

## Closed, Merged, or Missing MR

`glab stack sync` may create a non-draft MR for a branch without one and may
remove entries whose MRs are merged. Therefore:

- create each coherent real-diff draft sequentially through
  `change-request-create`;
- publish only the substantive MR source branch while its predecessor remains
  open;
- stop if an expected MR is closed, merged, or missing;
- after an authorized predecessor merge, follow the predecessor-merge workflow
  rather than ordinary feedback amendment; and
- never close duplicates or recreate MRs without provider-write authority.

## Lost Changes

Use `git reflog`, `git show <sha>`, and explicit recovery branches to locate and
preserve lost work. Inspect every stack entry because an automatic rebase may
have moved the patch to a different commit identity.

Do not cherry-pick directly into a managed stack entry. Recover the patch into
the index or work tree after identifying its current incremental owner. Use a
native hook-enabled amendment for a published non-tip MR so descendant refs
stay untouched; use `glab stack amend` only before publication or at the stack
tip. Use `glab stack save` only when the current entry is
last and the patch belongs in a new tip diff; otherwise preserve it and return
to Plan.

## Authentication or Repository Mismatch

```bash
glab auth status
```

```bash
git remote -v
```

```bash
glab repo view
```

Resolve the intended GitLab host and repository before mutation. Authentication
or repository ambiguity blocks provider writes; do not rewrite remotes as an
automatic troubleshooting step.
