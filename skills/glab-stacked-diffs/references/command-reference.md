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
creation. When a stack reference has no MR URL, sync creates a new MR
unconditionally; it does not discover and attach a draft MR created separately
by source branch. New-stack publication is therefore blocked under this policy
until a tested draft-create-and-attach mechanism exists.

Do not use `stack sync` to publish rewritten branches in an existing stack.
Version 1.108 fetches the remote and then performs one bulk push with an
unqualified lease. That does not bind the push to the remote SHAs captured by
preflight and does not expose predecessor-ordered branch checkpoints.

`stack sync` does not own reviewer-facing description policy. Apply
`change-request-create`, then the selected provider adapter, for description
creation or updates and hosted readback.

### Exact-Leased Publication for an Existing Stack

After `glab stack amend` has rebased the affected local branches, Finish pushes
the complete affected chain in one remote transaction:

```bash
git push --atomic --force-with-lease=refs/heads/<ancestor>:<ancestor-expected-sha> --force-with-lease=refs/heads/<descendant>:<descendant-expected-sha> <selected-GitLab-url> refs/heads/<ancestor>:refs/heads/<ancestor> refs/heads/<descendant>:refs/heads/<descendant>
```

Include one explicit lease and one full refspec for every affected branch. Each
expected SHA is read immediately before the publication wave. The explicit
lease operands make any concurrent remote update reject the transaction instead
of being absorbed by an intervening fetch. `--atomic` guarantees either every
ref updates or none does; if the server lacks atomic capability, Git fails and
the workflow stops without a sequential fallback. After success, read every
live source SHA and target back.

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

Local stack construction may complete after all units are validated. Provider
publication is blocked under `glab` 1.108 because its sync path cannot both
preserve semantic commit subjects and create or attach explicit draft MRs.

### Existing published stack

After each substantive ancestor amendment, atomically push the affected chain
with explicit per-branch expected-SHA leases before beginning the next
substantive MR. Descendant head changes caused only by rebase are propagation,
not new scope. Hosted gates can run concurrently once their corresponding
updated heads are visible.

### Reordered or rebased stack

`glab stack reorder` changes local metadata and retargets hosted MRs, but does
not repair Git ancestry. It is a Finish provider mutation, not an Execute-only
restack tool. A mid-stack insertion or reorder returns to Plan for an explicitly
accepted ancestry repair, exact source-versus-target diff proof, and hosted
retarget sequence. Publish any accepted rewritten chain atomically and refresh
all affected review gates.

## Safety Constraints

- Keep native commit and push hooks enabled.
- Treat a closed or merged MR as a topology change, not an ordinary sync input.
- Do not run sync solely to “see what happens”; inspect its mutation set first.
- Do not use an unqualified force push or unqualified lease for existing-stack
  propagation.
- Bind each published branch to the remote head captured immediately before the
  wave. A mismatch or lease rejection requires inspection.
- Keep MRs draft through technical readiness. Ready, merge, deployment, and
  cleanup stay with explicit terminal authority.
