## 1. Global Runtime Entrypoint

- [x] 1.1 Add globally linked `agent-runtime` packaging and central source/config/target root resolution.
- [x] 1.2 Add read-only top-level `agent-runtime status` for global runtime installation health, managed runtime surfaces, reusable scripts, hooks, and target OpenSpec readiness.

## 2. State Classification And Command Boundaries

- [x] 2.1 Add `OpenSpecStateReport` and `inspectOpenSpecState` so `install`, `update`, `status`, and `validate` share missing, configured, and partial setup classification before backup or mutation.
- [x] 2.2 Enforce command boundaries so `install` only runs for missing state, configured projects use `update`, partial state reports path-level repair findings, and `update` refuses missing state.

## 3. Guided Install Setup

- [ ] 3.1 Add first-time default inference and confirmed config creation for tools, schema, OpenSpec profile, delivery, workflows, context, and artifact rules.
- [ ] 3.2 Add guided install preview plus headless `--context-file` handling before writing `openspec/config.yaml`; do not support `--accept-inferred-config`.
- [ ] 3.3 Run upstream OpenSpec generation with isolated deterministic profile, delivery, and workflow inputs, then preserve confirmed repo-local config and normalize generated assets with repairable rollback behavior.

## 4. Context Inference And Update Reconciliation

- [ ] 4.1 Add bounded project-signal collection for concise context and artifact-rule inference, ignoring secrets, caches, generated assets, logs, archives, runtime state, and lockfile bodies.
- [ ] 4.2 Keep normal `agent-runtime openspec update` asset-focused and quiet unless generated assets need refresh or validation reports drift.
- [ ] 4.3 Add `update --review-config` config review with preserve-by-default merges and headless `--accept-config-changes` behavior.

## 5. Validation, Tests, And Docs

- [ ] 5.1 Extend `agent-runtime openspec validate` for repo-local config quality, resolved generated-asset targets, reusable runtime scripts, and symlink normalization drift.
- [ ] 5.2 Add focused tests with an argv/env-recording fake OpenSpec CLI, linked-bin/root-resolution fixtures, context-file install input, and partial-state preservation fixtures.
- [ ] 5.3 Update CLI help, runtime docs, `AGENTS.md`, and `skills/agent-runtime-cli/SKILL.md` for global CLI usage, root semantics, first-time install, configured-project update, and installed-surface refresh expectations.
