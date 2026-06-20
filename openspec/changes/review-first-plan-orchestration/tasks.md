## 1. Contract Foundation

- [ ] 1.1 Extract shared planning-contract helpers for fenced YAML extraction, scalar/list/map parsing, legacy input rejection, `plan_delivery_handoff`, `plan_review_request`, and `planning_review` validation without changing skill behavior.
- [ ] 1.2 Update `AGENTS.md`, `instructions/AGENTS.md`, and `rules/feature-delivery.md` so review-first plan workflows are an explicit hosted-review exception to ordinary direct-publish guidance.

## 2. Review And Sequencing Rename

- [ ] 2.1 Rename `plan-to-review` to `plan-review`, update folder/script/test/adapter metadata, and make the skill emit a validated `planning_review` handoff.
- [ ] 2.2 Atomically move current `plan-orchestrator` sequencing responsibilities to `plan-unit-sequencer` and create the new top-level `plan-orchestrator` entrypoint.

## 3. Workflow Integration

- [ ] 3.1 Add OpenSpec proposal automation to the top-level `plan-orchestrator` through the configured OpenSpec propose entrypoint and strict validation.
- [ ] 3.2 Align `plan-ready` and `plan-unit-delivery` contracts with review-first delivery and separate planning versus implementation artifacts.

## 4. Runtime Cleanup

- [ ] 4.1 Update `agent-runtime` skill installation to prune stale installed old-name skill directories or symlinks after plan skill renames.
- [ ] 4.2 Refresh personal and work runtime profiles, validate installed surfaces, and prove stale retired skill names are absent from repo and installed runtime surfaces.
