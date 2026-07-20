# Stacked Diffs Command Reference

`glab stack` is experimental. Run the installed command's `--help` before
depending on a flag or side effect. These notes describe the behavior relevant
to safe agent operation; they do not replace live help.

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
glab stack save -m "<description>"
```

Saves staged changes as a new diff after the current position. It creates a
commit and branch managed by the stack. Use an imperative description and keep
hooks enabled.

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

### `glab stack sync`

```bash
glab stack sync
```

The current experimental implementation can:

1. optionally update the base;
2. force-push amended branches with lease protection;
3. rebase later stack entries;
4. create MRs for branches without one; and
5. remove managed entries whose MRs are merged or closed.

For a fully published stack whose membership must not expand:

```bash
glab stack sync --skip-mr-creation
```

Relevant live flags in `glab` 1.108 include:

- `--skip-mr-creation` to prevent implicit MR creation
- `--update-base` to rebase the whole stack onto the latest base
- assignee, reviewer, and label flags for MR creation

Do not use hook-bypass flags. Before sync, record all affected remote heads and
inspect MR state. After sync, verify every expected head changed and every MR
kept the intended target and draft state. If a lease is rejected or an expected
head remains unchanged, stop for ownership or propagation diagnosis.

`stack sync` does not own reviewer-facing description policy. Apply
`change-request-create`, then the selected provider adapter, for description
creation or updates and hosted readback.

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
complete and validated. Finish must then confirm targets, draft states, and
descriptions.

### Existing published stack

After each substantive ancestor amendment, sync the affected chain immediately
before beginning the next substantive MR. Descendant head changes caused only
by rebase are propagation, not new scope. Hosted gates can run concurrently
once their corresponding updated heads are visible.

### Reordered or rebased stack

Reordering and base updates can change every effective diff. Inspect the whole
chain, publish in predecessor order, and refresh all affected review gates.

## Safety Constraints

- Keep native commit and push hooks enabled.
- Treat a closed or merged MR as a topology change, not an ordinary sync input.
- Do not run sync solely to “see what happens”; inspect its mutation set first.
- Do not use ordinary force-push as a substitute for stack sync.
- Treat the remote heads captured immediately before sync as exact ownership
  expectations. A mismatch or lease rejection requires inspection.
- Keep MRs draft through technical readiness. Ready, merge, deployment, and
  cleanup stay with explicit terminal authority.
