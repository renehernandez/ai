## 1. State Classification And Command Boundaries

- [ ] 1.1 Add `OpenSpecStateReport` and `inspectOpenSpecState` so `install`, `update`, `status`, and `validate` share missing, configured, and partial setup classification.
- [ ] 1.2 Enforce command boundaries so `install` only runs for missing state, configured projects use `update`, and partial state reports path-level repair findings.

## 2. Guided Install Setup

- [ ] 2.1 Add bounded project-signal collection and first-time default inference for tools, schema, OpenSpec profile, delivery, workflows, context, and artifact rules.
- [ ] 2.2 Add interactive install review plus headless `--accept-inferred-config` handling before writing `openspec/config.yaml`.
- [ ] 2.3 Run upstream OpenSpec generation with isolated deterministic profile, delivery, and workflow inputs, then preserve confirmed repo-local config and normalize generated assets.

## 3. Configured-Project Update Reconciliation

- [ ] 3.1 Keep normal `agent-runtime openspec update` asset-focused and quiet unless generated assets need refresh or validation reports drift.
- [ ] 3.2 Add `update --review-config` config review with preserve-by-default merges and headless `--accept-config-changes` behavior.

## 4. Validation, Tests, And Docs

- [ ] 4.1 Extend `agent-runtime openspec validate` for repo-local config quality, resolved generated-asset targets, and symlink normalization drift.
- [ ] 4.2 Add focused tests with an argv/env-recording fake OpenSpec CLI and injectable prompt responses.
- [ ] 4.3 Update runtime docs, command help, and agent-facing instructions for the first-time install and configured-project update lifecycle.
