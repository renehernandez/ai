# Stacked Diffs Command Reference

`glab stack` is experimental. Run the installed command's `--help` before
depending on a flag or side effect. These notes describe the behavior relevant
to safe agent operation; they do not replace live help.

The publication constraints were verified against `glab` 1.108.0 at commit
[`5de20850`](https://gitlab.com/gitlab-org/cli/-/raw/5de20850a43cbcacf3768f846eee3dae06731ef3/internal/commands/stack/sync/stack_sync.go)
and the official [`stack sync` documentation](https://docs.gitlab.com/cli/stack/sync/).
Append and reorder behavior was verified against the same commit's
[`stack save`](https://gitlab.com/gitlab-org/cli/-/raw/5de20850a43cbcacf3768f846eee3dae06731ef3/internal/commands/stack/save/stack_save.go)
and
[`stack reorder`](https://gitlab.com/gitlab-org/cli/-/raw/5de20850a43cbcacf3768f846eee3dae06731ef3/internal/commands/stack/reorder/stack_reorder.go)
implementations. Atomic and explicit lease semantics follow the official
[`git push` documentation](https://git-scm.com/docs/git-push).
If the installed implementation changes, revalidate draft creation, MR
attachment, reorder, and push semantics before mutation.

## Contents

- Stack lifecycle
- Navigation and inspection
- Publication behavior
- Safety constraints

## Stack Lifecycle

### `glab stack create`

```bash
glab stack create <stack-name>
```

Creates and activates a stack. Use a descriptive feature name. The command does
not grant permission to publish MRs.

### `glab stack save`

```bash
glab stack save -m "<semantic description>"
```

Saves staged changes as a new managed diff and creates its commit and branch.
Use an imperative semantic description and keep hooks enabled. The description
also becomes the commit subject, so do not encode provider state such as
`Draft:` in it. In `glab` 1.108, save is append-only: even when another stack
entry is selected, the new diff is appended after the current last entry.

Relevant live flags in `glab` 1.108 include:

- `-m`, `--message`, or `-d`, `--description` for the commit description
- `-a`, `--all` for modified and deleted tracked files
- file arguments, including `.`, to stage named paths

Prefer explicit `git add <paths>` followed by `glab stack save` so the staged
boundary is visible before mutation.

### `glab stack amend`

```bash
glab stack amend
```

Amends the current managed diff with staged changes and rebases later diffs.
That local rebase changes descendant commit identities even when their
incremental content is propagation-only.

Use this command only while constructing an unpublished stack or when the
selected entry is the stack tip. For feedback on a published non-tip MR, amend
that source branch directly with a native hook-enabled `git commit --amend`;
leave every descendant ref at its existing commit until predecessor promotion.

Relevant live flags in `glab` 1.108 include:

- `-m`, `--message`, or `-d`, `--description`
- `--reword` to change only the commit message
- `-a`, `--all` and explicit file arguments for staging

Verify the selected branch and matching MR immediately before amendment. Use
separate staging and amendment commands; never bypass commit hooks.

### `glab stack sync` for MR Creation

```bash
glab stack sync
```

The current experimental implementation can:

1. optionally update the base;
2. force-push amended branches with lease protection;
3. rebase later stack entries;
4. create MRs for branches without one; and
5. remove managed entries whose MRs are merged or closed.

Relevant live flags in `glab` 1.108 include:

- `--skip-mr-creation` to prevent implicit MR creation
- `--update-base` to rebase the whole stack onto the latest base
- assignee, reviewer, and label flags for MR creation

Do not use hook-bypass flags. Version 1.108 has no explicit draft option for MR
creation, so `stack sync` is not the publication owner. Create each coherent
real-diff draft sequentially through `change-request-create`, using the normal
base for the root and the immediate predecessor branch for each descendant.

Do not use `stack sync` to publish rewritten branches in an existing stack.
Version 1.108 fetches the remote and then performs one bulk push with an
unqualified lease. That does not bind the push to the remote SHAs captured by
preflight and does not expose predecessor-ordered branch checkpoints.

`stack sync` does not own reviewer-facing description policy. Apply
`change-request-create`, then its selected internal provider mechanics, for description
creation or updates and hosted readback.

### Exact-Leased Publication for an Updated MR

After a tip `glab stack amend` or a direct native amendment of a published
non-tip MR, Finish pushes only the substantive MR source branch:

```bash
git push --force-with-lease=refs/heads/<branch>:<expected-sha> <selected-GitLab-url> refs/heads/<branch>:refs/heads/<branch>
```

Read the expected SHA immediately before publication. The explicit lease makes
any concurrent remote update reject the push instead of being absorbed by an
intervening fetch. Leave every descendant source head untouched while its
predecessor remains open. After success, read the amended MR source SHA back.

## Navigation and Inspection

| Command | Behavior |
| --- | --- |
| `glab stack list` | Lists entries in the active stack |
| `glab stack switch <name>` | Switches to another managed stack |
| `glab stack first` | Moves to the earliest diff |
| `glab stack last` | Moves to the latest diff |
| `glab stack prev` | Moves to the preceding diff |
| `glab stack next` | Moves to the following diff |
| `glab stack move` | Opens the interactive diff selector |
| `glab stack reorder` | Reorders local metadata and retargets hosted MRs; it does not repair Git ancestry |

After every navigation command, run these as separate observations:

```bash
git branch --show-current
```

```bash
glab mr list --source-branch <current-branch>
```

Use `git show HEAD` for the current commit and compare each MR source branch to
its target branch for the incremental diff. A comparison from the stack tip to
the normal base is cumulative and cannot prove MR boundaries.

## Publication Behavior

### New stack

Local stack construction may complete after all units are validated. Publish
each coherent real diff sequentially through `change-request-create`. Never use
an empty placeholder to reserve topology.

### Existing published stack

After each substantive amendment, push only that MR source branch with its
explicit expected-SHA lease. Do not rebase or publish descendants while the
predecessor remains open. Their hosted gates stay provisional until
predecessor promotion reaches them.

### Reordered or rebased stack

`glab stack reorder` changes local metadata and retargets hosted MRs, but does
not repair Git ancestry. It is a Finish provider mutation, not an Execute-only
restack tool. A mid-stack insertion or reorder returns to Plan for an explicitly
accepted ancestry repair, exact source-versus-target diff proof, and hosted
retarget sequence. Do not publish a rewritten descendant chain while a
predecessor remains open.

## Safety Constraints

- Keep native commit and push hooks enabled.
- Treat a closed or merged MR as a topology change, not an ordinary sync input.
- Do not run sync solely to “see what happens”; inspect its mutation set first.
- Do not use an unqualified force push or unqualified lease for an amended MR.
- Bind each published branch to the remote head captured immediately before the
  wave. A mismatch or lease rejection requires inspection.
- Keep MRs draft through technical readiness. Ready, merge, deployment, and
  cleanup stay with explicit terminal authority.
