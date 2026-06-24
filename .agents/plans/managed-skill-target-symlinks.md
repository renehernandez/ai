# Managed Skill Target Symlinks

## Goal

Make AX install and update managed skills into `~/.agents/skills`, then expose
each managed skill to Codex and Claude through per-skill symlinks in their
configured target skill roots.

The first observable outcome is that `pnpm ax skills update --profile personal`
or `pnpm ax skills update --profile work` leaves every AX-managed skill with:

```text
~/.codex/skills/<skill-name>  -> ~/.agents/skills/<skill-name>
~/.claude/skills/<skill-name> -> ~/.agents/skills/<skill-name>
```

## Motivation

AX already treats `~/.agents/skills` as the canonical shared managed-skill
root. Local Codex runtime state may already contain individual skill links back
to `~/.agents/skills`, but `ax.config.json` currently configures only Claude's
skill root as an AX-managed target. Claude currently uses a root symlink from
`~/.claude/skills` to `~/.agents/skills`.

The desired model is consistent per-skill linking for both Codex and Claude.
That keeps target roots free to contain runtime-owned entries while AX only
reasons about the managed skills selected from `ax.config.json`.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Managed skill | A skill selected by AX profile/block configuration and installed into the canonical skill root. |
| Canonical skill root | The real managed install directory, currently `~/.agents/skills`. |
| Target skill root | A runtime-visible directory such as `~/.codex/skills` or `~/.claude/skills` that should contain per-skill symlinks for managed skills. |
| Root symlink mode | A target skill root, such as `~/.claude/skills`, symlinked wholesale to the canonical root. |
| Per-skill symlink mode | A real target skill root containing one symlink per managed skill. |

## Scope

### In Scope

- Configure AX skill targets for both `~/.codex/skills` and
  `~/.claude/skills`.
- Preserve `~/.agents/skills` as the canonical managed skill root.
- Normalize target roots into per-skill symlink mode during install/update.
- Convert a target root that is currently a symlink to the canonical root into a
  real directory before creating per-skill symlinks.
- Keep status output focused on configured managed skills and their target
  symlinks.
- Keep validation/install/update behavior safe when an exact managed target
  path is blocked by a non-symlink file or directory.
- Keep retired managed skill pruning scoped to exact managed or retired skill
  names in each configured target root.
- Add regression coverage for both Codex and Claude target roots.

### Out Of Scope

- Managing plugin-provided skills from the Codex plugin cache.
- Inventorying or classifying unmanaged entries in target skill roots.
- Moving, preserving, or special-casing runtime-owned target-root contents that
  do not collide with a managed skill name.
- Replacing target skill roots with root symlinks.
- Redesigning AX profile selection, lockfile shape, or remote skill caching.

## Desired Behavior

AX should derive the managed skill set from the selected profiles exactly as it
does today. For each managed skill, AX should ensure the canonical skill
directory exists and then create or update per-skill symlinks in every
configured target root.

If a configured target root is missing, AX should create it. If it is already a
real directory, AX should leave unrelated entries alone. If it is a symlink to
the canonical root, AX should back up the symlink, replace it with a real
directory, and then create per-skill symlinks inside that directory.

If an exact managed skill target path already exists as a non-symlink file or
directory, AX should refuse to replace it and report the collision. That keeps
manual/runtime-owned entries safe when they share a managed skill name.

## Atomic Implementation Unit

Update the AX managed-skill install/update path so both configured target skill
roots are normalized into per-skill symlink mode and only configured managed
skill names are linked, reported, or pruned.

The unit includes the config change, target-root normalization, safe per-skill
link replacement, scoped status/prune behavior, and the related regression and
documentation updates needed for that behavior to be trusted in the same
delivery.

## Acceptance Criteria

- `ax.config.json` keeps `runtime.canonicalSkillsDir` at `~/.agents/skills` and
  configures both `~/.codex/skills` and `~/.claude/skills` as skill targets.
- `skills install`, `skills update`, and top-level install/update flows that
  delegate to skills normalize configured target roots before managed skill
  links are installed.
- A configured target root that is a symlink to the canonical skill root is
  backed up, replaced by a real directory, and populated with per-skill symlinks
  without removing canonical `~/.agents/skills` contents.
- The backup proof for root-symlink migration records the original symlink
  target so the prior state is recoverable.
- Existing real target directories keep unrelated entries that do not collide
  with configured managed skill names.
- Exact managed skill target paths that already exist as non-symlink files or
  directories are refused rather than overwritten.
- Status output reports each configured target symlink for each managed skill
  and stays scoped to configured managed skill names.
- Retired managed skill pruning remains limited to retired managed skill names
  under the canonical and configured target roots.
- AX-facing docs or rules that describe managed skill roots are updated if they
  imply a single target root or root symlink mode.
- The implementation explicitly decides whether live runtime refresh is part of
  the delivery; if it is, both `personal` and `work` skill profiles are
  refreshed and status is checked after refresh.

## Verification

Minimum verification for the delivery slice:

```bash
pnpm test:integration -- tests/integration/ax-cli.test.ts
pnpm ax skills validate --profile personal
pnpm ax skills validate --profile work
pnpm ax skills status --profile personal
pnpm ax skills status --profile work
```

When live runtime refresh is part of delivery, also run:

```bash
pnpm ax skills update --profile personal
pnpm ax skills update --profile work
pnpm ax skills status --profile personal
pnpm ax skills status --profile work
```

The status output should show managed skill paths under `~/.agents/skills` and
healthy symlink targets under both `~/.codex/skills/<skill-name>` and
`~/.claude/skills/<skill-name>`.

Regression coverage must prove:

- install/update creates per-skill symlinks in both configured target roots;
- migration from target-root symlink mode creates a real target directory with
  per-skill links;
- migration backup captures the original root symlink target;
- canonical `~/.agents/skills` contents survive target-root migration;
- exact managed target-path collisions are refused for both configured target
  roots;
- retired managed skill pruning covers both configured target roots;
- reusable script target assertions cover both Codex and Claude sibling script
  roots when the fixture derives script roots from skill targets.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Claude root symlink migration accidentally overwrites content | Only auto-convert symlink roots; refuse unsafe non-directory roots and back up replaced symlinks. |
| AX starts managing plugin or runtime-owned skills | Derive scope only from selected AX-managed skill names. |
| Unmanaged entries in target roots distract status output | Status reports configured managed skills only. |
| Per-skill collision overwrites user/runtime content | Refuse non-symlink exact managed target paths. |
| Config-only change leaves behavior untested | Add integration coverage for Codex and Claude targets plus root-symlink migration. |

## Recommended First Slice

Deliver this as one atomic AX runtime-maintenance change. The implementation
unit is complete only when the config, normalization behavior, safe collision
handling, scoped status/prune behavior, documentation alignment, and regression
proof all land together.

This produces one system outcome: AX-managed skills are consistently installed
once under `~/.agents/skills` and exposed to Codex and Claude through per-skill
target symlinks.
