## 1. Plan Artifact Boundary

- [x] 1.1 Extract or reuse shared helpers for safe `.agents/plans/**`
      normalization, primary markdown plan classification, support-sidecar
      classification, fingerprinting, and private workspace path derivation.
- [x] 1.2 Update `plan-review` validation so `artifact_type: plan` accepts
      primary markdown plan docs and rejects support sidecars under
      `.agents/plans/**`.
- [x] 1.3 Preserve `artifact_type: openspec` validation so every
      `.agents/plans/**` path remains invalid in OpenSpec planning diffs.
- [x] 1.4 Add validator coverage for added, modified, deleted, renamed, copied,
      and type-changed support sidecars, including historical sidecars that are
      touched by the current diff.

## 2. Private AX Plan Artifact Storage

- [x] 2.1 Add `pnpm ax plans artifact record --plan <path> --kind <kind>
      --file <path>` as a repo-local target command that keys records to the
      invocation target repo.
- [x] 2.2 Add deterministic identity derivation from `origin` fetch URL or the
      selected artifact-host remote, normalized plan path, plan path hash, plan
      slug, and plan content fingerprint.
- [x] 2.3 Implement recoverable writes for immutable artifact blobs,
      `manifest.json`, revision `metadata.json`, and append-only
      `index.jsonl`.
- [x] 2.4 Add `pnpm ax plans artifact list --plan <path>` to print manifest and
      revision artifact records for the selected plan.
- [x] 2.5 Add tests for duplicate basenames, nested paths, path traversal,
      invalid kinds/extensions, duplicate records, corrupt manifests, truncated
      index rows, and orphan blobs.

## 3. Skill, Prompt, Rule, And CLI Guidance

- [x] 3.1 Update `skills/plan-ready`, `skills/plan-review`, and
      `skills/plan-orchestrator` source instructions plus OpenAI adapter prompts
      to route support artifacts to thread evidence and the private workspace.
- [x] 3.2 Update repo rules that describe `.agents/plans/**` so they
      distinguish primary atomic plan markdown docs from support sidecars.
- [x] 3.3 Update `skills/ax-cli/SKILL.md` so agents can discover and correctly
      use `pnpm ax plans artifact record|list`.
- [ ] 3.4 Update hosted review guidance so MR/PR descriptions use summaries,
      hashes, thread references, or stable correlation IDs and do not expose
      local `~/.ax/plans/...` paths by default.
- [ ] 3.5 Run `writing-skills` review or validation against the changed planning
      and AX CLI skill behavior, then address blocking findings.

## 4. Runtime Refresh And Verification

- [ ] 4.1 Run focused unit tests for plan-review validation and AX CLI plan
      artifact commands.
- [ ] 4.2 Run `pnpm test:unit`.
- [ ] 4.3 Refresh and validate managed skill surfaces for personal and work
      profiles.
- [ ] 4.4 Refresh and validate managed instruction/rule surfaces for personal
      and work profiles.
- [ ] 4.5 Inspect `ax.lock.json` and confirm runtime metadata drift is expected.
- [ ] 4.6 Run `pnpm test` and `git diff --check`.
