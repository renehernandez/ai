## Context

`ax` currently manages shared skills, generated agents, and
installed instruction files. OpenSpec assets have a different lifecycle:
`openspec init . --tools codex,claude` generates repo-local skills and commands
inside the repository that is adopting OpenSpec.

The generated Codex and Claude OpenSpec skill directories are byte-identical,
while the generated `opsx` command files are Claude-specific. This creates a
small but real drift risk if both harness skill copies are checked in as
independent files. The desired repo shape keeps OpenSpec assets local to the
repo while making one local `.agents` copy canonical.

## Goals / Non-Goals

**Goals:**

- Add an `openspec` scope to `ax` with `install`, `update`,
  `validate`, and `status`.
- Use OpenSpec's own generator as the source for repo-local assets.
- Normalize generated OpenSpec skills into `.agents/skills`.
- Normalize generated Claude commands into `.agents/commands`.
- Replace harness-local generated copies with relative symlinks.
- Provide validation and status output that make drift visible.

**Non-Goals:**

- Install OpenSpec-generated skills into global `~/.agents/skills`.
- Move OpenSpec-generated skills into the shared repo `skills/` folder.
- Create or require `.codex/commands`.
- Automatically install or update the global `@fission-ai/openspec` package.
- Add multi-repo traversal.
- Add runtime backup or restore behavior.

## Decisions

### Use OpenSpec as the Generator

`ax openspec install` should invoke
`openspec init . --tools codex,claude`. `ax openspec update` should
invoke `openspec update .` for initialized repos and fall back to install
behavior when the repo is missing OpenSpec scaffolding.

Alternative considered: reimplement OpenSpec template generation inside
`ax`. That would couple this repo to OpenSpec internals and drift
from upstream generated content.

### Normalize After Generation

The runtime should treat `.codex/skills`, `.claude/skills`, and
`.claude/commands` as generator outputs. After generation, it should copy or
move one generated skill copy to `.agents/skills/openspec-*`, copy or move
Claude commands to `.agents/commands/opsx`, then replace generated harness
copies with relative symlinks.

Alternative considered: leave duplicate generated files as-is. That is simpler,
but it allows Codex and Claude OpenSpec skills to diverge in the same repo.

### Keep the Scope Repo-Local

The `openspec` scope should operate on the current working repository by
default. The runtime config can declare defaults for tools, canonical paths,
skill targets, and command targets, but v1 does not need a `--path` option or
multi-repo traversal.

Alternative considered: manage OpenSpec globally through `~/.agents`. That does
not fit OpenSpec's per-repo scaffolding model.

### Require an Existing OpenSpec CLI

The runtime should check that `openspec` is available and fail with
`npm install -g @fission-ai/openspec@latest` when it is missing. It should not
install or update the global npm package automatically in this slice.

Alternative considered: automatically install or update the global CLI. That
touches user-level global state and belongs with the separate runtime backup
plan.

## Risks / Trade-offs

- OpenSpec generator output may change -> discover generated `openspec-*`
  assets and normalize by path pattern rather than assuming every file forever.
- Relative symlinks can be miscalculated from nested directories -> test actual
  symlink resolution for skills and commands.
- Re-running the OpenSpec generator could replace symlinks with real files ->
  always normalize after generation and make `validate` fail on duplicated real
  generated assets.
- Missing global OpenSpec CLI blocks setup -> print the exact npm install
  command rather than trying to install it implicitly.
