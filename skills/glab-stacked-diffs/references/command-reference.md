# Stacked Diffs Command Reference

`glab stack` is experimental. Run the installed command's `--help` before
depending on a flag or side effect. These notes describe the behavior relevant
to safe agent operation; they do not replace live help.

The publication constraints were verified against `glab` 1.108.0 at commit
[`5de20850`](https://gitlab.com/gitlab-org/cli/-/blob/5de20850a43cbcacf3768f846eee3dae06731ef3/internal/commands/stack/sync/stack_sync.go)
and the official [`stack sync` documentation](https://docs.gitlab.com/cli/stack/sync/).
If the installed implementation changes, revalidate draft-title derivation and
push semantics before mutation.

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
glab stack save -m "Draft: <description>"
```

Saves staged changes as a new diff after the current position. It creates a
commit and branch managed by the stack. Use an imperative description and keep
hooks enabled. For a diff that will create a new MR, keep `Draft:` at the start
of the first line: `glab` 1.108 derives the new MR title from this description,
and GitLab recognizes that title as draft by construction.

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

Do not use hook-bypass flags. Before sync creates a missing MR, verify its
managed description begins with `Draft:`, its intended target is correct, and
every already-published branch matches its remote head. After creation, read
every MR back and require draft state before hosted gates begin.

Do not use `stack sync` to publish rewritten branches in an existing stack.
Version 1.108 fetches the remote and then performs one bulk push with an
unqualified lease. That does not bind the push to the remote SHAs captured by
preflight and does not expose predecessor-ordered branch checkpoints.

`stack sync` does not own reviewer-facing description policy. Apply
`change-request-create`, then the selected provider adapter, for description
creation or updates and hosted readback.

### Exact-Leased Publication for an Existing Stack

After `glab stack amend` has rebased the affected local branches, Finish pushes
each existing branch from earliest to latest:

```bash
git push <selected-GitLab-url> refs/heads/<branch>:refs/heads/<branch> --force-with-lease=refs/heads/<branch>:<expected-remote-sha>
```

Run one command per branch. `<expected-remote-sha>` is the value read
immediately before the publication wave. The explicit lease operand makes a
concurrent remote update reject the push instead of being absorbed by an
intervening fetch. After each push, read the live source SHA and target back
before pushing the child.

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
| `glab stack reorder` | Reorders managed diffs and may rebase them |

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

An initial sync may create every planned MR together after the local units are
complete and validated. Each managed description must start with `Draft:`.
Finish then confirms targets, draft states, and descriptions before hosted
gates begin.

### Existing published stack

After each substantive ancestor amendment, push the affected chain immediately
with explicit per-branch expected-SHA leases before beginning the next
substantive MR. Descendant head changes caused only by rebase are propagation,
not new scope. Hosted gates can run concurrently once their corresponding
updated heads are visible.

### Reordered or rebased stack

Reordering and base updates can change every effective diff. Inspect the whole
chain, publish in predecessor order, and refresh all affected review gates.

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
