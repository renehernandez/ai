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
2. Resolve the earliest conflicted descendant.
3. Stage only the resolved files.
4. Continue the rebase.
5. Inspect every later descendant's incremental diff.
6. Publish the repaired chain with one atomic push containing every captured
   exact-SHA lease only after each incremental diff is verified.

```bash
git status
```

```bash
git add <resolved-files>
```

```bash
git rebase --continue
```

If the conflict reveals a changed contract or ambiguous ownership, stop and
return to Plan. Aborting a rebase is recoverable; destructive reset is not the
default recovery.

## Wrong Diff Amended

**Before publication:**

1. Inspect `git reflog` and the managed stack positions.
2. Create an explicit recovery branch at the valuable amended tip.
3. Return the wrong diff to its known pre-amend state through a recoverable
   operation.
4. Navigate to and verify the correct diff.
5. Restage the intended patch and use `glab stack amend`.
6. Compare both incremental diffs before publication.

**After publication:**

1. Capture the live heads for the wrong MR and every descendant.
2. Remove the misplaced change from its owning incremental diff with a normal
   staged amendment.
3. Publish and verify that correction progressively.
4. Add the change to the correct MR, amend, and publish its affected chain.

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
  work tree and run `glab stack amend`.
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

**Symptom:** an atomic exact-leased chain push is rejected, or a remote source
SHA no longer matches the preflight value.

Stop. Fetch the branch, inspect the external commits and hosted artifact, and
re-establish sole-writer ownership. Do not retry by accepting the new remote SHA
blindly. Integrating another writer's work may change substantive ownership and
can require Plan. An exact lease rejection leaves the whole atomic transaction
unchanged. If the server rejects atomic capability, report that blocker and do
not fall back to sequential publication.

## No-Op or Incomplete Propagation

**Symptom:** an amendment should have changed the current MR or descendants,
but an expected remote head remains unchanged after the atomic push.

1. Compare the local managed branches with the captured remote heads.
2. Verify the intended branch was actually amended.
3. Inspect whether descendants were rebased locally.
4. Confirm every pushed source ref names its intended local managed branch.
5. Diagnose before another publication attempt.

An exit code of zero is insufficient. Publication succeeds only when the live
MR heads and target chain reflect the expected substantive and propagation
updates.

## Closed, Merged, or Missing MR

`glab stack sync` may create a non-draft MR for a branch without one and may
remove entries whose MRs are merged. Therefore:

- block new-stack publication under `glab` 1.108 until tested draft creation
  can attach to stack metadata;
- use one atomic multi-ref push with exact leases for a fully published stack;
- stop if an expected MR is closed, merged, or missing;
- after an authorized predecessor merge, follow the predecessor-merge workflow
  rather than ordinary feedback amendment; and
- never close duplicates or recreate MRs without provider-write authority.

## Lost Changes

Use `git reflog`, `git show <sha>`, and explicit recovery branches to locate and
preserve lost work. Inspect every stack entry because an automatic rebase may
have moved the patch to a different commit identity.

Do not cherry-pick directly into a managed stack entry. Recover the patch into
the index or work tree and apply `glab stack amend` after identifying its
current incremental owner. Use `glab stack save` only when the current entry is
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
