# Project-local layout

## Select the canonical location

Prefer `.agents/skills/verify-<app>/` when the repository already uses
`.agents` as its canonical agentic layout. Evidence can include repository
instructions, existing canonical skills or commands, or explicit configuration;
an unrelated empty directory is not enough.

If the repository has another clearly canonical project-local skill root, use
that root and preserve its conventions. When no canonical location is
discoverable, stop and report the unresolved choice instead of inventing one.

Do not create or repair Codex, Claude, Cursor, or other discovery links. Link
management belongs to the repository's existing agentic setup owner.

## Generated directory

Use a lowercase, hyphenated `verify-<app>` name derived from the actual product
or primary application, not the repository owner or harness.

```text
verify-<app>/
|-- SKILL.md
|-- features/
|   |-- README.md
|   `-- <feature>.md
`-- scripts/                  # only when repo-native commands are insufficient
```

The generated `SKILL.md` names the exact commands, readiness signal, isolation
boundary, stable drive handles, evidence location, and cleanup ownership. Do not
leave placeholders.

## Feature map

`features/README.md` indexes every sibling feature file exactly once. Create one
file for each important user-facing feature found from current routes, commands,
menus, or documentation; do not mirror source modules mechanically.

Each feature file includes:

- `## Sub-features`
- `## How to get to it (user POV)`
- `## Driving it with <harness>`
- `## Gotchas`

The driving section states the observable end state and evidence that proves the
representative user path. Record concrete auth, entitlement, OS, external-state,
or isolation prerequisites rather than assuming them.
