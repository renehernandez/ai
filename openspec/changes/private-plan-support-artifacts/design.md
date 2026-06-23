## Context

The planning workflow has two different kinds of artifacts that currently share
the `.agents/plans/**` namespace:

- primary atomic plan markdown documents that are durable, reviewable planning
  content;
- support artifacts such as reviewer-selection YAML, handoffs, review requests,
  ledgers, blueprints, validation inputs, and reviewer reports.

Primary plan documents should stay in the repo when a one-off atomic plan needs
review. Support artifacts should remain available for debugging and resume, but
they should not appear as repo history or hosted review content.

This change also needs to work when `ax` is invoked through the managed shim
from another repo. The private workspace must key off the invocation target
repo, not the durable AI repo source root.

## Goals / Non-Goals

**Goals:**

- Preserve `.agents/plans/*.md` as the durable atomic plan document path.
- Reject support sidecars under `.agents/plans/**` before hosted planning
  review.
- Store file-backed support artifacts under `~/.ax/plans/` with deterministic
  repo, plan, revision, and artifact identity.
- Keep local private workspace paths out of hosted MR/PR descriptions by
  default.
- Update skill, prompt, rule, and AX CLI guidance so future agents use the same
  boundary.

**Non-Goals:**

- Migrating already-committed historical sidecars.
- Building rich private workspace search, pruning, or archival UX.
- Archiving every reviewer output when it was never file-backed.
- Changing the hosted review route or replacing OpenSpec for complex plans.

## Decisions

### Store Support Artifacts In A Plan-Scoped Private Workspace

Use the hybrid local structure:

```text
~/.ax/plans/
  index.jsonl
  repos/<repo_key>/plans/<plan_slug>/
    manifest.json
    revisions/sha256-<plan_fingerprint>/
      metadata.json
      artifacts/<kind>.sha256-<artifact_hash>.<ext>
```

The global index is append-only for audit and broad lookup. The manifest is the
current plan-local map. Revision directories contain immutable metadata and
artifact blobs.

Alternative considered: a single global `~/.ax/plans/artifacts/` bucket. That
was simpler for writes but weaker for future plan-scoped debugging and resume.

### Derive Identity From The Target Repo And Safe Plan Path

The `plans artifact` commands must operate on the invocation target root. When
the managed shim is used, the command must preserve
`RuntimeInvocationContext.targetRoot` or an equivalent `process.cwd()` target
path.

`repo_key` comes from the target repo's `origin` fetch URL when available. If
`origin` is absent, use the selected artifact-host remote. If neither exists,
block and ask for the intended repo identity. Do not derive identity from
mirrored push URLs. Canonicalize equivalent remote URL forms before building the
key: lowercase the host, strip protocol-specific prefixes, normalize separators,
and remove a trailing `.git` suffix.

`plan_slug` comes from the plan filename, with a short hash of the
repo-relative plan path when needed to avoid collisions. Store both the
normalized repo-relative plan path and full `plan_path_hash` in metadata so
nested plans or duplicate basenames cannot silently share a workspace.

Plan/support classification is deterministic: normalized `.md` files under
`.agents/plans/**` are primary plan documents only when they do not match a
support naming pattern. Support naming patterns are suffix patterns such as
`*.review-request.*`, `*.reviewer-selection.*`, `*.handoff.*`,
`*.blueprint.*`, `*.ledger.*`, `*.report.*`, `*.validation-input.*`, and
`*.validation-output.*`. YAML, JSON, and JSONL files under `.agents/plans/**`
are support artifacts even when their names do not match those patterns.
Classification does not inspect file contents.

### Keep The First Helper Minimal

The first command family only needs:

```bash
pnpm ax plans artifact record --plan .agents/plans/example.md --kind reviewer_selection --file /tmp/example.yaml
pnpm ax plans artifact list --plan .agents/plans/example.md
```

Record writes one file-backed support artifact and updates the index/manifest.
List prints the current plan workspace records. Correlation search by branch,
thread id, hosted review URL, and richer artifact lifecycle management can be
added later.

### Make Writes Recoverable

Artifact blobs are content-addressed and immutable. Manifest writes use a temp
file plus atomic rename. Append to `index.jsonl` only after blob and manifest
writes succeed. Duplicate records for the same artifact hash are tolerated.
Corrupt manifests, truncated JSONL rows, and orphan blobs produce deterministic
repair guidance instead of silent evidence loss.

### Validate The Boundary Before Hosted Review

`plan-review` validation remains strict for OpenSpec: any `.agents/plans/**`
path in an `artifact_type: openspec` diff is invalid.

For `artifact_type: plan`, primary markdown plan docs are allowed. Support
sidecars are rejected for every touched name-status variant, including added,
modified, deleted, renamed, copied, and type-changed paths.

Path safety checks include realpath/symlink resolution for `--plan` and
`--file`. The `--plan` path must resolve inside the target repo. The `--file`
path may resolve inside the target repo, the runtime operating-system temp
directory, or `~/.ax/plans/inbox/`; it must not resolve inside the private
destination workspace under `~/.ax/plans/repos/`. A symlink that resolves
outside those allowed roots or outside the private workspace for internal
workspace writes is treated as an escape.

### Avoid Hosted Review Leakage

Hosted MR/PR descriptions may include summarized evidence, artifact hashes,
thread references, or stable correlation IDs. They must not include local
`~/.ax/plans/...` paths, raw private evidence, or private thread metadata by
default.

## Risks / Trade-offs

- Historical sidecars remain in the repo and may confuse future agents. Mitigate
  by updating skills/rules to classify them as historical unless touched.
- A prose-only fix could regress. Mitigate with `plan-review` validation and
  focused tests.
- Private workspace records can diverge from thread evidence. Mitigate with
  content hashes, append-only index entries, and manifest metadata.
- Recoverable writes add implementation complexity. Keep the first helper
  narrow and avoid richer search/archive UX in this change.
