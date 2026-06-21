## 1. Shared Contracts

- [ ] 1.1 Replace planning-review mode validation, templates, fixtures, and
      tests with `mode: stacked_delivery` and `gate_outcome: ready_for_stack`.
- [ ] 1.2 Reject `ship_then_continue`, `stack_when_ready`, and orchestrated
      `direct_publish` paths with explicit legacy or unsupported-route errors.
- [ ] 1.3 Add stack identity fields to planning and delivery contracts:
      expected base ref/SHA, predecessor artifact, selected task base SHA,
      implementation artifact URL, implementation head SHA, and restack
      evidence.

## 2. Nitro Feedback Gate

- [ ] 2.1 Add a shared `nitro_feedback_gate` template and validator covering
      request evidence, start acknowledgement, completion status, stale
      feedback, actionable findings, non-actionable rationale, and gate outcome.
- [ ] 2.2 Normalize `nitro-review-feedback` statuses into the shared gate:
      `pending`, `no issues`, `findings`, `unavailable`, and `stale`.
- [ ] 2.3 Add the 10-minute review-start acknowledgement timeout, 1-minute poll
      interval, and resumable `nitro_review_completion_pending` state.
- [ ] 2.4 Update review routing so required Nitro feedback supports only
      Fullscript GitLab MRs and returns `nitro_route_unsupported` for GitHub,
      non-Fullscript GitLab, and ambiguous routes.

## 3. Rule And Skill Alignment

- [ ] 3.1 Update `AGENTS.md`, `instructions/AGENTS.md`, and
      `rules/feature-delivery.md` so `plan-orchestrator` stacked delivery is an
      explicit exception to ordinary direct-main publication.
- [ ] 3.2 Update `plan-ready` docs, scripts, adapter prompt, and tests so
      orchestrated plan delivery does not emit or accept `direct_publish`.
- [ ] 3.3 Update `plan-review`, `review-feedback-routing`, and hosted-review
      adapter prompts so the first cut is Nitro-capable Fullscript GitLab only.

## 4. Planning Review Stack Base

- [ ] 4.1 Update `plan-review` docs, script templates, validators, adapter
      prompt, and tests to emit `planning_review.mode: stacked_delivery`.
- [ ] 4.2 Require a clean latest-head `nitro_feedback_gate` before
      `plan-review` emits `planning_review`.
- [ ] 4.3 Include stack base ref/SHA and Nitro-clean stack-base evidence in the
      reviewed planning handoff.

## 5. Orchestrator Resume And Completion

- [ ] 5.1 Update `plan-orchestrator` docs, script helpers, adapter prompt, and
      tests for ready plan, OpenSpec blueprint, existing OpenSpec, and
      continue/resume intake paths.
- [ ] 5.2 Add resume inspection for planning MR, implementation stack order,
      current stack tip, every MR head SHA, every MR Nitro gate state,
      `tasks.md` state, and restack requirements.
- [ ] 5.3 Report `stack_ready` only after the planning MR and every
      implementation MR in stack order have clean latest-head Nitro gates and
      stack integrity evidence.

## 6. Sequencer And Unit Delivery

- [ ] 6.1 Update `plan-unit-sequencer` docs, script helpers, adapter prompt,
      and tests so OpenSpec task selection always advances from current
      stack-tip state.
- [ ] 6.2 Update `plan-unit-delivery` docs, script helpers, adapter prompt, and
      tests so one atomic plan or one OpenSpec deliverable task maps to one
      stacked implementation MR.
- [ ] 6.3 Require `plan-unit-delivery` to request fresh Nitro feedback after
      every material head-changing push and pass the shared Nitro gate before
      reporting unit success.
- [ ] 6.4 Require restacked descendants to rerun the full Nitro gate before
      `stack_ready`.

## 7. Runtime Refresh

- [ ] 7.1 Run `writing-skills` against changed shared agent and skill behavior.
- [ ] 7.2 Run unit and integration tests for planning scripts and runtime
      behavior.
- [ ] 7.3 Refresh personal and work runtime skills, then run skills
      status/validate for both profiles.
- [ ] 7.4 If installed instructions changed, run instructions status/validate
      for both profiles.
- [ ] 7.5 Validate repo-local OpenSpec scaffolding and strict validation for
      this change.
