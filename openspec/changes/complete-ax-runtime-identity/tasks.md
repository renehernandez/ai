## 1. Implementation

- [x] 1.1 Rename live AX runtime defaults
  - Deliverable: Rename tracked default config and lock artifacts, cache root,
    executable env var, and backup target naming while preserving the legacy
    reference policy.
  - Acceptance:
    - `ax.config.json` and `ax.lock.json` replace the old tracked defaults with
      content preservation.
    - `.ax/cache` replaces `.agent-runtime/cache` as the live runtime cache
      root.
    - `AX_EXECUTABLE_PATH` and `ax-lock` replace old live runtime names.
  - Verification:
    - `pnpm test:unit`
    - `pnpm test:integration`
    - `pnpm ax status`
- [ ] 1.2 Add managed AX shim lifecycle
  - Deliverable: Add `pnpm ax shim install|status|uninstall` for
    `~/.local/bin/ax` with managed marker, no-overwrite behavior, PATH
    diagnostics, and safe cleanup rules.
  - Acceptance:
    - `shim install` creates or updates only AX-managed shims.
    - `shim status` reports ownership, executable bit, PATH readiness,
      shadowing, stale targets, and detached-worktree targets.
    - `shim uninstall` removes only AX-managed shims.
  - Verification:
    - `pnpm test:unit`
    - `pnpm test:integration`
    - `pnpm ax shim install`
    - `pnpm ax shim status`
    - `~/.local/bin/ax status`
- [ ] 1.3 Define status health and rooting semantics
  - Deliverable: Extend `ax status` and runtime root resolution for shim health,
    explicit `--config` behavior, target readiness, runtime failures, and
    executable env var precedence.
  - Acceptance:
    - Status exit codes match the OpenSpec status semantics.
    - Default lock and cache roots remain under the AX source root even when
      `--config` points elsewhere.
    - `AX_EXECUTABLE_PATH` wins over `AGENT_RUNTIME_EXECUTABLE_PATH` when both
      are present.
  - Verification:
    - `pnpm test:unit`
    - `pnpm test:integration`
    - `pnpm ax status --all-profiles`
    - `node bin/ax.mjs status`
- [ ] 1.4 Update active AX docs specs and tests
  - Deliverable: Update runtime-facing docs, shared skills, rules,
    instructions, active OpenSpec specs, tests, and legacy-reference audit
    expectations for supported AX naming and the managed-shim path.
  - Acceptance:
    - Active runtime-facing docs and specs describe the managed shim instead of
      `pnpm link` or globally linked package behavior.
    - Remaining non-archive `agent-runtime` references are classified as
      historical or intentional legacy-input coverage.
    - Changed shared skills, rules, or instructions are refreshed and validated
      for personal and work profiles.
  - Verification:
    - `pnpm run biome:check:all`
    - `pnpm test`
    - `pnpm ax validate --all-profiles`
    - `pnpm ax openspec validate`
    - `rg --hidden -n "agent-runtime|AGENT_RUNTIME|\\.agent-runtime|pnpm link|globally linked" . -g '!node_modules' -g '!.git'`
- [ ] 1.5 Align repo delivery guidance with GitLab MR review
  - Deliverable: Update repo-local and shared git/review instructions so
    completed work in this repo routes through GitLab `origin` MRs against
    `main` with Nitro review by default.
  - Acceptance:
    - `AGENTS.md` and `rules/git-and-review.md` no longer describe direct-main
      or GitHub-primary publishing as the normal path.
    - Hosted-review completion evidence includes GitLab MR, pipeline
      inspection, Nitro review request, and latest-head Nitro feedback outcome.
  - Verification:
    - `pnpm ax instructions validate --profile personal`
    - `pnpm ax instructions validate --profile work`
    - `pnpm ax instructions status --profile personal`
    - `pnpm ax instructions status --profile work`
